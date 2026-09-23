"""Centralised configuration for the OneHealth AI service.

Every value is read from the environment (never hard-coded) with a safe default
so the service starts on a clean machine with no .env at all.
"""
from __future__ import annotations

import os
import shutil
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Load ai-service/.env if present. Never overrides real environment variables.
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


# Common Windows install locations for the Tesseract engine. Checked in order
# when TESSERACT_CMD is not set explicitly.
_WINDOWS_TESSERACT_CANDIDATES = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
    os.path.expandvars(r"%USERPROFILE%\AppData\Local\Tesseract-OCR\tesseract.exe"),
)


def resolve_tesseract_cmd() -> str | None:
    """Locate the Tesseract binary, or return None if it is not installed.

    OCR is only required for image / scanned inputs. PDFs that carry a text
    layer are handled without Tesseract, which keeps the demo path dependency
    free on Windows.
    """
    explicit = os.getenv("TESSERACT_CMD")
    if explicit and Path(explicit).exists():
        return explicit

    on_path = shutil.which("tesseract")
    if on_path:
        return on_path

    for candidate in _WINDOWS_TESSERACT_CANDIDATES:
        if candidate and Path(candidate).exists():
            return candidate
    return None


class Settings:
    """Runtime settings. Instantiated once via get_settings()."""

    def __init__(self) -> None:
        self.service_name: str = "onehealth-ai-service"
        self.version: str = "1.0.0"
        self.port: int = int(os.getenv("PORT", "8001"))
        self.host: str = os.getenv("HOST", "127.0.0.1")

        # CORS: the Node backend calls us server-to-server, the browser does not.
        self.allowed_origins: list[str] = [
            o.strip()
            for o in os.getenv(
                "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3001"
            ).split(",")
            if o.strip()
        ]

        # --- OCR ---
        self.tesseract_cmd: str | None = resolve_tesseract_cmd()
        self.ocr_language: str = os.getenv("OCR_LANGUAGE", "eng")
        # Rasterisation DPI for scanned PDFs. 200 is a good accuracy/speed balance.
        self.ocr_dpi: int = int(os.getenv("OCR_DPI", "200"))
        self.max_ocr_pages: int = int(os.getenv("MAX_OCR_PAGES", "10"))
        # A PDF page with fewer than this many characters in its text layer is
        # treated as scanned and sent to OCR instead.
        self.text_layer_min_chars: int = int(os.getenv("TEXT_LAYER_MIN_CHARS", "120"))

        # --- LLM ---
        self.openai_api_key: str | None = os.getenv("OPENAI_API_KEY") or None
        self.openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.openai_timeout: float = float(os.getenv("OPENAI_TIMEOUT", "20"))
        self.llm_enabled: bool = _bool("LLM_ENABLED", True)

        # --- Limits ---
        self.max_upload_bytes: int = int(os.getenv("MAX_UPLOAD_BYTES", str(50 * 1024 * 1024)))

    @property
    def ocr_available(self) -> bool:
        return self.tesseract_cmd is not None

    @property
    def openai_configured(self) -> bool:
        return bool(self.llm_enabled and self.openai_api_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
