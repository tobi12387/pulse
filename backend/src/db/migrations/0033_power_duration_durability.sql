CREATE TABLE IF NOT EXISTS "pulse_power_duration_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "activity_id" uuid NOT NULL REFERENCES "pulse_activities"("id") ON DELETE CASCADE,
  "activity_date" date NOT NULL,
  "best_efforts" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "durability" jsonb,
  "quality_source" varchar(32) NOT NULL DEFAULT 'unavailable',
  "quality_status" varchar(32) NOT NULL DEFAULT 'blocked',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pulse_power_duration_activity_uq"
  ON "pulse_power_duration_snapshots" ("activity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pulse_power_duration_user_date_idx"
  ON "pulse_power_duration_snapshots" ("user_id", "activity_date" DESC);
