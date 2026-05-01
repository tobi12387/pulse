ALTER TABLE "pulse_user_profile"
  ADD COLUMN IF NOT EXISTS "ftp_watts_source" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "ftp_watts_updated_at" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "max_hr_bpm_source" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "max_hr_bpm_updated_at" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "lthr_bpm_source" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "lthr_bpm_updated_at" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "vo2max_source" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "vo2max_updated_at" TIMESTAMP WITH TIME ZONE;

UPDATE "pulse_user_profile"
SET
  "ftp_watts_source" = COALESCE("ftp_watts_source", 'manual'),
  "ftp_watts_updated_at" = COALESCE("ftp_watts_updated_at", "updated_at")
WHERE "ftp_watts" IS NOT NULL;

UPDATE "pulse_user_profile"
SET
  "max_hr_bpm_source" = COALESCE("max_hr_bpm_source", 'manual'),
  "max_hr_bpm_updated_at" = COALESCE("max_hr_bpm_updated_at", "updated_at")
WHERE "max_hr_bpm" IS NOT NULL;

UPDATE "pulse_user_profile"
SET
  "lthr_bpm_source" = COALESCE("lthr_bpm_source", 'manual'),
  "lthr_bpm_updated_at" = COALESCE("lthr_bpm_updated_at", "updated_at")
WHERE "lthr_bpm" IS NOT NULL;

UPDATE "pulse_user_profile"
SET
  "vo2max_source" = COALESCE("vo2max_source", 'manual'),
  "vo2max_updated_at" = COALESCE("vo2max_updated_at", "updated_at")
WHERE "vo2max" IS NOT NULL;
