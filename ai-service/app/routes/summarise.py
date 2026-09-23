"""Summary endpoint - takes already-extracted parameters and phrases them.

Kept separate from /api/analyze so the summary can be regenerated without
re-running OCR on the original document.
"""
from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..services.gpt import DISCLAIMER, generate_summary


class Parameter(BaseModel):
    key: str
    testName: str
    value: float
    unit: str = ""
    referenceRange: str = ""
    status: Literal["NORMAL", "LOW", "HIGH", "UNKNOWN"] = "UNKNOWN"
    panel: str = "Other"
    confidence: float = 0.5


class SummariseRequest(BaseModel):
    parameters: list[Parameter] = Field(default_factory=list)
    detectedSex: str | None = None


router = APIRouter(prefix="/api/summarise", tags=["summary"])


@router.post("")
async def summarise(payload: SummariseRequest) -> dict[str, Any]:
    params = [p.model_dump() for p in payload.parameters]
    summary = generate_summary(params, payload.detectedSex)
    return {"success": True, "summary": summary, "disclaimer": DISCLAIMER}
