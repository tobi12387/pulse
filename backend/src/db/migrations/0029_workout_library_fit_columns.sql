ALTER TABLE "pulse_planned_workouts" ADD COLUMN IF NOT EXISTS "archetype_id" varchar(80);
--> statement-breakpoint
ALTER TABLE "pulse_planned_workouts" ADD COLUMN IF NOT EXISTS "difficulty_level" real;
--> statement-breakpoint
ALTER TABLE "pulse_planned_workouts" ADD COLUMN IF NOT EXISTS "difficulty_energy_system" varchar(40);
--> statement-breakpoint
ALTER TABLE "pulse_planned_workouts" ADD COLUMN IF NOT EXISTS "capability_fit" varchar(32);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pulse_planned_workouts_user_archetype_idx"
  ON "pulse_planned_workouts" ("user_id", "archetype_id");
