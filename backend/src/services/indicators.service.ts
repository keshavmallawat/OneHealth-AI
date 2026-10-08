/**
 * Watch indicators: a deterministic, source-cited reading of the patient's most
 * recent laboratory values against published guideline thresholds.
 *
 * What this is, and what it deliberately is not:
 *   - It compares numbers already extracted from the patient's own reports with
 *     fixed thresholds. There is no model, no scoring and no prediction.
 *   - It never names a diagnosis. The strongest wording is "worth discussing with
 *     a clinician", and every indicator carries the numbers and the guideline
 *     that produced it so a clinician can check the reasoning.
 *   - It gives no treatment, diet or medication advice.
 *   - Values the extractor was unsure about (UNKNOWN, low confidence, or
 *     flagged as a possible OCR misread) are never used.
 *
 * Thresholds and sources:
 *   Glycaemia  - American Diabetes Association, Standards of Care:
 *                HbA1c 5.7-6.4% (prediabetes range), >= 6.5% (diabetes range);
 *                fasting glucose 100-125 mg/dL (impaired), >= 126 mg/dL (diabetes range).
 *   Anaemia    - WHO haemoglobin thresholds: < 13.0 g/dL men, < 12.0 g/dL women
 *                (the lower figure is used when sex is unknown, to avoid a false flag).
 *   Lipids     - NCEP ATP III: total cholesterol 200-239 borderline, >= 240 high;
 *                LDL 130-159 borderline, 160-189 high, >= 190 very high;
 *                HDL < 40 low; triglycerides 150-199 borderline, 200-499 high, >= 500 very high.
 *   Others     - values outside the interval stored in reference_ranges.py.
 */
import type { ParameterStatus } from './ai.service';

export type IndicatorLevel = 'WATCH' | 'DISCUSS';

export interface Reading {
  key: string;
  testName: string;
  value: number;
  unit: string;
  status: ParameterStatus;
  confidence: number;
  ocrUncertain?: boolean;
  date: Date;
  recordId: string;
}

export interface IndicatorBasis {
  testName: string;
  value: number;
  unit: string;
  date: Date;
  recordId: string;
  note: string;
}

export interface Indicator {
  id: string;
  title: string;
  level: IndicatorLevel;
  summary: string;
  basis: IndicatorBasis[];
  source: string;
}

export const INDICATOR_DISCLAIMER =
  'These indicators compare your uploaded results with published guideline thresholds. ' +
  'They are for information only, are not a diagnosis, and cannot replace advice from a qualified clinician. ' +
  'If you feel unwell, contact a clinician or emergency services.';

export const NOT_ASSESSED = [
  'Blood pressure (it is not part of laboratory reports, so this platform does not assess it)',
  'Anything not printed on your uploaded reports',
];

const MIN_CONFIDENCE = 0.5;

/** The newest usable reading for each parameter. */
export function latestReadings(readings: Reading[]): Map<string, Reading> {
  const latest = new Map<string, Reading>();
  for (const r of readings) {
    if (r.status === 'UNKNOWN' || r.ocrUncertain || r.confidence < MIN_CONFIDENCE) continue;
    const current = latest.get(r.key);
    if (!current || r.date > current.date) latest.set(r.key, r);
  }
  return latest;
}

const rank: Record<IndicatorLevel, number> = { WATCH: 1, DISCUSS: 2 };
const top = (a: IndicatorLevel, b: IndicatorLevel): IndicatorLevel => (rank[a] >= rank[b] ? a : b);

function basisOf(r: Reading, note: string): IndicatorBasis {
  return { testName: r.testName, value: r.value, unit: r.unit, date: r.date, recordId: r.recordId, note };
}

interface Band {
  min?: number;
  max?: number; // exclusive upper bound
  level: IndicatorLevel;
  note: string;
}

function band(value: number, bands: Band[]): Band | null {
  return (
    bands.find((b) => (b.min === undefined || value >= b.min) && (b.max === undefined || value < b.max)) ?? null
  );
}

const HBA1C_BANDS: Band[] = [
  { min: 6.5, level: 'DISCUSS', note: '6.5% or higher is in the range the ADA uses for diabetes; a clinician confirms it with repeat testing' },
  { min: 5.7, max: 6.5, level: 'WATCH', note: '5.7% to 6.4% is the range the ADA calls prediabetes' },
];
const FASTING_BANDS: Band[] = [
  { min: 126, level: 'DISCUSS', note: '126 mg/dL or higher fasting is in the range the ADA uses for diabetes; a clinician confirms it with repeat testing' },
  { min: 100, max: 126, level: 'WATCH', note: '100 to 125 mg/dL fasting is the range the ADA calls impaired fasting glucose' },
];
const TOTAL_CHOL_BANDS: Band[] = [
  { min: 240, level: 'DISCUSS', note: '240 mg/dL or higher is classed as high (NCEP ATP III)' },
  { min: 200, max: 240, level: 'WATCH', note: '200 to 239 mg/dL is classed as borderline high (NCEP ATP III)' },
];
const LDL_BANDS: Band[] = [
  { min: 190, level: 'DISCUSS', note: '190 mg/dL or higher is classed as very high (NCEP ATP III)' },
  { min: 160, max: 190, level: 'DISCUSS', note: '160 to 189 mg/dL is classed as high (NCEP ATP III)' },
  { min: 130, max: 160, level: 'WATCH', note: '130 to 159 mg/dL is classed as borderline high (NCEP ATP III)' },
];
const TG_BANDS: Band[] = [
  { min: 500, level: 'DISCUSS', note: '500 mg/dL or higher is classed as very high (NCEP ATP III)' },
  { min: 200, max: 500, level: 'DISCUSS', note: '200 to 499 mg/dL is classed as high (NCEP ATP III)' },
  { min: 150, max: 200, level: 'WATCH', note: '150 to 199 mg/dL is classed as borderline high (NCEP ATP III)' },
];

