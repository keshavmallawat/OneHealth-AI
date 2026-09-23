"""Assistant endpoint.

The request carries a context the Node backend assembled from ONE patient's own
records. This service holds no patient data and performs no lookup of its own,
so there is no code path by which it could reach another patient's results.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..services.assistant import answer_question

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class HistoryPoint(BaseModel):
    key: str
    testName: str = ""
    value: float
    unit: str = ""
    referenceRange: str = ""
    status: str = "UNKNOWN"
    recordId: str | None = None
    fileName: str | None = None
    date: str | None = None
    dateLabel: str | None = None


class LatestParameter(BaseModel):
    key: str
    testName: str
    value: float
    unit: str = ""
    referenceRange: str = ""
    status: str = "UNKNOWN"


class LatestRecord(BaseModel):
    id: str | None = None
    fileName: str | None = None
    date: str | None = None
    dateLabel: str | None = None
    parameters: list[LatestParameter] = Field(default_factory=list)


class AssistantContext(BaseModel):
    recordCount: int = 0
    analysedCount: int = 0
    latest: LatestRecord | None = None
    history: list[HistoryPoint] = Field(default_factory=list)


class AssistantRequest(BaseModel):
    question: str = ""
    context: AssistantContext = Field(default_factory=AssistantContext)


@router.post("")
async def ask(payload: AssistantRequest) -> dict[str, Any]:
    context = payload.context.model_dump()
    result = answer_question(payload.question, context)
    return {"success": True, **result}
