"""Preflight check for the AI service.

Imports every third-party dependency and every application module, then reports
what the service will actually be able to do. Run this when the service fails to
start: an import error here is far easier to read than a server that exits
silently and leaves the caller with a socket hang-up.

Usage:  python scripts/check_environment.py
Exit code 0 = the service can start.
"""
from __future__ import annotations

import platform
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

failures: list[str] = []
notes: list[str] = []


def check(label: str, fn) -> None:
    try:
        detail = fn()
        print(f"  OK    {label}{f' — {detail}' if detail else ''}")
    except Exception as exc:  # noqa: BLE001 - we want to report anything
        failures.append(f"{label}: {type(exc).__name__}: {exc}")
        print(f"  FAIL  {label} — {type(exc).__name__}: {exc}")


def _fastapi():
    import fastapi
    return f"fastapi {fastapi.__version__}"


def _uvicorn():
    import uvicorn
    return f"uvicorn {uvicorn.__version__}"


def _pymupdf():
    import fitz
    version = getattr(fitz, "__version__", None) or fitz.VersionBind
    # Actually build a one-page PDF and read the text back, so we know the
    # native library really works and not just that the import resolved.
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((60, 60), "preflight probe 12.3 mg/dL")
    data = doc.tobytes()
    doc.close()
    reopened = fitz.open(stream=data, filetype="pdf")
    text = reopened[0].get_text()
    reopened.close()
    assert "preflight" in text, "PyMuPDF could not read back the text it wrote"
    return f"PyMuPDF {version} (render + text extraction verified)"


def _pillow():
    from PIL import Image
    Image.new("RGB", (8, 8))
    return "Pillow OK"


def _pytesseract():
    import pytesseract  # noqa: F401
    return "python bindings present"


def _openai():
    import openai
    return f"openai {openai.__version__} (only used when a key is configured)"


def _clinical_ner():
    """Report which NER engine will run, and prove the negation guard is live.

    A pass here means more than "the import worked": the probe sentence is one
    the extractor must NOT record as a diagnosis. If this check reports the
    rule-based engine, the service still works - the same guard is implemented
    there - but medspaCy's ConText is not in play.
    """
    from app.services.clinical_ner import engine_status, extract_clinical

    status = engine_status()
    probe = extract_clinical("Patient denies any history of hypertension.")
    found = [c for c in probe["conditions"] if c["name"] == "Hypertension"]
    assert found, "negation probe: hypertension mention was not detected at all"
    assert found[0]["assertion"] == "negated", (
        f"NEGATION GUARD BROKEN - a denied condition was recorded as "
        f"'{found[0]['assertion']}'. Do not ship this build."
    )
    lexicon = status["lexicon"]
    return (
        f"{status['engine']}, negation via {status['contextDetection']}, "
        f"{lexicon['medications']} medication / {lexicon['conditions']} condition forms"
    )


def _spacy():
    import spacy
    try:
        import medspacy
    except ImportError:
        raise AssertionError(
            "medspaCy is not installed; the rule-based NER engine will be used. "
            "Install with: pip install -r requirements.txt"
        ) from None
    try:
        spacy.load("en_core_web_sm")
    except OSError:
        raise AssertionError(
            "spaCy model 'en_core_web_sm' is missing. Install with: "
            "python -m spacy download en_core_web_sm"
        ) from None
    return f"spaCy {spacy.__version__} + medspaCy {medspacy.__version__} + en_core_web_sm"


def _app_modules():
    from app.config import get_settings  # noqa: F401
    from app.data.reference_ranges import REFERENCE_RANGES
    from app.main import app  # noqa: F401
    from app.services.ner import extract_parameters
    from app.services.pipeline import analyse_document  # noqa: F401
    from app.services.tesseract import extract_text  # noqa: F401
    result = extract_parameters("Hemoglobin 10.4 g/dL")
    assert result["parameters"], "extraction returned nothing"
    return f"{len(REFERENCE_RANGES)} parameters configured, extraction working"


def main() -> int:
    print(f"\nOneHealth AI - AI service preflight")
    print(f"Python {sys.version.split()[0]} on {platform.system()} {platform.release()}")
    print(f"Interpreter: {sys.executable}\n")

    check("FastAPI", _fastapi)
    check("Uvicorn", _uvicorn)
    check("PyMuPDF (PDF reading, no Poppler needed)", _pymupdf)
    check("Pillow", _pillow)
    check("pytesseract bindings", _pytesseract)
    check("openai client", _openai)
    check("spaCy stack", _spacy)
    check("application modules", _app_modules)
    check("clinical NER + negation guard", _clinical_ner)

    # OCR engine is optional - report it clearly either way.
    try:
        from app.config import get_settings
        settings = get_settings()
        if settings.ocr_available:
            print(f"  OK    Tesseract engine — {settings.tesseract_cmd}")
        else:
            notes.append(
                "Tesseract OCR engine not found. Digital PDFs (the main demo path) still "
                "work; image and scanned-PDF uploads will report that OCR is unavailable."
            )
            print("  NOTE  Tesseract engine — not found (optional)")
        print(
            f"  {'OK   ' if settings.openai_configured else 'NOTE '} LLM summaries — "
            + ("OpenAI key configured" if settings.openai_configured
               else "no API key; the deterministic generator will be used")
        )
    except Exception as exc:  # noqa: BLE001
        failures.append(f"settings: {exc}")

    print()
    for note in notes:
        print(f"NOTE: {note}")

    if failures:
        print(f"\n{len(failures)} PROBLEM(S) — the AI service will not start:")
        for failure in failures:
            print(f"  - {failure}")
        print("\nTry:  .venv\\Scripts\\python.exe -m pip install -r requirements.txt\n")
        return 1

    print("\nPreflight passed. The AI service can start.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
