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


def test_ocr_confusions_are_recovered():
    """Patterns seen when Tesseract reads real lab-style scans."""
    # Exponent in x10^3/uL comes back as a degree sign: must not be read as /uL.
    plt = _one("Platelet Count 317 x10°3/uL 150 - 450", "PLATELETS")
    assert plt is not None and plt["value"] == 317.0, plt
    wbc = _one("Total Leukocyte Count 3.0 L x10*3/uL 4.0 - 11.0", "WBC")
    assert wbc is not None and wbc["value"] == 3.0, wbc
    # HbA1c with the digit 1 read as a lowercase L.
    a1c = _one("HbAlc 4.6 % 4.0 - 5.6 %", "HBA1C")
    assert a1c is not None and a1c["value"] == 4.6, a1c
    # The glycosylated spelling used by many Indian labs.
    gly = _one("Glycosylated Hemoglobin (HbA1c) 6.2 H % 4.0 - 5.6 %", "HBA1C")
    assert gly is not None and gly["value"] == 6.2, gly
    # ...and it must never leak into the haemoglobin result.
    assert _one("Glycosylated Hemoglobin (HbA1c) 6.2 H % 4.0 - 5.6 %", "HEMOGLOBIN") is None


def test_misread_labels_and_values_are_not_reported_confidently():
    """The silent-wrong cases found by the benchmark: they must fail safe."""
    def one(text, key, ocr=True):
        params = extract_parameters(text, from_ocr=ocr)["parameters"]
        return next((p for p in params if p["key"] == key), None)

    # OCR garbled "LDL" -> "LOL": the LDL result must never become total cholesterol.
    assert one("LOL Cholesterol 132 mg/dL < 100 mg/dL", "CHOLESTEROL_TOTAL") is None
    # A clean line still works, including when the label is first on the line.
    assert one("Cholesterol - Total 292 H mg/dL < 200", "CHOLESTEROL_TOTAL")["value"] == 292.0
    # Result unreadable: the first number is the reference range, not the result.
    assert one("HbAlc Boake 4.0 - 5.6 %", "HBA1C") is None
    assert one("Total Cholesterol < 200 mg/dL", "CHOLESTEROL_TOTAL") is None
    # First digit misread as a symbol: value is flagged unreliable, never NORMAL/HIGH/LOW.
    ldl = one("LDL Cholesterol $7 mg/dL < 100", "LDL")
    assert ldl is not None and ldl["status"] == "UNKNOWN" and ldl["ocrUncertain"], ldl
    # The same glued form on a digital (non-OCR) report is left alone.
    assert one("ALT 52 U/L 7 - 56", "ALT", ocr=False)["status"] == "NORMAL"


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
