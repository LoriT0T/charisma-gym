"""App configuration — everything overridable from backend/.env"""
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", BACKEND_DIR.parent.parent / "docs"))

load_dotenv(BACKEND_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

# Realtime voice model (the coach's ears + mouth). If the preferred model is
# unavailable for this key, the bridge walks down the fallback list.
LIVE_MODEL = os.getenv("LIVE_MODEL", "gemini-3.1-flash-live-preview").strip()
LIVE_MODEL_FALLBACKS = [
    m.strip()
    for m in os.getenv(
        "LIVE_MODEL_FALLBACKS",
        "gemini-2.5-flash-native-audio-preview-12-2025,"
        "gemini-2.5-flash-native-audio-preview-09-2025,"
        "gemini-2.0-flash-live-001",
    ).split(",")
    if m.strip()
]

# Fast text model (the silent analyst in the booth).
TEXT_MODEL = os.getenv("TEXT_MODEL", "gemini-flash-latest").strip()
TEXT_MODEL_FALLBACKS = [
    m.strip()
    for m in os.getenv(
        "TEXT_MODEL_FALLBACKS",
        "gemini-3.5-flash,gemini-2.5-flash,gemini-2.0-flash",
    ).split(",")
    if m.strip()
]

# Run the whole app with a fake conversation loop (no API calls) — for UI dev.
MOCK_MODE = os.getenv("MOCK_MODE", "0").strip() in ("1", "true", "yes")

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

# Where the friend's memory lives. Overridable so a container can point it at a
# mounted volume — on ephemeral hosting this resets when the app rebuilds.
MEMORY_PATH = Path(os.getenv("MEMORY_PATH", str(BACKEND_DIR / "memory.json")))

# Optional access gate for public/tunneled deployments. Empty = no gate.
APP_PASSCODE = os.getenv("APP_PASSCODE", "").strip()

# Audio contract (fixed by the Live API)
INPUT_RATE = 16000   # browser -> Gemini: 16-bit PCM, 16 kHz, mono, little-endian
OUTPUT_RATE = 24000  # Gemini -> browser: 16-bit PCM, 24 kHz, mono, little-endian

# Analyzer behavior
MIN_WORDS_TO_ANALYZE = int(os.getenv("MIN_WORDS_TO_ANALYZE", "7"))
ANALYZER_CONTEXT_TURNS = 6
