# syntax=docker/dockerfile:1
# Chạy được trên Hugging Face Spaces (Docker SDK, cổng 7860, user uid 1000) hoặc Render.
#   docker build -t auralis-audio-ai auralis-audio-ai

FROM python:3.11-slim AS builder
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
RUN pip install --no-cache-dir uv==0.11.32
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --frozen --no-dev --no-install-project

FROM python:3.11-slim AS runtime
# ffmpeg cho pydub (giải mã/xuất MP3)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 1000 user
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY app ./app
COPY assets ./assets
ENV PATH=/app/.venv/bin:$PATH \
  PYTHONUNBUFFERED=1 \
  PORT=7860 \
  LOCAL_MEDIA_DIR=/tmp/media
USER user
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import os,urllib.request;urllib.request.urlopen(f'http://localhost:{os.environ.get(\"PORT\",\"7860\")}/api/v1/health')"
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
