"""Lõi hậu kỳ: Intro nhạc lớn → Auto-ducking khi có giọng → Outro tăng nhạc + fade out."""

import io
from dataclasses import dataclass, field

import numpy as np
from pydub import AudioSegment

from app.tts.synthesizer import ParagraphTiming

SAMPLE_RATE = 44_100
FRAME_MS = 10


@dataclass(frozen=True)
class MixConfig:
    intro_ms: int = 3000
    outro_ms: int = 4000
    #: Mức nhạc nền so với giọng đọc khi không có giọng (intro/outro)
    music_db: float = -6.0
    #: Mức nhạc nền khi MC đang đọc
    ducked_db: float = -18.0
    #: Mức trung bình (RMS) chuẩn hóa cho giọng đọc
    voice_rms_db: float = -16.0
    #: Ngưỡng coi một khung 10ms là "có giọng"
    voice_threshold_db: float = -45.0
    #: Khoảng lặng ngắn hơn mức này vẫn giữ nhạc nhỏ (tránh nhạc "nhấp nhô" giữa các câu)
    hold_ms: int = 1500
    #: Hạ nhạc sớm hơn giọng một chút để câu đầu không bị nhạc lấn
    lookahead_ms: int = 300
    attack_ms: float = 150.0
    release_ms: float = 500.0
    fade_in_ms: int = 600
    fade_out_ms: int = 3000
    loop_crossfade_ms: int = 2000
    peak_dbfs: float = -1.0


@dataclass(frozen=True)
class Timestamp:
    index: int
    start: float
    end: float

    def to_dict(self) -> dict[str, float | int]:
        return {"index": self.index, "start": self.start, "end": self.end}


@dataclass
class RadioMix:
    audio: AudioSegment
    timestamps: list[Timestamp]
    music_id: str | None
    #: Độ lợi nhạc nền theo từng khung 10ms (dB so với giọng) – dùng để kiểm tra/debug
    music_gain_db: np.ndarray = field(repr=False)

    @property
    def duration(self) -> float:
        return round(len(self.audio) / 1000, 3)

    def export_mp3(self, path_or_buffer, bitrate: str = "128k") -> None:
        self.audio.export(path_or_buffer, format="mp3", bitrate=bitrate)

    def to_mp3_bytes(self, bitrate: str = "128k") -> bytes:
        buffer = io.BytesIO()
        self.export_mp3(buffer, bitrate=bitrate)
        return buffer.getvalue()


def to_array(segment: AudioSegment) -> np.ndarray:
    samples = np.array(segment.get_array_of_samples(), dtype=np.float64)
    samples = samples.reshape(-1, segment.channels)
    return samples / float(1 << (8 * segment.sample_width - 1))


def from_array(samples: np.ndarray, frame_rate: int = SAMPLE_RATE) -> AudioSegment:
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype(np.int16)
    return AudioSegment(
        pcm.tobytes(), frame_rate=frame_rate, sample_width=2, channels=samples.shape[1]
    )


def db_to_gain(db: float | np.ndarray) -> float | np.ndarray:
    return 10 ** (np.asarray(db) / 20)


def frame_db(mono: np.ndarray, frame: int) -> np.ndarray:
    count = int(np.ceil(len(mono) / frame))
    padded = np.zeros(count * frame)
    padded[: len(mono)] = mono
    rms = np.sqrt(np.mean(padded.reshape(count, frame) ** 2, axis=1))
    return 20 * np.log10(np.maximum(rms, 1e-9))


def active_rms_db(mono: np.ndarray, frame: int, threshold_db: float) -> float:
    levels = frame_db(mono, frame)
    active = levels[levels > threshold_db]
    if active.size == 0:
        return float(levels.max())
    return float(20 * np.log10(np.sqrt(np.mean(db_to_gain(active) ** 2))))


