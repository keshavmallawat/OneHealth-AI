#!/usr/bin/env node
/**
 * OneHealth AI - end-to-end smoke test.
 *
 * Exercises the whole core flow against a running stack:
 *   register -> login -> upload -> AI processing -> detail -> file access
 *   -> stats -> trends -> authorisation checks -> soft delete
 *
 * No dependencies: uses Node 18+ global fetch/FormData/Blob.
 *
 * Usage:  node scripts/smoke-test.js  [apiBaseUrl]
 */
const fs = require('fs');
const path = require('path');

const API = process.argv[2] || process.env.API_URL || 'http://127.0.0.1:3001';
const ROOT = path.resolve(__dirname, '..');
const SAMPLE = path.join(ROOT, 'sample-data', 'sample-blood-report-abnormal.pdf');

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log(`\nOneHealth AI smoke test against ${API}\n`);

  // ---- 0. System health ---------------------------------------------------
  console.log('System health');
  const health = await fetch(`${API}/api/health`).then((r) => r.json());
  check('API reachable', health?.services?.api?.reachable === true);
  check('database reachable', health?.services?.database?.reachable === true,
    health?.services?.database?.error?.slice(0, 120));
  check('AI service reachable', health?.services?.aiService?.reachable === true,
    health?.services?.aiService?.error);

  if (!health?.services?.database?.reachable) {
    console.log('\nDatabase is unreachable - aborting. Check PostgreSQL and DATABASE_URL.\n');
    process.exit(1);
  }

  // ---- 1. Registration ----------------------------------------------------
  console.log('\nAuthentication');
  const email = `smoke_${Date.now()}@onehealth.test`;
  const password = 'SmokeTest@12345';

  // If this suite runs straight after another that also registered accounts,
  // the per-IP signup limiter may still be closed. Waiting it out keeps the
  // limiter honest instead of loosening it for the sake of a test.
  let registerResponse = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Test Patient', email, password }),
  });
  if (registerResponse.status === 429) {
    console.log('  ..    signup rate limit is closed; waiting 62s for the window to reopen');
    await sleep(62000);
    registerResponse = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Test Patient', email, password }),
    });
  }
  const registered = await registerResponse.json();
  check('register returns 201', registerResponse.status === 201, `got ${registerResponse.status}`);
  check('register returns an access token', typeof registered.accessToken === 'string');
  check('register does not leak a password hash', !JSON.stringify(registered).includes('passwordHash'));

  // ---- 2. Login -----------------------------------------------------------
  const loginResponse = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const login = await loginResponse.json();
  check('login succeeds', loginResponse.status === 200, `got ${loginResponse.status}`);
  check('login round-trips the encrypted email', login?.user?.email === email,
    `got ${login?.user?.email}`);

  const token = login.accessToken;
  const auth = { Authorization: `Bearer ${token}` };

  const wrongPassword = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'WrongPassword123' }),
  });
  check('wrong password is rejected with 401', wrongPassword.status === 401,
    `got ${wrongPassword.status}`);

  const me = await fetch(`${API}/api/auth/me`, { headers: auth }).then((r) => r.json());
  check('/auth/me returns the signed-in user', me?.user?.email === email);

  check('records require authentication',
    (await fetch(`${API}/api/records`)).status === 401);

  // ---- 3. Upload ----------------------------------------------------------
  console.log('\nUpload and AI processing');
  if (!fs.existsSync(SAMPLE)) {
    console.log(`  SKIP  sample file missing: ${SAMPLE}`);
    console.log('        run: python ai-service/scripts/generate_samples.py');
    process.exit(1);
  }

  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(SAMPLE)], { type: 'application/pdf' }),
    'sample-blood-report-abnormal.pdf');
  form.append('type', 'BLOOD_TEST');
  form.append('tags', 'smoke-test');

  const uploadResponse = await fetch(`${API}/api/records/upload`, {
    method: 'POST', headers: auth, body: form,
  });
  const uploaded = await uploadResponse.json();
  check('upload returns 201', uploadResponse.status === 201, `got ${uploadResponse.status}`);
  const recordId = uploaded?.data?.record?.id;
  check('upload returns a record id', Boolean(recordId));
  if (!recordId) {
    console.log('\nUpload failed - aborting.\n', JSON.stringify(uploaded).slice(0, 400));
    process.exit(1);
  }

  // ---- 4. Wait for the pipeline ------------------------------------------
  let detail = null;
  const startedAt = Date.now();
  for (let attempt = 0; attempt < 45; attempt++) {
    await sleep(1000);
    const body = await fetch(`${API}/api/records/${recordId}`, { headers: auth }).then((r) => r.json());
    detail = body?.data?.record;
    if (detail && detail.status !== 'PENDING' && detail.status !== 'PROCESSING') break;
  }
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  check(`analysis completes (took ${elapsed}s)`, detail?.status === 'DONE',
    `status ${detail?.status} ${detail?.processingError || ''}`);

  // ---- 5. Extraction quality ---------------------------------------------
  console.log('\nExtraction results');
  const parameters = detail?.parameters || [];
  check('14 parameters extracted', parameters.length === 14, `got ${parameters.length}`);
  check('abnormal values flagged', (detail?.abnormalCount ?? 0) === 10,
    `got ${detail?.abnormalCount}`);

  const byName = Object.fromEntries(parameters.map((p) => [p.testName, p]));
  check('Hemoglobin 10.4 flagged LOW',
    byName['Hemoglobin']?.value === 10.4 && byName['Hemoglobin']?.status === 'LOW',
    JSON.stringify(byName['Hemoglobin']?.value) + ' ' + byName['Hemoglobin']?.status);
  check('Fasting glucose 126 flagged HIGH',
    byName['Fasting Blood Glucose']?.value === 126 && byName['Fasting Blood Glucose']?.status === 'HIGH');
  check('Creatinine 0.9 reported NORMAL',
    byName['Serum Creatinine']?.status === 'NORMAL');
  check('Platelets normalised from 2,45,000 to 245',
    byName['Platelet Count']?.value === 245, `got ${byName['Platelet Count']?.value}`);
  check('every parameter carries a reference range',
    parameters.every((p) => typeof p.referenceRange === 'string' && p.referenceRange.length > 0));
  check('every parameter carries a confidence score',
    parameters.every((p) => typeof p.confidence === 'number' && p.confidence > 0 && p.confidence <= 1));
  check('sex-specific range applied (report says Female)', detail?.detectedSex === 'female');

  // ---- 6. Summary and disclaimer -----------------------------------------
  console.log('\nAI summary');
  check('a summary was generated', typeof detail?.aiSummary === 'string' && detail.aiSummary.length > 100);
  check('the disclaimer is present in the stored summary',
    (detail?.aiSummary || '').includes('does not constitute medical diagnosis'));
  check('summary source is recorded', ['openai', 'deterministic'].includes(detail?.summarySource),
    detail?.summarySource);
  check('summary quotes a real extracted value', (detail?.aiSummary || '').includes('10.4'));

  // ---- 7. File access -----------------------------------------------------
  console.log('\nDocument access control');
  const fileResponse = await fetch(`${API}/api/records/${recordId}/file`, { headers: auth });
  check('owner can fetch the original document', fileResponse.status === 200,
    `got ${fileResponse.status}`);
  check('document served with the right content type',
    (fileResponse.headers.get('content-type') || '').includes('pdf'));

  const anonymousFile = await fetch(`${API}/api/records/${recordId}/file`);
  check('anonymous document access is refused', anonymousFile.status === 401,
    `got ${anonymousFile.status}`);

  // A second patient must not be able to read the first patient's record.
  const otherEmail = `smoke_other_${Date.now()}@onehealth.test`;
  const other = await fetch(`${API}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Other Patient', email: otherEmail, password }),
  }).then((r) => r.json());
  const crossTenant = await fetch(`${API}/api/records/${recordId}`, {
    headers: { Authorization: `Bearer ${other.accessToken}` },
  });
  check('another patient cannot read this record', crossTenant.status === 403,
    `got ${crossTenant.status}`);

  // ---- 8. Aggregates ------------------------------------------------------
  console.log('\nDashboard aggregates');
  const stats = await fetch(`${API}/api/records/stats`, { headers: auth }).then((r) => r.json());
  check('stats report one analysed report', stats?.data?.analysedReports === 1,
    `got ${stats?.data?.analysedReports}`);
  check('stats surface the flagged values', (stats?.data?.latestReport?.flagged?.length ?? 0) === 10,
    `got ${stats?.data?.latestReport?.flagged?.length}`);

  const list = await fetch(`${API}/api/records?limit=10`, { headers: auth }).then((r) => r.json());
  check('record list returns the upload', list?.data?.records?.length === 1);
  check('list responses omit the OCR text payload',
    list?.data?.records?.[0]?.ocrText === undefined);

  const trends = await fetch(`${API}/api/records/trends`, { headers: auth }).then((r) => r.json());
  check('trends endpoint responds', trends?.success === true);
  check('a single report yields no trend lines', (trends?.data?.trends?.length ?? 0) === 0);

  // ---- 9. Error handling --------------------------------------------------
  console.log('\nError handling');
  const badForm = new FormData();
  badForm.append('file', new Blob([Buffer.from('this is not a report')], { type: 'text/plain' }), 'notes.txt');
  badForm.append('type', 'BLOOD_TEST');
  const badUpload = await fetch(`${API}/api/records/upload`, { method: 'POST', headers: auth, body: badForm });
  check('unsupported file types are rejected', badUpload.status === 400 || badUpload.status === 413,
    `got ${badUpload.status}`);

  const missing = await fetch(`${API}/api/records/does-not-exist`, { headers: auth });
  check('unknown record returns 404', missing.status === 404, `got ${missing.status}`);

  const notFound = await fetch(`${API}/api/nope`);
  check('unknown route returns a JSON 404', notFound.status === 404);

  // ---- 10. Soft delete ----------------------------------------------------
  console.log('\nDeletion');
  const deleted = await fetch(`${API}/api/records/${recordId}`, { method: 'DELETE', headers: auth });
  check('record can be deleted', deleted.status === 200, `got ${deleted.status}`);
  const afterDelete = await fetch(`${API}/api/records?limit=10`, { headers: auth }).then((r) => r.json());
  check('deleted record disappears from the list', afterDelete?.data?.records?.length === 0);

  // ---- Summary ------------------------------------------------------------
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\n  Failures:');
    failures.forEach((failure) => console.log(`   - ${failure}`));
  }
  console.log(`${'='.repeat(60)}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error('\nSmoke test crashed:', error?.message || error);
  console.error('Is the stack running? Try: powershell -File scripts\\setup-and-verify.ps1\n');
  process.exit(1);
});
