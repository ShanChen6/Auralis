from dataclasses import dataclass


@dataclass(frozen=True)
class VoicePreset:
    id: str
    label: str
    edge_voice: str
    """Tên giọng gửi sang VoiceStudio (giọng nhân bản). None = dùng id của preset."""
    voicestudio_voice: str | None = None


VOICE_PRESETS: dict[str, VoicePreset] = {
    "female_warm": VoicePreset("female_warm", "Nữ trầm ấm", "vi-VN-HoaiMyNeural"),
    "male_deep": VoicePreset("male_deep", "Nam sâu lắng", "vi-VN-NamMinhNeural"),
}

DEFAULT_VOICE = "female_warm"


def resolve_voice(voice: str | None) -> VoicePreset:
    """Nhận id preset ("female_warm"), tên giọng edge ("vi-VN-NamMinhNeural")
    hoặc tên giọng nhân bản bất kỳ của VoiceStudio."""
    if not voice:
        return VOICE_PRESETS[DEFAULT_VOICE]
    if voice in VOICE_PRESETS:
        return VOICE_PRESETS[voice]
    for preset in VOICE_PRESETS.values():
        if preset.edge_voice == voice:
            return preset
    if voice.endswith("Neural"):
        return VoicePreset(voice, voice, voice)
    # Giọng nhân bản của VoiceStudio; nếu phải fallback sẽ đọc bằng giọng nữ mặc định.
    default = VOICE_PRESETS[DEFAULT_VOICE]
    return VoicePreset(voice, voice, default.edge_voice, voicestudio_voice=voice)
