-- Phase 6: Health States & Adaptive Plan
-- Additive only (CLAUDE.md rule 2)

CREATE TABLE IF NOT EXISTS "pulse_health_state" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"      UUID NOT NULL,
  "type"         VARCHAR(20) NOT NULL,
  "severity"     VARCHAR(20) NOT NULL,
  "body_part"    VARCHAR(50),
  "notes"        TEXT,
  "start_date"   DATE NOT NULL,
  "end_date"     DATE,
  "resolved_at"  TIMESTAMP,
  "created_at"   TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "pulse_health_state_type_check"
    CHECK ("type" IN ('illness','injury','fatigue','travel')),
  CONSTRAINT "pulse_health_state_severity_check"
    CHECK ("severity" IN ('mild','moderate','severe'))
);

CREATE INDEX IF NOT EXISTS "pulse_health_state_user_active_idx"
  ON "pulse_health_state" ("user_id", "end_date")
  WHERE "resolved_at" IS NULL;

ALTER TABLE "pulse_planned_workouts"
  ADD COLUMN IF NOT EXISTS "original_zone"         INTEGER,
  ADD COLUMN IF NOT EXISTS "original_duration_min" INTEGER,
  ADD COLUMN IF NOT EXISTS "adjusted_reason"       VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "adjusted_at"           TIMESTAMP;
