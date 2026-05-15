ALTER TABLE "pulse_nutrition_logs"
  ADD COLUMN IF NOT EXISTS "ambient_temp_c" REAL,
  ADD COLUMN IF NOT EXISTS "sweat_rate_l_per_hour" REAL;
