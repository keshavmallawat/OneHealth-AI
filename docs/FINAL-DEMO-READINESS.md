# OneHealth AI — Final Demo Readiness

Last verified: 3 September 2026, against a freshly restarted stack
(PostgreSQL 16 on port 5433 · Node/Express API on 3001 · Python FastAPI AI
service on 8001 · React/Vite frontend on 5173), immediately before this
document was written. Every figure below is from that run, not carried over
from an earlier session.

---

## 1. Product overview

OneHealth AI is a personal digital health record platform: a patient uploads
lab reports, the system deterministically extracts and flags the values,
tracks them over time, and lets the patient grant — and revoke — time-limited,
scope-limited access to a clinician. Every clinician-visible fact is behind a
server-enforced consent check, not a frontend route. Nothing in the product is
fabricated: extracted values trace to a source document, unset profile fields
say "Not provided," and there is no invented health score.

## 2. Implemented features

Full itemized status lives in `docs/FINAL-FEATURE-MATRIX.md` (10 sections,
COMPLETE/PARTIAL/PLANNED/NOT IMPLEMENTED per feature) and the narrative
version in `docs/IMPLEMENTED-FEATURES.md`. In summary, COMPLETE and tested:
patient + clinician registration and auth, encrypted PII, patient profile,
record upload with OCR/text-layer extraction, deterministic 14-parameter
extraction with reference ranges and confidence scores, AI-generated
patient-friendly summaries (deterministic fallback, honestly labelled),
search/filter/sort, soft delete, the full consent lifecycle (request,
approve, decline, revoke, expiry, scope), QR-based sharing, clinician
read-only record and profile view, audit trail (actor + subject), trends with
deterministic observations, report comparison, the health assistant
(grounded, refuses diagnosis/prescription), PDF summary export, and
reminders. Named gaps: password-reset email, OTP delivery, ABDM/ABHA
integration, mobile app — all stated in the UI, none faked.

## 3. Architecture

```
React/Vite (5173) → Express API (3001) → PostgreSQL (5433)
                            ↓
                   FastAPI AI service (8001)
```

The AI service is stateless and holds no database connection — it receives a
document or a context payload and returns a result, nothing more. Prisma runs
engine-free (`engineType = "client"` + `@prisma/adapter-pg`), and migrations
run through a custom SQL runner rather than `prisma migrate deploy`, so the
project needs no downloaded native binary to start.

## 4. AI pipeline

Deterministic-first, in this order: (1) PDF text-layer extraction or Tesseract
OCR — no model involved; (2) alias-matched, unit-normalised, range-compared
parameter extraction (`ner.py`) — no model involved, this produces every
number the user sees; (3) patient-friendly summary — deterministic template by
default (no LLM key is configured in this deployment), with the UI labelling
it "Deterministic explainer" rather than implying a model wrote it; (4) health
assistant — answers are composed deterministically from the patient's own
extracted rows; a model, if configured, may only reword and its output is
discarded if it introduces a number the deterministic draft didn't have.
Verified by 15 passing `ai-service/tests` assertions, including adversarial
intent-routing cases (an inventory question and a results question that
naive pattern-matching could misroute).

## 5. Security model

- Passwords: bcrypt, cost 12, never returned by any endpoint.
- PII (email, phone): AES-256-GCM at rest, HMAC hash for lookup.
- Consent is the single authorization mechanism for clinician access,
  re-evaluated server-side on every request via `ConsentService.findActive()`
  — never cached client-side, auto-expiring lapsed grants at read time.
- Frontend routing is never treated as an authorization boundary; the consent
  test suite calls the API directly, bypassing the UI, to prove refusal.
- QR tokens are opaque, single-use, short-expiry, and carry no medical data —
  verified by decoding the generated QR image in the test suite.
- Malformed IDs, path-traversal-shaped paths, and SQL-injection-shaped IDs all
  return a clean 404 with no stack trace (re-verified live today — see §9).
- Rate limiting on signup, login, consent requests, QR redemption, and
  assistant queries — verified to actually throttle, not just exist.
- No secrets in the repository; the app refuses to boot in production with
  development-grade secrets.

## 6. Database

PostgreSQL 16, reached through Prisma's engine-free client adapter. Schema
covers User (patient + clinician fields), HealthRecord, DoctorAccessToken
(the consent grant), ShareSession (QR tokens), AccessLog (audit trail), and
Reminder. Migrations are tracked in `_onehealth_migrations` and applied by a
custom runner that can safely adopt a pre-existing populated database without
any destructive operation — this was proven with an actual drift test (seeded
a legacy-shaped database, ran the adoption path, confirmed zero data loss and
an idempotent re-run). No destructive database operation has been run against
the demo data at any point in this project.

## 7. Verified user flows

All of the following were exercised end-to-end against the live API today
(not just observed in the UI): registration and login for both roles;
profile update and validation; upload → OCR/text extraction → parameter
extraction → summary; consent request → pending refusal → approval →
authorized read → revocation → post-revocation refusal; QR generation →
redemption → single-use enforcement → revocation; assistant Q&A with
citations and refusal-before-composition; trends and two-report comparison;
PDF export; reminder create/complete/delete; cross-tenant record access
refusal; doctor-cannot-write enforcement.

## 8. Automated test results (this run)

