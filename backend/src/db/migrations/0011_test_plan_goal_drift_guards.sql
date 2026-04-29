-- Keep older installs/test databases aligned with current plan and race fields.
ALTER TABLE "pulse_planned_workouts"
  ADD COLUMN IF NOT EXISTS "steps" JSONB,
  ADD COLUMN IF NOT EXISTS "garmin_workout_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "garmin_scheduled_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "workout_feedback" TEXT,
  ADD COLUMN IF NOT EXISTS "compliance_score" REAL,
  ADD COLUMN IF NOT EXISTS "original_zone" INTEGER,
  ADD COLUMN IF NOT EXISTS "original_duration_min" INTEGER,
  ADD COLUMN IF NOT EXISTS "adjusted_reason" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "adjusted_at" TIMESTAMP;

ALTER TABLE "pulse_goals"
  ADD COLUMN IF NOT EXISTS "category" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "race_discipline" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "race_distance_km" REAL,
  ADD COLUMN IF NOT EXISTS "race_target_time_sec" INTEGER,
  ADD COLUMN IF NOT EXISTS "race_priority" VARCHAR(1),
  ADD COLUMN IF NOT EXISTS "race_location" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "race_notes" TEXT;
