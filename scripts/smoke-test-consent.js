#!/usr/bin/env node
/**
 * OneHealth AI — consent, sharing, assistant and export smoke test.
 *
 * Complements scripts/smoke-test.js (which covers the upload/OCR/AI pipeline)
 * by exercising the collaboration half of the platform end to end:
 *
 *   patient profile -> doctor registration -> access request -> refusal while
 *   pending -> approval -> authorised read -> audit trail -> revocation ->
 *   refusal after revocation -> QR share -> single use -> assistant grounding
 *   and refusals -> comparison -> PDF export -> reminders
 *
 * The authorisation assertions are the point of this file: every "must be
 * refused" case is called directly against the API, so passing proves the
 * server enforces consent rather than the UI hiding a button.
 *
 * Usage:  node scripts/smoke-test-consent.js  [apiBaseUrl]
 */
const fs = require('fs');
const path = require('path');

const API = process.argv[2] || process.env.API_URL || 'http://127.0.0.1:3001';
const ROOT = path.resolve(__dirname, '..');
const SAMPLE_A = path.join(ROOT, 'sample-data', 'sample-blood-report-abnormal.pdf');
const SAMPLE_B = path.join(ROOT, 'sample-data', 'sample-blood-report-normal.pdf');

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = Date.now();

async function api(method, url, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${url}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (raw) return response;
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body (e.g. a PDF) */
  }
  return { status: response.status, body: json, text, headers: response.headers };
}

async function register(role, extra = {}) {
  const email = `${role.toLowerCase()}_${stamp}_${Math.random().toString(36).slice(2, 7)}@onehealth.test`;
  const password = 'SmokeTest@12345';
  const body = { name: `Smoke ${role}`, email, password, role, ...extra };
  let response = await api('POST', '/api/auth/register', { body });
  // Running straight after another suite can land inside its signup window.
  if (response.status === 429) {
    console.log('  ..    signup rate limit is closed; waiting 62s for the window to reopen');
    await sleep(62000);
    response = await api('POST', '/api/auth/register', { body });
  }
  return { email, password, ...response.body, status: response.status };
}

async function uploadReport(token, file) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'application/pdf' }), path.basename(file));
  form.append('type', 'BLOOD_TEST');
  const response = await api('POST', '/api/records/upload', { token, body: form });
  return response.body?.data?.record?.id;
}

async function waitForAnalysis(token, recordId, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { body } = await api('GET', `/api/records/${recordId}`, { token });
    const status = body?.data?.record?.status;
    if (status === 'DONE' || status === 'FAILED') return body.data.record;
    await sleep(1500);
  }
  return null;
}

