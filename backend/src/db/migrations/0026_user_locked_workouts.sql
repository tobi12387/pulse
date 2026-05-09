ALTER TABLE "pulse_planned_workouts"
  ADD COLUMN IF NOT EXISTS "origin" VARCHAR(20) NOT NULL DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS "user_locked" BOOLEAN NOT NULL DEFAULT false;
