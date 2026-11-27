# auralis-audio-ai

Dịch vụ Hybrid TTS & hậu kỳ Radio của Auralis (Python FastAPI). Yêu cầu `ffmpeg` trên máy.

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest                 # test offline
uv run pytest -m network      # gọi edge-tts thật
```

Health check: `GET http://localhost:8000/api/v1/health`

## API `POST /api/v1/generate-radio`

Kịch bản → TTS → hậu kỳ nhạc nền → upload MP3 lên Cloudflare R2.

```http
POST /api/v1/generate-radio
Content-Type: application/json
X-API-Key: <AUDIO_AI_API_KEY>        # chỉ bắt buộc khi đã đặt biến này

{
  "script": "Đêm nay trời lại mưa...\n\nỪ, có những ngày...",
  "engine": "edge",            // "edge" | "voicestudio"
  "voice": "female_warm",      // female_warm | male_deep | tên giọng edge | giọng nhân bản VoiceStudio
  "rate": "-5%",
  "music": "piano_rain",       // piano_rain | lofi_warm | acoustic_night | null (không nhạc)
  "postId": "0193f2a1-..."     // tùy chọn, dùng đặt tên file
}
```

```json
{
  "audioUrl": "https://cdn.example.com/audio/radio/2026/11/0193f2a1-...-dd5e318c7fe7.mp3",
  "key": "audio/radio/2026/11/0193f2a1-...-dd5e318c7fe7.mp3",
  "duration": 26.626,
  "timestamps": [{ "index": 0, "start": 3.0, "end": 3.87 }, { "index": 1, "start": 4.87, "end": 13.408 }],
  "engine": "edge",
  "requestedEngine": "voicestudio",
  "fallbackReason": "Không kết nối được VoiceStudio: ...",
  "voice": "male_deep",
  "music": "lofi_warm"
}
```

| Mã | Khi nào |
| --- | --- |
| `401` | Thiếu hoặc sai `X-API-Key` (khi đã đặt `AUDIO_AI_API_KEY`) |
| `422` | Body sai, kịch bản trống hoặc dài quá `RADIO_MAX_WORDS` (mặc định 3.000 từ) |
| `502` | Engine TTS từ chối request, hoặc upload R2 thất bại |
| `503` | edge-tts không phản hồi (VoiceStudio sập thì đã tự fallback sang edge) |

- Tối đa `RADIO_MAX_CONCURRENT` (mặc định 2) số Radio được sản xuất cùng lúc. Request vượt quá sẽ xếp hàng chờ.
- Khi **chưa cấu hình `R2_*`**, file được lưu local trong `media/` và phục vụ qua `GET /media/...`. `GET /api/v1/health` cho biết đang dùng `"storage": "r2"` hay `"local"`.
- Thời gian xử lý: một kịch bản khoảng 20 giây đọc mất khoảng 4 giây. Kịch bản 3.000 từ (khoảng 20 phút) có thể mất vài phút, nên phía NestJS nên gọi bất đồng bộ (hàng đợi).

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

result = await build_default_synthesizer().synthesize(
    script, engine="voicestudio", voice="male_deep"
)
result.audio  # pydub.AudioSegment – giọng thô, 24kHz mono
result.paragraphs  # [ParagraphTiming(index, text, start_ms, end_ms), ...]
result.engine  # engine thực sự đã dùng ("edge" nếu đã fallback)
result.fallback_reason
```

Thử nhanh từ dòng lệnh:

```bash
uv run python -m app.tts.cli kich-ban.md -o voice.mp3 --engine edge --voice female_warm
```

## Hậu kỳ Radio (`app/radio/`)

`RadioProducer` nhận kịch bản, gọi TTS, rồi trộn với nhạc nền:

```
|<- Intro 3s ->|<------------ giọng MC ------------>|<- Outro 4s ->|
nhạc  -6dB      ↘ -18dB (auto-ducking)               ↗ -6dB  ↘ fade out
```

- **Auto-ducking:** phát hiện giọng theo từng khung 10ms. Nhạc hạ xuống sớm 300ms trước khi MC cất lời. Các khoảng lặng ngắn hơn 1,5s (giữa câu, giữa đoạn) vẫn giữ nhạc nhỏ để không bị "nhấp nhô". Khoảng lặng dài hơn thì nhạc dâng lên rồi hạ lại.
- **Mức âm lượng:**
  - Giọng được chuẩn hóa về -16 dBFS RMS.
  - Nhạc được chuẩn hóa cùng mức đó, nên -6dB và -18dB là mức **so với giọng đọc**.
  - Đỉnh của file được giới hạn ở -1 dBFS.
- **Nhạc nền:** nhạc ngắn hơn số Radio sẽ được lặp lại, nối có crossfade 2s. Nhạc fade in 600ms ở đầu.
- **Đầu ra:** MP3 44.1kHz stereo, kèm `timestamps` (giây) của từng đoạn văn, **đã cộng 3s intro**:

```json
[{ "index": 0, "start": 3.0, "end": 3.92 }, { "index": 1, "start": 4.92, "end": 13.582 }]
```

```bash
uv run python -m app.radio.cli kich-ban.md -o radio.mp3 --music piano_rain --voice female_warm
```

### Nhạc nền (`assets/music/`)

| id | Tên |
| --- | --- |
| `piano_rain` | Piano mưa |
| `lofi_warm` | Lo-fi ấm áp |
| `acoustic_night` | Guitar mộc |

⚠️ Đây là **nhạc tự tổng hợp để test** (`scripts/generate_placeholder_music.py`). Khi có nhạc thật (không lời, có bản quyền), chỉ cần chép đè file cùng tên. Nên dùng bản dài từ 1 phút trở lên.

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
| `AUDIO_AI_API_KEY` | trống (không yêu cầu key) |
| `RADIO_MAX_WORDS` / `RADIO_MAX_CONCURRENT` / `RADIO_MP3_BITRATE` | `3000` / `2` / `128k` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | trống thì lưu local |
| `R2_ENDPOINT` | tùy chọn, dùng cho emulator S3 |
| `LOCAL_MEDIA_DIR` / `PUBLIC_BASE_URL` | `media` / `http://localhost:8000` |

> Hợp đồng API VoiceStudio đang giả định: `POST {VOICESTUDIO_URL}{VOICESTUDIO_TTS_PATH}` với JSON `{"text", "voice", "speed"}`, trả về file audio (`audio/wav` hoặc `audio/mpeg`). Nếu API thật khác thì chỉ cần sửa `app/tts/engines/voicestudio.py`.
