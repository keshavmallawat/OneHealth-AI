"""Clinical entity extraction for prescriptions and discharge summaries.

WHAT THIS IS FOR

`ner.py` handles laboratory reports: numeric values compared against published
reference intervals. It finds nothing in a prescription, because a prescription
has no numbers to compare. This module covers that document class — medications
with their dose and schedule, diagnoses, procedures and allergies.

HOW IT STAYS HONEST

  * spaCy does tokenisation, sentence segmentation and phrase matching.
  * medspaCy's ConText decides whether a mention is *asserted* about this
    patient, or negated, historical, hypothetical, or about a relative.
  * The vocabulary is a curated lexicon (`app/data/clinical_terms.py`), so every
    entity traces to an explicit term rather than a model's guess.

Neither library is asked to invent clinical content, and no dosing advice is
produced anywhere — the schedule is read off the page and translated into plain
English ("1-0-1" becomes "twice daily"), never suggested.

THE NEGATION POINT, WHICH MATTERS MOST

"Patient denies any history of diabetes" contains the word *diabetes*. A naive
keyword extractor records a diabetes diagnosis. That is a clinically dangerous
error, and it is exactly what ConText exists to prevent: such a mention is
marked `negated` and is never counted as an active condition.

DEGRADATION

If spaCy, medspaCy or the language model is not installed, a regex engine with
the same output shape runs instead and `engine` says so. The negation guard is
reimplemented there with a trigger-phrase scan, so the safety property holds on
both paths. The platform never silently loses the guarantee.
"""
from __future__ import annotations

import logging
import re
from functools import lru_cache
from typing import Any

from ..data.clinical_terms import (
    ALLERGEN_LOOKUP,
    CONDITION_LOOKUP,
    DOSE_FORMS,
    FOOD_TIMING_LOOKUP,
    FREQUENCY_LOOKUP,
    LEXICON_SIZES,
    MEDICATION_LOOKUP,
    PROCEDURE_LOOKUP,
    ROUTE_LOOKUP,
)

logger = logging.getLogger(__name__)

ENGINE_SPACY = "spacy+medspacy"
ENGINE_REGEX = "rule-based"

# Assertion statuses. Only ASSERTED counts as something the patient has.
ASSERTED = "asserted"
NEGATED = "negated"
HISTORICAL = "historical"
HYPOTHETICAL = "hypothetical"
FAMILY = "family"

# --- shared regexes ---------------------------------------------------------
_DOSE = re.compile(
    r"\b(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|g|ml|l|iu|units?|%|mmol)\b", re.IGNORECASE
)
_DOSE_FORM = re.compile(r"\b(" + "|".join(sorted(DOSE_FORMS, key=len, reverse=True)) + r")\b", re.IGNORECASE)
_DURATION = re.compile(
    r"\b(?:for|x|×)\s*(\d+)\s*(day|days|week|weeks|month|months|night|nights)\b",
    re.IGNORECASE,
)
_STRENGTH_SUFFIX = re.compile(r"\b([a-z]+)[\s-]*(\d{2,4})\b", re.IGNORECASE)

# Negation / context triggers used by the fallback engine. Kept deliberately
# conservative: a missed negation is a safety failure, a spurious one is not.
_NEGATION_TRIGGERS = [
    "no ", "not ", "denies", "denied", "negative for", "without", "ruled out",
    "rule out", "free of", "absence of", "no history of", "no evidence of",
    "nil ", "none", "never had", "no complaints of", "no known",
]
_FAMILY_TRIGGERS = [
    "family history", "father", "mother", "brother", "sister", "sibling",
    "parent", "grandmother", "grandfather", "maternal", "paternal",
]
_HISTORICAL_TRIGGERS = [
    "past history", "previously", "in the past", "previous", "prior ", "old ",
    # Deliberately NOT here: "known case of" / "k/c/o" / "history of". In Indian
    # prescriptions "k/c/o T2DM" means the patient currently has type 2 diabetes;
    # marking it historical would drop a live chronic diagnosis off the summary.
]
_HYPOTHETICAL_TRIGGERS = [
    "if ", "should ", "in case of", "risk of", "may develop", "to rule out",
    "suspected", "possible", "r/o ",
]


