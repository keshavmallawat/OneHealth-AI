"""Assistant safety and grounding tests.

These assert the properties that matter clinically: it refuses to diagnose or
prescribe, it never states a value that is not in the supplied context, and it
answers inventory questions without tripping the clinical-intent guard.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.assistant import compose_answer  # noqa: E402

CONTEXT = {
    "recordCount": 3,
    "analysedCount": 2,
    "latest": {
        "id": "rec_1",
        "fileName": "follow-up.pdf",
        "dateLabel": "2 Sep 2026",
        "parameters": [
            {"key": "HEMOGLOBIN", "testName": "Hemoglobin", "value": 11.6,
             "unit": "g/dL", "referenceRange": "12.0 - 15.0 g/dL", "status": "LOW"},
            {"key": "HBA1C", "testName": "HbA1c", "value": 6.3,
             "unit": "%", "referenceRange": "4.0 - 5.6 %", "status": "HIGH"},
            {"key": "TSH", "testName": "TSH", "value": 2.8,
             "unit": "mIU/L", "referenceRange": "0.4 - 4.0 mIU/L", "status": "NORMAL"},
        ],
    },
    "history": [
        {"key": "HEMOGLOBIN", "testName": "Hemoglobin", "value": 10.4, "unit": "g/dL",
         "referenceRange": "12.0 - 15.0 g/dL", "status": "LOW", "recordId": "rec_0",
         "fileName": "baseline.pdf", "dateLabel": "13 Aug 2026"},
        {"key": "HEMOGLOBIN", "testName": "Hemoglobin", "value": 11.6, "unit": "g/dL",
         "referenceRange": "12.0 - 15.0 g/dL", "status": "LOW", "recordId": "rec_1",
         "fileName": "follow-up.pdf", "dateLabel": "2 Sep 2026"},
    ],
}

EMPTY_CONTEXT = {"recordCount": 0, "analysedCount": 0, "latest": None, "history": []}


def test_refuses_diagnosis():
    for question in ["do i have diabetes?", "am i anaemic", "can you diagnose me"]:
        result = compose_answer(question, CONTEXT)
        assert result["refused"] is True, question
        assert result["kind"] == "REFUSAL"


def test_refuses_prescription_and_treatment():
    for question in [
        "what medicine should i take",
        "what dosage of metformin do i need",
        "should i start a statin",
        "how do i treat this",
    ]:
        result = compose_answer(question, CONTEXT)
        assert result["refused"] is True, question


def test_inventory_question_is_not_refused():
    """'do I have' about records must not be read as a diagnosis request."""
    result = compose_answer("how many reports do i have?", CONTEXT)
    assert result["refused"] is False
    assert result["kind"] == "RECORDS"
    assert "3 records" in result["answer"]


def test_parameter_answer_uses_only_context_values():
    result = compose_answer("what is my hemoglobin?", CONTEXT)
    assert result["kind"] == "PARAMETER"
    assert "11.6" in result["answer"]
    # The trend sentence must cite the real earlier reading.
    assert "10.4" in result["answer"]
    numbers = set(re.findall(r"\d+\.\d+", result["answer"]))
    allowed = {"11.6", "10.4", "12.0", "15.0", "1.2"}
    assert numbers <= allowed, f"unexpected numbers: {numbers - allowed}"


def test_parameter_with_no_reading_says_so():
    result = compose_answer("what is my vitamin d", CONTEXT)
    # Vitamin D is not an extracted parameter, so it must not be fabricated.
    assert "11.6" not in result["answer"]
    assert result["kind"] in ("UNMATCHED", "PARAMETER")


def test_abnormal_listing_matches_context():
    result = compose_answer("what is flagged in my latest report?", CONTEXT)
    assert result["kind"] == "ABNORMAL"
    assert "Hemoglobin" in result["answer"]
    assert "HbA1c" in result["answer"]
    assert "TSH" not in result["answer"]  # normal values are not flagged
    assert result["citations"][0]["recordId"] == "rec_1"


def test_empty_account_is_handled_honestly():
    result = compose_answer("what is flagged in my latest report?", EMPTY_CONTEXT)
    assert result["refused"] is False
    assert "nothing" in result["answer"].lower() or "not have" in result["answer"].lower()


def test_citations_point_at_real_records():
    result = compose_answer("what is my hemoglobin?", CONTEXT)
    ids = {c["recordId"] for c in result["citations"]}
    assert ids <= {"rec_0", "rec_1"}
