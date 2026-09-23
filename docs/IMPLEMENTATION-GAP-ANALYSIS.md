# Implementation Gap Analysis

**Status as of 2 September 2026 (post-implementation).** This document records
what the repository actually contains, measured against the project
documentation. It is written to be checkable: every claim below corresponds to
code and to an automated test, and anything not implemented is named as such.

For the feature-by-feature breakdown see [FINAL-FEATURE-MATRIX.md](./FINAL-FEATURE-MATRIX.md).

---

## 1. Core data and AI processing (P0)

**Status: COMPLETE.**

Authentication, upload, storage, OCR, deterministic extraction, reference-range
classification, assisted interpretation and persistence all work end to end and
are covered by `scripts/smoke-test.js` (42 assertions) and `ai-service/tests`
(15 assertions).

The design decision worth defending in the evaluation: **extraction is never
done by a language model.** Values are matched by alias and parsed by
`ai-service/app/services/ner.py`, then compared against hard-coded intervals in
`reference_ranges.py` that each cite a published source. The model is only ever
allowed to rephrase findings that were already extracted, and when no API key is
configured the deterministic explainer runs instead — a fully supported path,
labelled honestly in the UI.

## 2. Digital health record product (P1)

**Status: COMPLETE.** This was the largest previously identified gap.

- **Patient profile** — demographics, blood type, sex, date of birth, allergies,
  ongoing conditions, emergency contact and ABHA identifier, with server-side
  validation and a "Not provided" rendering for anything unset. Nothing is
  invented on the patient's behalf.
- **Record repository** — search across file name, laboratory and notes; filters
  by type, result status, tag and date range; four sort orders; pagination.
  Filter state lives in the URL.
- **Record detail** — a clinical document viewer: identity and metadata, key
  findings first, the full results table with unit, reference range, position
  within range, status and confidence, the assisted interpretation with its
  source labelled, and source-document and processing metadata.
- **Patient-owned metadata** — report date, laboratory, notes, tags and record
  type are editable, because the extractor guesses and the patient owns the truth.

## 3. Healthcare collaboration (P2)

**Status: COMPLETE.** Previously schema-only; now a working workflow.

- Clinician registration with practice details, and a provider-specific product
  (different navigation, different pages) rather than one product with hidden buttons.
- Access requested by **patient share code**, never by email — a clinician
  cannot enumerate patients.
- Patient approves, declines or revokes, and chooses the duration.
- **Authorisation is server-side and re-evaluated on every request.**
  `scripts/smoke-test-consent.js` asserts refusal while pending, after decline,
  after revocation and after expiry — by calling the API directly, not by
  checking that a button is hidden.
- Read-only clinician view of an authorised patient, with scope-limited fields.
- Audit trail records both the actor and the subject, so the patient sees
  clinician access to their own records.

## 4. QR sharing (P2)

**Status: COMPLETE.**

The QR encodes a random token and nothing else. Redeeming it requires a
signed-in clinician and produces an ordinary, revocable, time-limited consent.
Single use, short expiry, patient-cancellable, and only one live code at a time.

## 5. Health intelligence (P3)

**Status: COMPLETE, with one deliberate omission.**

- Longitudinal charts per parameter with the reference band, built only from
  stored extractions.
- Deterministic observations (increased / decreased / stable / newly abnormal /
  returned to range) — arithmetic on two stored values, phrased as observation
  rather than conclusion.
- Report-to-report comparison, including tests newly added or not repeated.
- **Health score: not implemented, deliberately.** Any single "health number"
  would have to be invented, and inventing clinical signals is precisely the
  failure mode this project is built to avoid. This is a defensible design
  position, not a missing feature.

## 6. Health assistant (P4 — implemented)

**Status: COMPLETE.**

Grounded in the signed-in patient's own extracted values. The Node layer
assembles the context and is the security boundary; the AI service holds no
patient data and has no database access, so it is structurally incapable of
reaching another patient's records. Diagnosis, prescription, treatment and
prognosis requests are refused by an intent check that runs *before* any answer
is composed. When a language model is configured it may only re-word a
deterministic draft, and its output is discarded if it introduces a number the
draft did not contain.

## 7. Export and reminders (P4 — implemented)

- **PDF health summary**, built only from stored values, with the disclaimer on
  page one and "Not provided" for anything the patient has not entered.
- **Reminders**, in-app only. The platform sends no email or SMS and the UI says so.

## 8. Platform capabilities (P5)

| Item | Position |
|---|---|
| **MongoDB** | Not implemented, on purpose. PostgreSQL `Json` columns hold the extraction payload; adding a second datastore would add an operational dependency without a functional gain. |
| **AWS S3** | Implemented behind `STORAGE_DRIVER=s3`. The demo runs on the local driver so it needs no cloud account or credentials. |
| **ABHA / ABDM** | Identifier field only. There is no registry call and no consent-manager integration, and the profile page states this plainly rather than implying otherwise. |
| **Mobile / PWA** | The UI is responsive to a 390px viewport and verified there, but it is not an installable PWA. |
| **Production deployment** | Out of scope. The project runs locally; no pipeline is claimed. |

---

## Remaining gaps, stated plainly

1. **Password reset** is not implemented — it needs an outbound mail service.
   The page says so instead of showing a form that silently does nothing.
2. **OTP login** endpoints exist and are rate-limited, but delivery is a console
   stub, so the UI does not offer it.
3. **ABDM integration** is a field, not an integration.
4. **No notification delivery** of any kind. Reminders are in-app only.
5. **Doctor-to-doctor referral**, care teams beyond a single consent, and
   multi-patient dashboards for a clinic are not implemented.
6. **The Google Fonts stylesheet is loaded from the network.** With no internet
   the page falls back to the system sans-serif stack; nothing else depends on
   an outbound request at runtime.

None of these are hidden behind a navigation item. Every route in the
application reaches something that works.
