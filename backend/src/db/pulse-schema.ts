import {
  pgTable, pgEnum, uuid, text, varchar, integer, real,
  timestamp, date, jsonb, boolean, index, uniqueIndex,
} from 'drizzle-orm/pg-core';

// FK to users.id is enforced at DB level via migration SQL — not via Drizzle
// references() because drizzle-kit cannot resolve cross-file .js imports.

export interface WorkoutStep {
  type: 'warmup' | 'interval' | 'rest' | 'cooldown' | 'steady';
  durationMin: number;
  zone: number;
  reps?: number;
  restMin?: number;
  description?: string;
}

// ─── ENUMs (all prefixed pulse_) ─────────────────────────────────────────────
export const pulseSleepQualityEnum = pgEnum('pulse_sleep_quality', [
  'poor', 'fair', 'good', 'excellent',
]);
export const pulseActivityTypeEnum = pgEnum('pulse_activity_type', [
  'run', 'bike', 'swim', 'strength', 'hike', 'other',
]);
export const pulseGoalStatusEnum = pgEnum('pulse_goal_status', [
  'active', 'completed', 'paused', 'abandoned',
]);
export const pulseInsightSourceEnum = pgEnum('pulse_insight_source', [
  'rule', 'llm',
]);

// ─── User profile extension ───────────────────────────────────────────────────
export const pulseUserProfile = pgTable('pulse_user_profile', {
  userId:            uuid('user_id').primaryKey().notNull(),
  ftpWatts:          integer('ftp_watts'),
  maxHrBpm:          integer('max_hr_bpm'),
  lthrBpm:           integer('lthr_bpm'),
  restingHrBpm:      integer('resting_hr_bpm'),
  weightKg:          real('weight_kg'),
  vo2max:            real('vo2max'),
  trainingPhase:     varchar('training_phase', { length: 20 }).default('base'),
  weeklyHoursTarget: real('weekly_hours_target'),
  homeLat:           real('home_lat'),
  homeLon:           real('home_lon'),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
});

// ─── Daily metrics (Garmin/Apple Health data per day) ────────────────────────
export const pulseDailyMetrics = pgTable('pulse_daily_metrics', {
  id:              uuid('id').primaryKey().defaultRandom(),
  userId:          uuid('user_id').notNull(),
  date:            date('date').notNull(),
  hrvRmssd:        real('hrv_rmssd'),
  hrvStatus:       varchar('hrv_status', { length: 20 }),
  restingHr:       integer('resting_hr'),
  sleepHours:      real('sleep_hours'),
  sleepScore:      integer('sleep_score'),
  bodyBatteryMin:  integer('body_battery_min'),
  bodyBatteryMax:  integer('body_battery_max'),
  stressAvg:       integer('stress_avg'),
  steps:           integer('steps'),
  caloriesActive:  integer('calories_active'),
  source:          varchar('source', { length: 20 }).notNull().default('garmin'),
  rawData:         jsonb('raw_data'),
  syncedAt:        timestamp('synced_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('pulse_daily_metrics_user_date_idx').on(t.userId, t.date),
]);

// ─── Sleep sessions (detailed stages) ────────────────────────────────────────
export const pulseSleepSessions = pgTable('pulse_sleep_sessions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull(),
  date:        date('date').notNull(),
  startTime:   timestamp('start_time'),
  endTime:     timestamp('end_time'),
  durationH:   real('duration_h'),
  deepSleepH:  real('deep_sleep_h'),
  remSleepH:   real('rem_sleep_h'),
  lightSleepH: real('light_sleep_h'),
  awakeH:      real('awake_h'),
  sleepScore:  integer('sleep_score'),
  quality:     pulseSleepQualityEnum('quality'),
  source:      varchar('source', { length: 20 }).notNull().default('garmin'),
  rawData:     jsonb('raw_data'),
}, (t) => [
  uniqueIndex('pulse_sleep_sessions_user_date_idx').on(t.userId, t.date),
]);

