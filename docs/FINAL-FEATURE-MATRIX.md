# OneHealth AI — Final Feature Matrix

Last verified: 2 September 2026, against a running stack
(PostgreSQL 16 · Node/Express API · Python FastAPI AI service · React frontend).

## How to read this table

A feature is **COMPLETE** only when a request from the browser reaches the API,
the API enforces authorisation, the result is persisted, it survives a page
refresh, and an automated test asserts the behaviour. A screen that renders is
not, by itself, evidence of anything.

| Status | Meaning |
|---|---|
| **COMPLETE** | Works end to end, persisted, authorised server-side, covered by a test |
| **PARTIAL** | Works, but with a stated limitation |
| **PLANNED** | Deliberately scoped out; schema or seam exists, behaviour does not |
| **NOT IMPLEMENTED** | Not present in this build |

"Tested" names the automated check. `core` = `scripts/smoke-test.js` (42 assertions),
`consent` = `scripts/smoke-test-consent.js` (95 assertions),
`ai` = `ai-service/tests` (15 assertions), `qa` = scripted browser walkthrough.

---

## 1. Identity and access

| Feature | Status | Frontend | Backend | Database | Tested | Demo-safe claim |
|---|---|---|---|---|---|---|
| Patient registration | COMPLETE | `Register.tsx` | `auth.controller` | `User` | core, consent | "Patients self-register; passwords are bcrypt-hashed and never recoverable." |
| Clinician registration with practice details | COMPLETE | `Register.tsx` | `auth.controller` | `User` | consent | "A clinician registers with speciality, clinic and registration number, which patients see before sharing." |
| Role selection at signup, ADMIN not self-assignable | COMPLETE | `Register.tsx` | zod enum | `Role` | consent | "Only PATIENT and DOCTOR can be self-registered; the enum rejects ADMIN." |
| Login, JWT access token + HttpOnly refresh cookie | COMPLETE | `AuthContext` | `auth.controller`, `jwt.service` | — | core | "Short-lived access token in memory, refresh token in an HttpOnly cookie JavaScript cannot read." |
| Silent token refresh and replay of the original request | COMPLETE | `apiClient.ts` | `/auth/refresh` | — | qa | "An expired access token is refreshed transparently; the user is not signed out mid-task." |
| PII encryption at rest (email, phone) | COMPLETE | — | `crypto.service` (AES-256-GCM) | `User.emailEncrypted` | core | "Email and phone are stored encrypted; lookup uses a separate HMAC hash." |
| Rate limiting on signup and login | COMPLETE | — | `rate-limit.middleware` | Redis or in-memory | consent | "Repeated signups and failed logins from one address are throttled." |
| Password reset by email | NOT IMPLEMENTED | states so plainly | — | — | — | "Not in this build — it needs an outbound mail service, and the screen says so rather than pretending." |
| OTP login | PARTIAL | not surfaced | `auth.controller` | Redis | — | "The OTP endpoints exist and are rate-limited, but delivery is a console stub, so the UI does not offer it." |

## 2. Patient health record

| Feature | Status | Frontend | Backend | Database | Tested | Demo-safe claim |
|---|---|---|---|---|---|---|
| Patient profile: demographics, blood type, sex, date of birth | COMPLETE | `Profile.tsx` | `users.controller` | `User` | consent | "Every health field is optional and starts empty; what the patient has not entered reads 'Not provided'." |
| Allergies and ongoing conditions | COMPLETE | `Profile.tsx` | `users.controller` | `String[]` | consent | "Entered by the patient, de-duplicated server-side, and shown to clinicians they share with." |
| Emergency contact | COMPLETE | `Profile.tsx` | `users.controller` | `User` | consent | "Stored on the profile and surfaced to an authorised clinician." |
| Profile validation (blood type, future date of birth, ABHA format) | COMPLETE | inline errors | zod | — | consent | "Invalid values are refused by the server, not only by the form." |
| Share code, and re-issuing it | COMPLETE | `Profile.tsx`, `Sharing.tsx` | `identity.service` | `User.shareCode` | consent | "A patient identifier that is not their email, so clinicians cannot enumerate patients — and it can be rotated." |
| ABHA ID as profile metadata | PARTIAL | `Profile.tsx` | `users.controller` | `User.abhaId` | consent | "Stored and validated as an identifier. **No ABDM integration** — nothing is exchanged with the national registry, and the UI says so." |

## 3. Records and the AI pipeline

