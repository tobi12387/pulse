CREATE TABLE IF NOT EXISTS "pulse_adaptation_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_date" date NOT NULL,
  "kind" varchar(48) NOT NULL,
  "source_id" varchar(128) NOT NULL DEFAULT '',
  "severity" varchar(16) NOT NULL,
  "recommendation" varchar(48) NOT NULL,
  "summary" text NOT NULL,
  "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pulse_adaptation_events_unique_source_idx"
  ON "pulse_adaptation_events" ("user_id", "event_date", "kind", "source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pulse_adaptation_events_open_idx"
  ON "pulse_adaptation_events" ("user_id", "event_date", "resolved_at");
