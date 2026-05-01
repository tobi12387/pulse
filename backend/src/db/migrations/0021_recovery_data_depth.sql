ALTER TABLE "pulse_daily_metrics"
  ADD COLUMN IF NOT EXISTS "body_battery_charged" INTEGER,
  ADD COLUMN IF NOT EXISTS "body_battery_drained" INTEGER,
  ADD COLUMN IF NOT EXISTS "body_battery_highest" INTEGER,
  ADD COLUMN IF NOT EXISTS "body_battery_lowest" INTEGER,
  ADD COLUMN IF NOT EXISTS "body_battery_at_wake" INTEGER,
  ADD COLUMN IF NOT EXISTS "max_stress" INTEGER,
  ADD COLUMN IF NOT EXISTS "low_stress_sec" INTEGER,
  ADD COLUMN IF NOT EXISTS "medium_stress_sec" INTEGER,
  ADD COLUMN IF NOT EXISTS "high_stress_sec" INTEGER,
  ADD COLUMN IF NOT EXISTS "moderate_intensity_min" INTEGER,
  ADD COLUMN IF NOT EXISTS "vigorous_intensity_min" INTEGER,
  ADD COLUMN IF NOT EXISTS "avg_waking_respiration" REAL,
  ADD COLUMN IF NOT EXISTS "latest_spo2" REAL;

ALTER TABLE "pulse_sleep_sessions"
  ADD COLUMN IF NOT EXISTS "sleep_need_min" INTEGER,
  ADD COLUMN IF NOT EXISTS "sleep_actual_min" INTEGER,
  ADD COLUMN IF NOT EXISTS "avg_sleep_stress" INTEGER,
  ADD COLUMN IF NOT EXISTS "avg_sleep_hr" INTEGER,
  ADD COLUMN IF NOT EXISTS "avg_respiration" REAL,
  ADD COLUMN IF NOT EXISTS "restless_moments" INTEGER,
  ADD COLUMN IF NOT EXISTS "body_battery_change" INTEGER,
  ADD COLUMN IF NOT EXISTS "breathing_disruption_index" REAL;
