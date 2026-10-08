# Semester VII report: what to fix in the submitted document

The submitted PDF (34 pages) describes parts of a different project. `docs/SEM7-REPORT.md` holds replacement text for the abstract and Chapters 1 to 5, the bibliography, Appendix A and the acknowledgements. This file lists everything else that has to change, so the document matches the system that was built.

Figures to paste are in `docs/figures/`. A Word version of the replacement text, with the figures in place, is `OneHealth-Sem7-Report-replacement.docx`.

## 1. Front matter

| Where | Problem | Fix |
|---|---|---|
| Certificate | Says "end of semester VII of LY B. Tech" | Keep (correct) |
| Certificate of approval of examiners | Says "semester VII of **TY** B. Tech" | Change to "LY B. Tech" |
| Every page footer | "Semester **VI** 2023-27 Batch" | Change to "Semester VII" |
| Declaration | Says "adequately cited and referenced" while the old Chapter 2 cited nothing | True once the new Chapter 2 and bibliography are in; also change "in my submission" to "in our submission" |
| Acknowledgements | "Prof. uday Joshi" (cover says "Dr. Uday Joshi") | Use "Dr. Uday Joshi" in both |
| Abstract heading, Chapter 2 and 4 "abstract" lines | Lowercase "abstract" | Capitalise, or delete the per-chapter abstracts |
| Contents page | Lists "3.3 Block Diagram", "3.5 Supervised Learning", "3.6 Text Classification / Disease Prediction", and section 1.5 promises six chapters | Replace with the contents below |

### New contents

- Abstract, List of Figures, List of Tables, Nomenclature
- **Chapter 1 Introduction:** 1.1 Background, 1.2 Motivation, 1.3 Scope, 1.4 Brief description, 1.5 Organisation
- **Chapter 2 Literature survey:** 2.1 Patients and their test results, 2.2 Extracting laboratory values, 2.3 Negation and context in clinical text, 2.4 Language models in healthcare, 2.5 Access control, consent and data sharing, 2.6 Interoperability and architecture, 2.7 Reference standards, 2.8 Comparison and research gap, 2.9 Objectives
- **Chapter 3 Project design:** 3.1 Introduction, 3.2 Problem statement, 3.3 System architecture, 3.4 Objectives, 3.5 Deterministic medical data processing, 3.6 Why the system does not predict disease, 3.7 Security, privacy and consent design
- **Chapter 4 Implementation and experimentation:** 4.1 Introduction, 4.2 Technology stack, 4.3 Implemented modules, 4.4 Execution flow and experimental setup, 4.5 Analysis of results, 4.6 Limitations and threats to validity, 4.7 Summary
- **Chapter 5 Conclusions and further work:** 5.1 Conclusions, 5.2 Scope for further work
- Bibliography, Appendix A, Author's publications, Acknowledgements

Section 1.5 in the new text lists five chapters, which matches.

## 2. Figures

| Figure in the submitted report | What is wrong | Action |
|---|---|---|
| Use-case diagram (p. 19) | Still carries "[cite: 273]", "[cite: 308]" and "[cite: 386]" markers. Shows subscriptions, medication management, alerts, Razorpay, SendGrid, Twilio, Google OAuth, MCI verification and CloudTrail, none of which exist | Replace with `fig-use-cases.png` |
| Figure 1, system architecture (p. 21) | Shows a Flutter mobile app, a Django admin panel, Razorpay subscriptions, Google OAuth, TOTP two-factor, an ML risk model, bulk upload, record versioning, MongoDB Atlas, AWS ECS, CloudFront and KMS | Replace with `fig-architecture.png` |
| Figure 2, collaboration diagram (p. 21) | Shows NotifService and a DoctorService that stores files; neither exists | Delete, or replace with `fig-upload-sequence.png` |
| ER diagram (p. 22) | Has Subscription, Admin and DoctorProfile tables, `verified_status` and an AISummary table that the schema does not have; no share-session or reminder tables | Replace with `fig-er-diagram.png` |
| Data flow diagram (p. 23) | Shows email, SMS and payment-gateway external services, MongoDB and an "AI models and configurations" store | Replace with `fig-dataflow.png` |
| Sequence diagram, upload and analysis (p. 24) | Broadly right, but shows S3 as the store and a returned file URL | Replace with `fig-upload-sequence.png` |
| Figure 3, deployment diagram (p. 28) | Shows an AWS VPC with ECS Fargate, RDS Multi-AZ, MongoDB Atlas, ElastiCache, KMS, CloudFront, WAF, Razorpay and Firebase. Nothing of this is deployed | Delete. If you want a deployment figure, draw the compose file: web (nginx), api, ai, postgres, redis, as described in `docs/DEPLOYMENT.md`, and label it "deployment files, not yet hosted" |
| AI pipeline diagram (p. 29) | Shows image enhancement, noise removal, skew correction, Google Vision OCR, medical NER as a separate stage, risk indicators and a "model feedback and continuous improvement" loop. Skew correction, Google Vision and feedback learning are not implemented | Replace with `fig-ai-pipeline.png` |

## 3. Statements to delete or change, by section

| Section | Statement in the submitted report | Reality |
|---|---|---|
| Abstract, 1, 1.3, 1.4, 3.1, 3.2, 3.4, 5.1, 5.2 | Appointment scheduling; machine-learning disease prediction (Logistic Regression, Naïve Bayes, Decision Trees); "predict potential diseases based on symptoms" | Not built, and deliberately refused (section 3.6 of the new text) |
| 3.6 | "Text Classification / Disease Prediction", with a five-step prediction process and "early detection of diseases" as an advantage | Delete. It also contradicts section 3.5 of the same report |
| 3.3 | "Structured databases such as MongoDB or MySQL can be used" | PostgreSQL |
| 4.2 | "MongoDB was used as the primary database"; "Docker was used for containerization, ensuring consistent deployment" | PostgreSQL. Container files exist but have not been built |
| 4.2, 4.3.2 | "Stored in cloud storage using presigned URLs" | Local encrypted disk by default. The S3 driver is implemented and not exercised |
| 4.3.1 | "OTP verification for enhanced security" | OTP delivery is a console stub and is not offered in the interface |
| 4.3.3 | "A rule-based system ... detect critical health parameters" | True (reference intervals and watch indicators). Keep, with the sources |
| 4.5 | "Satisfactory performance", "high accuracy", with no numbers | Replace with the measured results in the new 4.5 |
| Appendix A.1 to A.4 | Symptom input, "Predicted disease: Viral Infection", Appointment Booking and Disease Prediction screenshots, MongoDB and scikit-learn | Replace with the new Appendix A |
| Bibliography | Ten generic entries, none cited in the text. The WHO website, two textbooks, scikit-learn, Kaggle and the React, Node and MongoDB documentation. "M. Abdar et al., IEEE Access, 2020" could not be verified | Replace with the twelve references in the new bibliography |

## 4. Before you submit

1. Read the abstract of every reference in the new bibliography. Two need a check: reference [7] (confirm the author list on its medRxiv page) and reference [11] (only its title and citation details were available when the survey was prepared).
2. Retake screenshots of the dashboard (with the "Worth watching" panel), the upload queue, and the profile page with the emergency card. Do this on your own machine after `RUN-SETUP.bat`.
3. Reproduce the evaluation numbers yourself: `python scripts/benchmark.py` in `ai-service/`. The examiner may ask you to run it.
4. Be ready to say, unprompted, that the benchmark is synthetic and written by the team, and that photographs of poor quality are not reliable.
5. Check that every claim in Chapters 3 and 4 is something you can show in the demonstration. If a sentence describes something you cannot show, cut it.
