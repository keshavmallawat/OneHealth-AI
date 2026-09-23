"""Medical parameter extraction and reference-range comparison.

Approach (and why it is not an LLM):
  A language model asked to "read the values off this report" will happily
  hallucinate a plausible number. For a healthcare tool that is unacceptable, so
  extraction here is fully deterministic: alias matching -> number capture ->
  unit normalisation -> comparison against the hard-coded intervals in
  app/data/reference_ranges.py. The LLM is used ONLY to phrase the summary of
  values that this module already extracted.

Every returned parameter carries the exact source line it came from, so any
value shown in the UI can be traced back to the text on the report.
"""
from __future__ import annotations

import re
from typing import Any

from ..data.reference_ranges import PANEL_OF, REFERENCE_RANGES, range_for

STATUS_NORMAL = "NORMAL"
STATUS_LOW = "LOW"
STATUS_HIGH = "HIGH"
STATUS_UNKNOWN = "UNKNOWN"

# A number with any digit grouping: 250,000 / 2,45,000 (Indian lakh notation,
# very common on Indian lab reports) / 13.4 / 7
_NUMBER = r"(\d[\d,]*(?:\.\d+)?)"
_NUMBER_RE = re.compile(_NUMBER)

# "12.0 - 15.0", "12.0–15.0", "12 to 15"
_RANGE_RE = re.compile(_NUMBER + r"\s*(?:-|–|—|to)\s*" + _NUMBER, re.IGNORECASE)
# "< 200", "<=200", "Upto 150"
_MAX_RE = re.compile(r"(?:<|<=|less than|upto|up to)\s*" + _NUMBER, re.IGNORECASE)
_MIN_RE = re.compile(r"(?:>|>=|greater than|above)\s*" + _NUMBER, re.IGNORECASE)


def _alias(pattern: str) -> re.Pattern[str]:
    """Word-boundary alias matcher tolerant of extra spaces and OCR noise."""
    escaped = re.escape(pattern).replace(r"\ ", r"[\s\.\-_]*")
    return re.compile(r"(?<![A-Za-z0-9])" + escaped + r"(?![A-Za-z0-9])", re.IGNORECASE)


