# OneHealth AI — Literature survey

This replaces Chapter 2 of the Semester VII report. The earlier chapter named no papers, and nothing in its text cited the bibliography.

**Verification status.** Every entry below was checked against its publisher, indexer or archive page on 8 October 2026 (title, authors, venue, year, pages). The summaries state only what those pages and abstracts report. Two entries need a follow-up before you cite them in the viva, and are marked **[confirm]**. Read each paper's abstract yourself before the viva; a survey you cannot discuss is worse than a short one.

---

## 2.1 Patients and their test results

Giardina et al. [1] interviewed 95 adults who had received test results through an online portal. Nearly two thirds received no explanatory information with their result, and 46% searched online for more. People with abnormal results were more likely than those with normal results to report negative emotions (56% against 21%) and to call their physician (44% against 15%). The authors conclude that a portal alone does not help patients interpret and act on results.

*Relevance.* This is the problem OneHealth AI addresses: results exist, but patients are left to interpret them alone. It also sets the safety requirement. A tool that explains abnormal results reaches people who are already anxious, so the explanation must be accurate, must not diagnose, and must say when it is unsure.

## 2.2 Extracting laboratory values from reports

Ma et al. [2] built a pipeline with an OCR module and an information-extraction module that turns scanned paper laboratory reports into a table of test name, result, unit and reference range. On 153 reports from Peking University First Hospital the OCR module averaged 0.93 accuracy (0.95 at character level), and the extraction module reached an F1 score of 0.86 (precision 0.90, recall 0.83). A conditional-random-field method outperformed a rule-based baseline, and reference-range extraction scored lower than the other entity types. The main error sources were poor scan quality, misplaced lines and multi-column layouts. Average inference time was 0.78 s per report on one CPU.

Smith [3] describes the Tesseract engine, the OCR component OneHealth AI uses, covering its line finding, feature classification and adaptive classifier.

*Relevance and difference.* Ma et al. report extraction quality as precision, recall and F1. OneHealth AI additionally counts **silent wrong values** (a wrong number shown with a confident HIGH, LOW or NORMAL status), because for a patient-facing tool that is the harmful error and F1 hides it. Its own benchmark (`docs/EVALUATION.md`) reports it separately. OneHealth AI also reads digital PDFs from their text layer, which avoids OCR error entirely for the common case. Its extraction is rule-based, so the CRF result in [2] is a reasonable direction for future work, not something this project claims to match.

## 2.3 Negation and context in clinical text

A mention of "hypertension" in a note does not mean the patient has it. Chapman, Chu and Dowling [4] present ConText, a regular-expression algorithm that extends NegEx to assign negation, temporality (historical or hypothetical) and experiencer (someone other than the patient) to clinical conditions in emergency department reports. It performed very well on negation, fairly well on hypothetical and historical status, and moderately well on identifying other experiencers. Eyre et al. [5] released medspaCy, an open-source Python library built on spaCy that combines rule-based and machine-learning methods for clinical text and includes context analysis of the kind in [4].

*Relevance.* OneHealth AI's clinical NER uses spaCy with medspaCy's context component, and a rule-based engine of the same output shape when those libraries are absent. It cross-checks the two detectors and lets either one suppress a mention, because wrongly suppressing a finding costs a line in a list while wrongly asserting a denied diagnosis records something false. Verified: the spaCy engine runs on Python 3.12 (30 of 30 tests pass); on Python 3.13 spaCy has no wheels and the rule-based engine takes over.

## 2.4 Language models in healthcare, and their errors

Thirunavukarasu et al. [6] review how large language models are built, their early clinical and biomedical uses, and their benefits and drawbacks for healthcare. A medRxiv preprint [7] evaluated 18 configurations of a language-model note-generation workflow on clinician-annotated output (450 notes). It found that 1.47% of note sentences contained hallucinations, 44% of those classed as major, and that 3.45% of transcript sentences were omitted, 16.7% of them major. Iterating on prompts and workflow reduced the errors substantially. **[confirm]** the preprint's author list from its medRxiv page before citing; the figures above come from the paper's text.

*Relevance.* Even a carefully engineered workflow produced some hallucinated sentences, so OneHealth AI never lets a model read or produce the numbers. Values are extracted deterministically, and a model may only reword findings already extracted. The assistant discards a reworded answer if it introduces a number the deterministic draft did not contain, and refuses requests for diagnosis, prescription or prognosis before composing any answer.

## 2.5 Access control, consent and data sharing

Sandhu et al. [8] define the role-based access control models widely used to separate what, for example, a patient, a clinician and an administrator may do. Azaria et al. [9] propose MedRec, a decentralised blockchain system for managing access to electronic medical records, giving patients a tamper-resistant history and control over sharing across providers. India's Ayushman Bharat Digital Mission keeps health data with the provider that holds it and lets a user of that data obtain it only with the patient's consent through a consent manager that is "data-blind by design" [10].

*Relevance and difference.* OneHealth AI combines role-based checks with a patient-controlled consent lifecycle (pending, approved, rejected, revoked, expired), time-limited grants with a scope, and single-use QR sessions, and it records who accessed whose data. It does not use a blockchain; an ordinary transactional database with a server-side check on every request meets the project's requirements with one fewer moving part. It is also not an ABDM participant: only the ABHA identifier is stored, and no registry or consent-manager calls are made.

## 2.6 Interoperability and architecture

Mandel et al. [11] describe SMART on FHIR, a standards-based platform for building apps that run across electronic health record systems. **[confirm]** by reading the abstract: only the title and citation were available when this survey was prepared.

*Relevance.* OneHealth AI uses its own JSON model, not FHIR resources, so records cannot yet be exchanged with a hospital system. Mapping extracted values to FHIR Observation resources is the natural next step and is listed under further work.

