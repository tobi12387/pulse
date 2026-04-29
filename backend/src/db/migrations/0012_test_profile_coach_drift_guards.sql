-- Keep older installs/test databases aligned with current profile, coach, and availability fields.
ALTER TABLE "pulse_user_profile"
  ADD COLUMN IF NOT EXISTS "ftp_watts" INTEGER,
  ADD COLUMN IF NOT EXISTS "max_hr_bpm" INTEGER,
  ADD COLUMN IF NOT EXISTS "lthr_bpm" INTEGER,
  ADD COLUMN IF NOT EXISTS "resting_hr_bpm" INTEGER,
  ADD COLUMN IF NOT EXISTS "weight_kg" REAL,
  ADD COLUMN IF NOT EXISTS "vo2max" REAL,
  ADD COLUMN IF NOT EXISTS "training_phase" VARCHAR(20) DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS "weekly_hours_target" REAL,
  ADD COLUMN IF NOT EXISTS "home_lat" REAL,
  ADD COLUMN IF NOT EXISTS "home_lon" REAL,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT now();

ALTER TABLE "pulse_coach_sessions"
  ADD COLUMN IF NOT EXISTS "context_snapshot" JSONB;

ALTER TABLE "pulse_week_availability"
  ADD COLUMN IF NOT EXISTS "available_days" JSONB DEFAULT '[1,3,5,6]'::jsonb,
  ADD COLUMN IF NOT EXISTS "weekly_hours" REAL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP DEFAULT now();
