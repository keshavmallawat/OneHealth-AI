# OneHealth AI — User Manual

OneHealth AI keeps your medical reports in one place, reads the laboratory values out of them, shows which values fall outside the usual range, explains them in plain language, and lets you share them with a clinician on your terms.

**Important.** OneHealth AI is an information tool. It does not diagnose, prescribe or treat, and it cannot replace a clinician. If you feel unwell, contact a clinician or emergency services. The demonstration uses synthetic reports only.

---

## 1. Getting started

**Open the app** at the address your administrator gives you (locally: `http://localhost:5173`).

**Create an account.** Choose *Register*, enter your name, email and a password, and pick **Patient** (or **Clinician** if you are a doctor, in which case you also enter your speciality, clinic and registration number). Your email and phone number are stored encrypted. Your password cannot be recovered by anyone, including the administrator.

**Sign in.** Use your email and password. You stay signed in while you work; if your session expires the app renews it without losing what you were doing.

> Password reset by email is not available in this release.

**Demonstration accounts** (synthetic data):

| Role | Email | Password |
|---|---|---|
| Patient | `patient@onehealth.ai` | `Demo@12345` |
| Clinician | `doctor@onehealth.ai` | `Demo@12345` |

---

## 2. Your dashboard

The dashboard shows, from your own data only:

- **Totals:** reports, analysed reports, tests tracked and values outside range.
- **Needs your attention:** appears only when there is something real to show, such as a clinician's access request, values outside range, overdue reminders or a report that could not be analysed.
- **Latest findings:** the values outside range in your newest report.
- **Worth watching:** see section 6.
- **Recent records, reminders and activity.**

---

## 3. Upload a report

1. On the dashboard (or *Upload*), drop files or choose them. PDF, JPEG, PNG, WebP and TIFF are accepted. You can add up to 10 files at once; each appears in a waiting list where you can remove it before uploading, and each is uploaded and analysed in turn with its own result.
2. Choose the report type. Optionally add the laboratory name, report date and tags.
3. Select **Upload**. The report appears with a status that updates by itself: *Queued, Analysing, Analysed*.

A digital PDF is read directly from its text. A scan or photo is read by text recognition, which takes a few seconds.

**If a report fails to analyse,** open it and choose **Retry analysis**. Your upload is never lost by a failed analysis.

---

## 4. Read your results

Open a report to see:

- **Laboratory results**, grouped by panel. Each row shows your value, the unit, the reference interval used (and the basis, for example "adult female"), a position marker, a status of **High, Low, Normal** or **Not compared**, and a confidence percentage.
- **Plain-language summary**, with a medical disclaimer and a label that says whether it was written by the built-in explainer or reworded by a language model.
- **Source document and processing:** file details, whether the text came from the PDF text layer or from text recognition, and when it was analysed.
- **View original:** the original document, served only to you.

### If your report was a scan or a photo
A notice appears above the results: *Read from a scanned image*. Text recognition can misread digits, especially in photos, so **compare each value with your original report before relying on it.** Values the system is not sure about are shown as **Not compared** rather than guessed, with the note that the number may have been misread.

### Edit and organise
Use **Edit details** to correct the report date, laboratory, notes, tags or type. The system guesses; you correct. Use **Delete** to remove a report from your view. The record of who accessed it is kept.

### Find reports
*Reports* lets you search and filter by type, status, tag and date, and sort. The filter lives in the page address, so you can bookmark a filtered view.

---

## 5. Trends and comparison

*Trends* draws a chart for each test that appears in at least two analysed reports, with the reference interval shaded and a one-line observation: increased, decreased, stable, newly abnormal, or returned to range. A single reading is not shown as a trend, and the page says so.

*Compare* places two of your reports side by side, test by test, including tests that were added or not repeated.

---

## 6. Worth watching

The dashboard's **Worth watching** panel compares the newest value of each test with published guideline thresholds: blood sugar (ADA), haemoglobin (WHO), cholesterol and blood fats (NCEP ATP III), and out-of-range kidney, thyroid, liver and blood-count markers.

