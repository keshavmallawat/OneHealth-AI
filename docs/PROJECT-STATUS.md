# OneHealth AI — Project status

As of 8 October 2026. Every number below comes from a checklist you can audit; nothing is an impression.

## Headline

| Measured against | Done | Remaining | Earlier today |
|---|---|---|---|
| **The university proposal** (6 objectives + 15 timeline items) | **85.7%** (18 of 21) | 14.3% | 76.2% |
| **The Complete Plan** (25 feature bullets + 32 phase deliverables) | **62.3%** (35.5 of 57) | 37.7% | 54.8% |

The proposal is what the project is graded on. The Complete Plan is the full startup roadmap; 7 of its 32 phase deliverables are launch activities (billing, pilots, load testing, production hosting) that no student submission would be expected to include.

**Scoring rule.** 1 point for built and covered by an automated test or measurement, 0.5 for built with a stated limit or not yet exercised, 0.25 for files or scaffolding that exist but have never run, 0 for absent. Part-credit values are judgement calls; they are listed so you can disagree with a specific one.

---

## A. Proposal scorecard

### Objectives (6)
| # | Objective | Score | Why |
|---|---|---|---|
| 1 | Centralised storage of medical records | 1 | Upload, storage, history, search |
| 2 | AI report analysis: extract, summarise, interpret | 1 | 14 parameters, flags, cited ranges, summary; accuracy measured |
| 3 | Patient dashboard: reports, insights, history charts | 1 | Dashboard, trends, comparison, watch indicators |
| 4 | Secure doctor access via RBAC and consent | 1 | 95 consent assertions |
| 5 | Privacy and security: encryption, auth, secure cloud storage | 0.75 | Encryption and auth done; S3 implemented but never run against a real bucket |
| 6 | Scalable architecture, multiple users, real-time AI processing | 0.75 | Works with live status; no load test and no deployment |
| | **Subtotal** | **5.5 / 6** | |

### Timeline items (15)
| # | Item | Score | Why |
|---|---|---|---|
| 1 | Problem definition and setup | 1 | |
| 2 | Architecture and design, UML | 1 | Diagrams in `docs/SRS.md` |
| 3 | Authentication and core backend | 1 | |
| 4 | File upload and cloud storage (S3) | 0.5 | Upload done; S3 not exercised |
| 5 | AI processing | 1 | |
| 6 | Dashboard | 1 | |
| 7 | Doctor access system | 1 | |
| 8 | System integration, alpha | 1 | End-to-end suites pass |
| 9 | Performance optimisation | 1 | OCR accuracy improved and measured; latency measured |
| 10 | Testing and validation | 1 | 196 assertions across four suites plus a 1,090-value benchmark; user testing was on synthetic data only |
| 11 | Security implementation | 1 | |
| 12 | Documentation: SRS, Black Book, user manual, screenshots | 0.75 | SRS, manual, evaluation, screenshots done. A Semester VII report existed but described a different system (appointments, disease prediction, MongoDB); replacement chapters, a verified literature survey and corrected figures are written (`docs/SEM7-REPORT.md`). **Still to do: paste them into the university document, retake two screenshots, confirm two references** |
| 13 | Final enhancement and demo preparation | 1 | |
| 14 | Final deployment (AWS or Render) | 0.25 | Container files written, never built or hosted |
| 15 | Final submission and viva | 0 | Still ahead |
| | **Subtotal** | **12.5 / 15** | |

**Proposal total: 18 / 21 = 85.7%.**

---

## B. Complete Plan scorecard

### Core module features (25)
**Done (16):** profile; upload of PDF and images (limit is 25 MB by default, the plan says 50 MB); tag, search and filter; OCR extraction; plain-English summary; abnormal flags; trend lines; confidence per value; time-limited share token; read-only clinician dashboard; access log with revocation; emergency QR; reminders; recent-report cards; risk indicator cards (blood-pressure part excluded); PDF export.
**Partial (5, half credit):** OTP login (delivery is a stub); auto-categorise (patient sets the type); clinician registration (registration number stored, not verified); ABHA linking (identifier only); bulk upload (a queue of up to ten files is built and browser-tested; ZIP upload is not).
**Not done (4):** Google sign-in, authenticator-app 2FA, version history, health score (deliberately omitted).

Score: 16 + 5 × 0.5 = **18.5 / 25**.

### Phase deliverables (32)
| Phase | Score | Gaps |
|---|---|---|
| 1 Foundation (6) | 4.25 | S3 not live (0.5), CI only, no CD (0.5), containers unbuilt (0.25) |
| 2 AI engine (6) | 4.0 | No Google Vision fallback; the spaCy and medspaCy engine now runs and passes the 30 tests on Python 3.12, but the default install on Python 3.13 uses the rule-based engine (0.75); no separate "borderline" severity (0.75); extracted data in PostgreSQL, not MongoDB (0.5) |
| 3 Doctor access (6) | 5.75 | Registration number not verified (0.75) |
| 4 Dashboard and polish (7) | 3.0 | No health score, Flutter app or offline PWA; risk cards without blood pressure (0.75); ABHA field only (0.25) |
| 5 Launch (7) | 0 | Production hosting, CDN and firewall, load test, beta users, feedback loop, billing, clinic pilots |
| **Total** | **17.0 / 32** | |

**Plan total: (18.5 + 17.0) / 57 = 62.3%.**

---

## C. What changed today