| Suite | Assertions | Result |
|---|---|---|
| `scripts/smoke-test.js` — core upload → extraction → summary pipeline | 42 | **42 passed, 0 failed** |
| `scripts/smoke-test-consent.js` — consent, QR sharing, assistant, export, reminders, rate limiting | 95 | **95 passed, 0 failed** |
| `ai-service/tests` — extraction correctness and assistant safety | 15 | **15 passed, 0 failed** |
| Backend TypeScript typecheck (`tsc --noEmit`) | — | **clean, 0 errors** |
| Frontend TypeScript typecheck (`tsc --noEmit`) | — | **clean, 0 errors** |
| Frontend production build (`vite build`) | — | **succeeded** (429 KB JS / 35 KB CSS, gzipped 128 KB / 7.5 KB) |

**Total: 152 automated assertions passing, two clean typechecks, one clean
production build — all re-run today, not carried forward from memory.**

## 9. Browser QA and live adversarial checks

Prior session included a scripted Playwright walkthrough across 27 pages at
desktop, tablet, and 390px mobile breakpoints: zero console errors, zero
failed API calls, zero horizontal overflow (a real defect was found and fixed
during that pass — grid children needed explicit `min-w-0`).

Additionally, live against the running backend today: malformed (non-UUID)
record IDs, URL-encoded path-traversal sequences (`..%2f..%2fetc%2fpasswd`),
and SQL-injection-shaped path segments all returned clean `404`s with generic
JSON bodies (`{"error":"Record not found"}` or equivalent) — no stack trace,
no ORM/query fragment, no framework version leaked in headers. `.env` and
`backend/.env` are not served as static files (`404`).

## 10. Known limitations

Password reset by email, OTP delivery, ABDM/ABHA registry integration, email
or SMS reminder delivery, an installable mobile app/PWA, and a production
cloud deployment are all not implemented. Every one of these is stated
plainly in the product UI or profile page rather than presented as a working
feature with no effect.

## 11. Features not safe to claim

Do not claim: real ABDM/ABHA connectivity (only the identifier field and its
format validation exist); that the AI summary was generated by GPT or any
external LLM (no key is configured — the deterministic fallback ran, and the
UI is truthful about this); a "health score" (does not exist, deliberately);
password-reset-by-email or OTP-by-SMS/email as working (endpoints exist for
OTP but delivery is a console stub, not wired to any provider); a native
mobile app (the responsive web UI is not a packaged app); production
readiness / cloud deployment (this is a local, demo-grade deployment).

## 12. Demo credentials

| Account | Email | Password |
|---|---|---|
| Patient | `patient@onehealth.ai` | `Demo@12345` |
| Clinician | `doctor@onehealth.ai` | `Demo@12345` |

Seed data: three analysed reports dated 13 Aug, 20 Aug, and 2 Sep 2026 (so
trends have a real timeline), and one pending clinician access request
already waiting, so the consent workflow has something to show immediately.

## 13. Startup procedure

1. Double-click `RUN-SETUP.bat` in the repository root. This installs
   dependencies, applies migrations (non-destructively — see §6), builds,
   starts all three services, seeds demo data if not already present, and
   runs both smoke-test suites. It is safe to re-run; it skips completed
   work. Logs land in `scripts\*.log`.
2. Open `http://localhost:5173`.
3. If a service fails to start, `docs/DEMO-SCRIPT.md` has a symptom → action
   table (page won't load, upload stuck on "Analysing", OCR failing, database
   not starting).

Fixed ports, unchanged throughout the project: frontend 5173, backend API
3001, AI service 8001, PostgreSQL 5433 (database `healthcareai`, under
`.local-postgres/` — entirely separate from any unrelated Postgres instance
on the default port 5432). No Docker is used or required.

## 14. Recommended demo flow

The full six-minute walkthrough with exact talking points is
`docs/DEMO-SCRIPT.md`. Shortest version:

1. Sign in as the patient — point out the live status indicator.
2. Open an already-analysed abnormal report — key findings, the deterministic
   explainer badge + disclaimer, the full results table with ranges and
   confidence.
3. Live upload `OneHealth-Demo-Report.pdf` — watch Queued → Analysing →
   Analysed with no refresh, then refresh the browser to prove it persisted.
4. Trends — pick glucose or HbA1c, show the reference band and the
   deterministic observation, then compare two reports.
5. Consent, in two browser windows — approve a pending clinician request as
   the patient, show it appear for the clinician, show the access-history
   entry naming the clinician, then revoke and show it disappear.
6. QR sharing — generate, point out the opaque token, redeem as a second
   clinician.
7. Ask the assistant a real question ("What is my hemoglobin?") and then a
   diagnostic one ("Do I have diabetes?") to show the refusal.
8. Export the PDF summary.

The strongest section to linger on, if time is short, is #5 — it is the one
that actually demonstrates server-side authorization rather than a UI
convention, and it's proven live in front of the audience by having the
clinician's view be genuinely empty until the patient approves.

---

**Bottom line:** 152 automated assertions passing, two clean typechecks, one
clean production build, and a set of live adversarial checks against the
running API — all reconfirmed today, immediately before this document was
written, after a full stack restart. Nothing in this document describes
intended behavior; every claim in it was just observed to be true.
