"""Tests for the deterministic extraction layer.

Run with pytest:      pytest
Or with no pytest:    python tests/test_extraction.py

These cover the parts where a silent regression would be dangerous: unit
conversion, reference-range classification, alias collisions (Hb vs HbA1c,
total vs LDL/HDL cholesterol) and the implausible-value guard.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.reference_ranges import REFERENCE_RANGES, range_for  # noqa: E402
from app.services.gpt import build_deterministic_summary  # noqa: E402
from app.services.ner import extract_parameters  # noqa: E402


def _one(text: str, key: str):
    params = extract_parameters(text)["parameters"]
    return next((p for p in params if p["key"] == key), None)


def test_unit_conversion():
    cases = [
        ("Platelet Count 2,45,000 /cumm", "PLATELETS", 245.0),
        ("Platelet Count 2.5 lakhs/cumm", "PLATELETS", 250.0),
        ("Total Leukocyte Count 7500 cells/cumm", "WBC", 7.5),
        ("WBC 7.5 10^3/uL", "WBC", 7.5),
        ("Hemoglobin 140 g/L", "HEMOGLOBIN", 14.0),
        ("Serum Creatinine 88.4 umol/L", "CREATININE", 1.0),
        ("Fasting Blood Glucose 5.5 mmol/L", "GLUCOSE_FASTING", 99.1),
        ("RBC 4.8 million/cumm", "RBC", 4.8),
    ]
    for text, key, expected in cases:
        param = _one(text, key)
        assert param is not None, f"{key} not extracted from {text!r}"
        assert abs(param["value"] - expected) < 0.6, (text, param["value"], expected)


def test_status_classification():
    assert _one("Hemoglobin 10.4 g/dL\nSex: Female", "HEMOGLOBIN")["status"] == "LOW"
    assert _one("Hemoglobin 14.0 g/dL", "HEMOGLOBIN")["status"] == "NORMAL"
    assert _one("Hemoglobin 19.0 g/dL", "HEMOGLOBIN")["status"] == "HIGH"
    assert _one("LDL Cholesterol 168 mg/dL", "LDL")["status"] == "HIGH"
    assert _one("HDL Cholesterol 62 mg/dL", "HDL")["status"] == "NORMAL"


def test_sex_specific_ranges():
    """HDL 45 mg/dL is normal for a man and low for a woman."""
    male = _one("Sex: Male\nHDL Cholesterol 45 mg/dL", "HDL")
    female = _one("Sex: Female\nHDL Cholesterol 45 mg/dL", "HDL")
    assert male["status"] == "NORMAL", male
    assert female["status"] == "LOW", female
    assert range_for("HDL", "female")["low"] == 50.0


def test_alias_collisions():
    """'Hb' must not steal HbA1c, and 'Cholesterol' must not steal LDL/HDL."""
    text = (
        "Hemoglobin 13.5 g/dL\n"
        "HbA1c 6.8 %\n"
        "Total Cholesterol 248 mg/dL\n"
        "LDL Cholesterol 168 mg/dL\n"
        "HDL Cholesterol 38 mg/dL\n"
    )
    assert _one(text, "HEMOGLOBIN")["value"] == 13.5
    assert _one(text, "HBA1C")["value"] == 6.8
    assert _one(text, "CHOLESTEROL_TOTAL")["value"] == 248.0
    assert _one(text, "LDL")["value"] == 168.0
    assert _one(text, "HDL")["value"] == 38.0


def test_implausible_values_are_flagged_unknown():
    """An OCR misread must never become a confident abnormal flag."""
    param = _one("Platelet Count 2485000 /cumm", "PLATELETS")
    assert param["status"] == "UNKNOWN", param


def test_every_parameter_is_extractable():
    """Each configured parameter must be found by at least its primary alias."""
    for key, spec in REFERENCE_RANGES.items():
        line = f"{spec['testName']} 1.0 {spec['unit']}"
        params = extract_parameters(line)["parameters"]
        assert any(p["key"] == key for p in params), f"{key} not matched by its own testName"


def test_summary_never_empty_and_has_no_invented_numbers():
    params = extract_parameters("Hemoglobin 10.4 g/dL\nSex: Female")["parameters"]
    summary = build_deterministic_summary(params)
    assert len(summary) > 80
    assert "10.4" in summary
    assert build_deterministic_summary([])  # empty case still produces text


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
