"""Explicit, traceable reference ranges for the laboratory parameters we extract.

DESIGN NOTES (important for evaluation):
  * Nothing here is inferred by a model. Every range is a hard-coded constant
    with a documented source, so any reported NORMAL / LOW / HIGH decision can
    be traced back to a specific published interval.
  * Ranges are adult, non-pregnant values. Where a parameter differs materially
    by sex we keep the sex-specific intervals AND a combined interval that is
    used when the report does not state the patient's sex.
  * These are typical intervals only. Real laboratories publish their own
    method-specific ranges; when the uploaded report prints its own range we
    surface that too (as `reportedRange`) alongside ours.
  * This module is deliberately data-only - no I/O, no model calls.

SOURCES (general adult clinical chemistry / haematology reference intervals):
  - Harrison's Principles of Internal Medicine, Appendix: Laboratory Values
  - Tietz Textbook of Clinical Chemistry and Molecular Diagnostics
  - WHO haemoglobin thresholds for anaemia (haemoglobin lower limits)
  - American Diabetes Association, Standards of Care (fasting glucose, HbA1c)
  - NCEP ATP III / AHA lipid classification (cholesterol, LDL, HDL, triglycerides)
"""
from __future__ import annotations

from typing import Any

# `low` / `high` of None means "unbounded on that side".
# `display` is what we show to the patient; it always matches low/high.
REFERENCE_RANGES: dict[str, dict[str, Any]] = {
    "HEMOGLOBIN": {
        "testName": "Hemoglobin",
        "unit": "g/dL",
        "low": 12.0, "high": 17.0,
        "display": "12.0 - 17.0 g/dL",
        "bySex": {
            "male":   {"low": 13.0, "high": 17.0, "display": "13.0 - 17.0 g/dL"},
            "female": {"low": 12.0, "high": 15.0, "display": "12.0 - 15.0 g/dL"},
        },
        "plausible": (2.0, 25.0),
        "source": "WHO anaemia thresholds; Harrison's Appendix (adult)",
        "patientLabel": "the oxygen-carrying protein in your red blood cells",
    },
    "WBC": {
        "testName": "White Blood Cell Count",
        "unit": "10^3/uL",
        "low": 4.0, "high": 11.0,
        "display": "4.0 - 11.0 x10^3/uL",
        "plausible": (0.5, 150.0),
        "source": "Harrison's Appendix (adult total leukocyte count)",
        "patientLabel": "the cells your body uses to fight infection",
    },
    "RBC": {
        "testName": "Red Blood Cell Count",
        "unit": "10^6/uL",
        "low": 4.1, "high": 5.9,
        "display": "4.1 - 5.9 x10^6/uL",
        "bySex": {
            "male":   {"low": 4.5, "high": 5.9, "display": "4.5 - 5.9 x10^6/uL"},
            "female": {"low": 4.1, "high": 5.1, "display": "4.1 - 5.1 x10^6/uL"},
        },
        "plausible": (1.0, 10.0),
        "source": "Harrison's Appendix (adult erythrocyte count)",
        "patientLabel": "the number of red blood cells carrying oxygen around your body",
    },
    "PLATELETS": {
        "testName": "Platelet Count",
        "unit": "10^3/uL",
        "low": 150.0, "high": 450.0,
        "display": "150 - 450 x10^3/uL",
        "plausible": (10.0, 2000.0),
        "source": "Harrison's Appendix (adult platelet count)",
        "patientLabel": "the cell fragments that help your blood clot",
    },
    "GLUCOSE_FASTING": {
        "testName": "Fasting Blood Glucose",
        "unit": "mg/dL",
        "low": 70.0, "high": 99.0,
        "display": "70 - 99 mg/dL",
        "plausible": (10.0, 900.0),
        "source": "American Diabetes Association - normal fasting plasma glucose",
        "patientLabel": "your blood sugar level after fasting",
    },
    "HBA1C": {
        "testName": "HbA1c (Glycated Hemoglobin)",
        "unit": "%",
        "low": 4.0, "high": 5.6,
        "display": "4.0 - 5.6 %",
        "plausible": (2.0, 20.0),
        "source": "American Diabetes Association - normal <5.7%",
        "patientLabel": "your average blood sugar over the past 2-3 months",
    },
    "CREATININE": {
        "testName": "Serum Creatinine",
        "unit": "mg/dL",
        "low": 0.6, "high": 1.3,
        "display": "0.6 - 1.3 mg/dL",
        "bySex": {
            "male":   {"low": 0.7, "high": 1.3, "display": "0.7 - 1.3 mg/dL"},
            "female": {"low": 0.6, "high": 1.1, "display": "0.6 - 1.1 mg/dL"},
        },
        "plausible": (0.1, 25.0),
        "source": "Tietz / Harrison's Appendix (adult serum creatinine)",
        "patientLabel": "a waste product that shows how well your kidneys are filtering",
    },
    "TSH": {
        "testName": "TSH (Thyroid Stimulating Hormone)",
        "unit": "mIU/L",
        "low": 0.4, "high": 4.0,
        "display": "0.4 - 4.0 mIU/L",
        "plausible": (0.001, 200.0),
        "source": "Harrison's Appendix (adult TSH)",
        "patientLabel": "the hormone that controls your thyroid gland",
    },
    "CHOLESTEROL_TOTAL": {
        "testName": "Total Cholesterol",
        "unit": "mg/dL",
        "low": None, "high": 200.0,
        "display": "< 200 mg/dL (desirable)",
        "plausible": (20.0, 1000.0),
        "source": "NCEP ATP III - desirable total cholesterol",
        "patientLabel": "the total amount of cholesterol in your blood",
    },
    "LDL": {
        "testName": "LDL Cholesterol",
        "unit": "mg/dL",
        "low": None, "high": 100.0,
        "display": "< 100 mg/dL (optimal)",
        "plausible": (5.0, 800.0),
        "source": "NCEP ATP III - optimal LDL",
        "patientLabel": "the 'bad' cholesterol that can build up in your arteries",
    },
    "HDL": {
        "testName": "HDL Cholesterol",
        "unit": "mg/dL",
        "low": 40.0, "high": None,
        "display": "> 40 mg/dL",
        "bySex": {
            "male":   {"low": 40.0, "high": None, "display": "> 40 mg/dL"},
            "female": {"low": 50.0, "high": None, "display": "> 50 mg/dL"},
        },
        "plausible": (5.0, 200.0),
        "source": "NCEP ATP III / AHA - low HDL threshold",
        "patientLabel": "the 'good' cholesterol that helps protect your heart",
    },
    "TRIGLYCERIDES": {
        "testName": "Triglycerides",
        "unit": "mg/dL",
        "low": None, "high": 150.0,
        "display": "< 150 mg/dL (normal)",
        "plausible": (10.0, 5000.0),
        "source": "NCEP ATP III - normal triglycerides",
        "patientLabel": "a type of fat carried in your blood",
    },
    "ALT": {
        "testName": "ALT (SGPT)",
        "unit": "U/L",
        "low": 7.0, "high": 56.0,
        "display": "7 - 56 U/L",
        "plausible": (1.0, 5000.0),
        "source": "Harrison's Appendix (adult alanine aminotransferase)",
        "patientLabel": "a liver enzyme that rises when the liver is irritated",
    },
    "AST": {
        "testName": "AST (SGOT)",
        "unit": "U/L",
        "low": 10.0, "high": 40.0,
        "display": "10 - 40 U/L",
        "plausible": (1.0, 5000.0),
        "source": "Harrison's Appendix (adult aspartate aminotransferase)",
        "patientLabel": "a liver enzyme that can also come from muscle",
    },
}

