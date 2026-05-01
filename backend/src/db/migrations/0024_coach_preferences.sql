CREATE TABLE IF NOT EXISTS "pulse_coach_preferences" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "time_windows" TEXT NOT NULL DEFAULT '',
  "disliked_workout_patterns" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "preferred_long_days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "injury_sensitive_constraints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "communication_style" VARCHAR(32) NOT NULL DEFAULT 'data_first',
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