// ─── Activities (with TSS for training load) ──────────────────────────────────
export const pulseActivities = pgTable('pulse_activities', {
  id:                       uuid('id').primaryKey().defaultRandom(),
  userId:                   uuid('user_id').notNull(),
  externalId:               varchar('external_id', { length: 100 }),
  source:                   varchar('source', { length: 20 }).notNull().default('garmin'),
  startTime:                timestamp('start_time').notNull(),
  activityType:             pulseActivityTypeEnum('activity_type').notNull(),
  name:                     varchar('name', { length: 255 }),
  durationSec:              integer('duration_sec'),
  distanceM:                real('distance_m'),
  avgHr:                    integer('avg_hr'),
  maxHr:                    integer('max_hr'),
  avgPowerW:                integer('avg_power_w'),
  normalizedPowerW:         integer('normalized_power_w'),
  tss:                      real('tss'),
  calories:                 integer('calories'),
  elevationGainM:           real('elevation_gain_m'),
  trainingEffectAerobic:    real('training_effect_aerobic'),
  trainingEffectAnaerobic:  real('training_effect_anaerobic'),
  vo2maxEstimate:           real('vo2max_estimate'),
  startLat:                 real('start_lat'),
  startLon:                 real('start_lon'),
  isIndoor:                 boolean('is_indoor').default(false),
  weather:                  jsonb('weather'),
  rawData:                  jsonb('raw_data'),
}, (t) => [
  index('pulse_activities_user_start_idx').on(t.userId, t.startTime),
  uniqueIndex('pulse_activities_external_source_idx').on(t.externalId, t.source),
]);

// ─── Activity streams (1Hz time-series) ──────────────────────────────────────
export const pulseActivityStreams = pgTable('pulse_activity_streams', {
  activityId:     uuid('activity_id').primaryKey().notNull(),
  durationSec:    integer('duration_sec').notNull(),
  sampleRateHz:   real('sample_rate_hz').notNull().default(1),
  hrStream:       integer('hr_stream').array(),
  paceStream:     real('pace_stream').array(),
  speedStream:    real('speed_stream').array(),
  powerStream:    integer('power_stream').array(),
  altitudeStream: integer('altitude_stream').array(),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
});

// ─── Activity analytics cache (EF, decoupling, drift) ────────────────────────
export const pulseActivityAnalytics = pgTable('pulse_activity_analytics', {
  activityId:        uuid('activity_id').primaryKey().notNull(),
  ef:                real('ef'),
  efUnit:            varchar('ef_unit', { length: 20 }),
  decouplingPct:     real('decoupling_pct'),
  firstHalfRatio:    real('first_half_ratio'),
  secondHalfRatio:   real('second_half_ratio'),
  hrDriftBpm:        real('hr_drift_bpm'),
  computedAt:        timestamp('computed_at').notNull().defaultNow(),
});

// ─── Planned workouts (training plan) ────────────────────────────────────────
export const pulsePlannedWorkouts = pgTable('pulse_planned_workouts', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  userId:               uuid('user_id').notNull(),
  plannedDate:          date('planned_date').notNull(),
  activityType:         pulseActivityTypeEnum('activity_type').notNull(),
  zone:                 integer('zone').notNull(),
  durationMin:          integer('duration_min').notNull(),
  distanceKm:           real('distance_km'),
  targetTss:            real('target_tss'),
  description:          text('description'),
  steps:                jsonb('steps').$type<WorkoutStep[]>(),
  garminWorkoutId:      varchar('garmin_workout_id', { length: 64 }),
  garminScheduledId:    varchar('garmin_scheduled_id', { length: 64 }),
  status:               varchar('status', { length: 20 }).notNull().default('planned'),
  completedActivityId:  uuid('completed_activity_id'),
  workoutFeedback:      text('workout_feedback'),
  complianceScore:      real('compliance_score'),
  originalZone:         integer('original_zone'),
  originalDurationMin:  integer('original_duration_min'),
  adjustedReason:       varchar('adjusted_reason', { length: 30 }),
  adjustedAt:           timestamp('adjusted_at'),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('pulse_planned_workouts_user_date_idx').on(t.userId, t.plannedDate),
]);

