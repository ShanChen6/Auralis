"""Sản xuất một số Radio hoàn chỉnh từ dòng lệnh.

uv run python -m app.radio.cli kich-ban.md -o radio.mp3 --music piano_rain --voice female_warm
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from app.config import get_settings
from app.radio.music import MUSIC_TRACKS
from app.radio.producer import RadioProducer
from app.tts.synthesizer import build_default_synthesizer


async def main() -> None:
    parser = argparse.ArgumentParser(description="Auralis Radio")
    parser.add_argument("input", help="File kịch bản (.txt/.md) hoặc '-' để đọc stdin")
    parser.add_argument("-o", "--output", default="radio.mp3")
    parser.add_argument("--engine", default="edge", choices=["edge", "voicestudio"])
    parser.add_argument("--voice", default="female_warm")
    parser.add_argument("--rate", default=get_settings().tts_default_rate)
    parser.add_argument("--music", default="piano_rain", choices=[*MUSIC_TRACKS, "none"])
    args = parser.parse_args()

    script = sys.stdin.read() if args.input == "-" else Path(args.input).read_text("utf-8")
    episode = await RadioProducer(build_default_synthesizer()).produce(
        script,
        engine=args.engine,
        voice=args.voice,
        rate=args.rate,
        music_id=None if args.music == "none" else args.music,
    )
    episode.mix.export_mp3(args.output)
    print(
        json.dumps(
            {
                "output": args.output,
                "duration": episode.mix.duration,
                "engine": episode.engine,
                "fallbackReason": episode.fallback_reason,
                "music": episode.mix.music_id,
                "timestamps": [t.to_dict() for t in episode.mix.timestamps],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
