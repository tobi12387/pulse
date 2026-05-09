CREATE TABLE IF NOT EXISTS "pulse_training_capability_levels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "energy_system" varchar(40) NOT NULL,
  "label" varchar(80) NOT NULL,
  "level" real DEFAULT 2 NOT NULL,
  "confidence" varchar(16) DEFAULT 'low' NOT NULL,
  "evidence" text[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  "signals" text[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  "source_window_days" integer DEFAULT 90 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pulse_training_capability_levels_user_system_uq"
  ON "pulse_training_capability_levels" ("user_id", "energy_system");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pulse_training_capability_levels_user_updated_idx"
  ON "pulse_training_capability_levels" ("user_id", "updated_at");
