import {
  pgTable, pgEnum, uuid, text, varchar, integer, real,
  timestamp, date, jsonb, boolean, index, uniqueIndex, time, primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type {
  EquipmentCategory,
  PulseActivityType,
  PulseCoachCommunicationStyle,
  PulseCapabilityConfidence,
  PulseFuelingGuidanceStyle,
  PulseGarminSyncContract,
  PulsePlanDecision,
  PulsePlanTrace,
  PulsePushTopics,
  PulseTrainingEnergySystem,
  PulseTrainingProgressionSignal,
  PulseWorkoutFitLabel,
  WorkoutExecutionStatus,
} from '@coaching-os/shared/pulse';

// FK to users.id is enforced at DB level via migration SQL — not via Drizzle
// references() because drizzle-kit cannot resolve cross-file .js imports.

export interface WorkoutStep {
  type: 'warmup' | 'interval' | 'rest' | 'cooldown' | 'steady';
  durationMin: number;
  zone: number;
  reps?: number;
  restMin?: number;
  description?: string;
  targetHrMinBpm?: number;
  targetHrMaxBpm?: number;
  targetLabel?: string;
}

export interface GarminActivityLapCache {
  index: number;
  distanceM?: number | null;
  durationSec?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  avgPowerW?: number | null;
  avgSpeedMs?: number | null;
  elevationGainM?: number | null;
}

export interface GarminActivityHrZoneCache {
  zone: number;
  secsInZone: number;
  zoneLowBoundary: number | null;
}

export interface GarminActivityDetailCache {
  source: 'garmin' | 'legacy_raw_data';
  fetchedAt?: string;
  splits?: unknown;
  hrTimeInZones?: unknown;
  rawData?: unknown;
}

export const DEFAULT_PUSH_TOPICS: PulsePushTopics = {
  briefing: true,
  checkin_reminder: true,
  risk_critical: true,
};

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
  ftpWattsSource:    varchar('ftp_watts_source', { length: 32 }),
  ftpWattsUpdatedAt: timestamp('ftp_watts_updated_at', { withTimezone: true }),
  maxHrBpm:          integer('max_hr_bpm'),
  maxHrBpmSource:    varchar('max_hr_bpm_source', { length: 32 }),
  maxHrBpmUpdatedAt: timestamp('max_hr_bpm_updated_at', { withTimezone: true }),
  lthrBpm:           integer('lthr_bpm'),
  lthrBpmSource:     varchar('lthr_bpm_source', { length: 32 }),
  lthrBpmUpdatedAt:  timestamp('lthr_bpm_updated_at', { withTimezone: true }),
  restingHrBpm:      integer('resting_hr_bpm'),
  weightKg:          real('weight_kg'),
  vo2max:            real('vo2max'),
  vo2maxSource:      varchar('vo2max_source', { length: 32 }),
  vo2maxUpdatedAt:   timestamp('vo2max_updated_at', { withTimezone: true }),
  trainingPhase:     varchar('training_phase', { length: 20 }).default('base'),
  weeklyHoursTarget: real('weekly_hours_target'),
  fuelingEnabled:    boolean('fueling_enabled').notNull().default(true),
  dietaryConstraints: text('dietary_constraints').array().notNull().default(sql`ARRAY[]::TEXT[]`),
  preferredFuelingProducts: text('preferred_fueling_products').notNull().default('Ministry'),
  carbGuidanceStyle: varchar('carb_guidance_style', { length: 32 }).$type<PulseFuelingGuidanceStyle>().notNull().default('suggest_ranges'),
  sodiumGuidanceStyle: varchar('sodium_guidance_style', { length: 32 }).$type<PulseFuelingGuidanceStyle>().notNull().default('suggest_ranges'),
  bodyWeightGuidanceEnabled: boolean('body_weight_guidance_enabled').notNull().default(true),
  pushTopics:        jsonb('push_topics').$type<PulsePushTopics>().notNull().default(sql`'{"briefing":true,"checkin_reminder":true,"risk_critical":true}'::jsonb`),
  pushQuietStart:    time('push_quiet_start').notNull().default('22:00'),
  pushQuietEnd:      time('push_quiet_end').notNull().default('06:30'),
  homeLat:           real('home_lat'),
  homeLon:           real('home_lon'),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
});

