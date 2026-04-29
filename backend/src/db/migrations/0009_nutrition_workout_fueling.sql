-- Phase 9: Recovery & Fueling Depth — extends pulse_nutrition_logs for workout fueling
-- Additive only.

ALTER TABLE "pulse_nutrition_logs"
  ADD COLUMN IF NOT EXISTS "workout_id"   UUID REFERENCES "pulse_planned_workouts"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "activity_id"  UUID REFERENCES "pulse_activities"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "context"      VARCHAR(20),    -- pre | during | post | daily
  ADD COLUMN IF NOT EXISTS "gels_count"   INTEGER,
  ADD COLUMN IF NOT EXISTS "drinks_ml"    INTEGER,
  ADD COLUMN IF NOT EXISTS "sodium_mg"    INTEGER,
  ADD COLUMN IF NOT EXISTS "notes"        TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pulse_nutrition_logs_context_check') THEN
    ALTER TABLE "pulse_nutrition_logs"
      ADD CONSTRAINT "pulse_nutrition_logs_context_check"
      CHECK ("context" IS NULL OR "context" IN ('pre','during','post','daily'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "pulse_nutrition_logs_workout_idx"
  ON "pulse_nutrition_logs" ("workout_id");

CREATE INDEX IF NOT EXISTS "pulse_nutrition_logs_activity_idx"
  ON "pulse_nutrition_logs" ("activity_id");