def _longest_forms(lookup: dict[str, str]) -> list[str]:
    """Surface forms longest-first, so 'type 2 diabetes' wins over 'diabetes'."""
    return sorted(lookup.keys(), key=len, reverse=True)


# ---------------------------------------------------------------------------
# spaCy + medspaCy pipeline
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _build_pipeline():
    """Return (nlp, notes, context_ok), or (None, notes, False) when unavailable.

    `context_ok` says whether medspaCy's ConText component actually attached. It
    is not cosmetic: without ConText the `ent._.is_negated` family of extensions
    does not exist, `getattr(..., False)` quietly returns False, and every
    negated or family-history mention would be reported as asserted. The caller
    uses this flag to fall back to the trigger scan instead.
    """
    notes: list[str] = []
    try:
        import spacy
    except ImportError:
        return None, ["spaCy is not installed - using the rule-based engine."], False

    try:
        nlp = spacy.load("en_core_web_sm", exclude=["lemmatizer"])
    except OSError:
        # Model missing. A blank English pipeline still gives tokenisation and,
        # with the sentenciser, sentence boundaries - enough for the ruler and
        # ConText to work.
        nlp = spacy.blank("en")
        nlp.add_pipe("sentencizer")
        notes.append(
            "spaCy model 'en_core_web_sm' is not installed; running on a blank "
            "English pipeline. Install it with: python -m spacy download en_core_web_sm"
        )

    # Replace any statistical NER so only our lexicon produces entities.
    if "ner" in nlp.pipe_names:
        nlp.remove_pipe("ner")

    ruler = nlp.add_pipe("entity_ruler", config={"overwrite_ents": True})
    patterns: list[dict[str, Any]] = []
    for label, lookup in (
        ("MEDICATION", MEDICATION_LOOKUP),
        ("CONDITION", CONDITION_LOOKUP),
        ("PROCEDURE", PROCEDURE_LOOKUP),
        ("ALLERGEN", ALLERGEN_LOOKUP),
    ):
        for surface in _longest_forms(lookup):
            tokens = surface.split()
            patterns.append(
                {"label": label, "pattern": [{"LOWER": t} for t in tokens], "id": lookup[surface]}
            )
    ruler.add_patterns(patterns)

    # Importing medspacy is what registers its factories with spaCy. Without
    # this import `nlp.add_pipe("medspacy_context")` raises E002 even though the
    # package is installed.
    context_ok = False
    try:
        import medspacy  # noqa: F401  (import for its side effect: factory registration)
    except ImportError:
        notes.append("medspaCy is not installed; negation falls back to trigger scanning.")
    else:
        try:
            nlp.add_pipe("medspacy_context")
            context_ok = True
        except Exception as exc:  # incompatible version
            notes.append(
                f"medspaCy ConText unavailable ({type(exc).__name__}); "
                "negation falls back to trigger scanning."
            )

        try:
            sectionizer = nlp.add_pipe("medspacy_sectionizer")
            _add_local_section_rules(sectionizer, notes)
        except Exception:
            notes.append("medspaCy section detection unavailable; sections not reported.")

    return nlp, notes, context_ok