class RadioMixer:
    def __init__(self, config: MixConfig | None = None) -> None:
        self.config = config or MixConfig()

    def mix(
        self,
        voice: AudioSegment,
        paragraphs: list[ParagraphTiming],
        music: AudioSegment | None,
        *,
        music_id: str | None = None,
    ) -> RadioMix:
        cfg = self.config
        frame = SAMPLE_RATE * FRAME_MS // 1000
        voice_mono = to_array(voice.set_frame_rate(SAMPLE_RATE).set_channels(1))[:, 0]
        voice_mono = self._normalize(voice_mono, frame, cfg.voice_rms_db)

        intro = cfg.intro_ms if music is not None else 0
        outro = cfg.outro_ms if music is not None else 0
        intro_n = intro * SAMPLE_RATE // 1000
        outro_n = outro * SAMPLE_RATE // 1000
        total_n = intro_n + len(voice_mono) + outro_n

        output = np.zeros((total_n, 2))
        output[intro_n : intro_n + len(voice_mono)] += voice_mono[:, None]

        frames = int(np.ceil(total_n / frame))
        gain_db = np.full(frames, -np.inf)
        if music is not None:
            bed = self._prepare_music(music, total_n, frame)
            gain_db = self._ducking_envelope(voice_mono, intro_n, total_n, frame)
            sample_gain = db_to_gain(
                np.interp(np.arange(total_n) / frame, np.arange(frames), gain_db)
            )
            output += bed * (sample_gain * self._fades(total_n))[:, None]

        output = self._limit(output, cfg.peak_dbfs)
        offset_s = intro / 1000
        timestamps = [
            Timestamp(
                p.index,
                round(offset_s + p.start_ms / 1000, 3),
                round(offset_s + p.end_ms / 1000, 3),
            )
            for p in paragraphs
        ]
        return RadioMix(from_array(output), timestamps, music_id, gain_db)

    # --- các bước xử lý ---------------------------------------------------

    def _normalize(self, mono: np.ndarray, frame: int, target_db: float) -> np.ndarray:
        level = active_rms_db(mono, frame, self.config.voice_threshold_db)
        return mono * db_to_gain(target_db - level)

    def _prepare_music(self, music: AudioSegment, total_n: int, frame: int) -> np.ndarray:
        cfg = self.config
        bed = to_array(music.set_frame_rate(SAMPLE_RATE).set_channels(2))
        bed = self._loop(bed, total_n, cfg.loop_crossfade_ms * SAMPLE_RATE // 1000)
        # Chuẩn hóa nhạc về cùng mức RMS với giọng, để -6dB / -18dB là "so với giọng đọc"
        level = active_rms_db(bed.mean(axis=1), frame, -70.0)
        return bed * db_to_gain(cfg.voice_rms_db - level)

    @staticmethod
    def _loop(bed: np.ndarray, total_n: int, crossfade_n: int) -> np.ndarray:
        if len(bed) >= total_n:
            return bed[:total_n]
        crossfade_n = min(crossfade_n, len(bed) // 4)
        fade_in = np.linspace(0, 1, crossfade_n)[:, None]
        out = bed.copy()
        while len(out) < total_n:
            # Nối vòng lặp với crossfade (cân bằng năng lượng) để không nghe thấy chỗ nối
            head = bed[:crossfade_n] * np.sqrt(fade_in)
            tail = out[-crossfade_n:] * np.sqrt(1 - fade_in)
            out = np.concatenate([out[:-crossfade_n], tail + head, bed[crossfade_n:]])
        return out[:total_n]

    def _ducking_envelope(
        self, voice: np.ndarray, intro_n: int, total_n: int, frame: int
    ) -> np.ndarray:
        cfg = self.config
        frames = int(np.ceil(total_n / frame))
        levels = np.full(frames, -120.0)
        voice_levels = frame_db(voice, frame)
        start = intro_n // frame
        levels[start : start + len(voice_levels)] = voice_levels[: frames - start]

        active = levels > cfg.voice_threshold_db
        active = self._fill_gaps(active, cfg.hold_ms // FRAME_MS)
        # Lookahead: bắt đầu hạ nhạc trước khi giọng cất lên
        look = cfg.lookahead_ms // FRAME_MS
        if look:
            shifted = np.zeros_like(active)
            shifted[:-look] = active[look:]
            active |= shifted

        target = np.where(active, cfg.ducked_db, cfg.music_db)
        attack = 1 - np.exp(-FRAME_MS / cfg.attack_ms)
        release = 1 - np.exp(-FRAME_MS / cfg.release_ms)
        envelope = np.empty(frames)
        current = cfg.music_db
        for i, goal in enumerate(target):
            current += (goal - current) * (attack if goal < current else release)
            envelope[i] = current
        return envelope

    @staticmethod
    def _fill_gaps(active: np.ndarray, max_gap: int) -> np.ndarray:
        filled = active.copy()
        indices = np.flatnonzero(active)
        if indices.size < 2:
            return filled
        gaps = np.diff(indices)
        for i in np.flatnonzero((gaps > 1) & (gaps <= max_gap)):
            filled[indices[i] : indices[i + 1]] = True
        return filled

    def _fades(self, total_n: int) -> np.ndarray:
        cfg = self.config
        fades = np.ones(total_n)
        fade_in_n = min(cfg.fade_in_ms * SAMPLE_RATE // 1000, total_n)
        fade_out_n = min(cfg.fade_out_ms * SAMPLE_RATE // 1000, total_n)
        fades[:fade_in_n] *= np.linspace(0, 1, fade_in_n)
        # fade_out dạng cong để tai nghe tắt dần tự nhiên
        fades[total_n - fade_out_n :] *= np.linspace(1, 0, fade_out_n) ** 2
        return fades

    @staticmethod
    def _limit(output: np.ndarray, peak_dbfs: float) -> np.ndarray:
        peak = np.max(np.abs(output))
        ceiling = float(db_to_gain(peak_dbfs))
        return output * (ceiling / peak) if peak > ceiling else output