| Change | Effect |
|---|---|
| Fresh-install verification in a clean environment: all suites green | Replaces a log from 23 September with a current result |
| Accuracy and latency benchmark (1,090 synthetic values) | Closes the proposal's "accuracy evaluation" and "performance" items with numbers |
| Six extractor faults found by the benchmark and fixed | Scan accuracy 87.6% to 97.3%; a path that reported an LDL value as total cholesterol is closed |
| Watch indicators and emergency card (backend, UI, 29 assertions) | Two Complete Plan features |
| OCR notice and per-value "check this value" cue in the UI | Safety response to the measured scan limits |
| SRS, user manual, deployment guide, evaluation report, corrected proposal text | Closes most of the documentation item |
| Container files for all three services plus a whole-stack compose file | Deployment scaffolding (unbuilt) |
| Provenance metadata stripped from 7 committed screenshots; local tool folders kept out of git | Keeps the repository clean of tool traces |
| Multi-file upload queue (up to ten files, per-file status, failed files can be retried) | Half of the plan's bulk-upload item; browser-tested |
| spaCy 3.8 and medspaCy installed and tested on Python 3.12; `requirements.txt` fixed (the old exact pin could not be installed on 3.12) | The spaCy engine is now verified, not assumed |
| Semester VII report audited against the repository: the abstract, Chapters 1, 3 and 5 and Appendix A described a different system | Replacement text, a literature survey of 12 verified sources and six corrected figures written |
| Fail-safe ablation with document-level bootstrap intervals (`ai-service/scripts/ablation.py`, `docs/ABLATION.md`) | Phone-photo silent wrong values 34 without the gates, 15 with them; clear scans 4 against 0. Evidence for the research paper |
| Draft research paper (`docs/paper/`), evaluation Q&A sheet (`docs/QA-SHEET.md`), October progress deck, refreshed screenshots (`docs/screenshots/2026-10-08/`) | Preparation for the 31 October monthly evaluation and the proposed publication credit. Paper is a short draft; author list and venue are still open |

## D. Verified results

| Check | Result |
|---|---|
| AI service tests | 30 / 30 (rule-based engine on Python 3.13, and spaCy + medspaCy engine on Python 3.12) |
| Core smoke suite | 42 / 42 |
| Consent and sharing smoke suite | 95 / 95 |
| Feature smoke suite (indicators, emergency card) | 29 / 29 |
| Backend typecheck, frontend build | clean |
| Frontend lint | 0 errors, 19 pre-existing warnings |
| Benchmark, digital PDF | 100% recall, 100% value accuracy, 0 silent-wrong values |
| Benchmark, scan with light degradation | 99.1% recall, 97.3% value accuracy, 0 silent-wrong values |
| Benchmark, phone-photo quality | 75.0% recall, 58.7% value accuracy, **7.2% silent-wrong values** |

## E. Remaining work, in order

### Needed for the submission
1. **Assemble the final report.** `docs/SEM7-REPORT.md` (and the Word copy) replaces the abstract, Chapters 1 to 5, bibliography and Appendix A. Paste in the figures from `docs/figures/`, fix the front matter and contents page as listed in `docs/REPORT-CORRECTIONS.md`, and add the screenshots. *About half a day, then proof-reading.*
2. **Check the literature survey** (`docs/LITERATURE-SURVEY.md`): read every abstract, confirm the author list of reference [7] and the abstract of [11]. The proposal promises at least 10 papers; the survey has 12 sources, of which 9 are papers or conference papers. *A few hours.*
3. **Fix the proposal text** (two blocks describe a different project): `docs/PROPOSAL-OBJECTIVES-CORRECTION.md`. *30 minutes.*
4. **Deploy once.** Build the containers, run them on one VM or Render, work through the checklist in `docs/DEPLOYMENT.md`, and fix whatever the first build exposes. *Half a day. This is the largest unknown: the Dockerfiles have never been built.*
5. **Run `RUN-SETUP.bat` on your own machine** and keep the log; refresh the screenshots for the two new panels.
6. **Update the final presentation** with the evaluation numbers and the safety findings.
7. **Rehearse the demo** using `docs/DEMO-SCRIPT.md`; add the indicators panel and emergency card to it.

### Worth doing if time allows
8. Exercise the S3 driver against a real bucket, or state plainly that it was not.
9. ~~Install spaCy and medspaCy under Python 3.12 and run the NER tests.~~ Done: 30 of 30 pass. Use Python 3.10 to 3.12 on the demonstration machine if you want the spaCy engine.
10. ~~A multi-file upload queue.~~ Done.
11. A ZIP upload, and a cross-check of scanned values against the status printed on the report.

### Backlog, not for the submission
Version history; password reset and OTP delivery by email or SMS; Google sign-in and authenticator-app 2FA; clinician registration-number verification; Google Vision fallback; PWA with offline viewing; ABDM sandbox integration; native mobile app; billing; clinic pilots; load testing; penetration test; monitoring and alerting.

## F. Risks to raise before an evaluator does

- **Scans are not reliable at phone-photo quality.** The benchmark shows it, the UI warns about it, and the claim to make is "digital PDFs and clear scans".
- **The benchmark is synthetic and written by the team.** It supports "reliable on the layouts tested", not "accurate on any laboratory's report".
- **The spaCy and medspaCy named in the proposal run only on Python 3.10 to 3.12.** They work there (tested on 3.12). On Python 3.13 they do not install and the rule-based engine takes over, so check which Python the demonstration machine has.
- **Doctor verification is not real verification.** The registration number is collected and displayed, not checked.
- **Nothing is deployed.**
- **The Semester VII report as submitted contradicts the product.** It describes appointments and disease prediction. If it was already handed in, be ready to explain that the design changed and that the replacement report is the accurate one.
