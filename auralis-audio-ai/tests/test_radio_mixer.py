import numpy as np
import pytest
from pydub import AudioSegment
from pydub.generators import Sine, WhiteNoise

from app.radio.mixer import MixConfig, RadioMixer, active_rms_db, to_array
from app.tts.synthesizer import ParagraphTiming

CFG = MixConfig()


def speech(*parts: tuple[str, int]) -> AudioSegment:
    """("v", ms) = có giọng (sóng sine), ("s", ms) = im lặng."""
    out = AudioSegment.silent(0, frame_rate=24_000)
    for kind, ms in parts:
        out += (
            Sine(220).to_audio_segment(duration=ms, volume=-12).set_frame_rate(24_000)
            if kind == "v"
            else AudioSegment.silent(ms, frame_rate=24_000)
        )
    return out.set_channels(1)


def music(ms: int = 60_000) -> AudioSegment:
    return WhiteNoise().to_audio_segment(duration=ms, volume=-20).set_channels(2)


def gain_at(mix, seconds: float) -> float:
    return float(mix.music_gain_db[int(seconds * 100)])


def test_layout_intro_voice_outro_and_timestamps() -> None:
    voice = speech(("v", 4000), ("s", 1000), ("v", 3000))
    paragraphs = [ParagraphTiming(0, "a", 0, 4000), ParagraphTiming(1, "b", 5000, 8000)]

    mix = RadioMixer().mix(voice, paragraphs, music(), music_id="piano_rain")

    assert len(mix.audio) == pytest.approx(3000 + 8000 + 4000, abs=1)
    assert mix.duration == pytest.approx(15.0, abs=0.01)
    assert mix.audio.frame_rate == 44_100 and mix.audio.channels == 2
    assert [t.to_dict() for t in mix.timestamps] == [
        {"index": 0, "start": 3.0, "end": 7.0},
        {"index": 1, "start": 8.0, "end": 11.0},
    ]
    assert mix.music_id == "piano_rain"


def test_ducking_envelope_follows_spec() -> None:
    voice = speech(("v", 4000), ("s", 1000), ("v", 3000))
    mix = RadioMixer().mix(voice, [ParagraphTiming(0, "a", 0, 8000)], music())

    assert gain_at(mix, 1.5) == pytest.approx(-6.0, abs=0.1)  # intro nhạc lớn
    assert gain_at(mix, 2.95) < -10  # lookahead: hạ nhạc trước khi giọng cất lên
    assert gain_at(mix, 5.0) == pytest.approx(-18.0, abs=0.1)  # đang đọc
    assert gain_at(mix, 7.5) == pytest.approx(-18.0, abs=0.1)  # khoảng nghỉ 1s vẫn giữ nhỏ
    assert gain_at(mix, 13.5) == pytest.approx(-6.0, abs=1.0)  # outro tăng nhạc trở lại


def test_long_silence_lets_music_swell_between_sections() -> None:
    voice = speech(("v", 2000), ("s", 5000), ("v", 2000))
    mix = RadioMixer().mix(voice, [ParagraphTiming(0, "a", 0, 9000)], music())
    # Khoảng lặng 5s > hold 1.5s: nhạc dâng lên rồi hạ lại trước đoạn sau
    assert gain_at(mix, 3 + 2 + 3.5) > -10
    assert gain_at(mix, 3 + 7 + 1) == pytest.approx(-18.0, abs=0.1)


def test_music_fades_in_and_out() -> None:
    mix = RadioMixer().mix(speech(("v", 3000)), [ParagraphTiming(0, "a", 0, 3000)], music())
    samples = to_array(mix.audio)
    first_ms = np.abs(samples[:44]).max()
    last_ms = np.abs(samples[-44:]).max()
    middle_of_intro = np.abs(samples[44_100 : 44_100 + 4410]).max()
    assert first_ms < middle_of_intro * 0.05
    assert last_ms < middle_of_intro * 0.01


def test_short_music_is_looped_without_gaps() -> None:
    mix = RadioMixer().mix(speech(("v", 8000)), [ParagraphTiming(0, "a", 0, 8000)], music(ms=3000))
    samples = to_array(mix.audio).mean(axis=1)
    # Vùng outro trước fade (giây 11–12) vẫn có nhạc dù file nhạc chỉ dài 3s
    window = samples[11 * 44_100 : 12 * 44_100]
    assert np.sqrt(np.mean(window**2)) > 1e-3


def test_without_music_returns_voice_only() -> None:
    voice = speech(("v", 2000))
    mix = RadioMixer().mix(voice, [ParagraphTiming(0, "a", 0, 2000)], None)
    assert len(mix.audio) == pytest.approx(2000, abs=1)
    assert mix.timestamps[0].start == 0.0
    assert mix.music_id is None


def test_voice_normalized_and_peak_limited() -> None:
    quiet = speech(("v", 3000)).apply_gain(-20)
    mix = RadioMixer(MixConfig(intro_ms=0, outro_ms=0)).mix(
        quiet, [ParagraphTiming(0, "a", 0, 3000)], None
    )
    samples = to_array(mix.audio)[:, 0]
    assert active_rms_db(samples, 441, -45) == pytest.approx(CFG.voice_rms_db, abs=0.5)

    loud = Sine(220).to_audio_segment(duration=2000, volume=0).set_channels(1)
    mix = RadioMixer(MixConfig(voice_rms_db=0)).mix(
        loud, [ParagraphTiming(0, "a", 0, 2000)], music()
    )
    assert 20 * np.log10(np.abs(to_array(mix.audio)).max()) <= CFG.peak_dbfs + 0.01
