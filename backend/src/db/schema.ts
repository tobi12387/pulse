import {
  pgTable, uuid, text, varchar, integer, real,
  timestamp, date, jsonb, index, uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  settings: jsonb('settings').$type<{
    availableDays?: number[];
    maxWeeklyHours?: number;
    llmModel?: string;
    garminUserId?: string;
    garminAccessToken?: string;
    garminRefreshToken?: string;
    garminTokenExpiresAt?: string;
  }>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Garmin Health ────────────────────────────────────────────────────────────
export const garminDailyHealth = pgTable('garmin_daily_health', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  hrvRmssd: real('hrv_rmssd'),
  hrvStatus: varchar('hrv_status', { length: 50 }),
  sleepDurationH: real('sleep_duration_h'),
  sleepScore: integer('sleep_score'),
  restingHr: integer('resting_hr'),
  steps: integer('steps'),
  caloriesActive: integer('calories_active'),
  bodyBatteryMin: integer('body_battery_min'),
  bodyBatteryMax: integer('body_battery_max'),
  stressAvg: integer('stress_avg'),
  syncedAt: timestamp('synced_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('garmin_health_user_date_idx').on(t.userId, t.date),
]);

export const garminActivities = pgTable('garmin_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  garminActivityId: varchar('garmin_activity_id', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  sportType: varchar('sport_type', { length: 50 }),
  subSportType: varchar('sub_sport_type', { length: 50 }),
  startTime: timestamp('start_time').notNull(),
  durationSec: integer('duration_sec'),
  distanceM: real('distance_m'),
  avgHr: integer('avg_hr'),
  maxHr: integer('max_hr'),
  calories: integer('calories'),
  trainingEffectAerobic: real('training_effect_aerobic'),
  trainingEffectAnaerobic: real('training_effect_anaerobic'),
  vo2maxEstimate: real('vo2max_estimate'),
});

// ─── Body Composition ─────────────────────────────────────────────────────────
export const weightLogs = pgTable('weight_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  weightKg: real('weight_kg').notNull(),
  bodyFatPct: real('body_fat_pct'),
  muscleMassKg: real('muscle_mass_kg'),
  source: varchar('source', { length: 20 }).notNull().default('manual'),
  note: text('note'),
}, (t) => [
  index('weight_logs_user_date_idx').on(t.userId, t.date),
]);

// ─── Nutrition ────────────────────────────────────────────────────────────────
export const nutritionLogs = pgTable('nutrition_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  loggedAt: timestamp('logged_at').notNull().defaultNow(),
  mealType: varchar('meal_type', { length: 20 }).notNull(),
  qualityTier: integer('quality_tier').notNull(),
  description: text('description'),
});

// ─── Check-ins ───────────────────────────────────────────────────────────────
export const weeklyCheckins = pgTable('weekly_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekStart: date('week_start').notNull(),
  stressLevel: integer('stress_level').notNull(),
  energyLevel: integer('energy_level').notNull(),
  mood: integer('mood').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Training Plan ────────────────────────────────────────────────────────────
export const weeklyPlans = pgTable('weekly_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekStart: date('week_start').notNull(),
  phase: integer('phase').notNull(),
  weeklyTss: integer('weekly_tss').notNull(),
  notes: text('notes'),
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('weekly_plans_user_week_idx').on(t.userId, t.weekStart),
]);

export const trainingSessions = pgTable('training_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weeklyPlanId: uuid('weekly_plan_id').references(() => weeklyPlans.id, { onDelete: 'set null' }),
  plannedDate: date('planned_date').notNull(),
  sportType: varchar('sport_type', { length: 50 }).notNull(),
  zone: integer('zone').notNull(),
  durationMin: integer('duration_min').notNull(),
  distanceKm: real('distance_km'),
  status: varchar('status', { length: 20 }).notNull().default('planned'),
  garminActivityId: varchar('garmin_activity_id', { length: 100 }),
  actualDurationMin: integer('actual_duration_min'),
  actualHrAvg: integer('actual_hr_avg'),
});

// ─── Daily Check-ins (Phase 2) ────────────────────────────────────────────────
export const checkIns = pgTable('check_ins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  energyLevel: integer('energy_level').notNull(),
  stressLevel: integer('stress_level').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('check_ins_user_date_idx').on(t.userId, t.date),
]);

export const dailyBriefings = pgTable('daily_briefings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  triggerType: varchar('trigger_type', { length: 30 }).notNull(),
  garminSnapshot: jsonb('garmin_snapshot'),
  checkinSnapshot: jsonb('checkin_snapshot'),
  briefingText: text('briefing_text').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('daily_briefings_user_date_idx').on(t.userId, t.date),
]);

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 10 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('chat_messages_user_created_idx').on(t.userId, t.createdAt),
]);

// ─── Coach & Chat ─────────────────────────────────────────────────────────────
export const coachMessages = pgTable('coach_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 10 }).notNull(),
  content: text('content').notNull(),
  triggerType: varchar('trigger_type', { length: 30 }).notNull().default('chat'),
  triggerReason: varchar('trigger_reason', { length: 100 }),
  evidenceIds: integer('evidence_ids').array().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  readAt: timestamp('read_at'),
});

// ─── Diary ────────────────────────────────────────────────────────────────────
export const diaryEntries = pgTable('diary_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  content: text('content').notNull(),
  sessionId: uuid('session_id').references(() => trainingSessions.id, { onDelete: 'set null' }),
  moodAfter: integer('mood_after'),
});

// ─── Insights ─────────────────────────────────────────────────────────────────
export const insights = pgTable('insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
  insightType: varchar('insight_type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  confidence: real('confidence').notNull(),
  dataPoints: jsonb('data_points').notNull().default({}),
});

// ─── Evidence Engine ──────────────────────────────────────────────────────────
export const evidencePapers = pgTable('evidence_papers', {
  id: uuid('id').primaryKey().defaultRandom(),
  doi: varchar('doi', { length: 255 }).unique(),
  title: text('title').notNull(),
  authors: text('authors'),
  journal: varchar('journal', { length: 255 }),
  publishedYear: integer('published_year'),
  abstract: text('abstract'),
  domain: varchar('domain', { length: 100 }).notNull(),
  relevanceScore: real('relevance_score').notNull().default(0),
  qualityScore: real('quality_score').notNull().default(0),
  freshnessScore: real('freshness_score').notNull().default(0),
  compositeScore: real('composite_score').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('candidate'),
  layer: varchar('layer', { length: 5 }).notNull().default('B'),
  source: varchar('source', { length: 50 }),
  lastCheckedAt: timestamp('last_checked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const evidenceItems = pgTable('evidence_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  paperId: uuid('paper_id').notNull().references(() => evidencePapers.id, { onDelete: 'cascade' }),
  claim: text('claim').notNull(),
  context: text('context'),
  domain: varchar('domain', { length: 100 }).notNull(),
  tags: text('tags').array().notNull().default([]),
  activatedAt: timestamp('activated_at').notNull().defaultNow(),
});