function group(
  id: string,
  title: string,
  source: string,
  pairs: Array<{ reading: Reading | undefined; bands: Band[] }>,
  summaries: Record<IndicatorLevel, string>
): Indicator | null {
  const basis: IndicatorBasis[] = [];
  let level: IndicatorLevel | null = null;
  for (const { reading, bands } of pairs) {
    if (!reading) continue;
    const hit = band(reading.value, bands);
    if (!hit) continue;
    basis.push(basisOf(reading, hit.note));
    level = level ? top(level, hit.level) : hit.level;
  }
  if (!level) return null;
  return { id, title, level, summary: summaries[level], basis, source };
}

export function buildIndicators(readings: Reading[], sex?: string | null): Indicator[] {
  const latest = latestReadings(readings);
  const get = (key: string) => latest.get(key);
  const out: Indicator[] = [];

  const sugar = group(
    'blood-sugar',
    'Blood sugar',
    'American Diabetes Association, Standards of Care',
    [
      { reading: get('HBA1C'), bands: HBA1C_BANDS },
      { reading: get('GLUCOSE_FASTING'), bands: FASTING_BANDS },
    ],
    {
      WATCH:
        'A blood-sugar result is higher than the usual interval but below the level guidelines use for diabetes. It is worth keeping an eye on and mentioning at your next check-up.',
      DISCUSS:
        'A blood-sugar result is in a range that guidelines say should be confirmed by a clinician. This is not a diagnosis; it is a reason to book a conversation with one.',
    }
  );
  if (sugar) out.push(sugar);

  const hb = get('HEMOGLOBIN');
  if (hb) {
    const threshold = sex === 'male' ? 13.0 : 12.0;
    if (hb.value < threshold) {
      const severe = hb.value < 8.0;
      out.push({
        id: 'haemoglobin',
        title: 'Haemoglobin',
        level: severe ? 'DISCUSS' : 'WATCH',
        summary: severe
          ? 'Your haemoglobin is well below the usual interval. This is worth discussing with a clinician soon.'
          : 'Your haemoglobin is below the usual interval. It is worth mentioning to a clinician, who can look at the full picture.',
        basis: [
          basisOf(
            hb,
            `Below the WHO threshold of ${threshold.toFixed(1)} g/dL${sex === 'male' || sex === 'female' ? ` for an adult ${sex}` : ' (lower adult threshold used because sex is not stated)'}${severe ? '; below 8.0 g/dL is a level clinicians usually want to see promptly' : ''}`
          ),
        ],
        source: 'WHO haemoglobin thresholds for anaemia',
      });
    }
  }

  const lipids = group(
    'cholesterol-and-fats',
    'Cholesterol and blood fats',
    'NCEP ATP III lipid classification',
    [
      { reading: get('CHOLESTEROL_TOTAL'), bands: TOTAL_CHOL_BANDS },
      { reading: get('LDL'), bands: LDL_BANDS },
      { reading: get('TRIGLYCERIDES'), bands: TG_BANDS },
      {
        reading: get('HDL'),
        bands: [{ max: 40, level: 'WATCH', note: 'Below 40 mg/dL is classed as low HDL (NCEP ATP III)' }],
      },
    ],
    {
      WATCH: 'One or more cholesterol or blood-fat results is borderline. It is worth keeping an eye on and raising at your next check-up.',
      DISCUSS: 'One or more cholesterol or blood-fat results is in the high range. It is worth discussing with a clinician.',
    }
  );
  if (lipids) out.push(lipids);

  // Parameters where the only claim is "outside the usual interval".
  const outside: Array<{ id: string; title: string; keys: string[]; direction: ParameterStatus[]; summary: string }> = [
    {
      id: 'kidney',
      title: 'Kidney marker',
      keys: ['CREATININE'],
      direction: ['HIGH'],
      summary:
        'Creatinine is above the usual interval. A single value cannot show how well your kidneys work, but it is worth mentioning to a clinician.',
    },
    {
      id: 'thyroid',
      title: 'Thyroid marker',
      keys: ['TSH'],
      direction: ['HIGH', 'LOW'],
      summary:
        'TSH is outside the usual interval. A clinician can tell you whether it matters in your situation.',
    },
    {
      id: 'liver',
      title: 'Liver enzymes',
      keys: ['ALT', 'AST'],
      direction: ['HIGH'],
      summary:
        'A liver enzyme is above the usual interval. These can rise for many everyday reasons; it is worth mentioning to a clinician.',
    },
    {
      id: 'blood-cells',
      title: 'Blood cell counts',
      keys: ['PLATELETS', 'WBC', 'RBC'],
      direction: ['HIGH', 'LOW'],
      summary:
        'A blood cell count is outside the usual interval. A clinician can look at it alongside the rest of your results.',
    },
  ];
  for (const item of outside) {
    const hits = item.keys
      .map((k) => get(k))
      .filter((r): r is Reading => !!r && item.direction.includes(r.status));
    if (hits.length === 0) continue;
    out.push({
      id: item.id,
      title: item.title,
      level: 'WATCH',
      summary: item.summary,
      basis: hits.map((r) => basisOf(r, `${r.status === 'HIGH' ? 'Above' : 'Below'} the usual interval for adults`)),
      source: 'Reference intervals in ai-service/app/data/reference_ranges.py (Harrison\'s, Tietz)',
    });
  }

  return out.sort((a, b) => rank[b.level] - rank[a.level] || a.title.localeCompare(b.title));
}
