"""Grounded question answering over a patient's own extracted results.

Safety model — the part that matters most in this file:

  * The assistant is given a context assembled by the Node backend from ONE
    patient's own records. It has no database access and no way to reach any
    other patient's data.
  * It answers from that context only. If a value is not in the context it says
    so; it never estimates, interpolates or recalls a number.
  * Diagnosis, prescription and dosage questions are refused by an explicit
    intent check that runs BEFORE any answer is composed, so no phrasing path
    can bypass it.
  * The deterministic composer is the source of every fact. When a language
    model is configured it is asked only to re-word an answer that has already
    been composed here, and the response is discarded if it introduces a number
    the deterministic answer did not contain.
"""
from __future__ import annotations

import re
from typing import Any

from ..data.explanations import EXPLANATIONS
from ..data.reference_ranges import REFERENCE_RANGES
from .ner import PARAMETER_PATTERNS

DISCLAIMER = (
    "This is general information about your own uploaded results, not a "
    "diagnosis. Please discuss anything that concerns you with a qualified "
    "healthcare professional."
)

# Questions that ask the assistant to act as a clinician. Checked first.
# Nouns that make "do I have ..." an inventory question, not a clinical one.
_BENIGN_OBJECT = (
    r"(?:any\s+|a\s+|an\s+|more\s+)?"
    r"(?:report|record|result|test|value|parameter|reading|document|file|upload|"
    r"consent|doctor|access|share|reminder|trend)"
)

_REFUSAL_PATTERNS = [
    # "do I have diabetes" is a diagnosis request; "do I have any reports" is not.
    (re.compile(r"\b(do|have)\s+i\s+(have|got)\s+(?!" + _BENIGN_OBJECT + r")", re.I), "diagnosis"),
    (re.compile(r"\bam\s+i\s+(diabetic|anaemic|anemic|ill|sick|dying|healthy enough)\b", re.I), "diagnosis"),
    (re.compile(r"\b(diagnos\w*)\b", re.I), "diagnosis"),
    (re.compile(r"\b(prescri\w*|dosage|dose|mg\s+of|how much .* should i take)\b", re.I), "prescription"),
    (re.compile(r"\b(what|which)\s+(medicine|medication|drug|tablet|supplement)\b", re.I), "prescription"),
    (re.compile(r"\bshould i (take|start|stop|change)\b", re.I), "prescription"),
    (re.compile(r"\b(cure|treat(ment)? for my|how do i treat)\b", re.I), "treatment"),
    (re.compile(r"\b(how long (do|have) i (have|got) (to live|left))\b", re.I), "prognosis"),
]

_REFUSALS = {
    "diagnosis": (
        "I can't tell you whether you have a condition — that is a clinical "
        "judgement only a doctor can make, using your history and an "
        "examination alongside these numbers. What I can do is show you exactly "
        "what your report says and how each value compares with its reference "
        "range."
    ),
    "prescription": (
        "I can't recommend or adjust any medication or dosage. That decision "
        "belongs to a prescribing clinician who knows your full history. I can "
        "explain what a value on your report measures and whether it is inside "
        "its reference range."
    ),
    "treatment": (
        "I can't suggest a treatment plan. A clinician needs to weigh your "
        "history, examination and these results together. I can walk you "
        "through what your recorded values are and what each test measures."
    ),
    "prognosis": (
        "That is not something a lab value can answer, and not something I can "
        "tell you. Please speak with your doctor about what your results mean "
        "for you."
    ),
}

