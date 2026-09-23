"""Text-extraction endpoint. Useful on its own and for debugging the OCR layer."""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..config import get_settings
from ..services.tesseract import ExtractionError, extract_text

router = APIRouter(prefix="/api/ocr", tags=["ocr"])


@router.post("")
async def run_ocr(file: UploadFile = File(...)) -> dict:
    settings = get_settings()
    data = await file.read()

    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="The uploaded file is too large.")

    try:
        result = extract_text(
            data, filename=file.filename or "", content_type=file.content_type or ""
        )
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {"success": True, "fileName": file.filename, **result.as_dict()}
