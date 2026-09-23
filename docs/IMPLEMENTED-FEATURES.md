# OneHealth AI — Implemented Features

This document describes what the product actually does, how it is built, and
why it is trustworthy — for anyone evaluating the build rather than running
the demo script. It is written against the same running stack verified in
`docs/FINAL-DEMO-READINESS.md` and `docs/FINAL-FEATURE-MATRIX.md`; those two
files carry the line-by-line status table and the pass/fail evidence. This one
explains the shape of the system.

---

## 1. What the product is

OneHealth AI is a personal digital health record platform. A patient uploads
lab reports (PDF or image); the system extracts the structured values,
flags what is out of range, tracks them over time, and lets the patient
selectively and revocably share that record with a clinician. Everything a
clinician can see is gated by an explicit, time-limited, patient-granted
consent, re-checked by the server on every single request — never by what the
frontend happens to render.

The project's central discipline: **nothing is invented**. Extracted values
come from deterministic parsing of the source document, never from a language
model. Unset profile fields read "Not provided," not a plausible-looking
default. There is no fabricated health score. Where a capability genuinely
isn't built (password-reset email, ABDM integration), the UI says so instead
of presenting a dead button.

---

## 2. Architecture

Four independent processes, each replaceable on its own:

| Layer | Technology | Port |
|---|---|---|
| Frontend | React + TypeScript + Vite | 5173 |
| API | Node.js + Express + TypeScript | 3001 |
| AI service | Python + FastAPI | 8001 |
| Database | PostgreSQL 16 | 5433 |

The API and the AI service communicate over HTTP on localhost; the AI service
holds no database connection and no persistent state of its own — it receives
a document, returns extracted values, and forgets both. This is what makes
"the assistant cannot reach another patient's data" a structural fact rather
than a promise: the process answering assistant questions is handed exactly
one patient's already-fetched rows and nothing else.

**Prisma runs engine-free.** `schema.prisma` sets
`engineType = "client"` with the `queryCompiler` and `driverAdapters` preview
features, and the app wires up `@prisma/adapter-pg` directly. This removes the
dependency on a downloaded native Prisma binary entirely — the ORM compiles
queries in JavaScript and executes them through the `pg` driver. It is a
deliberate robustness choice, not a workaround for one environment: it means
the project starts the same way regardless of what a given machine's
firewall, proxy, or corporate network allows through to Prisma's binary CDN.

**Database migrations run through a custom SQL runner**
(`backend/scripts/apply-migrations.js`) instead of `prisma migrate deploy`,
for the same engine-free reason. It tracks applied migrations in a
`_onehealth_migrations` table, is idempotent on re-run, and — notably — can
safely adopt a database that already has data in it: it detects a pre-existing
`User` table, marks the non-idempotent bootstrap migration as already applied
without re-running it, and applies only what comes after. This was verified
against a seeded, legacy-shaped database: all existing rows survived, and a
second run was a confirmed no-op. No migration in this project drops a table
or resets data.

---

## 3. The AI pipeline (deterministic-first, by design)

This is the part of the system most likely to be misunderstood, so it is
worth being precise about what "AI" means in each stage:

1. **Text extraction** — a digital PDF is read from its text layer
   (PyMuPDF); a scanned PDF or an image goes through Tesseract OCR. Neither
   step involves a language model.
2. **Parameter extraction** (`ner.py`) — a deterministic pass over the
   extracted text: known lab parameter names and their aliases are matched,
   the adjacent number is parsed, units are normalised (including Indian lakh
   notation — `2,45,000 /cumm` becomes `245 x10³/µL`), and the value is
   compared against a hard-coded, sourced reference range, selecting the
   sex-specific range where the report states a sex. Every value carries a
   confidence score reflecting how unambiguous the match was; an implausible
   parse is reported as UNKNOWN rather than a confident but wrong flag. **No
   language model participates in this step.** This is the step that produces
   every number a user sees, and it is regex/alias-driven and unit-tested.
3. **Patient-friendly summary** (`gpt.py`) — takes the already-extracted
   values and produces prose. With no LLM API key configured (the default,
   and the state of this deployment), a deterministic template composes the
   summary from the real values, and the UI labels it "Deterministic
   explainer." If an API key were configured, the model would only be
   permitted to *reword* the same already-extracted facts — it is not asked
   to extract or diagnose. A medical disclaimer is appended server-side so it
   cannot be dropped by the client.
4. **Health assistant** (`assistant.py`) — answers a patient's question about
   their own data. The context handed to it is only that one patient's
   extracted rows, assembled server-side. A refusal check for diagnosis,
   prescription, or treatment-plan requests runs *before* any answer is
   composed, so no phrasing of the question can route around it. Where a
   model is available to reword the deterministic answer, its output is
   discarded outright if it introduces any number that wasn't already in the
   deterministic draft — this is enforced in code, not by prompt instruction.

This pipeline was adversarially tested, not just happy-path tested: the test
suite includes cases like "how many reports do I have" (an inventory question
that a careless regex could misroute into a refusal) and "what is flagged in
my latest report" (a results question that could be misrouted into a bare
count), both of which surfaced real routing bugs during development and are
now regression-tested.

---

## 4. Consent and authorization model

This is the security-critical core of the product, so it gets its own
section.

