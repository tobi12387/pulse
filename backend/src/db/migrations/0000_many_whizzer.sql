CREATE TABLE "coach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(10) NOT NULL,
	"content" text NOT NULL,
	"trigger_type" varchar(30) DEFAULT 'chat' NOT NULL,
	"trigger_reason" varchar(100),
	"evidence_ids" integer[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "diary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"content" text NOT NULL,
	"session_id" uuid,
	"mood_after" integer
);
--> statement-breakpoint
CREATE TABLE "evidence_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "evidence_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"paper_id" uuid NOT NULL,
	"claim" text NOT NULL,
	"context" text,
	"domain" varchar(100) NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doi" varchar(255),
	"title" text NOT NULL,
	"authors" text,
	"journal" varchar(255),
	"published_year" integer,
	"abstract" text,
	"domain" varchar(100) NOT NULL,
	"relevance_score" real DEFAULT 0 NOT NULL,
	"quality_score" real DEFAULT 0 NOT NULL,
	"freshness_score" real DEFAULT 0 NOT NULL,
	"composite_score" real DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'candidate' NOT NULL,
	"layer" varchar(5) DEFAULT 'B' NOT NULL,
	"source" varchar(50),
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_papers_doi_unique" UNIQUE("doi")
);
--> statement-breakpoint
CREATE TABLE "garmin_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"garmin_activity_id" varchar(100) NOT NULL,
	"name" varchar(255),
	"sport_type" varchar(50),
	"sub_sport_type" varchar(50),
	"start_time" timestamp NOT NULL,
	"duration_sec" integer,
	"distance_m" real,
	"avg_hr" integer,
	"max_hr" integer,
	"calories" integer,
	"training_effect_aerobic" real,
	"training_effect_anaerobic" real,
	"vo2max_estimate" real,
	CONSTRAINT "garmin_activities_garmin_activity_id_unique" UNIQUE("garmin_activity_id")
);
--> statement-breakpoint
CREATE TABLE "garmin_daily_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"hrv_rmssd" real,
	"hrv_status" varchar(50),
	"sleep_duration_h" real,
	"sleep_score" integer,
	"resting_hr" integer,
	"steps" integer,
	"calories_active" integer,
	"body_battery_min" integer,
	"body_battery_max" integer,
	"stress_avg" integer,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"insight_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"confidence" real NOT NULL,
	"data_points" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	"meal_type" varchar(20) NOT NULL,
	"quality_tier" integer NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"weekly_plan_id" uuid,
	"planned_date" date NOT NULL,
	"sport_type" varchar(50) NOT NULL,
	"zone" integer NOT NULL,
	"duration_min" integer NOT NULL,
	"distance_km" real,
	"status" varchar(20) DEFAULT 'planned' NOT NULL,
	"garmin_activity_id" varchar(100),
	"actual_duration_min" integer,
	"actual_hr_avg" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "weekly_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"stress_level" integer NOT NULL,
	"energy_level" integer NOT NULL,
	"mood" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"phase" integer NOT NULL,
	"weekly_tss" integer NOT NULL,
	"notes" text,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weight_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"weight_kg" real NOT NULL,
	"body_fat_pct" real,
	"muscle_mass_kg" real,
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_paper_id_evidence_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."evidence_papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garmin_activities" ADD CONSTRAINT "garmin_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garmin_daily_health" ADD CONSTRAINT "garmin_daily_health_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_logs" ADD CONSTRAINT "nutrition_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_weekly_plan_id_weekly_plans_id_fk" FOREIGN KEY ("weekly_plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_checkins" ADD CONSTRAINT "weekly_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "garmin_health_user_date_idx" ON "garmin_daily_health" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_plans_user_week_idx" ON "weekly_plans" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "weight_logs_user_date_idx" ON "weight_logs" USING btree ("user_id","date");