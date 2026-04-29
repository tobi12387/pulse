-- Phase 8: Activity Intelligence — streams + weather
-- Additive only.

CREATE TABLE IF NOT EXISTS "pulse_activity_streams" (
  "activity_id"     UUID PRIMARY KEY REFERENCES "pulse_activities"("id") ON DELETE CASCADE,
  "duration_sec"    INTEGER NOT NULL,
  "sample_rate_hz"  REAL NOT NULL DEFAULT 1,
  "hr_stream"       INTEGER[],            -- bpm
  "pace_stream"     REAL[],               -- sec/km, NULL where speed=0 (e.g. coast)
  "speed_stream"    REAL[],               -- m/s
  "power_stream"    INTEGER[],            -- W (NULL when no power meter)
  "altitude_stream" INTEGER[],            -- m
  "created_at"      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Cache parsed analytics so we don't recompute on every load.
CREATE TABLE IF NOT EXISTS "pulse_activity_analytics" (
  "activity_id"             UUID PRIMARY KEY REFERENCES "pulse_activities"("id") ON DELETE CASCADE,
  "ef"                      REAL,           -- efficiency factor (pace_per_hr or NP/HR)
  "ef_unit"                 VARCHAR(20),    -- 'min/km/bpm' | 'W/bpm'
  "decoupling_pct"          REAL,           -- aerobic decoupling % (Pa:HR drift)
  "first_half_ratio"        REAL,
  "second_half_ratio"       REAL,
  "hr_drift_bpm"            REAL,           -- avg HR last 30min - first 30min (compare-to-self)
  "computed_at"             TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Per-activity weather snapshot (filled at Garmin sync time when location is available)
ALTER TABLE "pulse_activities"
  ADD COLUMN IF NOT EXISTS "weather"     JSONB,
  ADD COLUMN IF NOT EXISTS "start_lat"   REAL,
  ADD COLUMN IF NOT EXISTS "start_lon"   REAL,
  ADD COLUMN IF NOT EXISTS "is_indoor"   BOOLEAN DEFAULT FALSE;

-- Profile location for forecast lookups
ALTER TABLE "pulse_user_profile"
  ADD COLUMN IF NOT EXISTS "home_lat"        REAL,
  ADD COLUMN IF NOT EXISTS "home_lon"        REAL,
  ADD COLUMN IF NOT EXISTS "lthr_bpm"        INTEGER;

CREATE INDEX IF NOT EXISTS "pulse_activities_outdoor_idx"
  ON "pulse_activities" ("user_id", "start_time")
  WHERE "is_indoor" = FALSE;