# Aliases are ordered most-specific-first within each parameter.
# `specific` marks aliases that are unambiguous full names (higher confidence)
# versus short abbreviations that could collide.
PARAMETER_PATTERNS: list[dict[str, Any]] = [
    # --- Checked before HEMOGLOBIN so "HbA1c" never matches the "Hb" alias ---
    {"key": "HBA1C",
     "aliases": ["glycated hemoglobin", "glycosylated haemoglobin", "glycated haemoglobin",
                 "hba1c", "hb a1c", "a1c"],
     "specific": {"glycated hemoglobin", "glycosylated haemoglobin", "glycated haemoglobin", "hba1c"}},
    {"key": "HEMOGLOBIN",
     "aliases": ["hemoglobin", "haemoglobin", "hgb", "hb"],
     "specific": {"hemoglobin", "haemoglobin"},
     "excludeIfLine": ["a1c", "glycat", "glycos", "mchc", "mch "]},
    {"key": "WBC",
     "aliases": ["total leukocyte count", "total leucocyte count", "white blood cell count",
                 "white blood cells", "leukocyte count", "leucocyte count", "tlc", "wbc"],
     "specific": {"total leukocyte count", "total leucocyte count", "white blood cell count",
                  "white blood cells", "leukocyte count", "leucocyte count"},
     "excludeIfLine": ["differential"]},
    {"key": "RBC",
     "aliases": ["red blood cell count", "red blood cells", "erythrocyte count",
                 "rbc count", "rbc"],
     "specific": {"red blood cell count", "red blood cells", "erythrocyte count"}},
    {"key": "PLATELETS",
     "aliases": ["platelet count", "platelets", "thrombocyte count", "plt"],
     "specific": {"platelet count", "platelets", "thrombocyte count"}},
    {"key": "GLUCOSE_FASTING",
     "aliases": ["fasting blood glucose", "fasting plasma glucose", "fasting blood sugar",
                 "glucose fasting", "blood sugar fasting", "fbs", "fasting glucose", "glucose"],
     "specific": {"fasting blood glucose", "fasting plasma glucose", "fasting blood sugar",
                  "glucose fasting", "blood sugar fasting", "fasting glucose"},
     "excludeIfLine": ["post prandial", "postprandial", "pp ", "random", "urine"]},
    {"key": "CREATININE",
     "aliases": ["serum creatinine", "creatinine"],
     "specific": {"serum creatinine", "creatinine"},
     "excludeIfLine": ["clearance", "urine", "ratio"]},
    {"key": "TSH",
     "aliases": ["thyroid stimulating hormone", "thyroid-stimulating hormone", "tsh"],
     "specific": {"thyroid stimulating hormone", "thyroid-stimulating hormone"}},
    # --- LDL / HDL before total cholesterol so the generic alias cannot steal them ---
    {"key": "LDL",
     "aliases": ["ldl cholesterol", "ldl-cholesterol", "ldl chol", "ldl"],
     "specific": {"ldl cholesterol", "ldl-cholesterol"},
     "excludeIfLine": ["vldl", "non-hdl", "non hdl", "ratio"]},
    {"key": "HDL",
     "aliases": ["hdl cholesterol", "hdl-cholesterol", "hdl chol", "hdl"],
     "specific": {"hdl cholesterol", "hdl-cholesterol"},
     "excludeIfLine": ["non-hdl", "non hdl", "ratio"]},
    {"key": "TRIGLYCERIDES",
     "aliases": ["triglycerides", "triglyceride", "tgl", "tg"],
     "specific": {"triglycerides", "triglyceride"}},
    {"key": "CHOLESTEROL_TOTAL",
     "aliases": ["total cholesterol", "cholesterol total", "serum cholesterol", "cholesterol"],
     "specific": {"total cholesterol", "cholesterol total", "serum cholesterol"},
     "excludeIfLine": ["hdl", "ldl", "vldl", "ratio", "non-hdl"]},
    {"key": "ALT",
     "aliases": ["alanine aminotransferase", "alanine transaminase", "sgpt", "alt"],
     "specific": {"alanine aminotransferase", "alanine transaminase", "sgpt"}},
    {"key": "AST",
     "aliases": ["aspartate aminotransferase", "aspartate transaminase", "sgot", "ast"],
     "specific": {"aspartate aminotransferase", "aspartate transaminase", "sgot"}},
]

# Pre-compile
for _spec in PARAMETER_PATTERNS:
    _spec["compiled"] = [(a, _alias(a)) for a in _spec["aliases"]]


# --- Unit normalisation -------------------------------------------------------
# Each entry maps a detected unit (lowercased, punctuation-stripped) to a factor
# that converts the reported value into our canonical unit.
UNIT_CONVERSIONS: dict[str, list[tuple[str, float]]] = {
    "HEMOGLOBIN": [("g/dl", 1.0), ("gm/dl", 1.0), ("g/l", 0.1), ("gm%", 1.0), ("g%", 1.0)],
    "GLUCOSE_FASTING": [("mg/dl", 1.0), ("mg%", 1.0), ("mmol/l", 18.0182)],
    "CHOLESTEROL_TOTAL": [("mg/dl", 1.0), ("mmol/l", 38.67)],
    "LDL": [("mg/dl", 1.0), ("mmol/l", 38.67)],
    "HDL": [("mg/dl", 1.0), ("mmol/l", 38.67)],
    "TRIGLYCERIDES": [("mg/dl", 1.0), ("mmol/l", 88.57)],
    "CREATININE": [("mg/dl", 1.0), ("umol/l", 1 / 88.4), ("µmol/l", 1 / 88.4)],
    "TSH": [("miu/l", 1.0), ("uiu/ml", 1.0), ("µiu/ml", 1.0), ("miu/ml", 1.0), ("iu/ml", 1.0)],
    "ALT": [("u/l", 1.0), ("iu/l", 1.0), ("units/l", 1.0)],
    "AST": [("u/l", 1.0), ("iu/l", 1.0), ("units/l", 1.0)],
    "HBA1C": [("%", 1.0), ("percent", 1.0)],
    "WBC": [("10^3/ul", 1.0), ("10*3/ul", 1.0), ("thou/ul", 1.0), ("k/ul", 1.0),
            ("/ul", 0.001), ("/cumm", 0.001), ("cells/cumm", 0.001), ("/mm3", 0.001)],
    "PLATELETS": [("10^3/ul", 1.0), ("10*3/ul", 1.0), ("thou/ul", 1.0), ("k/ul", 1.0),
                  ("lakhs/cumm", 100.0), ("lakh/cumm", 100.0),
                  ("/ul", 0.001), ("/cumm", 0.001), ("/mm3", 0.001)],
    "RBC": [("10^6/ul", 1.0), ("mill/cumm", 1.0), ("million/cumm", 1.0),
            ("10*6/ul", 1.0), ("m/ul", 1.0), ("/ul", 1e-6), ("/cumm", 1e-6)],
}

