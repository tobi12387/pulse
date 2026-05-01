CREATE TABLE IF NOT EXISTS "pulse_plan_generations" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"           UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "week_start"        DATE NOT NULL,
  "input_snapshot"    JSONB NOT NULL,
  "plan_decision"     JSONB NOT NULL,
  "sport_mix"         JSONB NOT NULL,
  "hard_days"         JSONB NOT NULL,
  "generated_summary" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at"        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_plan_generations_user_week"
  ON "pulse_plan_generations" ("user_id", "week_start", "created_at" DESC);
