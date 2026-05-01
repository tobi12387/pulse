CREATE TABLE IF NOT EXISTS "pulse_action_decisions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source" VARCHAR(64) NOT NULL DEFAULT 'next_best_action',
  "source_id" VARCHAR(255),
  "kind" VARCHAR(40) NOT NULL DEFAULT 'manual',
  "title" TEXT NOT NULL DEFAULT '',
  "status" VARCHAR(20) NOT NULL DEFAULT 'open',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "resolved_at" TIMESTAMPTZ,
  "resolution_reason" TEXT,
  "target_route" VARCHAR(255),
  "raw_context" JSONB NOT NULL DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_action_decisions_user_status"
  ON "pulse_action_decisions" ("user_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_action_decisions_user_source"
  ON "pulse_action_decisions" ("user_id", "source", "source_id");