_UNIT_TOKEN_RE = re.compile(
    r"(10\^?\*?[36]\s*/\s*[uµ]l|lakhs?\s*/\s*cumm|million\s*/\s*cumm|mill\s*/\s*cumm|"
    r"cells\s*/\s*cumm|thou\s*/\s*[uµ]l|k\s*/\s*[uµ]l|"
    r"g\s*/\s*dl|gm\s*/\s*dl|gm\s*%|g\s*%|g\s*/\s*l|"
    r"mg\s*/\s*dl|mg\s*%|mmol\s*/\s*l|[uµ]mol\s*/\s*l|"
    r"m?[uµ]?iu\s*/\s*m?l|miu\s*/\s*l|"
    r"i?u\s*/\s*l|units\s*/\s*l|"
    r"/\s*cumm|/\s*mm3|/\s*[uµ]l|%)",
    re.IGNORECASE,
)


def _normalise_unit(raw: str) -> str:
    return re.sub(r"\s+", "", raw.lower()).replace("*", "^").replace("µ", "u")


def _convert(key: str, value: float, unit_raw: str | None) -> tuple[float, str | None, bool]:
    """Return (canonical_value, matched_unit, unit_recognised)."""
    spec = REFERENCE_RANGES[key]
    table = UNIT_CONVERSIONS.get(key, [])
    if unit_raw:
        norm = _normalise_unit(unit_raw)
        for candidate, factor in table:
            if _normalise_unit(candidate) == norm:
                return value * factor, unit_raw.strip(), True

    # No unit printed (or unrecognised): fall back to magnitude heuristics for the
    # count-based parameters, which are the only ones commonly written two ways.
    if key in ("WBC", "PLATELETS") and value > 1000:
        return value / 1000.0, unit_raw.strip() if unit_raw else None, False
    if key == "RBC" and value > 1000:
        return value / 1_000_000.0, unit_raw.strip() if unit_raw else None, False
    if key == "PLATELETS" and value < 10:  # "2.5 lakhs"
        return value * 100.0, unit_raw.strip() if unit_raw else None, False
    return value, unit_raw.strip() if unit_raw else None, False


def _classify(value: float, low: float | None, high: float | None) -> str:
    if low is not None and value < low:
        return STATUS_LOW
    if high is not None and value > high:
        return STATUS_HIGH
    return STATUS_NORMAL


def detect_sex(text: str) -> str | None:
    """Read the patient's sex off the report header when it is printed."""
    match = re.search(r"\b(?:sex|gender)\s*[:\-]?\s*(male|female|m|f)\b", text, re.IGNORECASE)
    if not match:
        return None
    token = match.group(1).lower()
    return "male" if token in ("male", "m") else "female"


def _reported_range(tail: str) -> str | None:
    range_match = _RANGE_RE.search(tail)
    if range_match:
        return f"{range_match.group(1).rstrip(chr(44))} - {range_match.group(2).rstrip(chr(44))}"
    max_match = _MAX_RE.search(tail)
    if max_match:
        return f"< {max_match.group(1)}"
    min_match = _MIN_RE.search(tail)
    if min_match:
        return f"> {min_match.group(1)}"
    return None


