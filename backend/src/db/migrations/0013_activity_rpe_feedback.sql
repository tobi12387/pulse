-- RPE feedback (Borg 1-10) and short subjective notes per activity.
ALTER TABLE "pulse_activities"
  ADD COLUMN IF NOT EXISTS "rpe" SMALLINT,
  ADD COLUMN IF NOT EXISTS "rpe_note" TEXT,
  ADD COLUMN IF NOT EXISTS "soreness_areas" TEXT[],
  ADD COLUMN IF NOT EXISTS "feedback_logged_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "idx_pulse_activities_rpe"
  ON "pulse_activities" ("user_id", "start_time" DESC)
  WHERE "rpe" IS NOT NULL;
