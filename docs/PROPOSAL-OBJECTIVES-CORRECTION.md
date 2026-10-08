# Project proposal C77: text to replace

The submitted proposal PDF has two blocks that do not describe this project. They read as a palm-vein payment system (palm scan, SHA-256 palm hash, simulated wallet, merchant dashboard, False Acceptance and False Rejection rates). They look like leftover text from a different project's template. An evaluator cannot score OneHealth AI against them, and they will be noticed.

Replace them with the text below. Every claim is backed by something in the repository; the pointer is in brackets so you can show it.

---

## Block 1: "The objectives which will be achieved before intermediate examination / up to the month of December / January / at the end of the first term"

- **Finalisation of project scope:** the functional boundaries of the MVP (upload, AI analysis, results dashboard, consent-based sharing) and its technical constraints for the Indian market (Indian lab formats, lakh-notation counts, `/cumm` units, ABHA identifier). [`docs/SRS.md` sections 1 to 2]
- **Completion of literature survey:** twelve sources surveyed (patient understanding of results, laboratory-report extraction, negation in clinical text, LLM hallucination, access control and consent, interoperability), with a comparison matrix and a stated research gap. [`docs/LITERATURE-SURVEY.md`] *Before the viva: read the abstracts of references [7] and [11], which are marked to confirm, and be able to discuss each paper.*
- **System architecture design:** a three-tier architecture (React frontend, Node.js/Express API, Python/FastAPI AI service), the PostgreSQL schema (users, health records, consent tokens, share sessions, access logs, reminders), and UML diagrams (use case, sequence, data flow, ER, consent state). [`docs/SRS.md` sections 2, 5, 6]
- **Authentication and core backend:** JWT login with rotating refresh tokens, role-based access control, encrypted personal data, rate limiting. [`backend/src/`; consent smoke suite]
- **Report analysis pipeline:** PDF text extraction, Tesseract OCR for scans, deterministic extraction of 14 laboratory parameters with unit normalisation, comparison with cited reference intervals, abnormal flags, and a plain-language summary with a medical disclaimer. [`ai-service/app/`; 30 AI tests, run with both the rule-based and the spaCy + medspaCy clinical NER engine]
- **Dashboard and sharing prototype:** patient dashboard with report history, trends and comparison; clinician registration; consent-based read-only access with an access log. [`frontend/src/pages/`; 95 consent assertions]
- **Intermediate documentation:** Term 1 progress report. *(already submitted)*

## Block 2: "The objectives which will be achieved before final defense / up to the month of April / May / at the end of the second term"

- **Fully functional ecosystem:** an end-to-end platform in which a patient uploads a report, sees extracted values, abnormal flags and a summary, and shares selected records with a clinician under revocable, time-limited consent. [`docs/DEMO-SCRIPT.md`; 42 core assertions]
- **Privacy-first security:** passwords hashed with bcrypt, email and phone encrypted with AES-256-GCM, no public document URLs, ownership and consent re-checked on every request, every access recorded with actor and subject. [`README.md` Security model]
- **Decision support, not diagnosis:** extraction is deterministic and never generated; every explanation and every watch indicator carries a disclaimer; the assistant refuses diagnosis, prescription and treatment requests before composing any answer. [`docs/SRS.md` section 2.4]
- **Measured performance and accuracy:** on 1,090 synthetic values, digital PDFs reach 100% recall and value accuracy at about 20 ms per document; scanned reports reach 99.1% recall and 97.3% value accuracy at about 3.6 s per page; the failure rate on heavily degraded photos is reported rather than hidden. [`docs/EVALUATION.md`]
- **Usable interface:** responsive React dashboard (checked down to 390 px) with results, trends, comparison, watch indicators, emergency card, reminders and PDF export. [`docs/USER-MANUAL.md`]
- **Deployment and documentation:** containerised deployment files and guide, SRS, user manual, evaluation report, final project report (Black Book) and final presentation. [`docs/DEPLOYMENT.md`]
  *Honest status: deployment files are written, hosting is not done. The Black Book has a draft that describes a different system; replacement chapters, figures and a corrections list matching this build are in `docs/SEM7-REPORT.md`, `docs/figures/` and `docs/REPORT-CORRECTIONS.md`, and still have to be assembled into the university template.*

---

## Two other things worth fixing before the viva

1. **The timeline table lists MongoDB** in the development environment and "metadata storage in database". The system stores extracted data in PostgreSQL JSON columns by design. Be ready to say why: it removes an operational dependency and keeps one transactional store for consent and records.
2. **The proposal says AWS S3.** The S3 driver is implemented but the demonstration runs on local encrypted storage. Say that, rather than implying S3 was used.
