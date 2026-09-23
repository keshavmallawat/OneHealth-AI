"""Orchestrates the full document -> insight pipeline in one place."""
from __future__ import annotations

import logging
import time
from typing import Any

from .clinical_ner import extract_clinical
from .gpt import DISCLAIMER, generate_summary
from .ner import extract_parameters
from .tesseract import SOURCE_PDF_TEXT, extract_text

logger = logging.getLogger(__name__)


def analyse_document(
    data: bytes, filename: str = "", content_type: str = "", *, include_text: bool = True
) -> dict[str, Any]:
    """Full pipeline: text extraction -> parameter extraction -> ranges -> summary."""
    started = time.perf_counter()

    extraction = extract_text(data, filename=filename, content_type=content_type)
    from_ocr = extraction.source != SOURCE_PDF_TEXT

    parsed = extract_parameters(extraction.text, from_ocr=from_ocr)

    # Medications, conditions, procedures and allergies. Kept separate from the
    # numeric parameter extraction above because they fail differently: a lab
    # value is either parsed or not, whereas a condition mention can be present
    # and still not belong to the patient (denied, family history). Every entity
    # therefore carries an `assertion`, and the caller must respect it.
    try:
        clinical = extract_clinical(extraction.text, from_ocr=from_ocr)
    except Exception:  # NLP must never break an upload
        logger.exception("Clinical NER failed; continuing without it")
        clinical = None

    summary = generate_summary(parsed["parameters"], parsed["detectedSex"])

    elapsed_ms = int((time.perf_counter() - started) * 1000)

    return {
        "success": True,
        "fileName": filename,
        "extraction": {
            "source": extraction.source,
            "pages": extraction.pages,
            "characters": len(extraction.text),
            "warnings": extraction.warnings,
            "ocrAvailable": extraction.ocr_available,
        },
        "ocrText": extraction.text if include_text else None,
        "detectedSex": parsed["detectedSex"],
        "parameters": parsed["parameters"],
        "stats": parsed["stats"],
        "clinical": clinical,
        "summary": summary,
        "disclaimer": DISCLAIMER,
        "processingMs": elapsed_ms,
    }