Each item is labelled either **Worth keeping an eye on** or **Worth discussing with a clinician**. It shows the exact values it used, with their dates and a link to the report, and the guideline behind it.

This is **not a diagnosis.** It does not give treatment, diet or medication advice. Blood pressure is not part of laboratory reports, so it is not assessed. If nothing is flagged, the panel says so, and covers only the tests printed on your reports.

---

## 7. Ask the assistant

*Assistant* answers questions about **your own** results ("Which of my values are high?", "How has my HbA1c changed?"). Every answer names the report it came from. Requests for a diagnosis, a prescription, treatment or a prognosis are politely refused.

---

## 8. Share with a clinician

You decide who sees what, for how long. Open *Sharing*.

### Access requests
A clinician asks using your **share code** (shown on your *Profile*; it is not your email, and you can issue a new one at any time). Their request appears under *Requests*, with their speciality, clinic and registration number. **Approve** it, choosing what they may see (records, trends, profile) and for how long (1 day to 30 days), or **Decline** it.

### Grant access directly
Search the clinician directory and grant access without waiting for a request.

### Share by QR code
Create a code valid for 5, 15 or 60 minutes. The clinician scans it while signed in; it works once, then stops. It creates an ordinary consent that you can revoke. You can cancel an unused code at any time.

### Revoke
Under *Access*, **Revoke** ends a clinician's access on their next request. Access also ends by itself at the expiry you chose.

### Who looked?
*Activity* lists every access, including by clinicians ("Dr Menon opened your report"), with the time.

---

## 9. Emergency card

On *Profile*, **Emergency card** makes a QR code that any phone camera can read with no sign-in and no internet.

1. Tick what you want on it: name, blood group, allergies, ongoing conditions, emergency contact. Only details you have entered in your profile can appear. Save your profile first so the card uses your latest details.
2. Select **Create card**, then download the image and print it.

**Anyone holding the printed code can read what is on it.** Include only what you are comfortable with and keep the printout somewhere you control. The card states that the details are entered by you and are not verified by a clinician. Creating a card is recorded in your activity.

---

## 10. Export a summary

On the dashboard, **Export health summary** downloads a PDF built only from your stored values. Anything you have not entered prints as "Not provided", and the disclaimer is on the first page.

---

## 11. Reminders

*Reminders* holds follow-ups, medication and vaccination reminders. They appear in the app only. The platform does not send email or text messages in this release.

---

## 12. Your profile

Keep your date of birth, sex, blood group, allergies, conditions and emergency contact up to date. **Nothing is filled in for you.** A missing value stays blank, and the reference intervals applied to your results improve when sex is known.

---

## 13. For clinicians

After you register as a clinician:

1. **Connect:** enter a patient's share code, or scan their QR code, and state a purpose. The patient decides.
2. **Patients:** lists only patients who currently allow you access. The list empties for a patient the moment they revoke.
3. Open a patient to see the records, trends and profile fields they have shared, **read-only**. You cannot edit or delete anything. Each view is recorded in the patient's activity.

---

## 14. Privacy and security at a glance

- Passwords are stored as bcrypt hashes. Email and phone number are encrypted at rest.
- Documents have no public web address. Each request re-checks that you own the document or hold a live consent.
- Every read of your records is written to your activity.
- Deleted reports vanish from view without revealing that they existed.

---

## 15. Troubleshooting

| Problem | What to do |
|---|---|
| Report stays on *Analysing* | The analysis service may be down. Ask the administrator to start it, then use **Retry analysis**. |
| An image upload fails but PDFs work | The text-recognition engine is not installed on the server. Digital PDFs still work. |
| A value looks wrong on a scan | Compare it with your original; scans can be misread. Re-upload a clearer copy or a digital PDF. |
| A test is missing | The system recognises 14 tests: haemoglobin, red and white cell counts, platelets, fasting glucose, HbA1c, creatinine, TSH, total cholesterol, LDL, HDL, triglycerides, ALT and AST. |
| "Too many attempts" | Sign-up and sign-in are rate limited; wait a minute and try again. |