def _add_local_section_rules(sectionizer, notes: list[str]) -> None:
    """Teach the sectionizer the headings our sample documents actually use.

    medspaCy ships US-clinic headings. Without these, an Indian discharge summary
    labelled "Procedures:" keeps the previous section's category, so an
    echocardiogram gets filed under "medications" - wrong, and visibly wrong to
    anyone reading the extracted record.
    """
    try:
        from medspacy.section_detection import SectionRule
    except Exception:
        notes.append("Custom section headings not registered; using medspaCy defaults only.")
        return

    extra = [
        ("procedures", ["Procedures", "Procedure", "Investigations", "Investigations Done"]),
        ("diagnoses", ["Diagnosis", "Provisional Diagnosis", "Final Diagnosis", "Impression"]),
        ("medications", ["Rx", "Treatment", "Advice", "Medications Advised"]),
        ("allergy", ["Allergy", "Drug Allergy", "Known Allergies"]),
        ("past_medical_history", ["History", "Past History", "Known Case Of"]),
        ("observation_and_plan", ["Follow Up", "Follow-up", "Plan", "Advice on Discharge"]),
    ]
    rules = []
    for category, literals in extra:
        for literal in literals:
            rules.append(SectionRule(literal=literal, category=category))
    try:
        sectionizer.add(rules)
    except Exception:
        notes.append("Custom section headings could not be added; using medspaCy defaults only.")


def _assertion_from_spacy(ent) -> str:
    """Map medspaCy's context attributes onto our single status field."""
    underscore = ent._
    if getattr(underscore, "is_negated", False):
        return NEGATED
    if getattr(underscore, "is_family", False):
        return FAMILY
    if getattr(underscore, "is_hypothetical", False):
        return HYPOTHETICAL
    if getattr(underscore, "is_historical", False):
        return HISTORICAL
    return ASSERTED


def _assertion_for(ent, line: str, offset: int, *, context_ok: bool) -> str:
    """Decide one assertion status for an entity, safely.

    Two independent detectors run. When ConText is loaded its verdict is used,
    except that a plain `asserted` is still cross-checked against the trigger
    scan: if either detector sees a negation or a family-history cue, the
    non-asserted status wins. Over-suppressing a mention costs a line in the
    extracted list; under-suppressing one records a diagnosis the patient was
    explicitly said not to have, which is the failure this module exists to
    prevent.
    """
    scanned = _assertion_from_text(line, offset if offset >= 0 else len(line))
    if not context_ok:
        return scanned

    spacy_status = _assertion_from_spacy(ent)
    if spacy_status == scanned:
        return spacy_status

    # The two detectors disagree. Which one wins depends on which way the error
    # would hurt.
    #
    # NEGATED and FAMILY remove a finding from the patient's record, so either
    # detector alone is enough: a false suppression costs one line in a list, a
    # missed negation records a diagnosis the note explicitly denied.
    if NEGATED in (spacy_status, scanned):
        return NEGATED
    if FAMILY in (spacy_status, scanned):
        return FAMILY

    # What is left is a disagreement over the qualifiers HISTORICAL and
    # HYPOTHETICAL, and there the trigger scan wins. ConText's shipped rules are
    # liberal with both - they read "Allergic to penicillin" as hypothetical and
    # "Known case of type 2 diabetes mellitus" as historical. Downgrading a live
    # penicillin allergy or a current chronic diagnosis is itself a safety
    # failure, and unlike negation it is one ConText makes routinely on Indian
    # prescription phrasing. The scan's verdict here is ASSERTED, HISTORICAL or
    # HYPOTHETICAL; all three are returned as found.
    return scanned


# ---------------------------------------------------------------------------
# Fallback assertion detection (no medspaCy)
# ---------------------------------------------------------------------------
def _assertion_from_text(line: str, match_start: int) -> str:
    """Scan the words before the mention for a context trigger.

    Only the text preceding the entity on its own line is considered - a trigger
    after the mention ('diabetes: no') is rare in real documents and treating it
    as negation would suppress genuine diagnoses.
    """
    before = line[:match_start].lower()
    window = before[-60:]  # triggers are local; a whole paragraph is not evidence

    for trigger in _FAMILY_TRIGGERS:
        if trigger in window:
            return FAMILY
    for trigger in _NEGATION_TRIGGERS:
        if trigger in window:
            return NEGATED
    for trigger in _HYPOTHETICAL_TRIGGERS:
        if trigger in window:
            return HYPOTHETICAL
    for trigger in _HISTORICAL_TRIGGERS:
        if trigger in window:
            return HISTORICAL
    return ASSERTED