| Feature | Status | Frontend | Backend | Database | Tested | Demo-safe claim |
|---|---|---|---|---|---|---|
| Upload PDF / JPEG / PNG / WebP / TIFF | COMPLETE | `UploadPanel.tsx` | `records.controller` | `HealthRecord` | core | "Type and size are validated in the browser and again on the server." |
| Secure storage with a driver abstraction | COMPLETE | — | `storage.service` | pointer `"<driver>:<key>"` | core | "Local encrypted disk by default; the S3 implementation is intact behind the same interface." |
| Authenticated document access only | COMPLETE | blob fetch | `streamFile` | — | core, consent | "There is no unauthenticated URL to an uploaded document; ownership is re-checked on every request." |
| PDF text-layer extraction | COMPLETE | — | AI service (PyMuPDF) | — | core, ai | "A digital PDF is read from its text layer, so the primary demo path needs no OCR engine at all." |
| OCR for scans and images | COMPLETE | — | AI service (Tesseract) | — | core, qa | "Images and scanned PDFs go through Tesseract; the seeded PNG report is extracted this way." |
| Deterministic medical parameter extraction (14 parameters) | COMPLETE | — | `ner.py` | `extractedData` | core, ai | "Values are matched by alias and parsed — never produced by a language model, which is the whole point." |
| Unit normalisation, incl. Indian lakh notation | COMPLETE | — | `ner.py` | — | core | "2,45,000 /cumm is normalised to 245 x10³/µL." |
| Reference ranges with cited sources | COMPLETE | shown per row | `reference_ranges.py` | — | core | "Every range is a hard-coded constant with a published source, so any HIGH/LOW can be traced." |
| Sex-specific ranges from the report | COMPLETE | stated in UI | `ner.py` | `detectedSex` | core | "Where a range differs by sex, the sex printed on the report selects it." |
| HIGH / LOW / NORMAL classification | COMPLETE | `StatusChip` | `ner.py` | — | core | "A deterministic comparison against the stored interval." |
| Confidence score per value | COMPLETE | results table | `ner.py` | — | core | "Reflects how unambiguous the alias match and the parse were." |
| Implausible values reported as UNKNOWN | COMPLETE | "Not compared" | `ner.py` | — | ai | "An OCR misread becomes UNKNOWN rather than a confident abnormal flag." |
| Patient-friendly summary | COMPLETE | `ReportDetail.tsx` | `gpt.py` | `aiSummary` | core | "Generated from values already extracted. With no API key the deterministic explainer runs, and the UI labels which produced it." |
| Medical disclaimer applied server-side | COMPLETE | `MedicalDisclaimer` | `ai.service.ts` | stored in `aiSummary` | core | "Appended by the server, so it cannot be lost by the client." |
| Live processing state and polling | COMPLETE | all list views | `ProcessStatus` | — | qa | "Queued → Analysing → Analysed updates without a refresh." |
| Retry a failed analysis | COMPLETE | `ReportDetail.tsx` | `reprocessRecord` | — | qa | "The uploaded document is never lost by a failed analysis; it can be re-run." |
| Patient-owned record metadata (date, lab, notes, tags, type) | COMPLETE | edit dialog | `updateRecord` | `HealthRecord` | consent | "The extractor guesses; the patient corrects." |
| Search, filter by type / status / tag / date, sorting | COMPLETE | `Reports.tsx` | `listRecords` | indexed | qa | "Filter state lives in the URL, so a filtered view can be bookmarked." |
| Soft delete with retained audit trail | COMPLETE | confirm dialog | `deleteRecord` | `DELETED` | core | "The record leaves the patient's view; the record of who accessed it is kept." |

## 4. Consent and provider access

| Feature | Status | Frontend | Backend | Database | Tested | Demo-safe claim |
|---|---|---|---|---|---|---|
| Clinician requests access by patient share code | COMPLETE | `ProviderConnect.tsx` | `consent.controller` | `DoctorAccessToken` | consent | "A clinician cannot search for patients; the patient's code is the only way in." |
| Patient approves, declines or revokes | COMPLETE | `Sharing.tsx` | `consent.controller` | `ConsentStatus` | consent | "Every state change is the patient's decision and is written to the audit trail." |
| Time-limited grants (24h / 3d / 7d / 30d) | COMPLETE | duration picker | `expiresAt` | `DoctorAccessToken` | consent | "Access ends automatically at the chosen expiry, checked on every request." |
| Patient grants access directly from a directory | COMPLETE | `Sharing.tsx` | `directory`, `grant` | — | consent | "The patient can initiate sharing without waiting to be asked." |
| Server-side authorisation on every read | COMPLETE | — | `rbac.middleware`, `consent.service` | — | consent | "Reaching a doctor page proves nothing: the API refuses without a live consent, including on direct calls." |
| Refusal while pending, after decline, after revoke, after expiry | COMPLETE | — | `ConsentService.findActive` | — | consent | "All four refusal paths are asserted directly against the API." |
| Clinician read-only patient record view | COMPLETE | `ProviderPatient.tsx` | `patientDetail` | — | consent | "Read-only is enforced server-side; the write endpoints refuse a DOCTOR role outright." |
| Scope (records / trends / profile) | COMPLETE | shown in UI | `consent.service` | `scope[]` | consent | "Contact details are only revealed when the profile scope was granted." |
| Clinician sees only their authorised patients | COMPLETE | `ProviderPatients.tsx` | `patients` | — | consent | "The list is derived from live consents and empties the moment access is revoked." |

