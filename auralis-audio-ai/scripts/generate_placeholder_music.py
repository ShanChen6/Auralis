"""Tạo nhạc nền mẫu (không lời, có thể lặp) bằng tổng hợp âm thanh – chỉ dùng để test.

    uv run python scripts/generate_placeholder_music.py

Tạo các file trong assets/music/: piano_rain.mp3, lofi_warm.mp3, acoustic_night.mp3.
Khi có nhạc thật, chỉ cần chép đè file cùng tên.
"""

from pathlib import Path

import numpy as np
from pydub import AudioSegment

SR = 44_100
OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "music"
rng = np.random.default_rng(2026)


def midi(note: int) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def place(track: np.ndarray, sound: np.ndarray, at_s: float, pan: float = 0.0) -> None:
    """Cộng âm thanh mono vào track stereo tại thời điểm at_s (pan -1..1), tự quấn vòng."""
    start = int(at_s * SR) % len(track)
    idx = (start + np.arange(len(sound))) % len(track)  # quấn vòng để vòng lặp liền mạch
    left, right = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
    np.add.at(track[:, 0], idx, sound * left)
    np.add.at(track[:, 1], idx, sound * right)


def piano_note(note: int, seconds: float = 3.5, velocity: float = 0.3) -> np.ndarray:
    t = t_axis(seconds)
    f = midi(note)
    tone = sum((0.6**k) * np.sin(2 * np.pi * f * (k + 1) * t * (1 + 0.0004 * k)) for k in range(5))
    envelope = np.minimum(t / 0.008, 1) * np.exp(-t * 1.6)
    return velocity * tone * envelope


def rhodes_note(note: int, seconds: float, velocity: float = 0.25) -> np.ndarray:
    t = t_axis(seconds)
    f = midi(note)
    tone = np.sin(2 * np.pi * f * t + 0.8 * np.sin(2 * np.pi * f * t) * np.exp(-t * 3))
    tremolo = 1 - 0.25 * (0.5 + 0.5 * np.sin(2 * np.pi * 4.5 * t))
    envelope = np.minimum(t / 0.01, 1) * np.exp(-t * 0.7)
    return velocity * tone * tremolo * envelope


def pluck(note: int, seconds: float = 2.5, velocity: float = 0.35) -> np.ndarray:
    """Karplus–Strong: tiếng gảy dây guitar."""
    period = int(SR / midi(note))
    buffer = rng.uniform(-1, 1, period)
    out = np.empty(int(seconds * SR))
    for i in range(len(out)):
        out[i] = buffer[i % period]
        buffer[i % period] = 0.996 * 0.5 * (buffer[i % period] + buffer[(i + 1) % period])
    return velocity * out


def lowpass(signal: np.ndarray, alpha: float) -> np.ndarray:
    """Bộ lọc thông thấp một cực (alpha nhỏ = tối hơn), xử lý theo khối cho nhanh."""
    out = np.empty_like(signal)
    acc = np.zeros(signal.shape[1:])
    for i in range(len(signal)):
        acc += alpha * (signal[i] - acc)
        out[i] = acc
    return out


def pink_noise(n: int) -> np.ndarray:
    white = rng.standard_normal(n)
    spectrum = np.fft.rfft(white)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    spectrum[1:] /= np.sqrt(freqs[1:])
    noise = np.fft.irfft(spectrum, n)
    return noise / np.max(np.abs(noise))


def chords_progression(track: np.ndarray, chords, bar_s: float, voice) -> None:
    bars = int(len(track) / SR / bar_s)
    for bar in range(bars):
        chord = chords[bar % len(chords)]
        start = bar * bar_s
        voice(track, chord, start, bar_s)


def piano_rain(seconds: float = 48.0) -> np.ndarray:
    track = np.zeros((int(seconds * SR), 2))
    chords = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 65]]
    bar_s = 4.0

    def arpeggio(tr, chord, start, bar):
        pattern = [0, 2, 1, 3, 2, 1, 3, 2]
        for i, step in enumerate(pattern):
            note = chord[step] + (12 if i in (3, 6) else 0)
            pan = -0.4 + 0.8 * (step / 3)
            place(tr, piano_note(note, velocity=0.22 if i else 0.3), start + i * bar / 8, pan)
        place(tr, piano_note(chord[0] - 12, 5.0, 0.25), start)

    chords_progression(track, chords, bar_s, arpeggio)

    # Mưa: nhiễu hồng lọc + giọt nước ngẫu nhiên
    rain = np.stack([pink_noise(len(track)), pink_noise(len(track))], axis=1)
    track += 0.05 * lowpass(rain, 0.35)
    for at in rng.uniform(0, seconds, 900):
        drop = rng.standard_normal(int(0.004 * SR)) * np.exp(-np.arange(int(0.004 * SR)) / 40)
        place(track, 0.03 * drop, at, rng.uniform(-0.9, 0.9))
    return track


