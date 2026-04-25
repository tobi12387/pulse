CREATE TYPE "public"."pulse_activity_type" AS ENUM('run', 'bike', 'swim', 'strength', 'hike', 'other');--> statement-breakpoint
CREATE TYPE "public"."pulse_goal_status" AS ENUM('active', 'completed', 'paused', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."pulse_insight_source" AS ENUM('rule', 'llm');--> statement-breakpoint
CREATE TYPE "public"."pulse_sleep_quality" AS ENUM('poor', 'fair', 'good', 'excellent');--> statement-breakpoint
CREATE TABLE "pulse_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"external_id" varchar(100),
	"source" varchar(20) DEFAULT 'garmin' NOT NULL,
	"start_time" timestamp NOT NULL,
	"activity_type" "pulse_activity_type" NOT NULL,
	"name" varchar(255),
	"duration_sec" integer,
	"distance_m" real,
	"avg_hr" integer,
	"max_hr" integer,
	"avg_power_w" integer,
	"normalized_power_w" integer,
	"tss" real,
	"calories" integer,
	"elevation_gain_m" real,
	"training_effect_aerobic" real,
	"training_effect_anaerobic" real,
	"vo2max_estimate" real,
	"raw_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "pulse_apple_health_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"record_count" integer,
	"date_range" jsonb,
	"status" varchar(20) DEFAULT 'processed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"external_id" varchar(255),
	"title" varchar(255) NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"all_day" boolean DEFAULT false NOT NULL,
	"stress_impact" integer DEFAULT 0,
	"source" varchar(20) DEFAULT 'google' NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_coach_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_snapshot" jsonb
);
--> statement-breakpoint
CREATE TABLE "pulse_daily_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"hrv_rmssd" real,
	"hrv_status" varchar(20),
	"resting_hr" integer,
	"sleep_hours" real,
	"sleep_score" integer,
	"body_battery_min" integer,
	"body_battery_max" integer,
	"stress_avg" integer,
	"steps" integer,
	"calories_active" integer,
	"source" varchar(20) DEFAULT 'garmin' NOT NULL,
	"raw_data" jsonb,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_garmin_tokens" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"target_date" date,
	"status" "pulse_goal_status" DEFAULT 'active' NOT NULL,
	"progress" real DEFAULT 0,
	"metrics" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_insights_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"metric_key" varchar(100) NOT NULL,
	"insight" text NOT NULL,
	"source" "pulse_insight_source" NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_mental_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"mood" integer NOT NULL,
	"energy" integer NOT NULL,
	"stress" integer NOT NULL,
	"motivation" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_nutrition_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal_type" varchar(30),
	"description" text,
	"calories" integer,
	"protein_g" real,
	"carbs_g" real,
	"fat_g" real,
	"quality_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_planned_workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"planned_date" date NOT NULL,
	"activity_type" "pulse_activity_type" NOT NULL,
	"zone" integer NOT NULL,
	"duration_min" integer NOT NULL,
	"distance_km" real,
	"target_tss" real,
	"description" text,
	"status" varchar(20) DEFAULT 'planned' NOT NULL,
	"completed_activity_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_sleep_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_time" timestamp,
	"end_time" timestamp,
	"duration_h" real,
	"deep_sleep_h" real,
	"rem_sleep_h" real,
	"light_sleep_h" real,
	"awake_h" real,
	"sleep_score" integer,
	"quality" "pulse_sleep_quality",
	"source" varchar(20) DEFAULT 'garmin' NOT NULL,
	"raw_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "pulse_user_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"ftp_watts" integer,
	"max_hr_bpm" integer,
	"resting_hr_bpm" integer,
	"weight_kg" real,
	"vo2max" real,
	"training_phase" varchar(20) DEFAULT 'base',
	"weekly_hours_target" real,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"narrative" text NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pulse_activities_user_start_idx" ON "pulse_activities" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE UNIQUE INDEX "pulse_activities_external_source_idx" ON "pulse_activities" USING btree ("external_id","source");--> statement-breakpoint
CREATE INDEX "pulse_calendar_events_user_start_idx" ON "pulse_calendar_events" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "pulse_coach_sessions_user_last_idx" ON "pulse_coach_sessions" USING btree ("user_id","last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pulse_daily_metrics_user_date_idx" ON "pulse_daily_metrics" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "pulse_insights_cache_user_key_idx" ON "pulse_insights_cache" USING btree ("user_id","metric_key");--> statement-breakpoint
CREATE UNIQUE INDEX "pulse_mental_checkins_user_date_idx" ON "pulse_mental_checkins" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "pulse_nutrition_logs_user_date_idx" ON "pulse_nutrition_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "pulse_planned_workouts_user_date_idx" ON "pulse_planned_workouts" USING btree ("user_id","planned_date");--> statement-breakpoint
CREATE UNIQUE INDEX "pulse_sleep_sessions_user_date_idx" ON "pulse_sleep_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "pulse_weekly_reviews_user_week_idx" ON "pulse_weekly_reviews" USING btree ("user_id","week_start");--> statement-breakpoint
ALTER TABLE "pulse_activities" ADD CONSTRAINT "pulse_activities_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_apple_health_uploads" ADD CONSTRAINT "pulse_apple_health_uploads_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_calendar_events" ADD CONSTRAINT "pulse_calendar_events_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_coach_sessions" ADD CONSTRAINT "pulse_coach_sessions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_daily_metrics" ADD CONSTRAINT "pulse_daily_metrics_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_garmin_tokens" ADD CONSTRAINT "pulse_garmin_tokens_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_goals" ADD CONSTRAINT "pulse_goals_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_insights_cache" ADD CONSTRAINT "pulse_insights_cache_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_mental_checkins" ADD CONSTRAINT "pulse_mental_checkins_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_nutrition_logs" ADD CONSTRAINT "pulse_nutrition_logs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_planned_workouts" ADD CONSTRAINT "pulse_planned_workouts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_sleep_sessions" ADD CONSTRAINT "pulse_sleep_sessions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_user_profile" ADD CONSTRAINT "pulse_user_profile_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pulse_weekly_reviews" ADD CONSTRAINT "pulse_weekly_reviews_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;