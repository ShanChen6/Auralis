from dataclasses import dataclass
from pathlib import Path

from pydub import AudioSegment

DEFAULT_MUSIC_DIR = Path(__file__).resolve().parents[2] / "assets" / "music"


@dataclass(frozen=True)
class MusicTrack:
    id: str
    label: str
    filename: str


MUSIC_TRACKS: dict[str, MusicTrack] = {
    "piano_rain": MusicTrack("piano_rain", "Piano mưa", "piano_rain.mp3"),
    "lofi_warm": MusicTrack("lofi_warm", "Lo-fi ấm áp", "lofi_warm.mp3"),
    "acoustic_night": MusicTrack("acoustic_night", "Guitar mộc", "acoustic_night.mp3"),
}


class MusicLibrary:
    def __init__(self, directory: Path = DEFAULT_MUSIC_DIR) -> None:
        self._directory = directory
        self._cache: dict[str, AudioSegment] = {}

    def load(self, music_id: str) -> AudioSegment:
        track = MUSIC_TRACKS.get(music_id)
        if track is None:
            raise ValueError(f"Nhạc nền không tồn tại: {music_id}. Có: {', '.join(MUSIC_TRACKS)}")
        if music_id not in self._cache:
            path = self._directory / track.filename
            if not path.exists():
                raise FileNotFoundError(f"Thiếu file nhạc nền {path}")
            self._cache[music_id] = AudioSegment.from_file(path)
        return self._cache[music_id]