// ─── Visible coach preferences ──────────────────────────────────────────────
export const pulseCoachPreferences = pgTable('pulse_coach_preferences', {
  userId:                     uuid('user_id').primaryKey().notNull(),
  timeWindows:                text('time_windows').notNull().default(''),
  dislikedWorkoutPatterns:    text('disliked_workout_patterns').array().notNull().default(sql`ARRAY[]::TEXT[]`),
  preferredLongDays:          integer('preferred_long_days').array().notNull().default(sql`ARRAY[]::INTEGER[]`),
  injurySensitiveConstraints: text('injury_sensitive_constraints').array().notNull().default(sql`ARRAY[]::TEXT[]`),
  communicationStyle:         varchar('communication_style', { length: 32 }).$type<PulseCoachCommunicationStyle>().notNull().default('data_first'),
  updatedAt:                  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Web Push subscriptions ─────────────────────────────────────────────────
export const pulsePushSubscriptions = pgTable('pulse_push_subscriptions', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  userId:              uuid('user_id').notNull(),
  endpoint:            text('endpoint').notNull(),
  p256dh:              text('p256dh').notNull(),
  auth:                text('auth').notNull(),
  deviceLabel:         varchar('device_label', { length: 64 }),
  enabled:             boolean('enabled').notNull().default(true),
  lastSuccessAt:       timestamp('last_success_at', { withTimezone: true }),
  lastErrorAt:         timestamp('last_error_at', { withTimezone: true }),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  createdAt:           timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  uniqueIndex('pulse_push_subscriptions_endpoint_idx').on(t.endpoint),
  index('idx_push_user_enabled').on(t.userId).where(sql`${t.enabled} = true`),
]);

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
  bodyBatteryCharged: integer('body_battery_charged'),
  bodyBatteryDrained: integer('body_battery_drained'),
  bodyBatteryHighest: integer('body_battery_highest'),
  bodyBatteryLowest: integer('body_battery_lowest'),
  bodyBatteryAtWake: integer('body_battery_at_wake'),
  stressAvg:       integer('stress_avg'),
  maxStress:       integer('max_stress'),
  lowStressSec:    integer('low_stress_sec'),
  mediumStressSec: integer('medium_stress_sec'),
  highStressSec:   integer('high_stress_sec'),
  moderateIntensityMin: integer('moderate_intensity_min'),
  vigorousIntensityMin: integer('vigorous_intensity_min'),
  avgWakingRespiration: real('avg_waking_respiration'),
  latestSpo2:      real('latest_spo2'),
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
  sleepNeedMin: integer('sleep_need_min'),
  sleepActualMin: integer('sleep_actual_min'),
  avgSleepStress: integer('avg_sleep_stress'),
  avgSleepHr: integer('avg_sleep_hr'),
  avgRespiration: real('avg_respiration'),
  restlessMoments: integer('restless_moments'),
  bodyBatteryChange: integer('body_battery_change'),
  breathingDisruptionIndex: real('breathing_disruption_index'),
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
  rpe:                      integer('rpe'),
  rpeNote:                  text('rpe_note'),
  sorenessAreas:            text('soreness_areas').array(),
  feedbackLoggedAt:         timestamp('feedback_logged_at', { withTimezone: true }),
  rawData:                  jsonb('raw_data'),
  garminDetailData:         jsonb('garmin_detail_data').$type<GarminActivityDetailCache>(),
  garminLaps:               jsonb('garmin_laps').$type<GarminActivityLapCache[]>(),
  garminHrZones:            jsonb('garmin_hr_zones').$type<GarminActivityHrZoneCache[]>(),
  garminDetailSyncedAt:     timestamp('garmin_detail_synced_at', { withTimezone: true }),
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

// ─── Risk Watch signals ─────────────────────────────────────────────────────
export const pulseRiskSignals = pgTable('pulse_risk_signals', {
  id:              uuid('id').primaryKey().defaultRandom(),
  userId:          uuid('user_id').notNull(),
  ruleId:          varchar('rule_id', { length: 64 }).notNull(),
  severity:        varchar('severity', { length: 16 }).notNull(),
  status:          varchar('status', { length: 16 }).notNull().default('active'),
  title:           varchar('title', { length: 255 }).notNull(),
  description:     text('description').notNull(),
  recommendation:  text('recommendation').notNull(),
  metricSnapshot:  jsonb('metric_snapshot').notNull(),
  triggeredAt:     timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:      timestamp('resolved_at', { withTimezone: true }),
  snoozedUntil:    timestamp('snoozed_until', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_risk_active').on(t.userId, t.status, t.severity),
]);

// ─── Action decision closure ────────────────────────────────────────────────
export const pulseActionDecisions = pgTable('pulse_action_decisions', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull(),
  source:           varchar('source', { length: 64 }).notNull().default('next_best_action'),
  sourceId:         varchar('source_id', { length: 255 }),
  kind:             varchar('kind', { length: 40 }).notNull().default('manual'),
  title:            text('title').notNull().default(''),
  status:           varchar('status', { length: 20 }).notNull().default('open'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:       timestamp('resolved_at', { withTimezone: true }),
  resolutionReason: text('resolution_reason'),
  targetRoute:      varchar('target_route', { length: 255 }),
  rawContext:       jsonb('raw_context').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  index('idx_action_decisions_user_status').on(t.userId, t.status, t.createdAt),
  index('idx_action_decisions_user_source').on(t.userId, t.source, t.sourceId),
]);

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
  archetypeId:          varchar('archetype_id', { length: 80 }),
  difficultyLevel:      real('difficulty_level'),
  difficultyEnergySystem: varchar('difficulty_energy_system', { length: 40 }).$type<PulseTrainingEnergySystem>(),
  capabilityFit:        varchar('capability_fit', { length: 32 }).$type<PulseWorkoutFitLabel>(),
  description:          text('description'),
  steps:                jsonb('steps').$type<WorkoutStep[]>(),
  garminWorkoutId:      varchar('garmin_workout_id', { length: 64 }),
  garminScheduledId:    varchar('garmin_scheduled_id', { length: 64 }),
  garminSyncContract:   jsonb('garmin_sync_contract').$type<PulseGarminSyncContract>(),
  status:               varchar('status', { length: 20 }).notNull().default('planned'),
  completedActivityId:  uuid('completed_activity_id'),
  executionStatus:      varchar('execution_status', { length: 40 }).$type<WorkoutExecutionStatus>(),
  executionMatchedAt:   timestamp('execution_matched_at', { withTimezone: true }),
  executionMatchConfidence: real('execution_match_confidence'),
  executionNotes:       text('execution_notes'),
  workoutFeedback:      text('workout_feedback'),
  complianceScore:      real('compliance_score'),
  origin:               varchar('origin', { length: 20 }).notNull().default('generated'),
  userLocked:           boolean('user_locked').notNull().default(false),
  originalZone:         integer('original_zone'),
  originalDurationMin:  integer('original_duration_min'),
  adjustedReason:       varchar('adjusted_reason', { length: 30 }),
  adjustedAt:           timestamp('adjusted_at'),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('pulse_planned_workouts_user_date_idx').on(t.userId, t.plannedDate),
]);

