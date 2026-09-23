# OneHealth AI — Pre-Evaluation Status

Prepared 2 September 2026. Everything below was verified against a running
stack, not asserted from the code.

## What this is

A unified digital health record platform. A patient uploads medical reports; the
platform reads them, extracts laboratory values, compares each against a
published reference interval, explains the result in plain language, and lets the
patient share the record with a clinician under consent they control and can
withdraw.

## Architecture

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 19 · Vite · Tailwind 4 | Single design system, responsive to 390px |
| API | Node · Express 5 · TypeScript | Orchestration, authentication, authorisation, persistence |
| AI service | Python · FastAPI | OCR, deterministic extraction, reference comparison, summaries, assistant |
| Database | PostgreSQL 16 · Prisma 6 | Engine-free runtime (`pg` driver adapter) — no platform binary needed |
| Storage | Local encrypted disk (S3 driver available) | `STORAGE_DRIVER=local|s3` |

## The design decision that matters

**Values are never produced by a language model.** Extraction is deterministic —
alias matching, number parsing, unit normalisation — and each value is compared
against a hard-coded interval that cites its published source. The model is only
ever allowed to rephrase findings that were already extracted, and with no API
key the deterministic explainer runs instead. The UI always says which produced
the text on screen.

## Verified

| Suite | Assertions | Result |
|---|---|---|
| Core pipeline (`scripts/smoke-test.js`) | 42 | **pass** |
| Consent, sharing, assistant, export (`scripts/smoke-test-consent.js`) | 95 | **pass** |
| Extraction and assistant safety (`ai-service/tests`) | 15 | **pass** |
| Frontend production build | — | clean |
| Backend typecheck and build | — | clean |
| Browser walkthrough at 1440 / 834 / 390px | 27 pages | no console errors, no failed API calls, no horizontal overflow |
| Migration against a populated pre-existing database | — | all rows preserved; re-run is a no-op |

**152 automated assertions passing.**

## Working features

Patient registration and login · encrypted PII · patient health profile ·
document upload · PDF text-layer extraction · Tesseract OCR · 14 deterministic
lab parameters · cited reference ranges · sex-specific intervals · HIGH/LOW/
NORMAL classification · confidence scores · patient-friendly summaries with a
server-applied disclaimer · record search, filter, sort and tagging · editable
record metadata · longitudinal trends with deterministic observations ·
report-to-report comparison · clinician registration · consent request, approve,
decline, revoke and expiry · QR sharing · read-only provider portal · audit trail
recording actor **and** subject · grounded health assistant with clinical-intent
refusals · PDF health summary export · reminders.

## Stated limitations

- **ABDM is not integrated.** The ABHA field is profile metadata; the UI says so.
- **No password reset** — it needs an outbound mail service. The page says so
  rather than showing a form that does nothing.
- **OTP delivery is a console stub**, so the UI does not offer OTP login.
- **No notification delivery.** Reminders are in-app only.
- **No health score** — deliberately. Every number in this product traces back to
  a document the patient uploaded; a composite score would not.
- **MongoDB is not used.** PostgreSQL `Json` columns hold the extraction payload.
  Adding a second datastore would add an operational dependency without a
  functional gain.

Full detail: `docs/FINAL-FEATURE-MATRIX.md`.

## Running it

Double-click `RUN-SETUP.bat`. It installs, migrates, builds, starts all three
services, seeds synthetic demo data and runs both test suites.

| | |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3001 |
| AI service | http://localhost:8001 |
| Patient | `patient@onehealth.ai` / `Demo@12345` |
| Clinician | `doctor@onehealth.ai` / `Demo@12345` |

Demonstration runbook, including answers to the hard questions:
`docs/DEMO-SCRIPT.md`.