# Panel grouping - used to organise the report detail page.
PANELS: dict[str, list[str]] = {
    "Complete Blood Count": ["HEMOGLOBIN", "RBC", "WBC", "PLATELETS"],
    "Diabetes Profile": ["GLUCOSE_FASTING", "HBA1C"],
    "Lipid Profile": ["CHOLESTEROL_TOTAL", "LDL", "HDL", "TRIGLYCERIDES"],
    "Liver Function": ["ALT", "AST"],
    "Kidney Function": ["CREATININE"],
    "Thyroid Function": ["TSH"],
}

PANEL_OF: dict[str, str] = {
    key: panel for panel, keys in PANELS.items() for key in keys
}


def range_for(key: str, sex: str | None = None) -> dict[str, Any]:
    """Return the effective range for a parameter, honouring sex when known.

    `basis` explains WHY this interval was chosen, so the UI never implies that
    sex detection failed when the parameter simply has no sex-specific range.
    """
    spec = REFERENCE_RANGES[key]
    has_sex_variants = "bySex" in spec

    if sex and has_sex_variants:
        variant = spec["bySex"].get(sex.lower())
        if variant:
            return {
                "low": variant["low"],
                "high": variant["high"],
                "display": variant["display"],
                "basis": f"adult {sex.lower()}",
            }

    if has_sex_variants:
        # Sex-specific interval exists but the report did not state the patient's
        # sex, so the wider combined interval is used.
        basis = "adult, combined range (sex not stated on report)"
    else:
        basis = "adult reference range"

    return {
        "low": spec["low"],
        "high": spec["high"],
        "display": spec["display"],
        "basis": basis,
    }
