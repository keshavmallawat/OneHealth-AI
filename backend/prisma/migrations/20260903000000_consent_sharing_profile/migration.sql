-- OneHealth AI — consent, provider access, QR sharing, richer patient profile.
--
-- Every statement is guarded so this migration is safe to (re-)apply to a
-- database created by `init`, by the previous reconciliation migration, or by
-- `prisma db push`. Nothing here drops patient data.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConsentStatus') THEN
    CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED');
  END IF;
END$$;

ALTER TYPE "RecordType" ADD VALUE IF NOT EXISTS 'VACCINATION';

-- ---------------------------------------------------------------------------
-- 2. User — health identity, provider profile, share code
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dateOfBirth"        TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sex"                TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "allergies"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chronicConditions"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emergencyName"      TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emergencyPhone"     TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shareCode"          TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "specialization"     TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clinicName"         TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "city"               TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "User_shareCode_key" ON "User"("shareCode");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- ---------------------------------------------------------------------------
-- 3. HealthRecord — patient-owned clinical metadata
-- ---------------------------------------------------------------------------
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "reportDate" TIMESTAMP(3);
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "labName"    TEXT;
ALTER TABLE "HealthRecord" ADD COLUMN IF NOT EXISTS "notes"      TEXT;
ALTER TABLE "HealthRecord" ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[];
UPDATE "HealthRecord" SET "tags" = ARRAY[]::TEXT[] WHERE "tags" IS NULL;
ALTER TABLE "HealthRecord" ALTER COLUMN "tags" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "HealthRecord_userId_status_idx" ON "HealthRecord"("userId", "status");

-- ---------------------------------------------------------------------------
-- 4. DoctorAccessToken — the consent lifecycle
-- ---------------------------------------------------------------------------
ALTER TABLE "DoctorAccessToken" ADD COLUMN IF NOT EXISTS "status"         "ConsentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "DoctorAccessToken" ADD COLUMN IF NOT EXISTS "purpose"        TEXT;
ALTER TABLE "DoctorAccessToken" ADD COLUMN IF NOT EXISTS "requestedBy"    TEXT NOT NULL DEFAULT 'PATIENT';
ALTER TABLE "DoctorAccessToken" ADD COLUMN IF NOT EXISTS "origin"         TEXT NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "DoctorAccessToken" ADD COLUMN IF NOT EXISTS "decidedAt"      TIMESTAMP(3);
ALTER TABLE "DoctorAccessToken" ADD COLUMN IF NOT EXISTS "revokedAt"      TIMESTAMP(3);
ALTER TABLE "DoctorAccessToken" ADD COLUMN IF NOT EXISTS "lastAccessedAt" TIMESTAMP(3);
ALTER TABLE "DoctorAccessToken" ADD COLUMN IF NOT EXISTS "accessCount"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DoctorAccessToken" ALTER COLUMN "scope" SET DEFAULT ARRAY[]::TEXT[];
UPDATE "DoctorAccessToken" SET "scope" = ARRAY[]::TEXT[] WHERE "scope" IS NULL;

-- Rows that existed before the lifecycle column was introduced were, by the old
-- semantics, already-granted access. Preserve that meaning.
UPDATE "DoctorAccessToken" SET "status" = 'APPROVED' WHERE "revoked" = false AND "status" = 'PENDING' AND "createdAt" < NOW() - INTERVAL '1 second';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DoctorAccessToken_doctorId_fkey'
  ) THEN
    ALTER TABLE "DoctorAccessToken"
      ADD CONSTRAINT "DoctorAccessToken_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "DoctorAccessToken_patientId_status_idx" ON "DoctorAccessToken"("patientId", "status");
CREATE INDEX IF NOT EXISTS "DoctorAccessToken_doctorId_status_idx"  ON "DoctorAccessToken"("doctorId", "status");

-- ---------------------------------------------------------------------------
-- 5. ShareSession — QR / link handshake (carries a token, never medical data)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ShareSession" (
    "id"                TEXT NOT NULL,
    "token"             TEXT NOT NULL,
    "patientId"         TEXT NOT NULL,
    "scope"             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "purpose"           TEXT,
    "expiresAt"         TIMESTAMP(3) NOT NULL,
    "revoked"           BOOLEAN NOT NULL DEFAULT false,
    "revokedAt"         TIMESTAMP(3),
    "claimedByDoctorId" TEXT,
    "claimedAt"         TIMESTAMP(3),
    "grantDurationHrs"  INTEGER NOT NULL DEFAULT 72,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShareSession_token_key" ON "ShareSession"("token");
CREATE INDEX IF NOT EXISTS "ShareSession_patientId_createdAt_idx" ON "ShareSession"("patientId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShareSession_patientId_fkey') THEN
    ALTER TABLE "ShareSession" ADD CONSTRAINT "ShareSession_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShareSession_claimedByDoctorId_fkey') THEN
    ALTER TABLE "ShareSession" ADD CONSTRAINT "ShareSession_claimedByDoctorId_fkey"
      FOREIGN KEY ("claimedByDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 6. AccessLog — record whose data was touched, not just who touched it
-- ---------------------------------------------------------------------------
ALTER TABLE "AccessLog" ADD COLUMN IF NOT EXISTS "patientId" TEXT;
ALTER TABLE "AccessLog" ADD COLUMN IF NOT EXISTS "detail"    TEXT;

-- Backfill: historically every logged action was a patient acting on their own
-- data, so the subject is the actor.
UPDATE "AccessLog" SET "patientId" = "actorId" WHERE "patientId" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccessLog_patientId_fkey') THEN
    ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "AccessLog_actorId_timestamp_idx"   ON "AccessLog"("actorId", "timestamp");
CREATE INDEX IF NOT EXISTS "AccessLog_patientId_timestamp_idx" ON "AccessLog"("patientId", "timestamp");

-- ---------------------------------------------------------------------------
-- 7. Reminder
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Reminder" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "notes"       TEXT,
    "dueAt"       TIMESTAMP(3) NOT NULL,
    "completed"   BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Reminder_userId_dueAt_idx" ON "Reminder"("userId", "dueAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reminder_userId_fkey') THEN
    ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