// ─── Health states (illness, injury, fatigue, travel) ────────────────────────
export const pulseHealthState = pgTable('pulse_health_state', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull(),
  type:        varchar('type', { length: 20 }).notNull(),         // illness | injury | fatigue | travel
  severity:    varchar('severity', { length: 20 }).notNull(),     // mild | moderate | severe
  bodyPart:    varchar('body_part', { length: 50 }),
  notes:       text('notes'),
  startDate:   date('start_date').notNull(),
  endDate:     date('end_date'),
  resolvedAt:  timestamp('resolved_at'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('pulse_health_state_user_active_idx').on(t.userId, t.endDate),
]);

// ─── Mental check-ins ─────────────────────────────────────────────────────────
export const pulseMentalCheckins = pgTable('pulse_mental_checkins', {
  id:              uuid('id').primaryKey().defaultRandom(),
  userId:          uuid('user_id').notNull(),
  date:            date('date').notNull(),
  mood:            integer('mood').notNull(),
  energy:          integer('energy').notNull(),
  stress:          integer('stress').notNull(),
  motivation:      integer('motivation').notNull(),
  notes:           text('notes'),
  themes:          text('themes').array(),
  source:          text('source').default('text'),
  coachQuestions:  jsonb('coach_questions'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('pulse_mental_checkins_user_date_idx').on(t.userId, t.date),
]);

// ─── Calendar events ──────────────────────────────────────────────────────────
export const pulseCalendarEvents = pgTable('pulse_calendar_events', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull(),
  externalId:   varchar('external_id', { length: 255 }),
  title:        varchar('title', { length: 255 }).notNull(),
  startTime:    timestamp('start_time').notNull(),
  endTime:      timestamp('end_time'),
  allDay:       boolean('all_day').notNull().default(false),
  stressImpact: integer('stress_impact').default(0),
  source:       varchar('source', { length: 20 }).notNull().default('google'),
  syncedAt:     timestamp('synced_at').notNull().defaultNow(),
}, (t) => [
  index('pulse_calendar_events_user_start_idx').on(t.userId, t.startTime),
]);

// ─── Coach sessions (chat with JSONB messages) ────────────────────────────────
export const pulseCoachSessions = pgTable('pulse_coach_sessions', {
  id:              uuid('id').primaryKey().defaultRandom(),
  userId:          uuid('user_id').notNull(),
  startedAt:       timestamp('started_at').notNull().defaultNow(),
  lastMessageAt:   timestamp('last_message_at').notNull().defaultNow(),
  messages:        jsonb('messages').notNull().default([]),
  contextSnapshot: jsonb('context_snapshot'),
}, (t) => [
  index('pulse_coach_sessions_user_last_idx').on(t.userId, t.lastMessageAt),
]);

// ─── Goals ────────────────────────────────────────────────────────────────────
export const pulseGoals = pgTable('pulse_goals', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  userId:             uuid('user_id').notNull(),
  title:              varchar('title', { length: 255 }).notNull(),
  description:        text('description'),
  targetDate:         date('target_date'),
  status:             pulseGoalStatusEnum('status').notNull().default('active'),
  progress:           real('progress').default(0),
  metrics:            jsonb('metrics').default({}),
  category:           varchar('category', { length: 30 }),
  // Race-specific (only meaningful when category='race')
  raceDiscipline:     varchar('race_discipline', { length: 30 }),
  raceDistanceKm:     real('race_distance_km'),
  raceTargetTimeSec:  integer('race_target_time_sec'),
  racePriority:       varchar('race_priority', { length: 1 }),  // A | B | C
  raceLocation:       varchar('race_location', { length: 255 }),
  raceNotes:          text('race_notes'),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
  updatedAt:          timestamp('updated_at').notNull().defaultNow(),
});

