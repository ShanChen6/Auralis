"""Tạo audio cho các số Radio mẫu (dữ liệu seed) bằng chính pipeline TTS + hậu kỳ.

    uv run python -m scripts.generate_demo_radios

Đọc  ../auralis-api/prisma/seed-data/demo-posts.json
Ghi  ../auralis-web/public/demo/radio/<slug>.mp3
     ../auralis-api/prisma/seed-data/demo-audio.json  (duration + timestamps cho seed)
"""

import asyncio
import json
from pathlib import Path

from app.radio.producer import RadioProducer
from app.tts.synthesizer import build_default_synthesizer

ROOT = Path(__file__).resolve().parents[2]
POSTS = ROOT / "auralis-api" / "prisma" / "seed-data" / "demo-posts.json"
AUDIO_JSON = POSTS.parent / "demo-audio.json"
OUT_DIR = ROOT / "auralis-web" / "public" / "demo" / "radio"


async def main() -> None:
    producer = RadioProducer(build_default_synthesizer())
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    audio: dict[str, dict] = {}
    for post in json.loads(POSTS.read_text("utf-8")):
        episode = await producer.produce(
            post["content"], voice=post["voice"], music_id=post["music"]
        )
        episode.mix.export_mp3(OUT_DIR / f"{post['slug']}.mp3", bitrate="96k")
        audio[post["slug"]] = {
            "duration": episode.mix.duration,
            "timestamps": [t.to_dict() for t in episode.mix.timestamps],
        }
        print(f"{post['slug']}: {episode.mix.duration}s, {len(episode.mix.timestamps)} đoạn")
    AUDIO_JSON.write_text(json.dumps(audio, ensure_ascii=False, indent=2) + "\n", "utf-8")


if __name__ == "__main__":
    asyncio.run(main())
