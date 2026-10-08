
# OneHealth AI: Q&A sheet for the October evaluation

Project C77. Answers are short on purpose. Every claim here is in the repository; the file is named so you can open it if asked. Say "I don't know, I'd check the code" rather than guess.

**How the marks work (10 per student):** progress against milestones 3, individual contribution and technical understanding 2, implementation and results 2, presentation and documentation 1, answering questions 2.

## 1. The project

**What does it do, in one sentence?**
A patient uploads a medical report; the system reads it, extracts the lab values, flags those outside the reference range, explains them in plain language with a disclaimer, and lets the patient share records with a clinician only through revocable consent.

**Why is it needed?**
In a study of 95 adults who got results through a portal, nearly two thirds received no explanation and 46% searched online (Giardina et al., JAMIA 2018). A portal alone does not help people interpret results.

**Is it a diagnostic tool?**
No. It is decision support. Every explanation carries a disclaimer, and the assistant refuses requests to diagnose, prescribe or predict, before composing any answer.

## 2. Accuracy and AI

**How do you know the extracted values are correct?**
Extraction is deterministic: names are matched by alias, numbers parsed, units normalised. Each value keeps the source line it came from. We measured it on 1,090 synthetic values: digital PDFs 100%, clear scans 97.3% value accuracy, phone-quality photos 58.7% (docs/EVALUATION.md).

**What stops the AI from inventing a value?**
It never produces values. A model, if configured, may only reword findings already extracted, and its answer is discarded if it adds a number the deterministic draft did not contain. In the results shown, no OpenAI key was configured, so the deterministic explainer wrote the text.

**What is a "silent wrong value"?**
A wrong number shown with a confident HIGH, LOW or NORMAL. It is the harmful error, so we count it separately. It is 0 on digital PDFs and clear scans and 7.2% on phone photos. Implausible misreads (glucose read as 7 mg/dL) are shown as not compared instead.

**Your benchmark is your own. Why trust it?**
You shouldn't treat it as proof for any laboratory. It is synthetic and written by the team, so it supports "reliable on the layouts tested". We say that on the results slide. Real reports would need patient consent and ethics approval, so we did not use any.

**Why not just use an LLM to read the report?**
A model can produce a plausible but wrong number with no sign that it is wrong. A preprint evaluating a language-model note-generation workflow still found 1.47% of note sentences hallucinated (reference [7] in the survey; read it before citing). For lab values, the number must come from the document.

**What do spaCy and medspaCy do here?**
They decide whether a clinical mention is asserted or negated ("no evidence of anaemia"). If they are not installed, a rule-based engine with the same output takes over. Both pass the 30 AI tests. spaCy needs Python 3.10 to 3.12.

**Why is OCR slow and weaker on photos?**
Tesseract takes about 3.6 s per page here, and heavy degradation (blur, skew, noise) breaks digits. The interface warns on scans and shows doubtful values as "check this value".

## 3. Security and consent

**Could a doctor just open a patient's URL?**
No. Authorisation is server-side and re-checked on every request against a live consent. The consent test suite calls the API directly to prove refusal while pending, after rejection, after revocation and after expiry.

**How is data protected?**
Email and phone are AES-256-GCM encrypted with a separate hash for lookup. Passwords use bcrypt at cost 12. JWT with rotating refresh tokens, rate limiting, and no unauthenticated URL to any uploaded document.

**What does the QR code contain?**
A random token only. No name, identifier or medical data. It expires in minutes, works once, and can be cancelled.

**Is it ABDM integrated?**
No. The ABHA identifier is stored as a profile field and the interface says so. A real integration needs sandbox credentials and a consent-manager flow.

**Is the clinician verified?**
No. The registration number is stored and displayed, not checked against a council register.

## 4. Deviations from the proposal

**Why PostgreSQL JSON instead of MongoDB?**
One transactional store for records and consent, and one fewer service to run.

**Why not S3?**
The S3 driver is implemented, but the demo uses local encrypted storage. It has not been tested on a real bucket, so we do not claim it.

**Why no health score?**
Any single score would be invented. Everything shown traces to an uploaded document.

**Is it deployed?**
No. Dockerfiles and a compose file are written but have not been built or hosted. That is planned for November.

## 5. Testing and process

**What testing did you do?**
196 automated checks: 42 core flow, 95 consent and sharing, 29 watch indicators and emergency card, and 30 AI service tests. Plus the 1,090-value benchmark. Testing used synthetic data only; there has been no study with real users.

**What failed and what did you change?**
The benchmark found six extractor faults, one of which reported an LDL value as total cholesterol. They were fixed; scan value accuracy rose from 87.6% to 97.3%.

**How far along are you against the proposal?**
18 of 21 objectives (85.7%), scored on a published checklist (docs/PROJECT-STATUS.md). The wider startup roadmap is at 62.3% because it includes billing, pilots and hosting.

## 6. Your own contribution

Answer these from what you actually did. Do not claim a module you cannot explain.

- **Which modules did you build?** Name them: for example the consent flow, the upload pipeline, the extraction logic.
- **Walk me through an upload.** Browser to API (validation, encrypted storage) to the AI service (text, extraction, ranges, explanation) back to the database, then the dashboard polling status. Trace it once in the code before the evaluation.
- **What was the hardest bug?** Have one real example ready, such as the scan misreads the benchmark exposed.
- **What would you do with more time?** Deploy and load-test, verify clinician identity, test with real reports under ethics approval, and map results to FHIR.

## 7. Questions that are hard

**What is wrong with your system?**
Phone-photo scans are unreliable (7.2% silent errors), the evidence is synthetic, nothing is hosted, and clinician verification and ABDM are not real.

**What is new here compared with existing work?**
We report silent wrong values, which F1-based studies hide, and we limit model error by design: the model never produces numbers. The survey found no single work that joins extraction from a patient's own reports, cited reference intervals, consent-based sharing and an assistant that cannot invent a value.

**Why should we believe the paper claims?**
We claim only what is measured and say how it was measured. The benchmark is reproducible: `python scripts/benchmark.py` with seed 20261008.