// ─── Week availability ────────────────────────────────────────────────────────
export const pulseWeekAvailability = pgTable('pulse_week_availability', {
  id:            uuid('id').primaryKey().defaultRandom(),
  userId:        uuid('user_id').notNull(),
  weekStart:     date('week_start').notNull(),
  availableDays: jsonb('available_days').notNull().$type<number[]>().default([1, 3, 5, 6]),
  weeklyHours:   real('weekly_hours').notNull().default(8),
  notes:         text('notes'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('pulse_week_availability_user_week_uq').on(t.userId, t.weekStart),
]);

// ─── Nutrition logs ───────────────────────────────────────────────────────────
export const pulseNutritionLogs = pgTable('pulse_nutrition_logs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull(),
  date:         date('date').notNull(),
  mealType:     varchar('meal_type', { length: 30 }),
  description:  text('description'),
  calories:     integer('calories'),
  proteinG:     real('protein_g'),
  carbsG:       real('carbs_g'),
  fatG:         real('fat_g'),
  qualityScore: integer('quality_score'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('pulse_nutrition_logs_user_date_idx').on(t.userId, t.date),
]);

// ─── Insights cache ───────────────────────────────────────────────────────────
export const pulseInsightsCache = pgTable('pulse_insights_cache', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull(),
  metricKey: varchar('metric_key', { length: 100 }).notNull(),
  insight:   text('insight').notNull(),
  source:    pulseInsightSourceEnum('source').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('pulse_insights_cache_user_key_idx').on(t.userId, t.metricKey),
]);

// ─── Garmin OAuth tokens (for sidecar auth) ───────────────────────────────────
export const pulseGarminTokens = pgTable('pulse_garmin_tokens', {
  userId:       uuid('user_id').primaryKey().notNull(),
  accessToken:  text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt:    timestamp('expires_at'),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
});

// ─── Strava OAuth tokens ──────────────────────────────────────────────────────
export const pulseStravaTokens = pgTable('pulse_strava_tokens', {
  userId:       uuid('user_id').primaryKey().notNull(),
  accessToken:  text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt:    timestamp('expires_at').notNull(),
  athleteId:    integer('athlete_id'),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
});

// ─── Apple Health uploads ─────────────────────────────────────────────────────
export const pulseAppleHealthUploads = pgTable('pulse_apple_health_uploads', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull(),
  uploadedAt:  timestamp('uploaded_at').notNull().defaultNow(),
  recordCount: integer('record_count'),
  dateRange:   jsonb('date_range'),
  status:      varchar('status', { length: 20 }).notNull().default('processed'),
});

// ─── Weight log ───────────────────────────────────────────────────────────────
export const pulseWeightLog = pgTable('pulse_weight_log', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull(),
  date:         date('date').notNull(),
  weightKg:     real('weight_kg').notNull(),
  bodyFatPct:   real('body_fat_pct'),
  muscleMassKg: real('muscle_mass_kg'),
  bmi:          real('bmi'),
  source:       varchar('source', { length: 20 }).default('manual'),
  notes:        text('notes'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('pulse_weight_log_user_date_idx').on(t.userId, t.date),
]);

// ─── Weekly reviews (LLM-generated) ──────────────────────────────────────────
export const pulseWeeklyReviews = pgTable('pulse_weekly_reviews', {
  id:              uuid('id').primaryKey().defaultRandom(),
  userId:          uuid('user_id').notNull(),
  weekStart:       date('week_start').notNull(),
  weekEnd:         date('week_end').notNull(),
  narrative:       text('narrative').notNull(),
  metrics:         jsonb('metrics').notNull().default({}),
  recommendations: jsonb('recommendations').notNull().default([]),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('pulse_weekly_reviews_user_week_idx').on(t.userId, t.weekStart),
]);
