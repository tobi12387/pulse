ALTER TABLE "pulse_activities"
  ADD COLUMN IF NOT EXISTS "garmin_detail_data" JSONB,
  ADD COLUMN IF NOT EXISTS "garmin_laps" JSONB,
  ADD COLUMN IF NOT EXISTS "garmin_hr_zones" JSONB,
  ADD COLUMN IF NOT EXISTS "garmin_detail_synced_at" TIMESTAMPTZ;

UPDATE "pulse_activities"
SET
  "garmin_laps" = CASE
    WHEN "garmin_laps" IS NULL AND jsonb_typeof("raw_data"->'laps') = 'array' THEN "raw_data"->'laps'
    ELSE "garmin_laps"
  END,
  "garmin_hr_zones" = CASE
    WHEN "garmin_hr_zones" IS NULL AND jsonb_typeof("raw_data"->'hrZones') = 'array' THEN "raw_data"->'hrZones'
    ELSE "garmin_hr_zones"
  END,
  "garmin_detail_data" = COALESCE(
    "garmin_detail_data",
    jsonb_build_object('source', 'legacy_raw_data', 'rawData', "raw_data")
  ),
  "garmin_detail_synced_at" = COALESCE("garmin_detail_synced_at", now())
WHERE "source" = 'garmin'
  AND "raw_data" IS NOT NULL
  AND (
    jsonb_typeof("raw_data"->'laps') = 'array'
    OR jsonb_typeof("raw_data"->'hrZones') = 'array'
  );
