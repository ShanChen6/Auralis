"""Thử giọng đọc từ dòng lệnh.

uv run python -m app.tts.cli kich-ban.txt -o out.mp3 --engine edge --voice female_warm
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from app.config import get_settings
from app.tts.synthesizer import build_default_synthesizer


async def main() -> None:
    parser = argparse.ArgumentParser(description="Auralis TTS")
    parser.add_argument("input", help="File kịch bản (.txt/.md) hoặc '-' để đọc stdin")
    parser.add_argument("-o", "--output", default="voice.mp3")
    parser.add_argument("--engine", default="edge", choices=["edge", "voicestudio"])
    parser.add_argument("--voice", default="female_warm")
    parser.add_argument("--rate", default=get_settings().tts_default_rate)
    args = parser.parse_args()

    script = sys.stdin.read() if args.input == "-" else Path(args.input).read_text("utf-8")
    result = await build_default_synthesizer().synthesize(
        script, engine=args.engine, voice=args.voice, rate=args.rate
    )
    result.audio.export(args.output, format="mp3", bitrate="128k")
    print(
        json.dumps(
            {
                "output": args.output,
                "engine": result.engine,
                "requestedEngine": result.requested_engine,
                "fallbackReason": result.fallback_reason,
                "durationMs": result.duration_ms,
                "paragraphs": [
                    {"index": p.index, "startMs": p.start_ms, "endMs": p.end_ms}
                    for p in result.paragraphs
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
