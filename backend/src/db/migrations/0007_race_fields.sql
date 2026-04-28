-- Phase 7: Race Mode — extends pulse_goals with race-specific fields.
-- Additive only.

ALTER TABLE "pulse_goals"
  ADD COLUMN IF NOT EXISTS "race_discipline"      VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "race_distance_km"     REAL,
  ADD COLUMN IF NOT EXISTS "race_target_time_sec" INTEGER,
  ADD COLUMN IF NOT EXISTS "race_priority"        VARCHAR(1) DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS "race_location"        VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "race_notes"           TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pulse_goals_race_discipline_check') THEN
    ALTER TABLE "pulse_goals"
      ADD CONSTRAINT "pulse_goals_race_discipline_check"
      CHECK ("race_discipline" IS NULL OR "race_discipline" IN
        ('run','bike','swim','triathlon_sprint','triathlon_olympic','triathlon_70_3','triathlon_140_6','duathlon','other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pulse_goals_race_priority_check') THEN
    ALTER TABLE "pulse_goals"
      ADD CONSTRAINT "pulse_goals_race_priority_check"
      CHECK ("race_priority" IS NULL OR "race_priority" IN ('A','B','C'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "pulse_goals_user_race_target_idx"
  ON "pulse_goals" ("user_id", "target_date")
  WHERE "category" = 'race' AND "status" = 'active';