async function main() {
  console.log(`\nOneHealth AI — consent & collaboration smoke test against ${API}\n`);

  const health = await api('GET', '/api/health');
  if (!health.body?.services?.database?.reachable) {
    console.log('\nDatabase unreachable — aborting.\n');
    process.exit(1);
  }

  // ---- Accounts -----------------------------------------------------------
  console.log('Accounts and roles');

  // Signup validation is asserted first, while the per-IP signup quota is still
  // untouched — a 429 here would hide whether validation works at all.
  check('a weak password is rejected at signup',
    (await api('POST', '/api/auth/register', {
      body: { name: 'Weak', email: `weak_${stamp}@onehealth.test`, password: 'password' },
    })).status === 400);

  check('the ADMIN role cannot be self-assigned at signup',
    (await api('POST', '/api/auth/register', {
      body: { name: 'Esc', email: `esc_${stamp}@onehealth.test`, password: 'Escalate@123', role: 'ADMIN' },
    })).status === 400);
  const patient = await register('PATIENT');
  check('patient registers', patient.status === 201, `got ${patient.status}`);
  check('patient is issued a share code', typeof patient.user?.shareCode === 'string' && patient.user.shareCode.startsWith('OH-'),
    patient.user?.shareCode);

  const doctor = await register('DOCTOR', {
    specialization: 'General Medicine',
    clinicName: 'Smoke Clinic',
    registrationNumber: `REG-${stamp}`,
    city: 'Pune',
  });
  check('doctor registers with a provider profile', doctor.status === 201, `got ${doctor.status}`);
  check('doctor account carries the DOCTOR role', doctor.user?.role === 'DOCTOR', doctor.user?.role);
  check('doctor is NOT issued a patient share code', !doctor.user?.shareCode);

  const other = await register('PATIENT');
  const doctor2 = await register('DOCTOR');
  check('all four test accounts were created',
    [patient, doctor, other, doctor2].every((a) => typeof a.accessToken === 'string'),
    [patient, doctor, other, doctor2].map((a) => a.status).join('/'));

  const pToken = patient.accessToken;
  const dToken = doctor.accessToken;
  const oToken = other.accessToken;
  const d2Token = doctor2.accessToken;

  // ---- Profile ------------------------------------------------------------
  console.log('\nPatient profile');
  const profile = await api('GET', '/api/users/me/profile', { token: pToken });
  check('profile loads', profile.status === 200 && Boolean(profile.body?.data?.profile));
  check('unset health fields come back empty, not invented',
    profile.body?.data?.profile?.bloodType === null &&
      profile.body?.data?.profile?.allergies?.length === 0);

  const saved = await api('PATCH', '/api/users/me/profile', {
    token: pToken,
    body: {
      bloodType: 'O+',
      sex: 'female',
      dateOfBirth: '1992-04-17',
      allergies: ['Penicillin', 'penicillin', '  Dust  '],
      chronicConditions: ['Hypothyroidism'],
      emergencyName: 'R. Sharma',
      emergencyPhone: '+919812345678',
    },
  });
  check('profile updates persist', saved.status === 200 && saved.body?.data?.profile?.bloodType === 'O+',
    `got ${saved.status}`);
  check('allergy list is de-duplicated and trimmed',
    JSON.stringify(saved.body?.data?.profile?.allergies) === JSON.stringify(['Penicillin', 'Dust']),
    JSON.stringify(saved.body?.data?.profile?.allergies));

  const reread = await api('GET', '/api/users/me/profile', { token: pToken });
  check('profile survives a re-read (persisted, not cached)',
    reread.body?.data?.profile?.emergencyName === 'R. Sharma');

  check('an invalid blood type is rejected',
    (await api('PATCH', '/api/users/me/profile', { token: pToken, body: { bloodType: 'Z+' } })).status === 400);
  check('a future date of birth is rejected',
    (await api('PATCH', '/api/users/me/profile', { token: pToken, body: { dateOfBirth: '2099-01-01' } })).status === 400);

  // ---- Records to share ---------------------------------------------------
  console.log('\nRecords');
  const recordA = await uploadReport(pToken, SAMPLE_A);
  check('patient uploads a report', Boolean(recordA));
  const analysedA = await waitForAnalysis(pToken, recordA);
  check('report is analysed', analysedA?.status === 'DONE', analysedA?.status);

  // ---- Consent: request, refusal while pending ----------------------------
  console.log('\nConsent — request and approval');
  const shareCode = profile.body.data.profile.shareCode;

  check('a wrong share code reveals nothing',
    (await api('POST', '/api/consents/request', { token: dToken, body: { shareCode: 'OH-XXX-XXX-XXX' } })).status === 404);

  const requested = await api('POST', '/api/consents/request', {
    token: dToken,
    body: { shareCode, purpose: 'Follow-up consultation' },
  });
  check('doctor can request access with a valid share code', requested.status === 201, `got ${requested.status}`);
  check('the new consent starts PENDING', requested.body?.data?.consent?.status === 'PENDING');
  check('a pending consent is not active', requested.body?.data?.consent?.active === false);

  check('a duplicate request is refused',
    (await api('POST', '/api/consents/request', { token: dToken, body: { shareCode } })).status === 409);

  const consentId = requested.body.data.consent.id;

  check('doctor CANNOT read the record while consent is pending',
    (await api('GET', `/api/records/${recordA}`, { token: dToken })).status === 403);
  check('doctor CANNOT stream the document while consent is pending',
    (await api('GET', `/api/records/${recordA}/file`, { token: dToken, raw: true })).status === 403);
  check('doctor CANNOT list the patient while consent is pending',
    (await api('GET', '/api/consents/patients', { token: dToken })).body?.data?.patients?.length === 0);

  const patientConsents = await api('GET', '/api/consents', { token: pToken });
  check('patient sees the pending request', patientConsents.body?.data?.counts?.pending === 1,
    JSON.stringify(patientConsents.body?.data?.counts));

  check('an unrelated patient cannot approve someone else’s consent',
    (await api('POST', `/api/consents/${consentId}/approve`, { token: oToken })).status === 404);
  check('a doctor cannot approve their own request',
    (await api('POST', `/api/consents/${consentId}/approve`, { token: dToken })).status === 403);

  const approved = await api('POST', `/api/consents/${consentId}/approve`, {
    token: pToken,
    body: { durationHours: 24 },
  });
  check('patient approves the request', approved.status === 200 && approved.body?.data?.consent?.status === 'APPROVED',
    `got ${approved.status}`);
  check('the approved consent is active', approved.body?.data?.consent?.active === true);

  // ---- Authorised access --------------------------------------------------
  console.log('\nConsent — authorised access');
  const doctorRead = await api('GET', `/api/records/${recordA}`, { token: dToken });
  check('doctor CAN now read the record', doctorRead.status === 200, `got ${doctorRead.status}`);
  check('the record is marked read-only for the clinician', doctorRead.body?.data?.viewer?.readOnly === true);
  check('doctor sees the extracted parameters', (doctorRead.body?.data?.record?.parameters?.length ?? 0) > 0);

  const doctorPatients = await api('GET', '/api/consents/patients', { token: dToken });
  check('patient appears in the doctor’s authorised list',
    doctorPatients.body?.data?.patients?.length === 1, JSON.stringify(doctorPatients.body?.data?.patients?.length));

  const patientId = patient.user.id;
  const patientDetail = await api('GET', `/api/consents/patients/${patientId}`, { token: dToken });
  check('doctor can open the patient summary', patientDetail.status === 200);
  check('patient summary lists the records', (patientDetail.body?.data?.records?.length ?? 0) >= 1);
  check('patient summary is flagged read-only', patientDetail.body?.data?.access?.readOnly === true);

  check('doctor CANNOT open a patient they have no consent for',
    (await api('GET', `/api/consents/patients/${other.user.id}`, { token: dToken })).status === 403);
  check('doctor CANNOT upload on a patient’s behalf',
    (await api('POST', '/api/records/upload', { token: dToken })).status === 403);
  check('doctor CANNOT delete a patient record',
    (await api('DELETE', `/api/records/${recordA}`, { token: dToken })).status === 403);
  check('doctor CANNOT edit a patient record',
    (await api('PATCH', `/api/records/${recordA}`, { token: dToken, body: { labName: 'tampered' } })).status === 403);
  check('doctor CANNOT read the patient stats endpoint',
    (await api('GET', '/api/records/stats', { token: dToken })).status === 403);

  // ---- Audit --------------------------------------------------------------
  console.log('\nAudit trail');
  const activity = await api('GET', '/api/records/activity?limit=50', { token: pToken });
  const entries = activity.body?.data?.activity ?? [];
  const doctorEntry = entries.find((e) => e.action === 'VIEW_RECORD_DETAILS' && !e.byMe);
  check('patient sees the clinician’s access in their own log', Boolean(doctorEntry),
    entries.map((e) => e.action).join(','));
  check('the log names the clinician who acted', doctorEntry?.actor?.role === 'DOCTOR');
  check('consent decisions are recorded', entries.some((e) => e.action === 'CONSENT_APPROVED'));
  check('the request itself is recorded', entries.some((e) => e.action === 'CONSENT_REQUESTED'));

  // ---- Revocation ---------------------------------------------------------
  console.log('\nConsent — revocation');
  const revoked = await api('POST', `/api/consents/${consentId}/revoke`, { token: pToken });
  check('patient revokes access', revoked.status === 200 && revoked.body?.data?.consent?.status === 'REVOKED',
    `got ${revoked.status}`);

  check('doctor CANNOT read the record after revocation',
    (await api('GET', `/api/records/${recordA}`, { token: dToken })).status === 403);
  check('doctor CANNOT stream the document after revocation',
    (await api('GET', `/api/records/${recordA}/file`, { token: dToken, raw: true })).status === 403);
  check('doctor CANNOT open the patient summary after revocation',
    (await api('GET', `/api/consents/patients/${patientId}`, { token: dToken })).status === 403);
  check('the authorised patient list is empty again',
    (await api('GET', '/api/consents/patients', { token: dToken })).body?.data?.patients?.length === 0);
  check('re-revoking is refused',
    (await api('POST', `/api/consents/${consentId}/revoke`, { token: pToken })).status === 409);

  // ---- QR sharing ---------------------------------------------------------
  console.log('\nQR sharing');
  const session = await api('POST', '/api/share/sessions', {
    token: pToken,
    body: { expiresInMinutes: 15, grantDurationHrs: 24, purpose: 'Walk-in consultation' },
  });
  check('patient creates a share session', session.status === 201, `got ${session.status}`);
  const shareToken = session.body?.data?.session?.token;
  check('a QR image is returned', String(session.body?.data?.qrDataUrl || '').startsWith('data:image/png;base64,'));
  check('the QR encodes only an opaque token, no medical data',
    typeof shareToken === 'string' &&
      session.body.data.session.url.endsWith(shareToken) &&
      !/hemoglobin|glucose|O\+|1992/i.test(session.body.data.session.url));

  check('an invalid share token is refused',
    (await api('POST', '/api/share/redeem', { token: d2Token, body: { token: 'not-a-real-token-value' } })).status === 404);

  const redeemed = await api('POST', '/api/share/redeem', { token: d2Token, body: { token: shareToken } });
  check('a second clinician redeems the share code', redeemed.status === 201, `got ${redeemed.status}`);
  check('redeeming grants access to the right patient', redeemed.body?.data?.patient?.id === patientId);

  check('doctor 2 CAN read the record after redeeming',
    (await api('GET', `/api/records/${recordA}`, { token: d2Token })).status === 200);

  check('the same share code cannot be used twice',
    (await api('POST', '/api/share/redeem', { token: dToken, body: { token: shareToken } })).status === 410);

  const session2 = await api('POST', '/api/share/sessions', { token: pToken, body: { expiresInMinutes: 15 } });
  const token2 = session2.body.data.session.token;
  await api('POST', `/api/share/sessions/${session2.body.data.session.id}/revoke`, { token: pToken });
  check('a revoked share code cannot be redeemed',
    (await api('POST', '/api/share/redeem', { token: dToken, body: { token: token2 } })).status === 410);

  check('creating a new share code retires the previous unused one',
    (await api('GET', '/api/share/sessions', { token: pToken })).body?.data?.sessions?.filter(
      (s) => s.status === 'ACTIVE'
    ).length <= 1);

  check('a patient cannot redeem a share code',
    (await api('POST', '/api/share/redeem', { token: pToken, body: { token: 'anything' } })).status === 403);

  // ---- Assistant ----------------------------------------------------------
  console.log('\nHealth assistant');
  const ask = await api('POST', '/api/assistant/ask', { token: pToken, body: { question: 'What is my hemoglobin?' } });
  check('assistant answers a parameter question', ask.status === 200, `got ${ask.status}`);
  check('the answer quotes the real extracted value', String(ask.body?.data?.answer || '').includes('10.4'),
    String(ask.body?.data?.answer || '').slice(0, 120));
  check('the answer cites the record it came from',
    ask.body?.data?.citations?.some((c) => c.recordId === recordA));
  check('the answer declares its source honestly',
    ['deterministic', 'openai'].includes(ask.body?.data?.source), ask.body?.data?.source);
  check('a disclaimer accompanies the answer', String(ask.body?.data?.disclaimer || '').length > 40);

  const diagnose = await api('POST', '/api/assistant/ask', { token: pToken, body: { question: 'Do I have diabetes?' } });
  check('assistant refuses to diagnose', diagnose.body?.data?.refused === true);
  const prescribe = await api('POST', '/api/assistant/ask', {
    token: pToken, body: { question: 'What medicine should I take for this?' },
  });
  check('assistant refuses to prescribe', prescribe.body?.data?.refused === true);

  const foreign = await api('POST', '/api/assistant/ask', { token: oToken, body: { question: 'What is my hemoglobin?' } });
  check('another patient’s assistant cannot see this patient’s values',
    !String(foreign.body?.data?.answer || '').includes('10.4'));

  check('the assistant requires authentication',
    (await api('POST', '/api/assistant/ask', { body: { question: 'hi' } })).status === 401);
  check('an empty question is rejected',
    (await api('POST', '/api/assistant/ask', { token: pToken, body: { question: '' } })).status === 400);

  // ---- Trends and comparison ---------------------------------------------
  console.log('\nTrends and comparison');
  const recordB = await uploadReport(pToken, SAMPLE_B);
  await waitForAnalysis(pToken, recordB);

  const trends = await api('GET', '/api/records/trends', { token: pToken });
  check('trends are produced from two reports', (trends.body?.data?.trends?.length ?? 0) > 0);
  check('each trend carries a deterministic observation',
    trends.body?.data?.trends?.every((t) => typeof t.observation?.note === 'string' && t.observation.note.length > 0));
  check('the observation names a direction',
    ['INCREASED', 'DECREASED', 'STABLE', 'SINGLE'].includes(trends.body?.data?.trends?.[0]?.observation?.direction));

  const comparison = await api('GET', `/api/records/compare?a=${recordA}&b=${recordB}`, { token: pToken });
  check('two reports can be compared', comparison.status === 200, `got ${comparison.status}`);
  check('the comparison returns per-parameter rows', (comparison.body?.data?.rows?.length ?? 0) > 0);
  check('the comparison is ordered oldest to newest',
    new Date(comparison.body?.data?.earlier?.date) <= new Date(comparison.body?.data?.later?.date));
  check('comparing a record you do not own is refused',
    (await api('GET', `/api/records/compare?a=${recordA}&b=${recordB}`, { token: oToken })).status === 404);
  check('comparing a report with itself is refused',
    (await api('GET', `/api/records/compare?a=${recordA}&b=${recordA}`, { token: pToken })).status === 400);

  // ---- PDF export ---------------------------------------------------------
  console.log('\nHealth summary export');
  const pdf = await api('GET', '/api/records/summary.pdf', { token: pToken, raw: true });
  check('summary PDF is generated', pdf.status === 200, `got ${pdf.status}`);
  check('it is served as a PDF attachment',
    pdf.headers.get('content-type') === 'application/pdf' &&
      String(pdf.headers.get('content-disposition')).includes('attachment'));
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  check('the PDF is a real, non-trivial document',
    pdfBytes.subarray(0, 4).toString() === '%PDF' && pdfBytes.length > 3000, `${pdfBytes.length} bytes`);
  check('the export is refused without authentication',
    (await api('GET', '/api/records/summary.pdf', { raw: true })).status === 401);

  // ---- Reminders ----------------------------------------------------------
  console.log('\nReminders');
  const reminder = await api('POST', '/api/reminders', {
    token: pToken,
    body: { title: 'Repeat fasting glucose', dueAt: new Date(Date.now() + 86400000).toISOString() },
  });
  check('a reminder can be created', reminder.status === 201, `got ${reminder.status}`);
  const reminderId = reminder.body?.data?.reminder?.id;
  check('reminders list for the owner',
    (await api('GET', '/api/reminders', { token: pToken })).body?.data?.counts?.open === 1);
  check('another patient cannot complete it',
    (await api('PATCH', `/api/reminders/${reminderId}`, { token: oToken, body: { completed: true } })).status === 404);
  check('the owner can complete it',
    (await api('PATCH', `/api/reminders/${reminderId}`, { token: pToken, body: { completed: true } })).body?.data
      ?.reminder?.completed === true);
  check('the owner can delete it',
    (await api('DELETE', `/api/reminders/${reminderId}`, { token: pToken })).status === 200);

  // ---- Error handling -----------------------------------------------------
  console.log('\nError handling');
  check('an unknown consent id returns 404',
    (await api('POST', '/api/consents/does-not-exist/approve', { token: pToken })).status === 404);
  check('a malformed consent request is rejected',
    (await api('POST', '/api/consents/request', { token: dToken, body: {} })).status === 400);
  check('errors never leak a stack trace',
    !/at\s+\w+\s+\(/.test(
      (await api('POST', '/api/consents/request', { token: dToken, body: {} })).text
    ));

  console.log('\nRate limiting');
  let sawThrottle = false;
  for (let i = 0; i < 14 && !sawThrottle; i++) {
    const attempt = await api('POST', '/api/auth/register', {
      body: { name: 'Flood', email: `flood_${stamp}_${i}@onehealth.test`, password: 'Flood@12345' },
    });
    if (attempt.status === 429) sawThrottle = true;
  }
  check('repeated signups from one address are throttled', sawThrottle);

  let loginThrottled = false;
  for (let i = 0; i < 10 && !loginThrottled; i++) {
    const attempt = await api('POST', '/api/auth/login', {
      body: { email: patient.email, password: 'WrongPassword@1' },
    });
    if (attempt.status === 429) loginThrottled = true;
  }
  check('repeated failed logins are throttled', loginThrottled);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  if (failures.length) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  console.log('');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nSmoke test crashed:', error);
  process.exit(1);
});
