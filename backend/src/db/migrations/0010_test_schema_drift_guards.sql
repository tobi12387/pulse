-- Keep older installs/test databases aligned with the current Pulse schema.
ALTER TABLE "pulse_mental_checkins"
  ADD COLUMN IF NOT EXISTS "themes" TEXT[],
  ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS "coach_questions" JSONB;

ALTER TABLE "pulse_activities"
  ADD COLUMN IF NOT EXISTS "weather" JSONB,
  ADD COLUMN IF NOT EXISTS "start_lat" REAL,
  ADD COLUMN IF NOT EXISTS "start_lon" REAL,
  ADD COLUMN IF NOT EXISTS "is_indoor" BOOLEAN DEFAULT false;