# ---------------------------------------------------------------------------
# Attribute extraction shared by both engines
# ---------------------------------------------------------------------------
def _scan_lookup(line: str, lookup: dict[str, str]) -> tuple[str | None, str | None]:
    """Return (matched surface form as written, canonical label)."""
    lowered = line.lower()
    for surface in sorted(lookup.keys(), key=len, reverse=True):
        # Abbreviations need word boundaries; '1-0-1' style codes do not tokenize
        # as words, so match them literally.
        pattern = re.escape(surface)
        if re.search(r"\d-\d", surface):
            found = re.search(pattern, lowered)
        else:
            found = re.search(r"(?<![a-z0-9])" + pattern + r"(?![a-z0-9])", lowered)
        if found:
            return line[found.start():found.end()], lookup[surface]
    return None, None


def _find_frequency(line: str) -> tuple[str | None, str | None]:
    """Return (matched surface form, plain-English dosing schedule)."""
    return _scan_lookup(line, FREQUENCY_LOOKUP)


def _find_food_timing(line: str) -> str | None:
    """Return 'before food' / 'after food' when the line says so."""
    return _scan_lookup(line, FOOD_TIMING_LOOKUP)[1]


def _find_route(line: str) -> str | None:
    lowered = line.lower()
    for surface in sorted(ROUTE_LOOKUP.keys(), key=len, reverse=True):
        if re.search(r"(?<![a-z])" + re.escape(surface) + r"(?![a-z])", lowered):
            return ROUTE_LOOKUP[surface]
    return None


def _find_dose(line: str, name_end: int) -> str | None:
    """Prefer a dose appearing after the drug name, as prescriptions are written."""
    after = _DOSE.search(line, name_end)
    if after:
        return after.group(0).strip()
    before = _DOSE.search(line[:name_end])
    return before.group(0).strip() if before else None


def _find_duration(line: str) -> str | None:
    found = _DURATION.search(line)
    if not found:
        return None
    count, unit = found.group(1), found.group(2).lower().rstrip("s")
    return f"{count} {unit}" + ("s" if count != "1" else "")


def _find_form(line: str) -> str | None:
    found = _DOSE_FORM.search(line)
    return found.group(1).lower() if found else None


def _confidence(*, specific_name: bool, has_dose: bool, has_frequency: bool, from_ocr: bool) -> float:
    score = 0.55
    if specific_name:
        score += 0.20
    if has_dose:
        score += 0.12
    if has_frequency:
        score += 0.08
    if from_ocr:
        score -= 0.08
    return round(max(0.05, min(score, 0.99)), 2)


