CREATE TABLE IF NOT EXISTS "pulse_strength_session" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"            UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "planned_workout_id" UUID REFERENCES "pulse_planned_workouts"("id") ON DELETE SET NULL,
  "date"               DATE NOT NULL,
  "duration_min"       INT,
  "notes"              TEXT,
  "created_at"         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "pulse_strength_set" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id"  UUID NOT NULL REFERENCES "pulse_strength_session"("id") ON DELETE CASCADE,
  "exercise"    TEXT NOT NULL,
  "set_number"  INT NOT NULL CHECK ("set_number" > 0),
  "reps"        INT NOT NULL CHECK ("reps" > 0),
  "weight_kg"   REAL CHECK ("weight_kg" IS NULL OR "weight_kg" >= 0),
  "rpe"         SMALLINT CHECK ("rpe" IS NULL OR ("rpe" >= 1 AND "rpe" <= 10)),
  "e1rm_kg"     REAL CHECK ("e1rm_kg" IS NULL OR "e1rm_kg" >= 0)
);

CREATE INDEX IF NOT EXISTS "idx_strength_session_user_date"
  ON "pulse_strength_session" ("user_id", "date");

CREATE INDEX IF NOT EXISTS "idx_strength_set_session"
  ON "pulse_strength_set" ("session_id");

CREATE TABLE IF NOT EXISTS "pulse_equipment" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"             UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name"                TEXT NOT NULL,
  "category"            TEXT NOT NULL CHECK ("category" IN ('chain','tire','brake_pad','cassette','running_shoe','bike','wetsuit','other')),
  "parent_equipment_id" UUID REFERENCES "pulse_equipment"("id") ON DELETE SET NULL,
  "activity_types"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "installed_date"      DATE NOT NULL,
  "initial_km"          REAL DEFAULT 0,
  "retirement_km"       REAL,
  "retirement_date"     DATE,
  "retired_at"          TIMESTAMPTZ,
  "notes"               TEXT,
  "created_at"          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "pulse_equipment_activity" (
  "equipment_id" UUID NOT NULL REFERENCES "pulse_equipment"("id") ON DELETE CASCADE,
  "activity_id"  UUID NOT NULL REFERENCES "pulse_activities"("id") ON DELETE CASCADE,
  "km_added"     REAL NOT NULL CHECK ("km_added" >= 0),
  PRIMARY KEY ("equipment_id", "activity_id")
);

CREATE TABLE IF NOT EXISTS "pulse_equipment_default" (
  "user_id"      UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "activity_type" TEXT NOT NULL CHECK ("activity_type" IN ('run','bike','swim','strength','hike','other')),
  "equipment_id" UUID NOT NULL REFERENCES "pulse_equipment"("id") ON DELETE CASCADE,
  PRIMARY KEY ("user_id", "activity_type")
);

CREATE INDEX IF NOT EXISTS "idx_equipment_user_active"
  ON "pulse_equipment" ("user_id")
  WHERE "retired_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_equipment_activity_activity"
  ON "pulse_equipment_activity" ("activity_id");
