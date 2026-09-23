/**
 * Central, validated environment configuration.
 *
 * Every secret and tunable is read here exactly once. Nothing elsewhere in the
 * codebase reads process.env directly, so a missing or malformed value fails
 * loudly at boot instead of surfacing as a confusing runtime error later.
 *
 * Secrets never have a hard-coded production default. In development we fall
 * back to a clearly-marked dev value and print a warning; in production the
 * process refuses to start without a real secret.
 */
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me-32chars';
const DEV_REFRESH_SECRET = 'dev-only-insecure-refresh-secret-change-me-32ch';
const DEV_PII_KEY = 'dev_only_32_byte_pii_key_000000!'; // exactly 32 bytes
const DEV_PII_HMAC = 'dev-only-pii-hmac-secret';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16).default(DEV_JWT_SECRET),
  JWT_REFRESH_SECRET: z.string().min(16).default(DEV_REFRESH_SECRET),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),

  // AES-256-GCM needs a 32-byte key. A value that is exactly 32 characters is
  // used verbatim; anything else is stretched to 32 bytes with SHA-256 (see
  // crypto.service.ts) rather than throwing deep inside createCipheriv.
  PII_ENCRYPTION_KEY: z.string().min(16, 'PII_ENCRYPTION_KEY must be at least 16 characters').default(DEV_PII_KEY),
  PII_HMAC_SECRET: z.string().min(8).default(DEV_PII_HMAC),

  // Storage: 'local' keeps the demo entirely off AWS; 's3' uses the real bucket.
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_PATH: z.string().default('storage'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(25),

  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().default('healthcare-ai-records'),

  AI_SERVICE_URL: z.string().default('http://127.0.0.1:8001'),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().positive().default(120000),

  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  REDIS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => !['false', '0', 'no', 'off'].includes(v.toLowerCase())),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Invalid environment configuration:\n');
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\n   Copy backend/.env.example to backend/.env and fill it in.\n');
  process.exit(1);
}

const raw = parsed.data;

// Refuse to boot in production with a development secret still in place.
if (isProduction) {
  const placeholders: [string, string][] = [
    ['JWT_SECRET', DEV_JWT_SECRET],
    ['JWT_REFRESH_SECRET', DEV_REFRESH_SECRET],
    ['PII_ENCRYPTION_KEY', DEV_PII_KEY],
    ['PII_HMAC_SECRET', DEV_PII_HMAC],
  ];
  const unsafe = placeholders.filter(([key, dev]) => (raw as any)[key] === dev).map(([k]) => k);
  if (unsafe.length) {
    console.error(`❌ Refusing to start in production with development secrets: ${unsafe.join(', ')}`);
    process.exit(1);
  }
}

const usingDevSecrets =
  raw.JWT_SECRET === DEV_JWT_SECRET || raw.PII_ENCRYPTION_KEY === DEV_PII_KEY;

export const env = {
  ...raw,
  isProduction,
  maxUploadBytes: raw.MAX_UPLOAD_MB * 1024 * 1024,
  // Absolute path so the location does not depend on the working directory -
  // this matters because `npm run dev` and `npm start` run from different places.
  localStorageRoot: path.isAbsolute(raw.LOCAL_STORAGE_PATH)
    ? raw.LOCAL_STORAGE_PATH
    : path.resolve(process.cwd(), raw.LOCAL_STORAGE_PATH),
  usingDevSecrets,
  awsConfigured: Boolean(
    raw.AWS_ACCESS_KEY_ID &&
      raw.AWS_SECRET_ACCESS_KEY &&
      !raw.AWS_ACCESS_KEY_ID.startsWith('your_') &&
      !raw.AWS_SECRET_ACCESS_KEY.startsWith('your_')
  ),
};

export function printConfigBanner(): void {
  console.log(`   Environment    : ${env.NODE_ENV}`);
  console.log(`   Storage driver : ${env.STORAGE_DRIVER}${env.STORAGE_DRIVER === 'local' ? ` (${env.localStorageRoot})` : ` (bucket ${env.S3_BUCKET_NAME})`}`);
  console.log(`   AI service     : ${env.AI_SERVICE_URL}`);
  console.log(`   Redis          : ${env.REDIS_ENABLED ? env.REDIS_URL : 'disabled (in-memory fallback)'}`);
  if (env.STORAGE_DRIVER === 's3' && !env.awsConfigured) {
    console.warn('   ⚠  STORAGE_DRIVER=s3 but AWS credentials look like placeholders.');
  }
  if (env.usingDevSecrets) {
    console.warn('   ⚠  Using development secrets. Set real values in .env before deploying.');
  }
}
