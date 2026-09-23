"""Patient-friendly summary generation.

Two paths, and the service always returns one of them:

  1. OPENAI  - used only when an API key is configured. The model is given the
     already-extracted values and is explicitly forbidden from inventing any
     number. It rephrases; it does not measure.
  2. DETERMINISTIC - a template-driven summary built purely from the extracted
     parameters and the reviewed static notes in app/data/explanations.py.

The deterministic path is not a stub. It is the guaranteed path: if there is no
API key, no internet, or the API errors or times out, the product still produces
a useful, readable summary. That is what makes the demo independent of network
availability.

The medical disclaimer is applied by the caller (and again by the Node backend)
so it can never be dropped from a response.
"""
from __future__ import annotations

import logging
from typing import Any

from ..config import get_settings
from ..data.explanations import note_for

logger = logging.getLogger(__name__)

SOURCE_OPENAI = "openai"
SOURCE_DETERMINISTIC = "deterministic"

DISCLAIMER = (
    "AI-generated information is for informational purposes only and does not "
    "constitute medical diagnosis or treatment. Please consult a qualified "
    "healthcare professional for interpretation of your results."
)

_SYSTEM_PROMPT = (
    "You are a careful health-literacy assistant inside a patient records app. "
    "You will be given laboratory values that have ALREADY been extracted and "
    "classified by a deterministic parser.\n"
    "STRICT RULES:\n"
    "1. Use ONLY the values given to you. Never invent, estimate or infer any "
    "number, test or result that is not in the list.\n"
    "2. Do NOT diagnose. Do not name a disease as the patient's condition.\n"
    "3. Do NOT recommend any medicine, dose, supplement, or treatment.\n"
    "4. Explain in plain language what each out-of-range value measures and why "
    "a doctor would look at it. Be calm and non-alarming.\n"
    "5. Always end by advising the reader to discuss the results with a "
    "qualified doctor.\n"
    "6. Write 120-180 words in short paragraphs. No markdown headings, no lists "
    "of raw numbers beyond what you need."
)


def _join_words(items: list[str]) -> str:
    """'a', 'a and b', 'a, b and c' - reads better than a bare comma list."""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return ", ".join(items[:-1]) + f" and {items[-1]}"


def _format_value(param: dict[str, Any]) -> str:
    return f"{param['value']} {param['unit']}"


def _describe(param: dict[str, Any]) -> str:
    direction = "below" if param["status"] == "LOW" else "above"
    return (
        f"{param['testName']} is {_format_value(param)}, which is {direction} the "
        f"typical range of {param['referenceRange']}"
    )


def build_deterministic_summary(parameters: list[dict[str, Any]]) -> str:
    """Compose a readable summary from the extracted values alone."""
    if not parameters:
        return (
            "We could read this document, but we could not confidently identify any "
            "of the laboratory values we currently recognise. This can happen with "
            "scans of low quality, handwritten notes, or reports that use an "
            "unusual layout. You can still view the original document, and your "
            "doctor can interpret it directly."
        )

    abnormal = [p for p in parameters if p["status"] in ("LOW", "HIGH")]
    unknown = [p for p in parameters if p["status"] == "UNKNOWN"]
    normal_count = len(parameters) - len(abnormal) - len(unknown)

    lines: list[str] = []

    if not abnormal:
        lines.append(
            f"This report covers {len(parameters)} laboratory "
            f"{'value' if len(parameters) == 1 else 'values'}, and all of the ones we "
            "could check fall within their typical reference ranges."
        )
    else:
        panels = sorted({p["panel"] for p in abnormal})
        lines.append(
            f"This report covers {len(parameters)} laboratory values. "
            f"{len(abnormal)} of them {'is' if len(abnormal) == 1 else 'are'} outside "
            f"the typical reference range and {normal_count} "
            f"{'is' if normal_count == 1 else 'are'} within range."
        )
        if panels:
            lines.append(
                f"The results that stand out sit in your {_join_words([p.lower() for p in panels])}."
            )

        lines.append("")
        lines.append("What stands out:")
        for param in abnormal:
            note = note_for(param["key"], param["status"])
            sentence = f"- {_describe(param)}."
            if note:
                sentence += f" {note}"
            lines.append(sentence)

    if unknown:
        names = ", ".join(p["testName"] for p in unknown)
        lines.append("")
        lines.append(
            f"We could not reliably check the following against a reference range, "
            f"so please read {'it' if len(unknown) == 1 else 'them'} on the original "
            f"report: {names}."
        )

    lines.append("")
    lines.append(
        "A single set of results is only a snapshot. Values move with hydration, "
        "recent meals, exercise, illness and medicines, so please go through this "
        "report with a qualified doctor who knows your history before drawing any "
        "conclusion."
    )
    return "\n".join(lines).strip()


def _build_user_prompt(parameters: list[dict[str, Any]], detected_sex: str | None) -> str:
    rows = [
        f"- {p['testName']}: {p['value']} {p['unit']} "
        f"(typical range {p['referenceRange']}) -> {p['status']}"
        for p in parameters
    ]
    sex_line = f"Patient sex as printed on the report: {detected_sex}.\n" if detected_sex else ""
    return (
        f"{sex_line}Extracted laboratory values:\n" + "\n".join(rows) +
        "\n\nWrite the patient-friendly summary now, following every rule."
    )


def generate_summary(
    parameters: list[dict[str, Any]], detected_sex: str | None = None
) -> dict[str, Any]:
    """Return {text, source, disclaimer, fallbackReason?}."""
    settings = get_settings()
    deterministic = build_deterministic_summary(parameters)

    if not settings.openai_configured:
        return {
            "text": deterministic,
            "source": SOURCE_DETERMINISTIC,
            "disclaimer": DISCLAIMER,
            "fallbackReason": "No OpenAI API key configured - using the built-in summary generator.",
        }

    if not parameters:
        return {
            "text": deterministic,
            "source": SOURCE_DETERMINISTIC,
            "disclaimer": DISCLAIMER,
            "fallbackReason": "No parameters were extracted, so no model call was made.",
        }

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key, timeout=settings.openai_timeout)
        completion = client.chat.completions.create(
            model=settings.openai_model,
            temperature=0.2,
            max_tokens=420,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(parameters, detected_sex)},
            ],
        )
        text = (completion.choices[0].message.content or "").strip()
        if len(text) < 40:
            raise ValueError("model returned an unusably short summary")
        return {"text": text, "source": SOURCE_OPENAI, "disclaimer": DISCLAIMER}
    except Exception as exc:  # network, auth, quota, timeout, malformed - all handled
        logger.warning("OpenAI summary failed (%s); using deterministic fallback", exc)
        return {
            "text": deterministic,
            "source": SOURCE_DETERMINISTIC,
            "disclaimer": DISCLAIMER,
            "fallbackReason": f"AI provider unavailable ({type(exc).__name__}) - used the built-in summary generator.",
        }
