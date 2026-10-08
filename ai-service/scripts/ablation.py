"""Ablation of the extractor's two fail-safes, on the same SYNTHETIC reports as benchmark.py.

Question: how many confident-but-wrong values would reach the patient if each
fail-safe were removed?

Fail-safes (both in app/services/ner.py):
  plausibility gate   a value outside the physiologically plausible window is reported
                      as UNKNOWN ("not compared") instead of HIGH/LOW/NORMAL
  OCR-uncertainty gate in OCR text, a number glued to a preceding non-digit character
                      (e.g. "$7" for 57) is reported as UNKNOWN

Variants
  full             both gates on (the shipped behaviour)
  no_plausibility  plausibility gate removed
  no_ocr_gate      OCR-uncertainty gate removed
  neither          both removed

The text of each document is read once and reused, so the only thing that changes
between variants is the gate. Nothing in the production code is modified: the plausibility
window is widened and `from_ocr` is withheld from the extractor for the duration of a run.

Confidence intervals are a 95% percentile bootstrap that resamples whole DOCUMENTS (values
within one report are not independent).

Usage (from ai-service/):  python scripts/ablation.py [--write ../docs/ABLATION.md]
"""
from __future__ import annotations

import argparse
import contextlib
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import benchmark as bm  # noqa: E402
from app.data.reference_ranges import REFERENCE_RANGES  # noqa: E402
from app.services.ner import extract_parameters  # noqa: E402
from app.services.tesseract import SOURCE_PDF_TEXT, extract_text  # noqa: E402

VARIANTS = ["full", "no_plausibility", "no_ocr_gate", "neither"]
LABELS = {
    "full": "Both gates on (shipped)",
    "no_plausibility": "Plausibility gate removed",
    "no_ocr_gate": "OCR-uncertainty gate removed",
    "neither": "Both removed",
}
BOOT = 2000


@contextlib.contextmanager
def widened_plausibility():
    saved = {k: v["plausible"] for k, v in REFERENCE_RANGES.items()}
    try:
        for v in REFERENCE_RANGES.values():
            v["plausible"] = (-1e18, 1e18)
        yield
    finally:
        for k, v in REFERENCE_RANGES.items():
            v["plausible"] = saved[k]


def run_variant(variant: str, prepared: list[tuple[bm.Case, str, bool]]) -> list[dict]:
    per_doc = []
    no_plaus = variant in ("no_plausibility", "neither")
    no_ocr = variant in ("no_ocr_gate", "neither")
    ctx = widened_plausibility() if no_plaus else contextlib.nullcontext()
    with ctx:
        for case, text, from_ocr in prepared:
            parsed = extract_parameters(text, from_ocr=(from_ocr and not no_ocr))
            s = bm.score(case, {"parameters": parsed["parameters"]})
            per_doc.append({"truth": s["truth"], "silent": s["silent"], "rejected": s["rejected"],
                            "value_ok": s["value_ok"], "found": s["found"]})
    return per_doc


def rate(docs: list[dict], key: str) -> float:
    t = sum(d["truth"] for d in docs)
    return 100.0 * sum(d[key] for d in docs) / t if t else 0.0


def bootstrap_ci(docs: list[dict], key: str, seed: int) -> tuple[float, float]:
    rng = random.Random(seed)
    n = len(docs)
    vals = []
    for _ in range(BOOT):
        sample = [docs[rng.randrange(n)] for _ in range(n)]
        vals.append(rate(sample, key))
    vals.sort()
    return vals[int(0.025 * BOOT)], vals[int(0.975 * BOOT) - 1]


