-- Reconciles the drift between `20260420141229_init` and the current schema.prisma.
--
-- Two things happened after the init migration that were never migrated:
--   1. User PII moved to HMAC lookup hash + AES-256-GCM ciphertext columns.
--   2. HealthRecord gained tags + the AI/OCR pipeline output columns.
--
-- Every statement is guarded so this migration applies cleanly to a database
-- created from `init`, to one that was previously `prisma db push`-ed to the
-- current schema, and to an empty database.

-- ---------------------------------------------------------------------------
-- 1. ProcessStatus gains DELETED (used by the soft-delete path)
-- ---------------------------------------------------------------------------
ALTER TYPE "ProcessStatus" ADD VALUE IF NOT EXISTS 'DELETED';

-- ---------------------------------------------------------------------------
-- 2. User: plaintext email/phone -> hashed lookup + encrypted payload
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailHash"      TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneHash"      TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneEncrypted" TEXT;

-- Any pre-existing row cannot be re-encrypted from SQL (the HMAC/AES keys live
-- in the application). Give such rows a non-colliding placeholder so the NOT
-- NULL constraints below can be applied without dropping the row.
UPDATE "User" SET "emailHash"      = 'legacy-unmigrated:' || "id" WHERE "emailHash" IS NULL;
UPDATE "User" SET "emailEncrypted" = ''                           WHERE "emailEncrypted" IS NULL;

ALTER TABLE "User" ALTER COLUMN "emailHash"      SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "emailEncrypted" SET NOT NULL;

DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_phone_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "email";
ALTER TABLE "User" DROP COLUMN IF EXISTS "phone";

CREATE UNIQUE INDEX IF NOT EXISTS "User_emailHash_key" ON "User"("emailHash");
CREATE UNIQUE INDEX IF NOT EXISTS "User_phoneHash_key" ON "User"("phoneHash");

-- ---------------------------------------------------------------------------
-- 3. HealthRecord: tags + AI pipeline output
-- ---------------------------------------------------------------------------
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "tags"            TEXT[];
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "mimeType"        TEXT;
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "ocrText"         TEXT;
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "extractedData"   JSONB;
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "aiSummary"       TEXT;
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "summarySource"   TEXT;
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "abnormalCount"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "parameterCount"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "processingError" TEXT;
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "processedAt"     TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "HealthRecord_userId_uploadedAt_idx" ON "HealthRecord"("userId", "uploadedAt");
