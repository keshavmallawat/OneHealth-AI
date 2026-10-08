# OneHealth AI - Extraction Accuracy and Latency Evaluation

Reproduce with `python scripts/benchmark.py` from `ai-service/` (seed `20261008`).
All documents are synthetic. Ground truth is exact because the reports are generated, not collected.

## Results

| Input type | Docs | Values | Recall | Value accuracy | Status accuracy | Precision | Silent wrong values | Median ms | p95 ms |
|---|---|---|---|---|---|---|---|---|---|
| Digital PDF (text layer) | 60 | 657 | 100.0% | 100.0% | 100.0% | 100.0% | 0 (0.0%) | 19 | 24 |
| Scanned image, light degradation (OCR) | 20 | 225 | 99.1% | 97.3% | 97.3% | 98.2% | 0 (0.0%) | 3609 | 4109 |
| Phone-photo style, heavy degradation (OCR) | 20 | 208 | 75.0% | 58.7% | 63.9% | 77.7% | 15 (7.2%) | 2558 | 2819 |

**Silent wrong values** = a wrong number reported with a confident HIGH/LOW/NORMAL status. This is the
unsafe failure. Implausible misreads (e.g. glucose read as 7 mg/dL) are instead shown as UNKNOWN / not compared,
and values that are missed entirely are simply absent; neither misleads the patient.

## Breakdown by test-name wording

`known` = names the extractor's alias table lists. `heldout` = phrasings written without consulting it.

| Input type | Wording | Values | Recall | Value accuracy | Status accuracy |
|---|---|---|---|---|---|
| Digital PDF (text layer) | known | 319 | 100.0% | 100.0% | 100.0% |
| Digital PDF (text layer) | heldout | 338 | 100.0% | 100.0% | 100.0% |
| Scanned image, light degradation (OCR) | known | 123 | 98.4% | 96.7% | 96.7% |
| Scanned image, light degradation (OCR) | heldout | 102 | 100.0% | 98.0% | 98.0% |
| Phone-photo style, heavy degradation (OCR) | known | 117 | 67.5% | 55.6% | 58.1% |
| Phone-photo style, heavy degradation (OCR) | heldout | 91 | 84.6% | 62.6% | 71.4% |

## Failures

**Scanned image, light degradation (OCR)** (6 failed checks; first 15 shown)

| Document | Parameter | Problem | Expected | Got |
|---|---|---|---|---|
| tabular-known-100 | RBC | missing | 4.46 | None |
| tabular-known-100 | HBA1C | missing | 5.3 | None |
| tabular-heldout-103 | HBA1C | wrong value | 5.3 | 45.0 |
| flagged-heldout-105 | GLUCOSE_FASTING | wrong value | 77.0 | 7.0 |
| flagged-known-108 | GLUCOSE_FASTING | wrong value | 75.0 | 7.0 |
| flagged-known-108 | LDL | wrong value | 57.0 | 7.0 |

**Phone-photo style, heavy degradation (OCR)** (86 failed checks; first 15 shown)

| Document | Parameter | Problem | Expected | Got |
|---|---|---|---|---|
| tabular-known-200 | HEMOGLOBIN | wrong value | 13.9 | 313.9 |
| tabular-known-200 | RBC | missing | 3.82 | None |
| tabular-known-200 | CHOLESTEROL_TOTAL | missing | 154.0 | None |
| tabular-known-200 | HDL | missing | 46.0 | None |
| tabular-known-200 | ALT | missing | 38.0 | None |
| tabular-known-200 | AST | missing | 34.0 | None |
| inline-known-201 | HEMOGLOBIN | missing | 12.4 | None |
| inline-known-201 | HBA1C | missing | 4.9 | None |
| inline-known-201 | LDL | missing | 138.0 | None |
| flagged-known-202 | RBC | missing | 5.75 | None |
| flagged-known-202 | PLATELETS | wrong value | 408.0 | 0.408 |
| flagged-known-202 | HBA1C | missing | 6.7 | None |
| flagged-known-202 | CREATININE | wrong value | 1.14 | 134.0 |
| flagged-known-202 | CHOLESTEROL_TOTAL | missing | 311.0 | None |
| flagged-known-202 | LDL | missing | 132.0 | None |


## What the benchmark found, and what was changed

The first run exposed real extractor faults. Each was fixed with a regression test in
`ai-service/tests/test_extraction.py`, and the benchmark was re-run.

| Finding | Effect | Fix |
|---|---|---|
| "Glycosylated Hemoglobin" (the spelling many Indian labs print) was not an HbA1c alias | HbA1c missed | Alias added, plus the OCR confusions `HbAlc` and `HbAic` |
| A bracketed synonym after the test name, as in `Glycosylated Hemoglobin (HbA1c) 6.2` | The `1` inside the brackets was read as the result | A leading parenthetical qualifier is skipped |
| OCR renders the exponent in `x10^3/uL` as a degree sign | Platelets read as 0.317 instead of 317 | Unit matcher accepts `*`, `°`, `º` and `·` for the exponent |
| OCR garbled `LDL Cholesterol` to `LOL Cholesterol` | The bare word "cholesterol" claimed the line, so an LDL value was reported as total cholesterol | The bare alias is trusted only at the start of a line |
| Result unreadable, range printed (`HbAlc <garbled> 4.0 - 5.6`) | The range's lower bound was reported as the result | A number that begins a range, or follows `<` or `>`, is never a result |
| First digit misread as a symbol (`$7` for 57) | The digit was dropped silently and 7 was reported | A number glued to a preceding non-digit is marked unreliable in OCR text and shown as "not compared" |

Effect on lightly degraded scans: recall 92.0% to 99.1%, value accuracy 87.6% to 97.3%, silent wrong values 2 to 0.
The digital-PDF path was already at 100% and is unchanged. The benchmark generator itself was also corrected: it first produced
physiologically implausible values (for example HbA1c 2.2), which the extractor rightly refused to classify.

## Limits that remain

- **Heavily degraded photos are not safe to read unattended.** At phone-photo quality (reduced size, blur, strong JPEG
  compression) value accuracy is about 59% and 7% of values are wrong with a confident status. The main cause is a digit
  being read as a different digit (for example 142 read as 342), which cannot be detected from the number alone.
- The product responds in three ways: scanned reports show a notice asking the patient to compare every value with the original,
  implausible or suspicious values are shown as "not compared", and every value keeps its source line and confidence.
- Recommended next step if this were to be taken further: cross-check each value against the status flag printed on the report
  and against the printed reference range, and ask the patient to confirm disagreements.

## Reading these numbers honestly

- The test set is synthetic and written by the project team. It shows the extractor is reliable on the layouts
  and wording families above; it does not prove accuracy on every laboratory's format.
- Status accuracy compares against the project's own published reference ranges, so it validates the
  extraction and comparison logic, not the clinical ranges themselves.
- OCR rows depend on the Tesseract version and image quality; the degradation here is simulated, not photographed.
- Latency was measured on a cloud sandbox CPU, in-process, without the HTTP hop; a laptop will differ.
  The Complete Plan's end-to-end target (< 20 s per report) is the relevant comparison.
