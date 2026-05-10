CREATE TABLE IF NOT EXISTS "pulse_garmin_execution_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "planned_workout_id" uuid NOT NULL REFERENCES "pulse_planned_workouts"("id") ON DELETE CASCADE,
  "attempted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "operation" varchar(32) NOT NULL,
  "outcome" varchar(32) NOT NULL,
  "local_contract" jsonb,
  "remote_workout_id" varchar(128),
  "remote_scheduled_id" varchar(128),
  "payload_snapshot" jsonb,
  "issues" jsonb DEFAULT '[]'::jsonb,
  "error_message" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pulse_garmin_execution_ledger_workout_idx"
  ON "pulse_garmin_execution_ledger" ("planned_workout_id", "attempted_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pulse_garmin_execution_ledger_user_outcome_idx"
  ON "pulse_garmin_execution_ledger" ("user_id", "outcome", "attempted_at" DESC);