- A patient has a **share code** (not their email — a clinician cannot
  enumerate patients by guessing emails).
- A clinician requests access by share code. The request is created
  `PENDING` and grants nothing.
- The patient approves (choosing a duration — 24h/3d/7d/30d — and a scope:
  records, trends, and/or profile), declines, or later revokes.
- **`ConsentService.findActive()` is the single source of truth**, called on
  every protected request. It is not a cached client-side flag. It also
  auto-expires a lapsed grant at read time, so an expired consent is refused
  even if nothing has explicitly revoked it yet.
- A clinician's read access is enforced to be read-only at the route level:
  the write endpoints (upload, edit, delete) reject a `DOCTOR` role outright,
  regardless of consent state.
- **The frontend routing is not the security boundary.** A doctor page
  existing in the React router proves nothing about what the API will permit;
  the test suite proves the refusal by calling the API directly, bypassing
  the UI entirely, for four distinct authorization-failure states: pending,
  declined, revoked, and expired.
- Every access is written to an audit log that records **both the actor and
  the subject** — so a patient's own activity history shows "Dr. Menon opened
  your report," not just their own actions. Consent decisions themselves
  (request, approve, decline, revoke) are also logged.

## 5. QR-based sharing

A second path to the same consent system, built for the case where the
patient and clinician are physically together:

- The patient generates a short-lived (5/15/60 minute), single-use token.
- **The QR code encodes only that opaque token — never a name, a patient ID,
  a diagnosis, or any medical value.** This was a hard constraint from the
  start and is asserted directly in the test suite by decoding the QR image
  and checking its payload shape.
- Redeeming the token requires a signed-in clinician account and creates an
  ordinary `DoctorAccessToken` consent row — indistinguishable from one
  created by the request/approve flow, and just as revocable by the patient.
- A token cannot be redeemed twice, a revoked token cannot be redeemed at
  all, and generating a new token retires whatever unused token preceded it.

## 6. Trends, comparison, and the deliberate absence of a health score

Longitudinal charts are built only from values the patient actually has —
a single report yields an honest "not enough data" state rather than a
fabricated trend line. Where two or more points exist, the system attaches a
**deterministic observation** (increased / decreased / stable / newly
abnormal / returned to range) computed by arithmetic on the stored values,
never composed by a model. A two-report comparison view does a per-parameter
diff, including parameters that were tested in one report and not the other.

There is no composite "health score" anywhere in the product. This was a
conscious decision: any single number claiming to summarize a patient's
overall health would have to be invented, since nothing in the underlying
data supports one, and inventing a clinical-sounding number is precisely the
failure mode this project's deterministic-first discipline exists to avoid.

## 7. Everything else that's real

- **PDF health-summary export** — built server-side only from stored values;
  unset fields print "Not provided," and the medical disclaimer is stamped on
  page one. A clinician with active consent can export the same summary for
  a patient they're authorized for.
- **In-app reminders** — patient-owned, no email/SMS delivery (the UI does
  not claim otherwise).
- **Search, filter, and sort** across records by type, status, tag, and
  date, with filter state kept in the URL so a filtered view is bookmarkable.
- **Retry of a failed analysis** — an upload that fails to analyze is never
  silently lost; it can be re-run against the AI service.
- **Live processing status** (Queued → Analysing → Analysed) that updates
  without a manual refresh.

## 8. Security posture, summarized

(Full evidence table in `FINAL-FEATURE-MATRIX.md` §9; adversarial spot-checks
in `FINAL-DEMO-READINESS.md`.)

- Passwords: bcrypt, cost 12; never returned in any API response.
- PII (email, phone): AES-256-GCM at rest, with a separate HMAC hash used for
  lookup so the plaintext is never needed to query by email.
- Secrets: read only from validated environment variables; the process
  refuses to boot in production with development-grade secrets, and no
  secret is committed to the repository.
- Uploaded documents have no unauthenticated URL; every fetch re-checks
  ownership or an active consent grant.
- Malformed, path-traversal-shaped, and SQL-injection-shaped record and
  consent IDs all return a clean 404 with no stack trace or internal detail
  leaked.
- Rate limiting on signup, login, consent requests, QR redemption, and
  assistant queries.
- CORS restricted to the configured frontend origin; standard security
  headers (helmet) applied; documents served with `nosniff` and `no-store`.

## 9. Known, stated limitations

These are named in the UI itself, not just in this document:

- **Password reset by email** is not implemented — it requires an outbound
  mail service this deployment does not have configured.
- **OTP login** exists as a rate-limited endpoint but delivery is a console
  stub, so it is not surfaced in the UI.
- **ABDM/ABHA integration** does not exist — the ABHA ID is stored as
  ordinary profile metadata with format validation; there is no call to the
  national health registry or a consent-manager flow.
- **Reminders** are in-app only; there is no email or SMS delivery.
- **No mobile app or installable PWA** — the responsive web UI is verified
  down to a 390px viewport, but it is a website, not an installable app.
- **No production cloud deployment** — the project is built and verified to
  run locally; no hosting or deployment pipeline is claimed.

---

For the itemized status of every individual feature with its test coverage,
see `docs/FINAL-FEATURE-MATRIX.md`. For proof this build currently passes —
test counts, browser QA, and a recommended live-demo flow — see
`docs/FINAL-DEMO-READINESS.md`.