## 5. QR sharing

| Feature | Status | Frontend | Backend | Database | Tested | Demo-safe claim |
|---|---|---|---|---|---|---|
| Generate a short-lived QR / share token | COMPLETE | `Sharing.tsx` | `share.controller` | `ShareSession` | consent | "The QR encodes a random token and nothing else — no name, no identifier, no medical data." |
| Single use | COMPLETE | — | `claimedAt` guard | — | consent | "A second redemption of the same token is refused." |
| Expiry (5 / 15 / 60 minutes) | COMPLETE | picker | `expiresAt` | — | consent | "The code stops working at its expiry, independent of any grant it created." |
| Patient can cancel an unused code | COMPLETE | `Sharing.tsx` | `revoke` | `revoked` | consent | "Cancelling takes effect immediately." |
| Only one live code at a time | COMPLETE | — | `share.controller` | — | consent | "Creating a new code retires the previous unused one." |
| Clinician redeems, gaining a normal revocable consent | COMPLETE | `ProviderConnect.tsx` | `redeem` | `DoctorAccessToken` | consent | "Redeeming creates an ordinary consent row the patient can revoke like any other." |
| Only a signed-in clinician can redeem | COMPLETE | — | `requireRole([DOCTOR])` | — | consent | "A scanned code is useless without a verified clinician account." |

## 6. Trends and comparison

| Feature | Status | Frontend | Backend | Database | Tested | Demo-safe claim |
|---|---|---|---|---|---|---|
| Longitudinal chart per parameter | COMPLETE | `Trends.tsx` | `getTrends` | stored extractions | qa | "Every point is a value read from a report the patient uploaded." |
| Reference band on the chart | COMPLETE | inline SVG | — | — | qa | "The shaded band is the stored reference interval." |
| Deterministic observations | COMPLETE | observation panel | `insights.service` | — | consent | "increased / decreased / stable / newly abnormal / returned to range — arithmetic, not interpretation." |
| Report-to-report comparison | COMPLETE | `Trends.tsx` | `compare` | — | consent | "A per-parameter diff of two reports, including tests newly added or not repeated." |
| Honest empty state | COMPLETE | `Trends.tsx` | `message` | — | qa | "A single reading is not shown as a trend; the page says why." |
| Health score | NOT IMPLEMENTED | — | — | — | — | "Deliberately absent: any single number here would be invented, and inventing clinical signals is the failure mode this project is built to avoid." |

## 7. Health assistant

| Feature | Status | Frontend | Backend | Database | Tested | Demo-safe claim |
|---|---|---|---|---|---|---|
| Questions about the patient's own values | COMPLETE | `Assistant.tsx` | `assistant.controller` → `assistant.py` | read-only | consent, ai | "The context is assembled from one patient's rows; the AI service holds no data and cannot reach another patient." |
| Citations back to the source report | COMPLETE | linked chips | — | — | consent | "Every factual answer names the report it came from." |
| Refuses diagnosis, prescription, treatment, prognosis | COMPLETE | distinct styling | intent check before composition | — | consent, ai | "The refusal check runs before any answer is composed, so no phrasing path bypasses it." |
| Deterministic answers, optional model rewording | COMPLETE | source badge | `assistant.py` | — | ai | "Facts come from the deterministic composer. A model may only re-word, and its output is discarded if it introduces a number the draft did not contain." |
| Honest source labelling | COMPLETE | badge + reason | — | — | consent | "The UI never claims a deterministic answer came from a language model." |
| Rate limited | COMPLETE | — | `rate-limit.middleware` | — | — | "30 questions per five minutes per account." |

## 8. Audit, export and reminders

