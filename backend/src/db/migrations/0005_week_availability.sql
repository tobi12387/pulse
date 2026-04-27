CREATE TABLE "pulse_week_availability" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "week_start" DATE NOT NULL,
  "available_days" JSONB NOT NULL DEFAULT '[1,3,5,6]',
  "weekly_hours" REAL NOT NULL DEFAULT 8,
  "notes" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  CONSTRAINT "pulse_week_availability_user_week_uq" UNIQUE ("user_id", "week_start")
);
CREATE INDEX "pulse_week_availability_user_idx" ON "pulse_week_availability" ("user_id", "week_start");
ALTER TABLE "pulse_goals" ADD COLUMN IF NOT EXISTS "category" VARCHAR(30);