_ABNORMAL_QUERY = re.compile(
    r"\b(abnormal|out of range|flagged|concern\w*|attention|wrong|problem|issue|high or low|not normal)\b",
    re.I,
)
_NORMAL_QUERY = re.compile(r"\b(normal|in range|fine|okay|ok)\b", re.I)
_COUNT_QUERY = re.compile(r"\b(how many|number of)\b.*\b(report|record|test|result)\w*\b", re.I)
_LATEST_QUERY = re.compile(r"\b(latest|last|most recent|newest)\b.*\b(report|record|test|upload)\w*\b", re.I)
_TREND_QUERY = re.compile(r"\b(trend|change|changed|improv\w*|worse|better|over time|since|compared)\b", re.I)
_SUMMARY_QUERY = re.compile(r"\b(summar\w*|overview|explain my (report|results)|how am i doing)\b", re.I)
_MEANING_QUERY = re.compile(r"\b(what is|what's|what does|meaning of|why does|why is|tell me about)\b", re.I)


def _match_parameters(question: str) -> list[str]:
    """Parameter keys named in the question, most specific alias first."""
    found: list[str] = []
    for spec in PARAMETER_PATTERNS:
        for _alias_text, compiled in spec["compiled"]:
            if compiled.search(question):
                if spec["key"] not in found:
                    found.append(spec["key"])
                break
    return found


def _fmt(value: float) -> str:
    return f"{value:g}"


def _status_phrase(status: str) -> str:
    return {
        "NORMAL": "inside the reference range",
        "HIGH": "above the reference range",
        "LOW": "below the reference range",
        "UNKNOWN": "recorded, but we could not compare it with a reference range",
    }.get(status, "recorded")