| Feature | Status | Frontend | Backend | Database | Tested | Demo-safe claim |
|---|---|---|---|---|---|---|
| Audit trail of actor **and** subject | COMPLETE | `ActivityHistory.tsx` | `audit.service` | `AccessLog` | consent | "The patient sees 'Dr Menon opened your report', not only their own actions." |
| Consent decisions in the audit trail | COMPLETE | — | `audit.service` | — | consent | "Requests, approvals, declines, revocations and QR redemptions are all logged." |
| PDF health summary export | COMPLETE | dashboard action | `pdf.service` | — | consent | "Built only from stored values; unset fields print 'Not provided' and the disclaimer is stamped on page one." |
| Clinician export for an authorised patient | COMPLETE | `ProviderPatient.tsx` | `exportSummary` | — | consent | "Behind the same consent check as everything else." |
| Reminders | COMPLETE | `Reminders.tsx` | `reminders.controller` | `Reminder` | consent | "In-app only. The platform sends no email or SMS, and the UI says so." |

## 9. Security posture

| Control | Status | Evidence |
|---|---|---|
| Passwords bcrypt-hashed (cost 12) | COMPLETE | `auth.controller`; core asserts no hash is ever returned |
| PII encrypted at rest (AES-256-GCM) | COMPLETE | `crypto.service`; core asserts the email round-trips |
| Secrets only from validated environment | COMPLETE | `config/env.ts`; refuses to boot in production with dev secrets |
| No secrets in the repository | COMPLETE | `.env` is git-ignored; `.env.example` holds placeholders |
| Server-side RBAC on every protected route | COMPLETE | `rbac.middleware`; consent asserts direct-API refusals |
| Ownership re-checked on every record request | COMPLETE | `checkRecordAccess`; core asserts cross-tenant refusal |
| Consent re-evaluated per request, expiry enforced at read time | COMPLETE | `consent.service`; consent asserts pending/declined/revoked/expired |
| Soft delete indistinguishable from missing | COMPLETE | `rbac.middleware` returns 404, so deletion cannot be probed |
| Upload type and size validation | COMPLETE | `upload.middleware`; core asserts rejection |
| Rate limiting on auth, consent requests, QR redemption, assistant | COMPLETE | `rate-limit.middleware`; consent asserts throttling fires |
| No stack traces or internals in error responses | COMPLETE | catch-all handler; consent asserts no stack trace leaks |
| CORS restricted to the configured frontend origin | COMPLETE | `index.ts` |
| Security headers (helmet), `nosniff`, `no-store` on documents | COMPLETE | `index.ts`, `streamFile` |

## 10. Platform and infrastructure

| Item | Status | Note |
|---|---|---|
| PostgreSQL via Prisma | COMPLETE | Engine-free runtime (`engineType = "client"` + `pg` driver adapter), so no platform binary has to be downloaded to run the project |
| Migration runner without Prisma engines | COMPLETE | `backend/scripts/apply-migrations.js`; adopts an existing database, and every migration after the bootstrap is idempotent |
| MongoDB for extracted data | NOT IMPLEMENTED | PostgreSQL `Json` columns hold the extraction; adding MongoDB would add an operational dependency without a functional gain. Documented as a deliberate decision, not an omission |
| AWS S3 storage | PARTIAL | Implemented behind `STORAGE_DRIVER=s3` and exercised by the pointer format; the demo runs on the local driver so it needs no cloud account |
| Docker compose for the database | PARTIAL | `infra/docker-compose.yml` works; the default path is a self-contained local cluster needing no Docker or admin rights |
| ABHA / ABDM integration | PLANNED | Only the identifier field exists. No registry calls, no consent-manager integration |
| Mobile app / PWA | NOT IMPLEMENTED | The web UI is responsive down to a 390px viewport; it is not an installable PWA |
| Production cloud deployment | NOT IMPLEMENTED | The project runs locally; no deployment pipeline is claimed |

---

## Verification summary

| Suite | Assertions | Result |
|---|---|---|
| `scripts/smoke-test.js` — core pipeline | 42 | **42 passed** |
| `scripts/smoke-test-consent.js` — consent, sharing, assistant, export | 95 | **95 passed** |
| `ai-service/tests` — extraction and assistant safety | 15 | **15 passed** |
| Frontend production build | — | **clean** (TypeScript + Vite) |
| Backend typecheck and build | — | **clean** |
| Browser walkthrough (desktop, tablet, 390px mobile) | 27 pages | **no console errors, no failed API calls, no horizontal overflow** |
| Migration against a populated pre-existing database | — | **all rows preserved, re-run is a no-op** |

**Total: 152 automated assertions passing.**