// ─── Plan generation trace ──────────────────────────────────────────────────
export const pulsePlanGenerations = pgTable('pulse_plan_generations', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull(),
  weekStart:        date('week_start').notNull(),
  inputSnapshot:    jsonb('input_snapshot').$type<PulsePlanTrace['inputSnapshot']>().notNull(),
  planDecision:     jsonb('plan_decision').$type<PulsePlanDecision>().notNull(),
  sportMix:         jsonb('sport_mix').$type<PulsePlanTrace['sportMix']>().notNull(),
  hardDays:         jsonb('hard_days').$type<PulsePlanTrace['hardDays']>().notNull(),
  generatedSummary: text('generated_summary').array().notNull().default(sql`ARRAY[]::TEXT[]`),
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_plan_generations_user_week').on(t.userId, t.weekStart, t.createdAt),
]);

// ─── Training capability levels ─────────────────────────────────────────────
export const pulseTrainingCapabilityLevels = pgTable('pulse_training_capability_levels', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull(),
  energySystem:     varchar('energy_system', { length: 40 }).$type<PulseTrainingEnergySystem>().notNull(),
  label:            varchar('label', { length: 80 }).notNull(),
  level:            real('level').notNull().default(2),
  confidence:       varchar('confidence', { length: 16 }).$type<PulseCapabilityConfidence>().notNull().default('low'),
  evidence:         text('evidence').array().notNull().default(sql`ARRAY[]::TEXT[]`),
  signals:          text('signals').array().$type<PulseTrainingProgressionSignal[]>().notNull().default(sql`ARRAY[]::TEXT[]`),
  sourceWindowDays: integer('source_window_days').notNull().default(90),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('pulse_training_capability_levels_user_system_uq').on(t.userId, t.energySystem),
  index('pulse_training_capability_levels_user_updated_idx').on(t.userId, t.updatedAt),
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
  // Phase 9: workout fueling
  workoutId:    uuid('workout_id'),
  activityId:   uuid('activity_id'),
  context:      varchar('context', { length: 20 }),    // pre | during | post | daily
  gelsCount:    integer('gels_count'),
  drinksMl:     integer('drinks_ml'),
  sodiumMg:     integer('sodium_mg'),
  bottles750Ml: real('bottles_750_ml'),
  powderG:      real('powder_g'),
  fuelingProducts: text('fueling_products').array().notNull().default(sql`ARRAY[]::TEXT[]`),
  giComfort:    varchar('gi_comfort', { length: 30 }),
  notes:        text('notes'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('pulse_nutrition_logs_user_date_idx').on(t.userId, t.date),
  index('pulse_nutrition_logs_workout_idx').on(t.workoutId),
]);

