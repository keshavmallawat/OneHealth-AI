# OneHealth AI - Ablation of the extractor's fail-safes

Reproduce with `python scripts/ablation.py` from `ai-service/` (same seed and documents as `scripts/benchmark.py`).
All documents are synthetic. Each report's text is read once; only the fail-safes change between rows.

**Question.** If a fail-safe were removed, how many wrong values would reach the patient with a confident
HIGH, LOW or NORMAL status (a *silent wrong value*)?

The 95% interval is a percentile bootstrap that resamples whole documents (2,000 resamples).

## Results

| Input type | Fail-safes | Values | Silent wrong | Rate (95% CI) | Wrong but shown as not compared | Value accuracy |
|---|---|---|---|---|---|---|
| Digital PDF (text layer) | Both gates on (shipped) | 657 | 0 | 0.0% (0.0 to 0.0) | 0 | 100.0% |
| Digital PDF (text layer) | Plausibility gate removed | 657 | 0 | 0.0% (0.0 to 0.0) | 0 | 100.0% |
| Digital PDF (text layer) | OCR-uncertainty gate removed | 657 | 0 | 0.0% (0.0 to 0.0) | 0 | 100.0% |
| Digital PDF (text layer) | Both removed | 657 | 0 | 0.0% (0.0 to 0.0) | 0 | 100.0% |
| Scanned image, light degradation (OCR) | Both gates on (shipped) | 225 | 0 | 0.0% (0.0 to 0.0) | 4 | 97.3% |
| Scanned image, light degradation (OCR) | Plausibility gate removed | 225 | 3 | 1.3% (0.0 to 2.8) | 1 | 97.3% |
| Scanned image, light degradation (OCR) | OCR-uncertainty gate removed | 225 | 1 | 0.4% (0.0 to 1.4) | 3 | 97.3% |
| Scanned image, light degradation (OCR) | Both removed | 225 | 4 | 1.8% (0.0 to 4.0) | 0 | 97.3% |
| Phone-photo style, heavy degradation (OCR) | Both gates on (shipped) | 208 | 15 | 7.2% (4.3 to 10.2) | 19 | 58.7% |
| Phone-photo style, heavy degradation (OCR) | Plausibility gate removed | 208 | 29 | 13.9% (9.9 to 18.0) | 5 | 58.7% |
| Phone-photo style, heavy degradation (OCR) | OCR-uncertainty gate removed | 208 | 18 | 8.7% (5.6 to 11.7) | 16 | 58.7% |
| Phone-photo style, heavy degradation (OCR) | Both removed | 208 | 34 | 16.3% (11.8 to 20.9) | 0 | 58.7% |

## How to read this

- Value accuracy does not change between rows: the gates never alter a number, they only decide whether the number is
  given a status. What changes is whether a wrong number is labelled confidently or shown as *not compared*.
- The fail-safes convert wrong values from silent to visible. They do not make the extractor more accurate.
- The benchmark is synthetic and written by the project team; the heavy-degradation rows are simulated, not photographed.
- Values within a report are correlated, so intervals are wide on the 20-document groups. Treat them as a guide.