## 2.7 Reference standards used in the project

Reference intervals and guideline thresholds are fixed constants with a named source, not model output: the World Health Organization's haemoglobin thresholds for anaemia [12], the American Diabetes Association criteria for fasting glucose and HbA1c, and the NCEP ATP III classification for lipids. The source for each value is stored beside it in `ai-service/app/data/reference_ranges.py`, so any HIGH or LOW can be traced.

## 2.8 Comparison and research gap

| Work | Reads values from reports | Handles negation / context | Patient-controlled sharing | Explains results to patients | Limits model errors by design | Measures silent wrong values |
|---|---|---|---|---|---|---|
| Giardina et al. [1] | — (study of portals) | — | — | Shows the need | — | — |
| Ma et al. [2] | Yes (scans) | — | — | — | — | No (reports F1) |
| ConText / medspaCy [4][5] | — (clinical text) | Yes | — | — | — | — |
| MedRec [9] | — | — | Yes | — | — | — |
| SMART on FHIR [11] | — | — | Via authorisation | — | — | — |
| LLM note generation [6][7] | — | — | — | Generates text | Measures hallucination | — |
| **OneHealth AI** | Yes (PDF text layer and OCR) | Yes (spaCy + medspaCy, with fallback) | Yes (consent lifecycle, QR) | Yes (deterministic, optional rewording) | Yes (model never produces numbers) | **Yes** (`docs/EVALUATION.md`) |

A dash means the work does not address that dimension as far as its abstract and summary indicate, not that it is deficient. The cells for OneHealth AI are what the repository demonstrates.

**Gap.** The works above each address one piece: extraction, negation, access control, or the risks of generated text. We found none in this survey that joins extraction from a patient's own reports, deterministic comparison with cited reference intervals, a patient-controlled consent flow and an assistant that cannot invent a value, and then measures how often the extraction is wrong without showing it. That is the contribution of OneHealth AI. The claim is limited by what was surveyed: ten sources, not the whole literature.

## 2.9 Objectives of the proposed system

1. Store a patient's medical reports centrally and securely.
2. Extract laboratory values from digital and scanned reports deterministically, compare them with cited reference intervals, flag values outside range and explain them in plain language with a disclaimer.
3. Give the patient a dashboard of results, trends, comparison and watch indicators.
4. Let the patient share records with a clinician only through explicit, time-limited, revocable consent, with every access recorded.
5. Protect personal data with hashing, encryption at rest, token authentication and role-based authorisation.
6. Answer questions only from the patient's own results, and refuse to diagnose.
7. Measure extraction accuracy and report its failures.

---

## References

[1] T. D. Giardina, J. Baldwin, D. T. Nystrom, D. F. Sittig and H. Singh, "Patient perceptions of receiving test results via online portals: a mixed-methods study," *Journal of the American Medical Informatics Association*, vol. 25, no. 4, pp. 440–446, 2018. doi:10.1093/jamia/ocx140

[2] M.-W. Ma, X.-S. Gao, Z.-Y. Zhang et al., "Extracting laboratory test information from paper-based reports," *BMC Medical Informatics and Decision Making*, vol. 23, article 251, 2023. doi:10.1186/s12911-023-02346-6

[3] R. Smith, "An Overview of the Tesseract OCR Engine," in *Proc. Ninth International Conference on Document Analysis and Recognition (ICDAR)*, IEEE Computer Society, 2007, pp. 629–633.

[4] W. W. Chapman, D. Chu and J. N. Dowling, "ConText: An Algorithm for Identifying Contextual Features from Clinical Text," in *Proc. BioNLP 2007 Workshop*, Prague, 2007, pp. 81–88.

[5] H. Eyre, A. B. Chapman, K. S. Peterson, J. Shi, P. R. Alba, M. M. Jones, T. L. Box, S. L. DuVall and O. V. Patterson, "Launching into clinical space with medspaCy: a new clinical text processing toolkit in Python," *AMIA Annual Symposium Proceedings*, 2022 (arXiv:2106.07799, 2021).

[6] A. J. Thirunavukarasu, D. S. J. Ting, K. Elangovan, L. Gutierrez, T. F. Tan and D. S. W. Ting, "Large language models in medicine," *Nature Medicine*, vol. 29, pp. 1930–1940, 2023. doi:10.1038/s41591-023-02448-8

[7] "A Framework to Assess Clinical Safety and Hallucination Rates of LLMs for Medical Text Summarisation," medRxiv preprint, 2024. doi:10.1101/2024.09.12.24313556 **[confirm authors]**

[8] R. S. Sandhu, E. J. Coyne, H. L. Feinstein and C. E. Youman, "Role-Based Access Control Models," *IEEE Computer*, vol. 29, no. 2, pp. 38–47, 1996.

[9] A. Azaria, A. Ekblaw, T. Vieira and A. Lippman, "MedRec: Using Blockchain for Medical Data Access and Permission Management," in *Proc. International Conference on Open and Big Data (OBD)*, IEEE, 2016, pp. 25–30.

[10] Manan, "The ABDM's Decentralized and Patient-Centric Consent Management Architecture," Software Freedom Law Center, India (SFLC.in), 18 January 2024. https://sflc.in/?p=8723

[11] J. C. Mandel, D. A. Kreda, K. D. Mandl, I. S. Kohane and R. B. Ramoni, "SMART on FHIR: a standards-based, interoperable apps platform for electronic health records," *Journal of the American Medical Informatics Association*, vol. 23, no. 5, pp. 899–908, 2016.

[12] World Health Organization, "Haemoglobin concentrations for the diagnosis of anaemia and assessment of severity," WHO/NMH/NHD/MNM/11.1, 2011. https://www.who.int/publications/i/item/WHO-nMH-NHD-MNM-11.1