// ─── Strength sessions ──────────────────────────────────────────────────────
export const pulseStrengthSession = pgTable('pulse_strength_session', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull(),
  plannedWorkoutId: uuid('planned_workout_id'),
  date:             date('date').notNull(),
  durationMin:      integer('duration_min'),
  notes:            text('notes'),
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_strength_session_user_date').on(t.userId, t.date),
]);

export const pulseStrengthSet = pgTable('pulse_strength_set', {
  id:        uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),
  exercise:  text('exercise').notNull(),
  setNumber: integer('set_number').notNull(),
  reps:      integer('reps').notNull(),
  weightKg:  real('weight_kg'),
  rpe:       integer('rpe'),
  e1rmKg:    real('e1rm_kg'),
}, (t) => [
  index('idx_strength_set_session').on(t.sessionId),
]);

// ─── Equipment tracking ─────────────────────────────────────────────────────
export const pulseEquipment = pgTable('pulse_equipment', {
  id:                uuid('id').primaryKey().defaultRandom(),
  userId:            uuid('user_id').notNull(),
  name:              text('name').notNull(),
  category:          text('category').$type<EquipmentCategory>().notNull(),
  parentEquipmentId: uuid('parent_equipment_id'),
  activityTypes:     text('activity_types').array().$type<PulseActivityType[]>().notNull().default(sql`ARRAY[]::TEXT[]`),
  installedDate:     date('installed_date').notNull(),
  initialKm:         real('initial_km').default(0),
  retirementKm:      real('retirement_km'),
  retirementDate:    date('retirement_date'),
  retiredAt:         timestamp('retired_at', { withTimezone: true }),
  notes:             text('notes'),
  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_equipment_user_active').on(t.userId).where(sql`${t.retiredAt} IS NULL`),
]);

export const pulseEquipmentActivity = pgTable('pulse_equipment_activity', {
  equipmentId: uuid('equipment_id').notNull(),
  activityId:  uuid('activity_id').notNull(),
  kmAdded:     real('km_added').notNull(),
}, (t) => [
  primaryKey({ columns: [t.equipmentId, t.activityId] }),
  index('idx_equipment_activity_activity').on(t.activityId),
]);

export const pulseEquipmentDefault = pgTable('pulse_equipment_default', {
  userId:       uuid('user_id').notNull(),
  activityType: text('activity_type').$type<PulseActivityType>().notNull(),
  equipmentId:  uuid('equipment_id').notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.activityType] }),
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
