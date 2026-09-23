"""OneHealth AI - AI service (FastAPI).

Responsibilities:
  * turn an uploaded medical report (PDF / image) into text,
  * extract known laboratory parameters deterministically,
  * compare them against documented reference ranges,
  * produce a patient-friendly summary (LLM when available, deterministic always).

It holds no patient data: every request is stateless and nothing is written to
disk. Persistence is the Node backend's job.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .data.reference_ranges import PANELS, REFERENCE_RANGES
from .routes.analyze import router as analyze_router
from .routes.assistant import router as assistant_router
from .routes.ocr import router as ocr_router
from .routes.summarise import router as summarise_router
from .services.clinical_ner import engine_status as clinical_engine_status

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)-8s %(name)s: %(message)s"
)
logger = logging.getLogger("onehealth.ai")

settings = get_settings()

app = FastAPI(
    title="OneHealth AI - AI Service",
    description=(
        "OCR and medical report analysis for the OneHealth AI platform. "
        "Values are extracted deterministically and compared against documented "
        "reference ranges; the language model only rephrases those findings."
    ),
    version=settings.version,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(assistant_router)
app.include_router(ocr_router)
app.include_router(summarise_router)


@app.on_event("startup")
async def announce_capabilities() -> None:
    logger.info("OneHealth AI service v%s starting", settings.version)
    logger.info(
        "OCR engine: %s",
        settings.tesseract_cmd or "NOT FOUND (PDF text-layer reports still work)",
    )
    logger.info(
        "LLM summaries: %s",
        f"enabled ({settings.openai_model})"
        if settings.openai_configured
        else "disabled - using the deterministic summary generator",
    )
    logger.info("Recognised parameters: %d", len(REFERENCE_RANGES))


@app.get("/health", tags=["meta"])
async def health() -> dict:
    """Liveness + capability probe. The Node backend surfaces this to the UI."""
    return {
        "status": "ok",
        "service": settings.service_name,
        "version": settings.version,
        "capabilities": {
            "ocrAvailable": settings.ocr_available,
            "ocrEngine": settings.tesseract_cmd,
            "llmConfigured": settings.openai_configured,
            "llmModel": settings.openai_model if settings.openai_configured else None,
            "summaryFallback": "deterministic",
            "recognisedParameters": len(REFERENCE_RANGES),
            "clinicalNer": clinical_engine_status(),
        },
    }


@app.get("/api/reference-ranges", tags=["meta"])
async def reference_ranges() -> dict:
    """Expose the reference table so the ranges shown in the UI are traceable."""
    return {
        "panels": PANELS,
        "parameters": {
            key: {
                "testName": spec["testName"],
                "unit": spec["unit"],
                "range": spec["display"],
                "bySex": spec.get("bySex"),
                "source": spec["source"],
            }
            for key, spec in REFERENCE_RANGES.items()
        },
    }
