ALTER TABLE "pulse_planned_workouts"
  ADD COLUMN IF NOT EXISTS "execution_status" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "execution_matched_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "execution_match_confidence" REAL,
  ADD COLUMN IF NOT EXISTS "execution_notes" TEXT;

UPDATE "pulse_planned_workouts"
SET
  "execution_status" = 'completed_matched',
  "execution_matched_at" = COALESCE("execution_matched_at", now()),
  "execution_match_confidence" = COALESCE("execution_match_confidence", 1),
  "execution_notes" = COALESCE("execution_notes", 'Vorhandene abgeschlossene Einheit wurde als Garmin-Ausfuehrung uebernommen.')
WHERE "completed_activity_id" IS NOT NULL
  AND "execution_status" IS NULL;

UPDATE "pulse_planned_workouts"
SET
  "execution_status" = CASE
    WHEN "garmin_scheduled_id" IS NOT NULL THEN 'garmin_scheduled'
    WHEN "garmin_workout_id" IS NOT NULL THEN 'garmin_template'
    ELSE "execution_status"
  END,
  "execution_notes" = CASE
    WHEN "garmin_scheduled_id" IS NOT NULL THEN COALESCE("execution_notes", 'Workout ist auf Garmin im Kalender geplant.')
    WHEN "garmin_workout_id" IS NOT NULL THEN COALESCE("execution_notes", 'Workout-Vorlage ist auf Garmin, aber kein Kalendertermin ist bekannt.')
    ELSE "execution_notes"
  END
WHERE "status" = 'planned'
  AND "execution_status" IS NULL
  AND ("garmin_workout_id" IS NOT NULL OR "garmin_scheduled_id" IS NOT NULL);
