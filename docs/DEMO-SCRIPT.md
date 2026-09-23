# OneHealth AI — demonstration runbook

Everything below runs on synthetic data. No real patient information is used
anywhere in this project.

---

## Before you start

1. Double-click **`RUN-SETUP.bat`** in the repository root. It installs
   dependencies, applies migrations, builds, starts all three services, seeds
   the demo data and runs both end-to-end test suites. Full log:
   `scripts\setup-log.txt`.
2. Open **http://localhost:5173**.

| Account | Email | Password |
|---|---|---|
| Patient | `patient@onehealth.ai` | `Demo@12345` |
| Clinician | `doctor@onehealth.ai` | `Demo@12345` |

The seed creates three analysed reports dated 13 Aug, 20 Aug and 2 Sep 2026, and
one pending access request from the demo clinician — so the consent workflow has
something real to show from the first click.

Have `OneHealth-Demo-Report.pdf` ready for the live upload.

---

## The 6-minute walkthrough

### 1. Sign in (20s)
Sign in as the patient. Point out the status indicator in the sidebar: it polls
the API and the AI service, so "Secure connection" is a live claim.

### 2. Health overview (45s)
- Four figures across the top, all computed from stored data.
- **Needs your attention** — assembled only from real state: a pending clinician
  request, values outside range, overdue reminders, failed analyses. If there is
  nothing to say, the panel does not appear.
- The identity card, the share code, and the access-history panel.

### 3. Open an analysed report (90s) — *the core of the project*
Open **sample-blood-report-abnormal.pdf**.

- **Key findings first** — the ten out-of-range values, before the full table.
- **Assisted interpretation**, with the source badge reading "Deterministic
  explainer" and the medical disclaimer directly beneath it.
- **The results table** — every value with its unit, reference range, position
  within that range, status and confidence.

> The sentence to say out loud: *"The numbers are never produced by a language
> model. They are matched by name, parsed, and compared against published
> reference intervals that are hard-coded with their sources. The model is only
> ever allowed to rephrase findings that were already extracted — and with no API
> key configured, the deterministic explainer runs instead, which is what the
> badge is telling you."*

- Scroll to **Source document and processing**: text source (PDF text layer vs
  OCR), characters extracted, when it was analysed.

### 4. Live upload (60s)
Dashboard → drop in `OneHealth-Demo-Report.pdf` → Upload and analyse.

Watch the status go **Queued → Analysing → Analysed** without a refresh. Open it:
14 values, 7 flagged. Refresh the browser to show it is persisted in PostgreSQL,
not client state.

### 5. Trends (45s)
- Pick a parameter — glucose or HbA1c tells the best story.
- The shaded band is the reference interval; each point is a real report.
- **Observation** is deterministic: "increased by…", "returned to range".
- **Compare two reports** at the bottom — a per-parameter diff.

### 6. Consent and the provider portal (2 min) — *the strongest section*

**As the patient**, go to **Sharing & consent → Requests**. There is a pending
request from Dr Menon with a stated purpose.

Before approving, open a second browser (or a private window) and sign in as the
**clinician**. Their patient list is empty, and *Access requests* shows the
request waiting.

> *"Nothing of this patient is visible to the clinician right now. That is not
> the UI hiding a button — the API refuses the request."*

Back **as the patient**: choose a duration and **Approve**.

**As the clinician**: refresh — the patient now appears. Open them:
- A read-only banner, the granted scope, and the expiry.
- Patient summary with allergies and conditions.
- Open one of their records: the same clinical view, marked read-only.

Back **as the patient**: **Access history** now shows *"Dr. A. Menon (Demo
Doctor) opened sample-blood-report-abnormal.pdf"*.

> *"The audit records who acted and whose data it was, which is what makes it
> meaningful to the patient rather than invisible."*

Then **Revoke access**. Refresh the clinician's page — the patient is gone.

### 7. QR sharing (30s)
**Sharing & consent → Share by QR** → Generate. Point out:
- The QR carries a random token only — no name, no identifier, no medical data.
- It expires in minutes, is single-use, and can be cancelled.
- A clinician redeems it at **Connect a patient**, which creates an ordinary
  revocable consent.

### 8. Health assistant (45s)
Ask **"What is my hemoglobin?"** — a real value, a comparison with the previous
report, and citation chips linking back to the source records.

Then ask **"Do I have diabetes?"** — the assistant refuses, and explains why.

> *"The refusal runs before any answer is composed, so no phrasing can get
> around it. And the context is assembled from this patient's rows only — the AI
> service has no database access at all."*

### 9. Export (20s)
Dashboard → **Export summary** → a PDF built only from stored values, with the
disclaimer on page one and "Not provided" wherever the patient has entered
nothing.

---

## Questions you are likely to be asked

**"How do you know the extracted values are correct?"**
Extraction is deterministic — alias matching, number parsing, unit
normalisation — and every parameter carries the exact source line it came from.
`ai-service/tests` asserts specific values from the sample reports, including
the Indian lakh notation case (2,45,000 /cumm → 245 x10³/µL).

**"What stops the AI hallucinating a value?"**
It never produces values. It receives values that were already extracted. In the
assistant, a model response is discarded outright if it contains a number the
deterministic draft did not contain.

**"Could a doctor just navigate to a patient's URL?"**
No. Authorisation is server-side and re-evaluated on every request against a live
consent. `scripts/smoke-test-consent.js` calls the API directly to prove refusal
while pending, after decline, after revocation and after expiry.

**"Where is the data stored, and is it secure?"**
PostgreSQL via Prisma. Email and phone are AES-256-GCM encrypted at rest with a
separate HMAC hash for lookup; passwords are bcrypt at cost 12. Uploaded
documents have no unauthenticated URL — every fetch re-checks ownership or
consent. Secrets come only from validated environment variables and the process
refuses to start in production with development secrets.

**"Is this ABDM integrated?"**
No, and the profile page says so. The ABHA identifier is stored as profile
metadata. A real integration needs sandbox credentials and a consent-manager
flow, which is roadmap, not this build.

**"Why no health score?"**
Because it would have to be invented. Every number in this product traces to a
document the patient uploaded; a composite score would not, and inventing
clinical signals is the failure mode the whole design avoids.

**"What isn't finished?"**
Password reset (needs a mail service), OTP delivery (console stub), ABDM
integration, and any notification delivery. All four are named in
`docs/FINAL-FEATURE-MATRIX.md` rather than hidden.

---

## If something goes wrong mid-demo

| Symptom | Action |
|---|---|
| A page will not load | The three services log to `scripts\*.log`. Re-run `RUN-SETUP.bat`; it is safe to re-run and skips completed work. |
| Upload stays "Analysing" | The AI service is down. `scripts\ai-service.log` will say why. The already-seeded reports still demonstrate the full pipeline. |
| Image OCR fails | Tesseract is not installed. **Digital PDFs still work** — use `OneHealth-Demo-Report.pdf`, which needs no OCR. |
| The database will not start | Double-click `SETUP-DATABASE.bat`, then `RUN-SETUP.bat`. |

Fallback: `node scripts/smoke-test.js` and `node scripts/smoke-test-consent.js`
exercise the entire stack from the command line and print 42 and 95 passing
assertions respectively — a working demonstration even without the browser.