def _parameter_answer(key: str, context: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
    """What this patient's own file says about one parameter."""
    spec = REFERENCE_RANGES.get(key, {})
    test_name = spec.get("testName", key.replace("_", " ").title())
    label = spec.get("patientLabel")
    history = [p for p in context.get("history", []) if p.get("key") == key]

    if not history:
        general = f"{test_name} measures {label}." if label else f"{test_name} is one of the tests this platform recognises."
        return (
            f"{general} There is no {test_name} result in your uploaded reports yet, "
            f"so I have no value of your own to show you. The typical adult reference "
            f"range is {spec.get('display', 'not on file')}.",
            [],
        )

    history = sorted(history, key=lambda p: p.get("date") or "")
    latest = history[-1]
    citations = [
        {"recordId": latest.get("recordId"), "fileName": latest.get("fileName"), "date": latest.get("date")}
    ]

    parts = [
        f"Your most recent {test_name} is {_fmt(latest['value'])} {latest.get('unit', '')}".strip() + ".",
        f"That is {_status_phrase(latest['status'])} of {latest.get('referenceRange', 'the expected interval')}.",
    ]
    if label:
        parts.insert(0, f"{test_name} measures {label}.")

    explanation = EXPLANATIONS.get(key, {}).get(latest["status"])
    if explanation:
        parts.append(explanation)

    if len(history) >= 2:
        previous = history[-2]
        delta = latest["value"] - previous["value"]
        relative = abs(delta / previous["value"]) if previous["value"] else abs(delta)
        if relative < 0.05:
            movement = "essentially unchanged since the previous report"
        else:
            movement = (
                f"{'up' if delta > 0 else 'down'} by {_fmt(abs(delta))} "
                f"{latest.get('unit', '')}".strip() + " since the previous report"
            )
        parts.append(f"It is {movement} ({_fmt(previous['value'])} on {previous.get('dateLabel', 'the earlier report')}).")
        if previous["status"] != "NORMAL" and latest["status"] == "NORMAL":
            parts.append("It has moved back inside the reference range.")
        elif previous["status"] == "NORMAL" and latest["status"] in ("HIGH", "LOW"):
            parts.append("It was inside the reference range on the previous report and is now outside it.")
        citations.append(
            {"recordId": previous.get("recordId"), "fileName": previous.get("fileName"), "date": previous.get("date")}
        )

    return " ".join(parts), citations


def _abnormal_answer(context: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
    latest = context.get("latest") or {}
    flagged = [p for p in latest.get("parameters", []) if p.get("status") in ("HIGH", "LOW")]
    if not latest:
        return ("You do not have an analysed report on file yet, so there is nothing to flag.", [])
    if not flagged:
        return (
            f"Nothing is flagged in your most recent report ({latest.get('fileName')}). "
            f"All {len(latest.get('parameters', []))} extracted values sit inside their reference ranges.",
            [{"recordId": latest.get("id"), "fileName": latest.get("fileName"), "date": latest.get("date")}],
        )
    lines = [
        f"Your most recent report ({latest.get('fileName')}) has {len(flagged)} "
        f"value{'s' if len(flagged) != 1 else ''} outside the reference range:"
    ]
    for p in flagged:
        lines.append(
            f"- {p['testName']}: {_fmt(p['value'])} {p.get('unit', '')}".rstrip()
            + f" — {p['status'].lower()} against {p.get('referenceRange', 'its range')}"
        )
    lines.append(
        "Being outside a reference range is a prompt to discuss the result, not a diagnosis in itself."
    )
    return "\n".join(lines), [
        {"recordId": latest.get("id"), "fileName": latest.get("fileName"), "date": latest.get("date")}
    ]


def _overview_answer(context: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
    latest = context.get("latest") or {}
    total = context.get("recordCount", 0)
    if not latest:
        return (
            f"You have {total} record{'s' if total != 1 else ''} on file and none of them has "
            "finished analysis yet, so I have no values to describe.",
            [],
        )
    params = latest.get("parameters", [])
    flagged = [p for p in params if p.get("status") in ("HIGH", "LOW")]
    text = (
        f"You have {total} record{'s' if total != 1 else ''} on file. Your most recent analysed "
        f"report is {latest.get('fileName')}, which produced {len(params)} laboratory values: "
        f"{len(params) - len(flagged)} inside their reference range and {len(flagged)} outside."
    )
    if flagged:
        names = ", ".join(p["testName"] for p in flagged[:5])
        text += f" The values outside range are {names}"
        text += " and others." if len(flagged) > 5 else "."
    return text, [{"recordId": latest.get("id"), "fileName": latest.get("fileName"), "date": latest.get("date")}]


def _records_answer(context: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
    total = context.get("recordCount", 0)
    analysed = context.get("analysedCount", 0)
    latest = context.get("latest") or {}
    text = (
        f"There {'is' if total == 1 else 'are'} {total} record{'s' if total != 1 else ''} in your "
        f"account, {analysed} of which {'has' if analysed == 1 else 'have'} completed analysis."
    )
    if latest:
        text += f" The most recent analysed one is {latest.get('fileName')} from {latest.get('dateLabel')}."
    return text, []


def compose_answer(question: str, context: dict[str, Any]) -> dict[str, Any]:
    """Deterministic answer. Always returns something honest."""
    text = (question or "").strip()
    if not text:
        return {
            "answer": "Ask me about any value in your reports — for example "
            "\"what is my HbA1c?\" or \"what is flagged in my latest report?\".",
            "kind": "PROMPT",
            "citations": [],
            "refused": False,
        }

    # "How many reports do I have?" is unambiguously an inventory question, so it
    # is settled before the clinical-intent check can misread its "do I have".
    # Only _COUNT_QUERY is safe to short-circuit here: "what is flagged in my
    # LATEST report" also mentions a report but is a results question, so
    # _LATEST_QUERY stays below the parameter and abnormal checks.
    if _COUNT_QUERY.search(text):
        answer, citations = _records_answer(context)
        return {"answer": answer, "kind": "RECORDS", "citations": citations, "refused": False}

    for pattern, kind in _REFUSAL_PATTERNS:
        if pattern.search(text):
            return {"answer": _REFUSALS[kind], "kind": "REFUSAL", "citations": [], "refused": True}

    keys = _match_parameters(text)

    if keys:
        answers: list[str] = []
        citations: list[dict[str, Any]] = []
        for key in keys[:3]:
            answer, cites = _parameter_answer(key, context)
            answers.append(answer)
            citations.extend(cites)
        return {
            "answer": "\n\n".join(answers),
            "kind": "PARAMETER",
            "citations": citations,
            "refused": False,
        }

    if _ABNORMAL_QUERY.search(text):
        answer, citations = _abnormal_answer(context)
        return {"answer": answer, "kind": "ABNORMAL", "citations": citations, "refused": False}

    if _COUNT_QUERY.search(text) or _LATEST_QUERY.search(text):
        answer, citations = _records_answer(context)
        return {"answer": answer, "kind": "RECORDS", "citations": citations, "refused": False}

    if _SUMMARY_QUERY.search(text) or _NORMAL_QUERY.search(text) or _TREND_QUERY.search(text):
        answer, citations = _overview_answer(context)
        return {"answer": answer, "kind": "OVERVIEW", "citations": citations, "refused": False}

    if _MEANING_QUERY.search(text):
        known = ", ".join(sorted({spec["testName"] for spec in REFERENCE_RANGES.values()})[:6])
        return {
            "answer": (
                "I could not match that to a test in your reports. I can explain any of the "
                f"laboratory values this platform extracts — for example {known} — and I can "
                "tell you what is flagged in your most recent report."
            ),
            "kind": "UNMATCHED",
            "citations": [],
            "refused": False,
        }

    return {
        "answer": (
            "I can only answer from the reports in your own account. Try asking about a "
            "specific value (\"what is my hemoglobin?\"), what is flagged in your latest "
            "report, or how a value has changed over time."
        ),
        "kind": "UNMATCHED",
        "citations": [],
        "refused": False,
    }


# ---------------------------------------------------------------------------
# Optional phrasing pass
# ---------------------------------------------------------------------------

_REPHRASE_SYSTEM = (
    "You rewrite a health explanation so it reads more naturally for a patient. "
    "STRICT RULES:\n"
    "1. You may ONLY use facts present in the draft. Never add a number, a test "
    "name, a range or a claim that is not already there.\n"
    "2. Never diagnose, never suggest medication, never recommend treatment.\n"
    "3. Keep every number exactly as written in the draft.\n"
    "4. Keep it under 180 words, calm and plain. No emoji, no headings.\n"
    "Return only the rewritten text."
)

_NUMBER_IN_TEXT = re.compile(r"\d+(?:\.\d+)?")


def _numbers(text: str) -> set[str]:
    return {n.rstrip("0").rstrip(".") if "." in n else n for n in _NUMBER_IN_TEXT.findall(text)}


def answer_question(question: str, context: dict[str, Any]) -> dict[str, Any]:
    """Deterministic answer, optionally re-worded by the configured model.

    The model never supplies facts. Its output is accepted only if it introduces
    no number that the deterministic draft did not already contain, so a
    hallucinated value cannot reach the patient.
    """
    from ..config import get_settings

    result = compose_answer(question, context)
    result["source"] = "deterministic"
    result["disclaimer"] = DISCLAIMER

    settings = get_settings()

    # Refusals and prompts are deliberately fixed wording — never sent to a model.
    if result["refused"] or result["kind"] in ("PROMPT",) or not settings.openai_configured:
        if not settings.openai_configured:
            result["fallbackReason"] = (
                "No language model is configured, so this answer came from the built-in "
                "deterministic explainer."
            )
        return result

    draft = result["answer"]
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key, timeout=settings.openai_timeout)
        completion = client.chat.completions.create(
            model=settings.openai_model,
            temperature=0.2,
            max_tokens=320,
            messages=[
                {"role": "system", "content": _REPHRASE_SYSTEM},
                {"role": "user", "content": f"Patient asked: {question}\n\nDraft:\n{draft}"},
            ],
        )
        text = (completion.choices[0].message.content or "").strip()
        if len(text) < 30:
            raise ValueError("model returned an unusably short answer")
        if not _numbers(text).issubset(_numbers(draft)):
            raise ValueError("model introduced a number that was not in the draft")
        result["answer"] = text
        result["source"] = "openai"
    except Exception as exc:
        result["fallbackReason"] = (
            f"The language model was unavailable ({type(exc).__name__}); this answer came "
            "from the built-in deterministic explainer."
        )
    return result
