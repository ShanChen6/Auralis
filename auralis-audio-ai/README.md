# auralis-audio-ai

Dịch vụ Hybrid TTS & hậu kỳ Radio của Auralis (Python FastAPI). Yêu cầu `ffmpeg` trên máy.

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest                 # test offline
uv run pytest -m network      # gọi edge-tts thật
```

Health check: `GET http://localhost:8000/api/v1/health`

## Lõi tạo giọng đọc (`app/tts/`)

Strategy Pattern: `VoiceSynthesizer` chọn engine theo tên và tự chuyển sang `edge` khi engine được chọn không kết nối được.

| Engine | Mô tả |
| --- | --- |
| `edge` | `edge-tts` online, miễn phí. Giọng `vi-VN-HoaiMyNeural` / `vi-VN-NamMinhNeural`, mặc định `rate="-5%"`, thử lại 2 lần khi lỗi mạng |
| `voicestudio` | Local API VoiceStudio (giọng nhân bản). Nếu không kết nối được hoặc lỗi 5xx thì **đọc lại toàn bộ bằng edge**; lỗi 4xx thì báo lỗi luôn |

Giọng (`voice`): `female_warm` (Nữ trầm ấm), `male_deep` (Nam sâu lắng), một tên giọng edge bất kỳ (`...Neural`), hoặc tên giọng nhân bản của VoiceStudio.

Cách tách kịch bản (Markdown được làm sạch trước):

- Đoạn văn: phân cách bằng dòng trống. Mỗi đoạn có một mốc `start/end` để Frontend bôi sáng.
- Câu: tách tại `. ! ? …` hoặc xuống dòng, sau đó nghỉ **600ms**. Nếu chữ kế tiếp viết thường (VD: "Ừ… vậy") thì vẫn tính là cùng một câu.
- Cụm: tách tại `, ; :`, sau đó nghỉ **250ms**. Cụm ngắn hơn 3 từ được gộp vào cụm sau để giữ ngữ điệu.
- Hết đoạn văn: nghỉ **1000ms**.
- Khoảng lặng thừa ở đầu và cuối mỗi cụm do engine sinh ra được cắt bỏ, nên khoảng nghỉ chính xác theo cấu hình.

```python
from app.tts.synthesizer import build_default_synthesizer

result = await build_default_synthesizer().synthesize(script, engine="voicestudio", voice="male_deep")
result.audio            # pydub.AudioSegment – giọng thô, 24kHz mono
result.paragraphs       # [ParagraphTiming(index, text, start_ms, end_ms), ...]
result.engine           # engine thực sự đã dùng ("edge" nếu đã fallback)
result.fallback_reason
```

Thử nhanh từ dòng lệnh:

```bash
uv run python -m app.tts.cli kich-ban.md -o voice.mp3 --engine edge --voice female_warm
```

## Cấu hình (`.env`)

| Biến | Mặc định |
| --- | --- |
| `TTS_DEFAULT_RATE` | `-5%` |
| `TTS_CONCURRENCY` | `4` (số cụm gọi engine song song) |
| `TTS_SPLIT_COMMAS` | `true` |
| `TTS_COMMA_PAUSE_MS` / `TTS_SENTENCE_PAUSE_MS` / `TTS_PARAGRAPH_PAUSE_MS` | `250` / `600` / `1000` |
| `EDGE_TTS_PROXY` | lấy từ `HTTPS_PROXY` (edge-tts không tự đọc biến proxy) |
| `VOICESTUDIO_URL` | `http://localhost:3900` (hoặc URL Cloudflare Tunnel) |
| `VOICESTUDIO_TTS_PATH` | `/api/tts` |
| `VOICESTUDIO_TIMEOUT_S` | `120` |

> Hợp đồng API VoiceStudio đang giả định: `POST {VOICESTUDIO_URL}{VOICESTUDIO_TTS_PATH}` với JSON `{"text", "voice", "speed"}`, trả về file audio (`audio/wav` hoặc `audio/mpeg`). Nếu API thật khác thì chỉ cần sửa `app/tts/engines/voicestudio.py`.
