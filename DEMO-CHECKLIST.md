# Demo checklist

## 30 minutes before

- [ ] Double-click **`RUN-SETUP.bat`**. Wait for it to finish.
- [ ] Check the tail of `scripts\setup-log.txt` — the last lines should show
      **42 passed** and **95 passed**.
- [ ] Open http://localhost:5173 and sign in as `patient@onehealth.ai` / `Demo@12345`.
- [ ] Confirm the dashboard shows 3 records and the sidebar says "Secure connection".
- [ ] Open a second browser window (or a private window) and sign in as
      `doctor@onehealth.ai` / `Demo@12345`. Leave it on **My patients**.
- [ ] Have `OneHealth-Demo-Report.pdf` somewhere you can find it in a file picker
      (it is in `sample-data\`, inside the project folder).
- [ ] Close any other browser tabs. Zoom to 100%.

## The run

1. **Dashboard** — figures, "Needs your attention", identity card.
2. **Open sample-blood-report-abnormal.pdf** — key findings, assisted
   interpretation with its source badge, disclaimer, full results table with
   reference ranges and confidence.
3. **Live upload** `OneHealth-Demo-Report.pdf` — Queued → Analysing → Analysed.
   Open it: 14 values, 7 flagged. Refresh to prove persistence.
4. **Trends** — pick glucose or HbA1c, show the reference band, the deterministic
   observation, then **Compare two reports**.
5. **Sharing & consent → Requests** — approve Dr Menon. Switch to the clinician
   window, refresh, open the patient, open a record.
6. **Back as the patient → Access history** — "Dr. A. Menon opened…". Then
   **Revoke**, and refresh the clinician window to show access is gone.
7. **Share by QR** — generate a code; point out it carries only a random token.
8. **Health assistant** — "What is my hemoglobin?" then "Do I have diabetes?".
9. **Export summary** — the PDF.

## Lines worth having ready

- *"The numbers are never produced by a language model — they are parsed and
  compared against published intervals that are hard-coded with their sources."*
- *"Reaching a doctor page proves nothing. Authorisation is re-checked on the
  server on every request, and the test suite calls the API directly to prove it."*
- *"The audit records who acted and whose data it was — that is what makes it
  meaningful to the patient."*
- *"There is no health score, deliberately. It would have to be invented."*

## If something breaks

| Symptom | Do this |
|---|---|
| A page will not load | Re-run `RUN-SETUP.bat` — safe to re-run. |
| Upload stuck on "Analysing" | AI service is down; see `scripts\ai-service.log`. The seeded reports still show the full pipeline. |
| Image OCR fails | Tesseract is missing. Digital PDFs still work — use `OneHealth-Demo-Report.pdf`. |
| Database will not start | `SETUP-DATABASE.bat`, then `RUN-SETUP.bat`. |
| Everything is broken | `node scripts/smoke-test.js` and `node scripts/smoke-test-consent.js` demonstrate the whole stack from the command line. |
