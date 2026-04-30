CREATE TABLE IF NOT EXISTS "pulse_strava_tokens" (
  "user_id"       UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "access_token"  TEXT NOT NULL,
  "refresh_token" TEXT NOT NULL,
  "expires_at"    TIMESTAMP NOT NULL,
  "athlete_id"    INTEGER,
  "updated_at"    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "pulse_weight_log" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date"           DATE NOT NULL,
  "weight_kg"      REAL NOT NULL,
  "body_fat_pct"   REAL,
  "muscle_mass_kg" REAL,
  "bmi"            REAL,
  "source"         VARCHAR(20) DEFAULT 'manual',
  "notes"          TEXT,
  "created_at"     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "pulse_weight_log_user_date_idx"
  ON "pulse_weight_log" ("user_id", "date");
