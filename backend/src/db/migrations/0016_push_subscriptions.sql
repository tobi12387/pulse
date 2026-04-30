CREATE TABLE IF NOT EXISTS "pulse_push_subscriptions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "device_label" VARCHAR(64),
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "last_success_at" TIMESTAMPTZ,
  "last_error_at" TIMESTAMPTZ,
  "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT now(),
  "updated_at" TIMESTAMPTZ DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pulse_push_subscriptions_endpoint_idx"
  ON "pulse_push_subscriptions" ("endpoint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_push_user_enabled"
  ON "pulse_push_subscriptions" ("user_id")
  WHERE "enabled" = TRUE;
--> statement-breakpoint
ALTER TABLE "pulse_user_profile"
  ADD COLUMN IF NOT EXISTS "push_topics" JSONB NOT NULL DEFAULT '{"briefing":true,"checkin_reminder":true,"risk_critical":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS "push_quiet_start" TIME NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS "push_quiet_end" TIME NOT NULL DEFAULT '06:30';