def lofi_warm(seconds: float = 48.0) -> np.ndarray:
    track = np.zeros((int(seconds * SR), 2))
    bpm = 80
    beat = 60 / bpm
    bar_s = 4 * beat
    chords = [[50, 57, 60, 65], [43, 50, 53, 59], [48, 55, 59, 64], [45, 52, 55, 60]]

    def comp(tr, chord, start, bar):
        for note in chord:
            place(tr, rhodes_note(note, bar * 0.95), start, rng.uniform(-0.3, 0.3))
        place(tr, rhodes_note(chord[0] - 12, bar * 0.9, 0.35), start)

    chords_progression(track, chords, bar_s, comp)

    kick_t = t_axis(0.35)
    kick = 0.6 * np.sin(2 * np.pi * (45 + 80 * np.exp(-kick_t * 30)) * kick_t) * np.exp(-kick_t * 9)
    hat = rng.standard_normal(int(0.05 * SR))
    hat = 0.06 * np.diff(hat, prepend=0) * np.exp(-np.arange(len(hat)) / 200)
    snare_t = t_axis(0.2)
    snare = 0.18 * rng.standard_normal(len(snare_t)) * np.exp(-snare_t * 18)
    beats = int(seconds / beat)
    for b in range(beats):
        swing = 0.06 * beat if b % 2 else 0
        if b % 4 in (0, 2) or (b % 8 == 7):
            place(track, kick, b * beat)
        if b % 4 in (1, 3):
            place(track, snare, b * beat, 0.1)
        place(track, hat, b * beat, 0.3)
        place(track, 0.6 * hat, b * beat + beat / 2 + swing, 0.3)

    track = lowpass(track, 0.25)  # "ấm" kiểu băng cassette
    crackle = np.zeros_like(track)
    for at in rng.uniform(0, seconds, 400):
        place(crackle, 0.04 * rng.standard_normal(30), at, rng.uniform(-1, 1))
    return track + crackle + 0.004 * np.stack([pink_noise(len(track))] * 2, axis=1)


def acoustic_night(seconds: float = 48.0) -> np.ndarray:
    track = np.zeros((int(seconds * SR), 2))
    chords = [
        [40, 47, 52, 55, 59, 64],
        [45, 52, 57, 60, 64],
        [48, 55, 60, 64, 67],
        [43, 50, 55, 59, 62],
    ]
    bar_s = 3.0

    def fingerpick(tr, chord, start, bar):
        pattern = [0, 2, 3, 4, 3, 2]
        for i, step in enumerate(pattern):
            note = chord[min(step, len(chord) - 1)]
            place(
                tr, pluck(note, velocity=0.3 if i else 0.4), start + i * bar / 6, -0.2 + 0.1 * step
            )

    chords_progression(track, chords, bar_s, fingerpick)
    # Đệm pad rất nhẹ cho không khí đêm
    t = t_axis(seconds)
    pad = 0.02 * (np.sin(2 * np.pi * midi(52) * t) + np.sin(2 * np.pi * midi(59) * t))
    pad *= 0.6 + 0.4 * np.sin(2 * np.pi * t / seconds * 4)
    track += np.stack([pad, pad], axis=1)
    return track


def export(name: str, track: np.ndarray) -> None:
    track = track / np.max(np.abs(track)) * 0.89  # đỉnh khoảng -1dBFS
    pcm = (track * 32767).astype(np.int16)
    segment = AudioSegment(pcm.tobytes(), frame_rate=SR, sample_width=2, channels=2)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{name}.mp3"
    segment.export(path, format="mp3", bitrate="96k", tags={"title": f"{name} (placeholder)"})
    print(f"{path.relative_to(OUT_DIR.parent.parent)}  {len(segment) / 1000:.1f}s")


if __name__ == "__main__":
    for name, build in [
        ("piano_rain", piano_rain),
        ("lofi_warm", lofi_warm),
        ("acoustic_night", acoustic_night),
    ]:
        export(name, build())
