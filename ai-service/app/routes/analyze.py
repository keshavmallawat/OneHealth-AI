"""The endpoint the Node backend calls: one document in, full analysis out."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..config import get_settings
from ..services.pipeline import analyse_document
from ..services.tesseract import ExtractionError

router = APIRouter(prefix="/api/analyze", tags=["analysis"])


@router.post("")
async def analyze(
    file: UploadFile = File(...),
    includeText: str = Form("true"),
) -> dict:
    settings = get_settings()
    data = await file.read()

    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="The uploaded file is too large.")

    try:
        return analyse_document(
            data,
            filename=file.filename or "",
            content_type=file.content_type or "",
            include_text=includeText.lower() not in ("false", "0", "no"),
        )
    except ExtractionError as exc:
        # 422: we understood the request but could not read the document.
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - safety net
        raise HTTPException(
            status_code=500, detail=f"Analysis failed unexpectedly: {exc}"
        ) from exc