# ---------------------------------------------------------------------------
# Engine: spaCy + medspaCy
# ---------------------------------------------------------------------------
def _extract_with_spacy(text: str, *, from_ocr: bool) -> dict[str, Any] | None:
    nlp, notes, context_ok = _build_pipeline()
    if nlp is None:
        return None

    doc = nlp(text)
    lines = text.split("\n")

    def line_for(char_index: int) -> str:
        running = 0
        for line in lines:
            running += len(line) + 1
            if char_index < running:
                return line.strip()
        return ""

    medications: list[dict[str, Any]] = []
    conditions: list[dict[str, Any]] = []
    procedures: list[dict[str, Any]] = []
    allergies: list[dict[str, Any]] = []

    for ent in doc.ents:
        canonical = ent.ent_id_ or ent.text
        line = line_for(ent.start_char)
        section = getattr(ent._, "section_category", None)
        # Position of the entity within its own line, for dose lookup.
        offset = line.lower().find(ent.text.lower())
        assertion = _assertion_for(ent, line, offset, context_ok=context_ok)
        name_end = (offset + len(ent.text)) if offset >= 0 else 0

        if ent.label_ == "MEDICATION":
            frequency_raw, frequency_plain = _find_frequency(line)
            dose = _find_dose(line, name_end)
            medications.append({
                "name": canonical,
                "matchedText": ent.text,
                "dose": dose,
                "form": _find_form(line),
                "frequency": frequency_raw,
                "frequencyPlain": frequency_plain,
                "foodTiming": _find_food_timing(line),
                "route": _find_route(line),
                "duration": _find_duration(line),
                "assertion": assertion,
                "section": section,
                "sourceLine": line[:200],
                "confidence": _confidence(
                    specific_name=len(ent.text) > 4,
                    has_dose=dose is not None,
                    has_frequency=frequency_plain is not None,
                    from_ocr=from_ocr,
                ),
            })
        elif ent.label_ == "CONDITION":
            conditions.append({
                "name": canonical,
                "matchedText": ent.text,
                "assertion": assertion,
                "section": section,
                "sourceLine": line[:200],
                "confidence": _confidence(
                    specific_name=len(ent.text) > 4, has_dose=False,
                    has_frequency=False, from_ocr=from_ocr,
                ),
            })
        elif ent.label_ == "PROCEDURE":
            procedures.append({
                "name": canonical, "matchedText": ent.text, "assertion": assertion,
                "section": section, "sourceLine": line[:200],
                "confidence": _confidence(specific_name=len(ent.text) > 3, has_dose=False,
                                          has_frequency=False, from_ocr=from_ocr),
            })
        elif ent.label_ == "ALLERGEN":
            allergies.append({
                "name": canonical, "matchedText": ent.text, "assertion": assertion,
                "section": section, "sourceLine": line[:200],
                "confidence": _confidence(specific_name=len(ent.text) > 3, has_dose=False,
                                          has_frequency=False, from_ocr=from_ocr),
            })

    sections = []
    try:
        sections = sorted({s.category for s in doc._.sections if s.category})
    except Exception:
        pass

    return {
        "engine": ENGINE_SPACY,
        "engineNotes": notes,
        "medications": _dedupe(medications),
        "conditions": _dedupe(conditions),
        "procedures": _dedupe(procedures),
        "allergies": _dedupe(allergies),
        "sections": sections,
    }


# ---------------------------------------------------------------------------
# Engine: regex fallback
# ---------------------------------------------------------------------------
def _scan(lookup: dict[str, str], line: str) -> list[tuple[str, str, int, int]]:
    """Longest-first, non-overlapping scan. Returns (canonical, surface, start, end)."""
    found: list[tuple[str, str, int, int]] = []
    claimed: list[tuple[int, int]] = []
    lowered = line.lower()
    for surface in _longest_forms(lookup):
        for match in re.finditer(r"(?<![a-z0-9])" + re.escape(surface) + r"(?![a-z0-9])", lowered):
            start, end = match.span()
            if any(start < c_end and end > c_start for c_start, c_end in claimed):
                continue
            claimed.append((start, end))
            found.append((lookup[surface], line[start:end], start, end))
    return found


def _extract_with_regex(text: str, *, from_ocr: bool) -> dict[str, Any]:
    medications: list[dict[str, Any]] = []
    conditions: list[dict[str, Any]] = []
    procedures: list[dict[str, Any]] = []
    allergies: list[dict[str, Any]] = []

    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line:
            continue

        for canonical, surface, start, end in _scan(MEDICATION_LOOKUP, line):
            frequency_raw, frequency_plain = _find_frequency(line)
            dose = _find_dose(line, end)
            medications.append({
                "name": canonical, "matchedText": surface, "dose": dose,
                "form": _find_form(line), "frequency": frequency_raw,
                "frequencyPlain": frequency_plain,
                "foodTiming": _find_food_timing(line),
                "route": _find_route(line),
                "duration": _find_duration(line),
                "assertion": _assertion_from_text(line, start),
                "section": None, "sourceLine": line[:200],
                "confidence": _confidence(specific_name=len(surface) > 4,
                                          has_dose=dose is not None,
                                          has_frequency=frequency_plain is not None,
                                          from_ocr=from_ocr),
            })

        for bucket, lookup in (
            (conditions, CONDITION_LOOKUP),
            (procedures, PROCEDURE_LOOKUP),
            (allergies, ALLERGEN_LOOKUP),
        ):
            for canonical, surface, start, _end in _scan(lookup, line):
                bucket.append({
                    "name": canonical, "matchedText": surface,
                    "assertion": _assertion_from_text(line, start),
                    "section": None, "sourceLine": line[:200],
                    "confidence": _confidence(specific_name=len(surface) > 4, has_dose=False,
                                              has_frequency=False, from_ocr=from_ocr),
                })

    return {
        "engine": ENGINE_REGEX,
        "engineNotes": ["spaCy/medspaCy not in use; rule-based engine with trigger-based negation."],
        "medications": _dedupe(medications),
        "conditions": _dedupe(conditions),
        "procedures": _dedupe(procedures),
        "allergies": _dedupe(allergies),
        "sections": [],
    }


