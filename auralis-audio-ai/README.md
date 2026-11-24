# auralis-audio-ai

Dịch vụ Hybrid TTS & hậu kỳ Radio của Auralis (Python FastAPI).

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest
```

Health check: `GET http://localhost:8000/api/v1/health`