def build_groups() -> list[tuple[str, list[tuple[bm.Case, str, bool]]]]:
    # Same generation order and seed as benchmark.main(), so the documents are identical.
    rng = random.Random(bm.SEED)
    layouts = ["tabular", "inline", "flagged"]
    wordings = ["known", "heldout"]
    text_cases, ocr_clean, ocr_hard = [], [], []
    for i in range(bm.N_TEXT_PDF):
        c = bm.make_case(rng, i, layouts[i % 3], wordings[(i // 3) % 2])
        text_cases.append((c, bm.render_pdf(c.lines), f"{c.name}.pdf", "application/pdf"))
    for i in range(bm.N_OCR_CLEAN):
        c = bm.make_case(rng, 100 + i, layouts[i % 3], wordings[(i // 3) % 2])
        ocr_clean.append((c, bm.render_png(c.lines, False, rng), f"{c.name}.png", "image/png"))
    for i in range(bm.N_OCR_HARD):
        c = bm.make_case(rng, 200 + i, layouts[i % 3], wordings[(i // 3) % 2])
        ocr_hard.append((c, bm.render_png(c.lines, True, rng), f"{c.name}.jpg", "image/jpeg"))

    groups = []
    for label, cases in [("Digital PDF (text layer)", text_cases),
                         ("Scanned image, light degradation (OCR)", ocr_clean),
                         ("Phone-photo style, heavy degradation (OCR)", ocr_hard)]:
        prepared = []
        for case, data, fname, ctype in cases:
            ex = extract_text(data, filename=fname, content_type=ctype)
            prepared.append((case, ex.text, ex.source != SOURCE_PDF_TEXT))
        groups.append((label, prepared))
    return groups


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", help="write a markdown report to this path")
    args = ap.parse_args()

    results = []
    for gi, (label, prepared) in enumerate(build_groups()):
        row = {"label": label, "documents": len(prepared), "variants": {}}
        for vi, v in enumerate(VARIANTS):
            docs = run_variant(v, prepared)
            lo, hi = bootstrap_ci(docs, "silent", seed=1000 + 10 * gi + vi)
            row["variants"][v] = {
                "values": sum(d["truth"] for d in docs),
                "silent": sum(d["silent"] for d in docs),
                "silent_pct": round(rate(docs, "silent"), 1),
                "silent_ci": [round(lo, 1), round(hi, 1)],
                "safely_rejected": sum(d["rejected"] for d in docs),
                "value_accuracy": round(rate(docs, "value_ok"), 1),
            }
        results.append(row)

    print(json.dumps(results, indent=2))
    if args.write:
        Path(args.write).write_text(to_markdown(results), encoding="utf-8")
        print(f"\nWrote {args.write}")


def to_markdown(results: list[dict]) -> str:
    out = [
        "# OneHealth AI - Ablation of the extractor's fail-safes",
        "",
        "Reproduce with `python scripts/ablation.py` from `ai-service/` (same seed and documents as `scripts/benchmark.py`).",
        "All documents are synthetic. Each report's text is read once; only the fail-safes change between rows.",
        "",
        "**Question.** If a fail-safe were removed, how many wrong values would reach the patient with a confident",
        "HIGH, LOW or NORMAL status (a *silent wrong value*)?",
        "",
        "The 95% interval is a percentile bootstrap that resamples whole documents (2,000 resamples).",
        "",
        "## Results",
        "",
        "| Input type | Fail-safes | Values | Silent wrong | Rate (95% CI) | Wrong but shown as not compared | Value accuracy |",
        "|---|---|---|---|---|---|---|",
    ]
    for g in results:
        for v in VARIANTS:
            m = g["variants"][v]
            out.append(f"| {g['label']} | {LABELS[v]} | {m['values']} | {m['silent']} | "
                       f"{m['silent_pct']}% ({m['silent_ci'][0]} to {m['silent_ci'][1]}) | "
                       f"{m['safely_rejected']} | {m['value_accuracy']}% |")
    out += [
        "",
        "## How to read this",
        "",
        "- Value accuracy does not change between rows: the gates never alter a number, they only decide whether the number is",
        "  given a status. What changes is whether a wrong number is labelled confidently or shown as *not compared*.",
        "- The fail-safes convert wrong values from silent to visible. They do not make the extractor more accurate.",
        "- The benchmark is synthetic and written by the project team; the heavy-degradation rows are simulated, not photographed.",
        "- Values within a report are correlated, so intervals are wide on the 20-document groups. Treat them as a guide.",
        "",
    ]
    return "\n".join(out)


if __name__ == "__main__":
    main()