def _dedupe(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One entry per (name, assertion); keep the most informative occurrence."""
    def richness(item: dict[str, Any]) -> tuple:
        return (
            item.get("dose") is not None,
            item.get("frequencyPlain") is not None,
            item.get("duration") is not None,
            item.get("confidence", 0),
        )

    best: dict[tuple[str, str], dict[str, Any]] = {}
    for item in items:
        key = (item["name"], item["assertion"])
        if key not in best or richness(item) > richness(best[key]):
            best[key] = item
    return sorted(best.values(), key=lambda i: i["name"])


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def extract_clinical(text: str, *, from_ocr: bool = False) -> dict[str, Any]:
    """Extract medications, conditions, procedures and allergies from free text.

    Always returns the same shape. `engine` names which implementation ran, and
    every entity carries an `assertion` so a negated or family-history mention is
    never mistaken for something the patient has.
    """
    if not text or not text.strip():
        return {
            "engine": ENGINE_REGEX, "engineNotes": ["Empty document."],
            "medications": [], "conditions": [], "procedures": [], "allergies": [],
            "sections": [], "stats": _stats([], [], [], []),
        }

    result = None
    try:
        result = _extract_with_spacy(text, from_ocr=from_ocr)
    except Exception as exc:  # never let NLP break the upload pipeline
        logger.warning("spaCy clinical extraction failed (%s); using rule-based engine", exc)

    if result is None:
        result = _extract_with_regex(text, from_ocr=from_ocr)

    result["stats"] = _stats(
        result["medications"], result["conditions"],
        result["procedures"], result["allergies"],
    )
    result["lexicon"] = LEXICON_SIZES
    return result


# Statuses under which a finding still belongs to the patient. HISTORICAL is
# included on purpose: a condition the patient had in the past is still theirs
# and still belongs on the record, just dated. NEGATED, FAMILY and HYPOTHETICAL
# are not the patient's current findings and are counted as excluded instead.
_PATIENT_STATUSES = (ASSERTED, HISTORICAL)


def _stats(medications, conditions, procedures, allergies) -> dict[str, int]:
    def asserted(items):
        return [i for i in items if i["assertion"] in _PATIENT_STATUSES]

    return {
        "medicationCount": len(asserted(medications)),
        "conditionCount": len(asserted(conditions)),
        "procedureCount": len(asserted(procedures)),
        "allergyCount": len(asserted(allergies)),
        # Mentions that exist in the document but are NOT attributed to the
        # patient. Surfaced so the count is explainable rather than silently
        # smaller than what a reader sees on the page.
        "excludedMentions": sum(
            len([i for i in items if i["assertion"] not in _PATIENT_STATUSES])
            for items in (medications, conditions, procedures, allergies)
        ),
        "totalEntities": sum(len(items) for items in (medications, conditions, procedures, allergies)),
    }


def engine_status() -> dict[str, Any]:
    """Reported by /health so the active engine is visible without a document."""
    nlp, notes, context_ok = _build_pipeline()
    return {
        "available": True,  # one engine always runs
        "contextDetection": "medspacy" if context_ok else "trigger-scan",
        "engine": ENGINE_SPACY if nlp is not None else ENGINE_REGEX,
        "notes": notes,
        "lexicon": LEXICON_SIZES,
    }