def _score_confidence(
    *, is_specific: bool, unit_recognised: bool, has_reported_range: bool,
    plausible: bool, from_ocr: bool,
) -> float:
    score = 0.45
    score += 0.25 if is_specific else 0.08
    if unit_recognised:
        score += 0.18
    if has_reported_range:
        score += 0.09
    if plausible:
        score += 0.05
    if from_ocr:
        score -= 0.07
    return round(max(0.05, min(score, 0.99)), 2)


def extract_parameters(text: str, *, from_ocr: bool = False) -> dict[str, Any]:
    """Extract every recognised laboratory parameter from report text."""
    sex = detect_sex(text)
    lines = [ln.strip() for ln in re.split(r"[\r\n]+", text) if ln.strip()]
    best: dict[str, dict[str, Any]] = {}

    for line in lines:
        lowered = line.lower()
        for spec in PARAMETER_PATTERNS:
            key = spec["key"]
            if any(bad in lowered for bad in spec.get("excludeIfLine", [])):
                continue

            for alias_text, pattern in spec["compiled"]:
                match = pattern.search(line)
                if not match:
                    continue

                tail = line[match.end():]
                number_match = _NUMBER_RE.search(tail)
                if not number_match:
                    break  # alias matched but no value on this line

                raw_value = float(number_match.group(1).replace(",", "").rstrip("."))
                after_value = tail[number_match.end():]

                unit_match = _UNIT_TOKEN_RE.search(after_value[:28])
                unit_raw = unit_match.group(1) if unit_match else None

                value, matched_unit, unit_recognised = _convert(key, raw_value, unit_raw)

                meta = REFERENCE_RANGES[key]
                lo_p, hi_p = meta["plausible"]
                plausible = lo_p <= value <= hi_p

                reported = _reported_range(
                    after_value[unit_match.end():] if unit_match else after_value
                )

                effective = range_for(key, sex)
                status = (
                    _classify(value, effective["low"], effective["high"])
                    if plausible else STATUS_UNKNOWN
                )

                confidence = _score_confidence(
                    is_specific=alias_text in spec.get("specific", set()),
                    unit_recognised=unit_recognised,
                    has_reported_range=reported is not None,
                    plausible=plausible,
                    from_ocr=from_ocr,
                )

                candidate = {
                    "key": key,
                    "testName": meta["testName"],
                    "value": round(value, 3),
                    "rawValue": raw_value,
                    "unit": meta["unit"],
                    "reportedUnit": matched_unit,
                    "referenceRange": effective["display"],
                    "referenceLow": effective["low"],
                    "referenceHigh": effective["high"],
                    "referenceBasis": effective["basis"],
                    "referenceSource": meta["source"],
                    "reportedRange": reported,
                    "status": status,
                    "confidence": confidence,
                    "panel": PANEL_OF.get(key, "Other"),
                    "sourceLine": line[:200],
                    "patientLabel": meta["patientLabel"],
                }

                existing = best.get(key)
                if existing is None or candidate["confidence"] > existing["confidence"]:
                    best[key] = candidate
                break  # first alias that matched wins for this parameter/line

    ordered_keys = [s["key"] for s in PARAMETER_PATTERNS]
    parameters = [best[k] for k in ordered_keys if k in best]
    parameters.sort(key=lambda p: (p["panel"], p["testName"]))

    abnormal = [p for p in parameters if p["status"] in (STATUS_LOW, STATUS_HIGH)]
    return {
        "parameters": parameters,
        "detectedSex": sex,
        "stats": {
            "parameterCount": len(parameters),
            "abnormalCount": len(abnormal),
            "normalCount": sum(1 for p in parameters if p["status"] == STATUS_NORMAL),
            "unknownCount": sum(1 for p in parameters if p["status"] == STATUS_UNKNOWN),
        },
    }
