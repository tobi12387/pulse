CREATE TABLE IF NOT EXISTS "pulse_risk_signals" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"         UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rule_id"         VARCHAR(64) NOT NULL,
  "severity"        VARCHAR(16) NOT NULL,
  "status"          VARCHAR(16) NOT NULL DEFAULT 'active',
  "title"           VARCHAR(255) NOT NULL,
  "description"     TEXT NOT NULL,
  "recommendation"  TEXT NOT NULL,
  "metric_snapshot" JSONB NOT NULL,
  "triggered_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "resolved_at"     TIMESTAMPTZ,
  "snoozed_until"   TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ DEFAULT now(),
  "updated_at"      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_risk_active"
  ON "pulse_risk_signals" ("user_id", "status", "severity")
  WHERE "status" = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "uq_risk_active_rule"
  ON "pulse_risk_signals" ("user_id", "rule_id")
  WHERE "status" = 'active';
