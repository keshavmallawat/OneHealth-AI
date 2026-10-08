#!/usr/bin/env node
/**
 * OneHealth AI - smoke test for watch indicators and the emergency card.
 *
 *   register -> upload abnormal report -> indicators -> disclaimer and sources
 *   register -> upload normal report   -> no indicators
 *   emergency card: empty profile refused -> fill profile -> card -> field choice
 *   -> invalid input -> authentication -> audit trail
 *
 * Usage:  node scripts/smoke-test-features.js  [apiBaseUrl]
 */
const fs = require('fs');
const path = require('path');

const API = process.argv[2] || process.env.API_URL || 'http://127.0.0.1:3001';
const ROOT = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
function check(label, condition, detail = '') {
  if (condition) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail ? ` - ${detail}` : ''}`); }
}

async function json(url, options) {
  const res = await fetch(url, options);
  let body = null;
  try { body = await res.json(); } catch { /* not json */ }
  return { status: res.status, body };
}

async function register(name) {
  const email = `feat_${Date.now()}_${Math.floor(Math.random() * 1e6)}@onehealth.test`;
  const payload = JSON.stringify({ name, email, password: 'FeatureTest@12345' });
  const send = () => json(`${API}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
  });
  let res = await send();
  if (res.status === 429) {
    console.log('  ..    signup rate limit closed; waiting 62s');
    await sleep(62000);
    res = await send();
  }
  return { Authorization: `Bearer ${res.body.accessToken}` };
}

async function uploadAndWait(auth, file) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(path.join(ROOT, 'sample-data', file))], { type: 'application/pdf' }), file);
  form.append('type', 'BLOOD_TEST');
  const up = await json(`${API}/api/records/upload`, { method: 'POST', headers: auth, body: form });
  const id = up.body?.data?.record?.id;
  for (let i = 0; i < 45; i++) {
    await sleep(1000);
    const d = await json(`${API}/api/records/${id}`, { headers: auth });
    const status = d.body?.data?.record?.status;
    if (status && status !== 'PENDING' && status !== 'PROCESSING') return status;
  }
  return 'TIMEOUT';
}

async function main() {
  console.log(`\nOneHealth AI feature smoke test against ${API}\n`);

  console.log('Watch indicators - abnormal report');
  const patient = await register('Indicator Patient');
  check('indicators require authentication', (await json(`${API}/api/records/indicators`)).status === 401);

  const empty = await json(`${API}/api/records/indicators`, { headers: patient });
  check('a patient with no reports gets an empty, well-formed response',
    empty.status === 200 && empty.body.data.indicators.length === 0 && empty.body.data.reportsConsidered === 0);

  check('the abnormal report is analysed', (await uploadAndWait(patient, 'sample-blood-report-abnormal.pdf')) === 'DONE');
  const res = await json(`${API}/api/records/indicators`, { headers: patient });
  const data = res.body?.data;
  const byId = Object.fromEntries((data?.indicators || []).map((i) => [i.id, i]));
  check('indicators endpoint responds', res.status === 200);
  check('blood sugar is raised for discussion (HbA1c 6.8, fasting glucose 126)', byId['blood-sugar']?.level === 'DISCUSS');
  check('cholesterol and fats are raised for discussion', byId['cholesterol-and-fats']?.level === 'DISCUSS');
  check('low haemoglobin is raised for watching', byId['haemoglobin']?.level === 'WATCH');
  check('every indicator cites a source', (data?.indicators || []).every((i) => i.source && i.source.length > 5));
  check('every indicator lists the numbers it used',
    (data?.indicators || []).every((i) => i.basis.length > 0 && i.basis.every((b) => typeof b.value === 'number' && b.recordId)));
  check('the sugar indicator names both tests behind it',
    (byId['blood-sugar']?.basis || []).map((b) => b.testName).join('|').match(/HbA1c|Hemoglobin A1c|Glycated/i) !== null
      && (byId['blood-sugar']?.basis || []).length === 2);
  const text = JSON.stringify(data);
  check('no indicator names a diagnosis', !/you have (diabetes|anaemia|anemia)|diagnos(ed|is) (of|with)/i.test(
    (data?.indicators || []).map((i) => i.summary).join(' ')));
  check('a disclaimer is returned', /not a diagnosis/i.test(data?.disclaimer || ''));
  check('blood pressure is declared as not assessed', /blood pressure/i.test((data?.notAssessed || []).join(' ')));
  check('the response carries no password or token material', !/passwordHash|accessToken/.test(text));
  check('worst findings are listed first', (data?.indicators || [])[0]?.level === 'DISCUSS');

  console.log('\nWatch indicators - normal report');
  const patient2 = await register('Normal Patient');
  check('the normal report is analysed', (await uploadAndWait(patient2, 'sample-blood-report-normal.pdf')) === 'DONE');
  const normal = await json(`${API}/api/records/indicators`, { headers: patient2 });
  check('a normal report raises no indicators',
    normal.status === 200 && normal.body.data.indicators.length === 0 && normal.body.data.reportsConsidered === 1,
    JSON.stringify(normal.body?.data?.indicators?.map((i) => i.id)));

  console.log('\nEmergency card');
  check('the card requires authentication', (await json(`${API}/api/users/me/emergency-card`)).status === 401);
  const blank = await json(`${API}/api/users/me/emergency-card?include=bloodType,allergies`, { headers: patient });
  check('a profile with nothing entered is refused with a helpful message',
    blank.status === 400 && /profile/i.test(blank.body?.message || ''), `got ${blank.status}`);

  const patch = await json(`${API}/api/users/me/profile`, {
    method: 'PATCH',
    headers: { ...patient, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bloodType: 'O+', allergies: ['Penicillin', 'Peanuts'], chronicConditions: ['Hypothyroidism'],
      emergencyName: 'Asha', emergencyPhone: '+919800000000',
    }),
  });
  check('profile details are saved', patch.status === 200, `got ${patch.status}`);

  const card = await json(`${API}/api/users/me/emergency-card`, { headers: patient });
  const c = card.body?.data;
  check('the card is generated', card.status === 200);
  check('the QR is a PNG image', typeof c?.qrDataUrl === 'string' && c.qrDataUrl.startsWith('data:image/png;base64,'));
  check('the card text carries the blood group', /Blood group: O\+/.test(c?.text || ''));
  check('the card text carries allergies and conditions',
    /Allergies: Penicillin, Peanuts/.test(c?.text || '') && /Ongoing conditions: Hypothyroidism/.test(c?.text || ''));
  check('the card text carries the emergency contact', /Emergency contact: Asha \+919800000000/.test(c?.text || ''));
  check('the card states it is patient-entered and unverified', /not verified/i.test(c?.text || ''));

  const trimmed = await json(`${API}/api/users/me/emergency-card?include=bloodType`, { headers: patient });
  check('the patient controls which fields appear',
    /Blood group/.test(trimmed.body?.data?.text || '')
      && !/Allergies|Name:|Emergency contact/.test(trimmed.body?.data?.text || ''));
  check('an unknown field is rejected',
    (await json(`${API}/api/users/me/emergency-card?include=passwordHash`, { headers: patient })).status === 400);

  const activity = await json(`${API}/api/records/activity?scope=mine`, { headers: patient });
  const actions = (activity.body?.data?.activity || []).map((a) => a.action);
  check('generating a card is written to the access history', actions.includes('EMERGENCY_CARD_GENERATED'),
    actions.join(','));

  console.log(`\n${'='.repeat(60)}\n  ${passed} passed, ${failed} failed\n${'='.repeat(60)}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
