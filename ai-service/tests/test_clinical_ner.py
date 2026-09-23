"""Tests for the clinical NER layer (medications, conditions, procedures, allergies).

Run with pytest:      pytest
Or with no pytest:    python tests/test_clinical_ner.py

The negation tests are the important ones. A keyword extractor that reads
"Patient denies any history of hypertension" and files a hypertension diagnosis
has produced a clinically dangerous record, and it does so silently. Every
assertion case below is a sentence shape that appears in real discharge
summaries and prescriptions.

The same cases run twice: once through the spaCy + medspaCy pipeline and once
through the rule-based engine, because the safety property has to hold on
whichever engine the deployment actually ends up with.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import clinical_ner  # noqa: E402
from app.services.clinical_ner import (  # noqa: E402
    ASSERTED,
    FAMILY,
    NEGATED,
    extract_clinical,
)

NOTE = """DISCHARGE SUMMARY

History:
Patient denies any history of hypertension.
No evidence of chronic kidney disease on imaging.
Family history of coronary artery disease (father).
Known case of type 2 diabetes mellitus since 2019.
Iron deficiency anaemia confirmed on CBC.

Allergies:
Allergic to penicillin - rash.
No known allergy to sulfa drugs.

Medications:
Tab Metformin 500 mg 1-0-1 after food x 30 days
Tab Thyronorm 50 mcg once daily before food x 90 days
Cap Orofer XT 1-0-0 after food x 60 days
Tab Dolo 650 mg SOS oral
Tab Atorvastatin 10 mg HS x 30 days

Procedures:
Echocardiography done on admission.
"""


def _by_name(items, name):
    for item in items:
        if item["name"].lower() == name.lower():
            return item
    return None


def _both_engines():
    """Yield (label, result) for the spaCy path and the rule-based path."""
    spacy_result = clinical_ner._extract_with_spacy(NOTE, from_ocr=False)
    if spacy_result is not None:
        yield "spacy", spacy_result
    yield "regex", clinical_ner._extract_with_regex(NOTE, from_ocr=False)


def test_denied_condition_is_not_asserted():
    for engine, result in _both_engines():
        found = _by_name(result["conditions"], "Hypertension")
        assert found is not None, f"[{engine}] hypertension mention was not found at all"
        assert found["assertion"] == NEGATED, (
            f"[{engine}] 'denies any history of hypertension' -> {found['assertion']}"
        )


def test_no_evidence_of_condition_is_not_asserted():
    for engine, result in _both_engines():
        found = _by_name(result["conditions"], "Chronic Kidney Disease")
        assert found is not None, f"[{engine}] CKD mention was not found at all"
        assert found["assertion"] == NEGATED, (
            f"[{engine}] 'no evidence of chronic kidney disease' -> {found['assertion']}"
        )


def test_family_history_is_not_the_patients_diagnosis():
    for engine, result in _both_engines():
        found = _by_name(result["conditions"], "Coronary Artery Disease")
        assert found is not None, f"[{engine}] CAD mention was not found at all"
        assert found["assertion"] == FAMILY, (
            f"[{engine}] 'family history of coronary artery disease' -> {found['assertion']}"
        )


def test_denied_allergy_is_not_asserted():
    for engine, result in _both_engines():
        found = _by_name(result["allergies"], "Sulfa Drugs")
        assert found is not None, f"[{engine}] sulfa mention was not found at all"
        assert found["assertion"] == NEGATED, (
            f"[{engine}] 'no known allergy to sulfa drugs' -> {found['assertion']}"
        )


def test_real_diagnoses_are_still_asserted():
    """The negation guard must not swallow genuine findings."""
    for engine, result in _both_engines():
        for name in ("Type 2 Diabetes Mellitus", "Iron Deficiency Anaemia"):
            found = _by_name(result["conditions"], name)
            assert found is not None, f"[{engine}] {name} was not found"
            assert found["assertion"] == ASSERTED, (
                f"[{engine}] {name} -> {found['assertion']}, expected asserted"
            )


def test_real_allergy_is_asserted():
    for engine, result in _both_engines():
        found = _by_name(result["allergies"], "Penicillin")
        assert found is not None, f"[{engine}] penicillin allergy was not found"
        assert found["assertion"] == ASSERTED, f"[{engine}] -> {found['assertion']}"


def test_stats_count_only_asserted_findings():
    result = extract_clinical(NOTE)
    stats = result["stats"]
    assert stats["conditionCount"] == 2, f"expected 2 asserted conditions, got {stats}"
    assert stats["allergyCount"] == 1, f"expected 1 asserted allergy, got {stats}"
    assert stats["excludedMentions"] >= 3, (
        f"negated/family mentions should be reported as excluded, got {stats}"
    )


def test_indian_dosing_notation_is_a_schedule_not_food_timing():
    """'1-0-1 after food' carries two facts. Reporting only the second loses the dose."""
    for engine, result in _both_engines():
        metformin = _by_name(result["medications"], "Metformin")
        assert metformin is not None, f"[{engine}] metformin not found"
        assert metformin["frequencyPlain"] == "twice daily", (
            f"[{engine}] 1-0-1 -> {metformin['frequencyPlain']}, expected twice daily"
        )
        assert metformin["foodTiming"] == "after food", (
            f"[{engine}] foodTiming -> {metformin['foodTiming']}"
        )


def test_medication_attributes_are_extracted():
    for engine, result in _both_engines():
        thyronorm = _by_name(result["medications"], "Levothyroxine")
        if thyronorm is None:
            thyronorm = _by_name(result["medications"], "Thyronorm")
        assert thyronorm is not None, f"[{engine}] thyronorm not found"
        assert thyronorm["dose"] == "50 mcg", f"[{engine}] dose -> {thyronorm['dose']}"
        assert thyronorm["frequencyPlain"] == "once daily"
        assert thyronorm["duration"] == "90 days", f"[{engine}] duration -> {thyronorm['duration']}"


def test_sos_and_bedtime_abbreviations():
    for engine, result in _both_engines():
        dolo = _by_name(result["medications"], "Paracetamol") or _by_name(
            result["medications"], "Dolo"
        )
        assert dolo is not None, f"[{engine}] dolo/paracetamol not found"
        assert dolo["frequencyPlain"] == "as needed", f"[{engine}] -> {dolo['frequencyPlain']}"
        assert dolo["route"] == "oral"

        atorva = _by_name(result["medications"], "Atorvastatin")
        assert atorva is not None, f"[{engine}] atorvastatin not found"
        assert atorva["frequencyPlain"] == "at bedtime", f"[{engine}] -> {atorva['frequencyPlain']}"


def test_procedure_is_extracted():
    for engine, result in _both_engines():
        assert _by_name(result["procedures"], "Echocardiogram") is not None, (
            f"[{engine}] echocardiogram not found"
        )


def test_empty_and_garbage_input_do_not_crash():
    for text in ("", "   \n\n ", "@@@ ### 12345", "a" * 5000):
        result = extract_clinical(text)
        assert set(result["medications"]) == set() or isinstance(result["medications"], list)
        assert isinstance(result["stats"], dict)


def test_engine_status_reports_how_negation_is_detected():
    status = clinical_ner.engine_status()
    assert status["contextDetection"] in ("medspacy", "trigger-scan")
    assert status["lexicon"]["medications"] > 50


def _run_all() -> int:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for test in tests:
        try:
            test()
            print(f"PASS  {test.__name__}")
        except AssertionError as exc:
            failed += 1
            print(f"FAIL  {test.__name__}: {exc}")
    print(f"\n{len(tests) - failed}/{len(tests)} tests passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(_run_all())
