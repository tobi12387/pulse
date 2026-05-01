# Pulse Foundation (Phase 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Pulse infrastructure into Coaching OS v2 — DB schema, shared types, env vars, Docker garmin-sidecar, BullMQ queues, and a Fastify plugin skeleton at `/api/pulse/*`.

**Architecture:** All Pulse DB tables carry a `pulse_` prefix to avoid conflicts with existing v2 tables. The schema lives in `backend/src/db/pulse-schema.ts` (separate file, same Drizzle config). Five BullMQ queues run on the existing Redis instance. A Python FastAPI sidecar (`garmin-sidecar/`) handles Garmin OAuth — the backend calls it at `GARMIN_SIDECAR_URL`. The Fastify plugin at `/api/pulse/*` uses the existing `app.authenticate` JWT decorator.

**Tech Stack:** Drizzle ORM 0.45 + drizzle-kit 0.30, BullMQ 5, ioredis, Fastify 5, Zod, Python 3.11 + FastAPI

**Repo root:** `/root/coaching-os-v2`

---

## File Map

| Action | Path |
|--------|------|
| Create | `backend/src/db/pulse-schema.ts` |
| Modify | `backend/drizzle.config.ts` |
| Create | `backend/src/db/migrations/000X_pulse_tables.sql` (generated) |
| Create | `shared/src/pulse/types.ts` |
| Modify | `shared/package.json` |
| Modify | `backend/src/lib/env.ts` |
| Modify | `.env.example` |
| Modify | `docker-compose.yml` |
| Create | `garmin-sidecar/main.py` |
| Create | `garmin-sidecar/requirements.txt` |
| Create | `garmin-sidecar/Dockerfile` |
| Create | `backend/src/pulse/queues/queues.ts` |
| Create | `backend/src/pulse/queues/workers.ts` |
| Create | `backend/src/pulse/queues/workers.test.ts` |
| Create | `backend/src/pulse/plugin.ts` |
| Create | `backend/src/pulse/plugin.test.ts` |
| Modify | `backend/src/app.ts` |

---

## Task 1: Pulse DB Schema

**Files:**
- Create: `backend/src/db/pulse-schema.ts`
- Modify: `backend/drizzle.config.ts`
- Run: `npm run db:generate` then `npm run db:migrate`

- [ ] **Step 1: Create `backend/src/db/pulse-schema.ts`**

```typescript
import {
  pgTable, pgEnum, uuid, text, varchar, integer, real,
  timestamp, date, jsonb, boolean, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './schema.js';

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
  userId:            uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  ftpWatts:          integer('ftp_watts'),
  maxHrBpm:          integer('max_hr_bpm'),
  restingHrBpm:      integer('resting_hr_bpm'),
  weightKg:          real('weight_kg'),
  vo2max:            real('vo2max'),
  trainingPhase:     varchar('training_phase', { length: 20 }).default('base'),
  weeklyHoursTarget: real('weekly_hours_target'),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
});

// ─── Daily metrics (Garmin/Apple Health data per day) ────────────────────────
export const pulseDailyMetrics = pgTable('pulse_daily_metrics', {
  id:              uuid('id').primaryKey().defaultRandom(),
  userId:          uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId:                   uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  rawData:                  jsonb('raw_data'),
}, (t) => [
  index('pulse_activities_user_start_idx').on(t.userId, t.startTime),
  uniqueIndex('pulse_activities_external_source_idx').on(t.externalId, t.source),
]);

// ─── Planned workouts (training plan) ────────────────────────────────────────
export const pulsePlannedWorkouts = pgTable('pulse_planned_workouts', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  userId:               uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  plannedDate:          date('planned_date').notNull(),
  activityType:         pulseActivityTypeEnum('activity_type').notNull(),
  zone:                 integer('zone').notNull(),
  durationMin:          integer('duration_min').notNull(),
  distanceKm:           real('distance_km'),
  targetTss:            real('target_tss'),
  description:          text('description'),
  status:               varchar('status', { length: 20 }).notNull().default('planned'),
  completedActivityId:  uuid('completed_activity_id'),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('pulse_planned_workouts_user_date_idx').on(t.userId, t.plannedDate),
]);

// ─── Mental check-ins ─────────────────────────────────────────────────────────
export const pulseMentalCheckins = pgTable('pulse_mental_checkins', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date:       date('date').notNull(),
  mood:       integer('mood').notNull(),
  energy:     integer('energy').notNull(),
  stress:     integer('stress').notNull(),
  motivation: integer('motivation').notNull(),
  notes:      text('notes'),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('pulse_mental_checkins_user_date_idx').on(t.userId, t.date),
]);

// ─── Calendar events ──────────────────────────────────────────────────────────
export const pulseCalendarEvents = pgTable('pulse_calendar_events', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId:          uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startedAt:       timestamp('started_at').notNull().defaultNow(),
  lastMessageAt:   timestamp('last_message_at').notNull().defaultNow(),
  messages:        jsonb('messages').notNull().default([]),
  contextSnapshot: jsonb('context_snapshot'),
}, (t) => [
  index('pulse_coach_sessions_user_last_idx').on(t.userId, t.lastMessageAt),
]);

// ─── Goals ────────────────────────────────────────────────────────────────────
export const pulseGoals = pgTable('pulse_goals', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title:       varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  targetDate:  date('target_date'),
  status:      pulseGoalStatusEnum('status').notNull().default('active'),
  progress:    real('progress').default(0),
  metrics:     jsonb('metrics').default({}),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
});

// ─── Nutrition logs ───────────────────────────────────────────────────────────
export const pulseNutritionLogs = pgTable('pulse_nutrition_logs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId:       uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  accessToken:  text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt:    timestamp('expires_at'),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
});

// ─── Apple Health uploads ─────────────────────────────────────────────────────
export const pulseAppleHealthUploads = pgTable('pulse_apple_health_uploads', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  uploadedAt:  timestamp('uploaded_at').notNull().defaultNow(),
  recordCount: integer('record_count'),
  dateRange:   jsonb('date_range'),
  status:      varchar('status', { length: 20 }).notNull().default('processed'),
});

// ─── Weekly reviews (LLM-generated) ──────────────────────────────────────────
export const pulseWeeklyReviews = pgTable('pulse_weekly_reviews', {
  id:              uuid('id').primaryKey().defaultRandom(),
  userId:          uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekStart:       date('week_start').notNull(),
  weekEnd:         date('week_end').notNull(),
  narrative:       text('narrative').notNull(),
  metrics:         jsonb('metrics').notNull().default({}),
  recommendations: jsonb('recommendations').notNull().default([]),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('pulse_weekly_reviews_user_week_idx').on(t.userId, t.weekStart),
]);
```

- [ ] **Step 2: Update `backend/drizzle.config.ts` to include pulse schema**

Replace:
```typescript
schema: './src/db/schema.ts',
```
With:
```typescript
schema: ['./src/db/schema.ts', './src/db/pulse-schema.ts'],
```

Full updated file:
```typescript
import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';
config({ path: '../.env' });

export default defineConfig({
  schema: ['./src/db/schema.ts', './src/db/pulse-schema.ts'],
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run from `backend/`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Generate migration**

Run from `backend/`:
```bash
npm run db:generate
```
Expected: new migration file created in `backend/src/db/migrations/` named something like `0002_pulse_tables.sql`. It should contain `CREATE TABLE pulse_user_profile`, `CREATE TABLE pulse_daily_metrics`, etc.

- [ ] **Step 5: Apply migration**

Run from `backend/`:
```bash
npm run db:migrate
```
Expected: `All migrations applied successfully`

- [ ] **Step 6: Verify tables exist**

```bash
psql postgresql://postgres:postgres@localhost:5433/coaching_os_v2 -c "\dt pulse_*"
```
Expected: lists 14 `pulse_*` tables.

- [ ] **Step 7: Run existing tests to confirm no regression**

```bash
cd /root/coaching-os-v2/backend && npm test
```
Expected: all 52 tests pass.

- [ ] **Step 8: Commit**

```bash
git -C /root/coaching-os-v2 add backend/src/db/pulse-schema.ts backend/drizzle.config.ts backend/src/db/migrations/
git -C /root/coaching-os-v2 commit -m "feat: add pulse DB schema (14 tables, pulse_ prefix)"
```

---

## Task 2: Shared Types + Package Exports

**Files:**
- Create: `shared/types/pulse.ts` — NOTE: must be in `types/` not `src/`, because `shared/tsconfig.json` has `"include": ["types/**/*.ts"]`. A file under `src/` would not be compiled.
- Modify: `shared/package.json`

- [ ] **Step 1: Create `shared/types/pulse.ts`**

```typescript
// TypeScript interfaces for Pulse data — no Drizzle dependency.

export interface PulseDailyMetrics {
  id: string;
  userId: string;
  date: string;
  hrvRmssd: number | null;
  hrvStatus: 'poor' | 'below_normal' | 'normal' | 'above_normal' | null;
  restingHr: number | null;
  sleepHours: number | null;
  sleepScore: number | null;
  bodyBatteryMin: number | null;
  bodyBatteryMax: number | null;
  stressAvg: number | null;
  steps: number | null;
  caloriesActive: number | null;
  source: string;
  syncedAt: string;
}

export interface PulseSleepSession {
  id: string;
  userId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  durationH: number | null;
  deepSleepH: number | null;
  remSleepH: number | null;
  lightSleepH: number | null;
  awakeH: number | null;
  sleepScore: number | null;
  quality: 'poor' | 'fair' | 'good' | 'excellent' | null;
  source: string;
}

export interface PulseActivity {
  id: string;
  userId: string;
  externalId: string | null;
  source: string;
  startTime: string;
  activityType: 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';
  name: string | null;
  durationSec: number | null;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPowerW: number | null;
  normalizedPowerW: number | null;
  tss: number | null;
  calories: number | null;
  elevationGainM: number | null;
}

export interface PulsePlannedWorkout {
  id: string;
  userId: string;
  plannedDate: string;
  activityType: 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';
  zone: number;
  durationMin: number;
  distanceKm: number | null;
  targetTss: number | null;
  description: string | null;
  status: 'planned' | 'completed' | 'skipped';
}

export interface PulseMentalCheckin {
  id: string;
  userId: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
  notes: string | null;
  createdAt: string;
}

export interface PulseCoachMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface PulseCoachSession {
  id: string;
  userId: string;
  startedAt: string;
  lastMessageAt: string;
  messages: PulseCoachMessage[];
}

export interface PulseGoal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  progress: number;
  createdAt: string;
}

export interface PulseWeeklyReview {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  narrative: string;
  metrics: Record<string, unknown>;
  recommendations: string[];
  createdAt: string;
}

export interface PulseReadiness {
  score: number;
  components: {
    sleep: number;
    hrv: number;
    tsb: number;
    battery: number;
    mental: number;
    stress: number;
  };
  label: 'low' | 'moderate' | 'good' | 'excellent';
}

export interface PulseFitnessLoad {
  ctl: number;
  atl: number;
  tsb: number;
  date: string;
}

export interface PulseHomeScreenData {
  date: string;
  readiness: PulseReadiness;
  todayMetrics: PulseDailyMetrics | null;
  fitnessLoad: PulseFitnessLoad;
  recentActivities: PulseActivity[];
  nextWorkout: PulsePlannedWorkout | null;
}
```

- [ ] **Step 2: Update `shared/package.json` exports**

Add the `./pulse` export entry. Because the file is at `shared/types/pulse.ts`, tsc compiles it to `dist/types/pulse.js`:

```json
{
  "name": "@coaching-os/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/types/api.js",
  "types": "./dist/types/api.d.ts",
  "exports": {
    "./api":      { "import": "./dist/types/api.js",      "types": "./dist/types/api.d.ts" },
    "./coaching": { "import": "./dist/types/coaching.js", "types": "./dist/types/coaching.d.ts" },
    "./health":   { "import": "./dist/types/health.js",   "types": "./dist/types/health.d.ts" },
    "./coach":    { "import": "./dist/types/coach.js",    "types": "./dist/types/coach.d.ts" },
    "./pulse":    { "import": "./dist/types/pulse.js",    "types": "./dist/types/pulse.d.ts" }
  },
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Check `shared/tsconfig.json` includes the new file**

Read `shared/tsconfig.json`. If `include` is not set (or is `["**/*.ts"]`), no change needed — the compiler picks up all `.ts` files. If it has an explicit include list, add `"src/pulse/**/*.ts"`.

- [ ] **Step 4: Build shared package**

```bash
cd /root/coaching-os-v2/shared && npm run build
```
Expected: `dist/types/pulse.js` and `dist/types/pulse.d.ts` created (alongside existing `dist/types/api.js` etc.), no errors.

- [ ] **Step 5: Verify backend can import from `@coaching-os/shared/pulse`**

Add a temporary import at the top of `backend/src/app.ts`, compile, then remove it:
```typescript
import type { PulseReadiness } from '@coaching-os/shared/pulse'; // temp check
```
```bash
cd /root/coaching-os-v2/backend && npx tsc --noEmit
```
Expected: no errors. Remove the temporary import.

- [ ] **Step 6: Commit**

```bash
git -C /root/coaching-os-v2 add shared/types/pulse.ts shared/package.json shared/dist/
git -C /root/coaching-os-v2 commit -m "feat: add pulse shared types + package export"
```

---

## Task 3: Env Vars + Docker Compose + Python Sidecar

**Files:**
- Modify: `backend/src/lib/env.ts`
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Create: `garmin-sidecar/main.py`
- Create: `garmin-sidecar/requirements.txt`
- Create: `garmin-sidecar/Dockerfile`

- [ ] **Step 1: Add new env vars to `backend/src/lib/env.ts`**

Add four new fields to the `envSchema` object (after the existing `GARMIN_PASSWORD` line):

```typescript
GARMIN_SIDECAR_URL:    z.string().url().default('http://localhost:8001'),
GOOGLE_CLIENT_ID:      z.string().optional(),
GOOGLE_CLIENT_SECRET:  z.string().optional(),
APPLE_WEBHOOK_SECRET:  z.string().optional(),
LLM_MONTHLY_BUDGET_USD: z.coerce.number().default(50),
```

Full updated `env.ts`:
```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL:           z.string().min(1),
  DATABASE_URL_TEST:      z.string().min(1).optional(),
  REDIS_URL:              z.string().min(1).default('redis://localhost:6379'),
  JWT_SECRET:             z.string().min(32),
  OPENROUTER_API_KEY:     z.string().min(1),
  FAST_MODEL:             z.string().default('openai/gpt-5-mini'),
  SMART_MODEL:            z.string().default('openai/gpt-5.5'),
  PORT:                   z.coerce.number().default(3000),
  APP_URL:                z.string().url().default('http://localhost:3000'),
  NODE_ENV:               z.enum(['development', 'test', 'production']).default('development'),
  GARMIN_EMAIL:           z.string().email(),
  GARMIN_PASSWORD:        z.string().min(1),
  GARMIN_SIDECAR_URL:    z.string().url().default('http://localhost:8001'),
  GOOGLE_CLIENT_ID:      z.string().optional(),
  GOOGLE_CLIENT_SECRET:  z.string().optional(),
  APPLE_WEBHOOK_SECRET:  z.string().optional(),
  LLM_MONTHLY_BUDGET_USD: z.coerce.number().default(50),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Ungültige Umgebungsvariablen:');
    for (const [key, errors] of Object.entries(result.error.flatten().fieldErrors)) {
      console.error(`  ${key}: ${errors?.join(', ')}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;
```

- [ ] **Step 2: Add new vars to `.env.example`**

Append to `.env.example`:
```bash
# Pulse: Garmin Python sidecar
GARMIN_SIDECAR_URL=http://localhost:8001

# Pulse: Google Calendar (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Pulse: Apple Health webhook (optional)
APPLE_WEBHOOK_SECRET=

# Pulse: LLM budget guard
LLM_MONTHLY_BUDGET_USD=50
```

- [ ] **Step 3: Add garmin-sidecar service to `docker-compose.yml`**

Append the new service before the closing `volumes:` block:
```yaml
  garmin-sidecar:
    build: ./garmin-sidecar
    restart: unless-stopped
    ports:
      - "8001:8001"
    environment:
      PORT: "8001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

- [ ] **Step 4: Create `garmin-sidecar/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
garminconnect==0.2.22
python-dotenv==1.0.1
pydantic==2.8.2
httpx==0.27.2
```

- [ ] **Step 5: Create `garmin-sidecar/main.py`**

```python
import os
from datetime import date, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Garmin Sidecar", version="1.0.0")


class SyncRequest(BaseModel):
    date: str
    garmin_email: str
    garmin_password: str


class SyncResponse(BaseModel):
    status: str
    date: str
    hrv_rmssd: Optional[float] = None
    hrv_status: Optional[str] = None
    resting_hr: Optional[int] = None
    sleep_hours: Optional[float] = None
    sleep_score: Optional[int] = None
    body_battery_min: Optional[int] = None
    body_battery_max: Optional[int] = None
    stress_avg: Optional[int] = None
    steps: Optional[int] = None
    calories_active: Optional[int] = None
    sleep_deep_h: Optional[float] = None
    sleep_rem_h: Optional[float] = None
    sleep_light_h: Optional[float] = None
    sleep_awake_h: Optional[float] = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "garmin-sidecar"}


@app.post("/sync", response_model=SyncResponse)
async def sync(req: SyncRequest):
    try:
        from garminconnect import Garmin, GarminConnectAuthenticationError

        client = Garmin(req.garmin_email, req.garmin_password)
        client.login()

        target_date = req.date  # YYYY-MM-DD string

        result = SyncResponse(status="ok", date=target_date)

        # HRV data
        try:
            hrv_data = client.get_hrv_data(target_date)
            if hrv_data:
                summary = hrv_data.get("hrvSummary", {})
                result.hrv_rmssd = summary.get("lastNight")
                result.hrv_status = summary.get("status", "").lower().replace(" ", "_") or None
        except Exception as e:
            logger.warning(f"HRV fetch failed: {e}")

        # Sleep data
        try:
            sleep_data = client.get_sleep_data(target_date)
            if sleep_data:
                daily = sleep_data.get("dailySleepDTO", {})
                total_sec = daily.get("sleepTimeSeconds", 0)
                result.sleep_hours = round(total_sec / 3600, 2) if total_sec else None
                result.sleep_score = daily.get("sleepScores", {}).get("overall", {}).get("value")
                deep_sec = daily.get("deepSleepSeconds", 0)
                rem_sec = daily.get("remSleepSeconds", 0)
                light_sec = daily.get("lightSleepSeconds", 0)
                awake_sec = daily.get("awakeSleepSeconds", 0)
                result.sleep_deep_h = round(deep_sec / 3600, 2) if deep_sec else None
                result.sleep_rem_h = round(rem_sec / 3600, 2) if rem_sec else None
                result.sleep_light_h = round(light_sec / 3600, 2) if light_sec else None
                result.sleep_awake_h = round(awake_sec / 3600, 2) if awake_sec else None
        except Exception as e:
            logger.warning(f"Sleep fetch failed: {e}")

        # Stats (steps, stress, body battery, resting HR)
        try:
            stats = client.get_stats(target_date)
            if stats:
                result.resting_hr = stats.get("restingHeartRate")
                result.steps = stats.get("totalSteps")
                result.calories_active = stats.get("activeKilocalories")
                result.stress_avg = stats.get("averageStressLevel")
                result.body_battery_min = stats.get("minBodyBattery")
                result.body_battery_max = stats.get("maxBodyBattery")
        except Exception as e:
            logger.warning(f"Stats fetch failed: {e}")

        return result

    except Exception as e:
        logger.error(f"Garmin sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
```

- [ ] **Step 6: Create `garmin-sidecar/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8001

CMD ["python", "main.py"]
```

- [ ] **Step 7: Verify env.ts compiles**

```bash
cd /root/coaching-os-v2/backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Run existing tests**

```bash
cd /root/coaching-os-v2/backend && npm test
```
Expected: all 52 tests pass (env test may need `GARMIN_SIDECAR_URL` added to test env — check `backend/src/lib/env.test.ts` and `.env`).

Note: if the env test validates all vars, ensure `.env` has `GARMIN_SIDECAR_URL=http://localhost:8001`. It has a default so it should pass without the var set.

- [ ] **Step 9: Validate docker-compose syntax**

```bash
docker compose -f /root/coaching-os-v2/docker-compose.yml config --quiet
```
Expected: exits 0 (no output = valid).

- [ ] **Step 10: Commit**

```bash
git -C /root/coaching-os-v2 add backend/src/lib/env.ts .env.example docker-compose.yml garmin-sidecar/
git -C /root/coaching-os-v2 commit -m "feat: add pulse env vars, docker garmin-sidecar, python sidecar"
```

---

## Task 4: Pulse BullMQ Queues + Workers

**Files:**
- Create: `backend/src/pulse/queues/queues.ts`
- Create: `backend/src/pulse/queues/workers.ts`
- Create: `backend/src/pulse/queues/workers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/pulse/queues/workers.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/queue.js', () => ({
  createQueue: vi.fn(() => ({ add: vi.fn(), close: vi.fn() })),
  createWorker: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock('../../lib/env.js', () => ({
  env: {
    REDIS_URL: 'redis://localhost:6380',
    NODE_ENV: 'test',
    FAST_MODEL: 'test-model',
    SMART_MODEL: 'test-model',
    OPENROUTER_API_KEY: 'test-key',
    APP_URL: 'http://localhost:3000',
    GARMIN_SIDECAR_URL: 'http://localhost:8001',
    LLM_MONTHLY_BUDGET_USD: 50,
  },
}));

describe('pulse queue names', () => {
  it('exports the five queue name constants', async () => {
    const { PULSE_QUEUE_NAMES } = await import('./queues.js');
    expect(PULSE_QUEUE_NAMES).toEqual(expect.arrayContaining([
      'pulse-garmin-sync',
      'pulse-calendar-sync',
      'pulse-morning-brief',
      'pulse-weekly-review',
      'pulse-insight-precompute',
    ]));
  });
});

describe('startPulseWorkers', () => {
  it('returns a shutdown function', async () => {
    const { startPulseWorkers } = await import('./workers.js');
    const shutdown = startPulseWorkers();
    expect(typeof shutdown).toBe('function');
    await shutdown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/queues/workers.test.ts
```
Expected: FAIL — `Cannot find module './queues.js'`

- [ ] **Step 3: Create `backend/src/pulse/queues/queues.ts`**

```typescript
import { createQueue } from '../../lib/queue.js';
import type { Queue } from 'bullmq';

export const PULSE_QUEUE_NAMES = [
  'pulse-garmin-sync',
  'pulse-calendar-sync',
  'pulse-morning-brief',
  'pulse-weekly-review',
  'pulse-insight-precompute',
] as const;

export type PulseQueueName = typeof PULSE_QUEUE_NAMES[number];

export const pulseQueues: Record<PulseQueueName, Queue> = {
  'pulse-garmin-sync':        createQueue('pulse-garmin-sync'),
  'pulse-calendar-sync':      createQueue('pulse-calendar-sync'),
  'pulse-morning-brief':      createQueue('pulse-morning-brief'),
  'pulse-weekly-review':      createQueue('pulse-weekly-review'),
  'pulse-insight-precompute': createQueue('pulse-insight-precompute'),
};

export interface PulseJobData {
  userId: string;
  date?: string;
}
```

- [ ] **Step 4: Create `backend/src/pulse/queues/workers.ts`**

```typescript
import type { Job } from 'bullmq';
import { createWorker } from '../../lib/queue.js';
import type { Worker } from 'bullmq';
import { pulseQueues } from './queues.js';
import type { PulseJobData } from './queues.js';

async function handleGarminSync(job: Job<PulseJobData>): Promise<void> {
  const { userId, date } = job.data;
  const targetDate = date ?? new Date().toISOString().split('T')[0]!;
  console.log(`[pulse-garmin-sync] userId=${userId} date=${targetDate}`);
  // Phase 3b: call garmin adapter here
}

async function handleCalendarSync(job: Job<PulseJobData>): Promise<void> {
  const { userId } = job.data;
  console.log(`[pulse-calendar-sync] userId=${userId}`);
  // Phase 3b: call calendar adapter here
}

async function handleMorningBrief(job: Job<PulseJobData>): Promise<void> {
  const { userId } = job.data;
  console.log(`[pulse-morning-brief] userId=${userId}`);
  // Phase 3b: generate morning briefing here
}

async function handleWeeklyReview(job: Job<PulseJobData>): Promise<void> {
  const { userId } = job.data;
  console.log(`[pulse-weekly-review] userId=${userId}`);
  // Phase 3b: call review engine here
}

async function handleInsightPrecompute(job: Job<PulseJobData>): Promise<void> {
  const { userId } = job.data;
  console.log(`[pulse-insight-precompute] userId=${userId}`);
  // Phase 3b: call insight engine here
}

export function startPulseWorkers(): () => Promise<void> {
  const workers: Worker[] = [
    createWorker('pulse-garmin-sync',        handleGarminSync),
    createWorker('pulse-calendar-sync',      handleCalendarSync),
    createWorker('pulse-morning-brief',      handleMorningBrief),
    createWorker('pulse-weekly-review',      handleWeeklyReview),
    createWorker('pulse-insight-precompute', handleInsightPrecompute),
  ];

  return async () => {
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all(Object.values(pulseQueues).map((q) => q.close()));
  };
}

export async function registerRepeatableJobs(userId: string): Promise<void> {
  await pulseQueues['pulse-garmin-sync'].add(
    'sync',
    { userId },
    { repeat: { pattern: '0 * * * *', tz: 'Europe/Berlin' }, removeOnComplete: { count: 10 } },
  );
  await pulseQueues['pulse-morning-brief'].add(
    'brief',
    { userId },
    { repeat: { pattern: '0 6 * * *', tz: 'Europe/Berlin' }, removeOnComplete: { count: 10 } },
  );
  await pulseQueues['pulse-weekly-review'].add(
    'review',
    { userId },
    { repeat: { pattern: '0 19 * * 0', tz: 'Europe/Berlin' }, removeOnComplete: { count: 10 } },
  );
  await pulseQueues['pulse-insight-precompute'].add(
    'precompute',
    { userId },
    { repeat: { pattern: '30 6 * * *', tz: 'Europe/Berlin' }, removeOnComplete: { count: 10 } },
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/queues/workers.test.ts
```
Expected: 2 tests pass.

- [ ] **Step 6: Run all tests**

```bash
cd /root/coaching-os-v2/backend && npm test
```
Expected: all 54 tests pass.

- [ ] **Step 7: Commit**

```bash
git -C /root/coaching-os-v2 add backend/src/pulse/
git -C /root/coaching-os-v2 commit -m "feat: add pulse BullMQ queues + worker stubs"
```

---

## Task 5: Fastify Pulse Plugin + Register in App

**Files:**
- Create: `backend/src/pulse/plugin.ts`
- Create: `backend/src/pulse/plugin.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/pulse/plugin.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../lib/auth.js';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  app = await buildApp();
  await db.delete(users).where(eq(users.email, 'pulse-test@coaching.os'));
  const [u] = await db.insert(users).values({
    email: 'pulse-test@coaching.os',
    passwordHash: await hashPassword('TestPass123!'),
    name: 'Pulse Test',
  }).returning({ id: users.id });
  const res = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'pulse-test@coaching.os', password: 'TestPass123!' },
  });
  token = res.json<{ token: string }>().token;
  void u;
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, 'pulse-test@coaching.os'));
  await app.close();
});

describe('GET /api/pulse/health', () => {
  it('returns 200 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pulse/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', namespace: 'pulse' });
  });
});

describe('GET /api/pulse/home', () => {
  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pulse/home' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with token', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/home',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ date: string; readiness: { score: number } }>();
    expect(body).toHaveProperty('date');
    expect(body).toHaveProperty('readiness');
    expect(body.readiness).toHaveProperty('score');
  });
});

describe('POST /api/pulse/coach', () => {
  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/coach',
      payload: { message: 'Hallo' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for empty message', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/coach',
      payload: { message: '' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns coach reply for valid message', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/coach',
      payload: { message: 'Hallo' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ reply: string }>();
    expect(body).toHaveProperty('reply');
    expect(typeof body.reply).toBe('string');
    expect(body.reply.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/plugin.test.ts
```
Expected: FAIL — routes not registered, 404s.

- [ ] **Step 3: Create `backend/src/pulse/plugin.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import {
  pulseDailyMetrics,
  pulseMentalCheckins,
  pulseActivities,
  pulsePlannedWorkouts,
  pulseCoachSessions,
} from '../db/pulse-schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';
import type { PulseHomeScreenData, PulseReadiness, PulseCoachMessage } from '@coaching-os/shared/pulse';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeReadiness(metrics: {
  sleepHours: number | null;
  hrvStatus: string | null;
  bodyBatteryMax: number | null;
  stressAvg: number | null;
  mentalMood: number | null;
  mentalEnergy: number | null;
  mentalMotivation: number | null;
  mentalStress: number | null;
  tsb: number;
}): PulseReadiness {
  const sleep = metrics.sleepHours != null
    ? Math.min(metrics.sleepHours / 8, 1) * 100
    : 60;

  const hrv = metrics.hrvStatus != null ? ({
    poor: 25, below_normal: 50, balanced: 75, normal: 75, above_normal: 100,
  }[metrics.hrvStatus] ?? 60) : 60;

  const tsb = Math.max(0, Math.min(100, (metrics.tsb + 30) / 60 * 100));

  const battery = metrics.bodyBatteryMax ?? 60;

  const mental = metrics.mentalMood != null
    ? ((metrics.mentalMood + (metrics.mentalEnergy ?? 5) + (metrics.mentalMotivation ?? 5)) / 3) * 10
    : 60;

  const stress = metrics.stressAvg != null
    ? Math.max(0, (100 - metrics.stressAvg))
    : metrics.mentalStress != null
      ? (10 - metrics.mentalStress) * 10
      : 60;

  const score = Math.round(
    sleep  * 0.25 +
    hrv    * 0.25 +
    tsb    * 0.20 +
    battery * 0.15 +
    mental * 0.10 +
    stress * 0.05,
  );

  const label: PulseReadiness['label'] =
    score >= 80 ? 'excellent' :
    score >= 65 ? 'good' :
    score >= 45 ? 'moderate' : 'low';

  return {
    score,
    components: { sleep, hrv, tsb, battery, mental, stress },
    label,
  };
}

const coachMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

function simpleCoachReply(message: string, readiness: PulseReadiness): string {
  const m = message.toLowerCase();

  if (/^(hallo|hi|hey|guten morgen|servus|moin)/.test(m)) {
    return `Hallo! Deine heutige Readiness liegt bei ${readiness.score}/100 (${readiness.label}). Wie kann ich dir helfen?`;
  }
  if (/(schlaf|schlafen|müde)/.test(m)) {
    const s = Math.round(readiness.components.sleep);
    return `Dein Schlaf-Score heute: ${s}/100. ${s < 60 ? 'Lass heute das intensive Training lieber aus.' : 'Gute Basis für das Training!'}`;
  }
  if (/(hrv|herzrate|herzratenvariabil)/.test(m)) {
    return `Dein HRV-Score heute: ${Math.round(readiness.components.hrv)}/100. ${readiness.components.hrv < 50 ? 'Dein Nervensystem braucht Erholung.' : 'Dein Nervensystem ist gut erholt.'}`;
  }
  if (/(readiness|bereit|form|fit)/.test(m)) {
    return `Deine Readiness heute: ${readiness.score}/100 (${readiness.label}). ${readiness.score >= 70 ? 'Grünes Licht für hartes Training!' : readiness.score >= 50 ? 'Moderates Training ist ok.' : 'Heute lieber regenerieren.'}`;
  }
  if (/(trainingsplan|plan|woche|workout|training)/.test(m)) {
    return `Basierend auf deiner Readiness von ${readiness.score}/100 empfehle ich heute ${readiness.score >= 70 ? 'Intensivtraining (Zone 4-5).' : readiness.score >= 50 ? 'moderates Training (Zone 2-3).' : 'Regeneration oder leichtes Z1-Training.'}`;
  }
  if (/(erholung|recovery|regeneration|pause)/.test(m)) {
    return `Erholung ist genauso wichtig wie Training. Dein TSB liegt bei ${Math.round(readiness.components.tsb)}/100 — ${readiness.components.tsb < 40 ? 'du akkumulierst gerade Ermüdung, eine Pause wäre sinnvoll.' : 'du bist gut erholt.'}`;
  }

  return `Ich bin dein Pulse Coach. Du fragst: "${message}". Deine aktuelle Readiness ist ${readiness.score}/100. Was möchtest du konkret wissen — Training, Schlaf, HRV oder Erholung?`;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default async function pulsePlugin(app: FastifyInstance) {
  // Public health check
  app.get('/health', async () => ({ status: 'ok', namespace: 'pulse' }));

  // All routes below require JWT
  app.get('/home', { onRequest: [app.authenticate] }, async (req): Promise<PulseHomeScreenData> => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;

    // Today's metrics
    const [metrics] = await db.select()
      .from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), eq(pulseDailyMetrics.date, today)));

    // Today's mental check-in
    const [mental] = await db.select()
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));

    // Last 3 activities
    const recentActivities = await db.select()
      .from(pulseActivities)
      .where(eq(pulseActivities.userId, userId))
      .orderBy(desc(pulseActivities.startTime))
      .limit(3);

    // Next planned workout
    const [nextWorkout] = await db.select()
      .from(pulsePlannedWorkouts)
      .where(and(
        eq(pulsePlannedWorkouts.userId, userId),
        eq(pulsePlannedWorkouts.status, 'planned'),
        gte(pulsePlannedWorkouts.plannedDate, today),
      ))
      .orderBy(pulsePlannedWorkouts.plannedDate)
      .limit(1);

    const readiness = computeReadiness({
      sleepHours:        metrics?.sleepHours ?? null,
      hrvStatus:         metrics?.hrvStatus ?? null,
      bodyBatteryMax:    metrics?.bodyBatteryMax ?? null,
      stressAvg:         metrics?.stressAvg ?? null,
      mentalMood:        mental?.mood ?? null,
      mentalEnergy:      mental?.energy ?? null,
      mentalMotivation:  mental?.motivation ?? null,
      mentalStress:      mental?.stress ?? null,
      tsb:               0, // Phase 3b: compute from load engine
    });

    return {
      date: today,
      readiness,
      todayMetrics: metrics ? {
        id: metrics.id, userId: metrics.userId, date: metrics.date,
        hrvRmssd: metrics.hrvRmssd, hrvStatus: metrics.hrvStatus as any,
        restingHr: metrics.restingHr, sleepHours: metrics.sleepHours,
        sleepScore: metrics.sleepScore, bodyBatteryMin: metrics.bodyBatteryMin,
        bodyBatteryMax: metrics.bodyBatteryMax, stressAvg: metrics.stressAvg,
        steps: metrics.steps, caloriesActive: metrics.caloriesActive,
        source: metrics.source, syncedAt: metrics.syncedAt.toISOString(),
      } : null,
      fitnessLoad: { ctl: 0, atl: 0, tsb: 0, date: today }, // Phase 3b
      recentActivities: recentActivities.map((a) => ({
        id: a.id, userId: a.userId, externalId: a.externalId,
        source: a.source, startTime: a.startTime.toISOString(),
        activityType: a.activityType as any, name: a.name,
        durationSec: a.durationSec, distanceM: a.distanceM,
        avgHr: a.avgHr, maxHr: a.maxHr, avgPowerW: a.avgPowerW,
        normalizedPowerW: a.normalizedPowerW, tss: a.tss,
        calories: a.calories, elevationGainM: a.elevationGainM,
      })),
      nextWorkout: nextWorkout ? {
        id: nextWorkout.id, userId: nextWorkout.userId,
        plannedDate: nextWorkout.plannedDate, activityType: nextWorkout.activityType as any,
        zone: nextWorkout.zone, durationMin: nextWorkout.durationMin,
        distanceKm: nextWorkout.distanceKm, targetTss: nextWorkout.targetTss,
        description: nextWorkout.description, status: nextWorkout.status as any,
      } : null,
    };
  });

  app.post('/coach', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = coachMessageSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Nachricht' });

    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;

    const [metrics] = await db.select()
      .from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), eq(pulseDailyMetrics.date, today)));

    const [mental] = await db.select()
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));

    const readiness = computeReadiness({
      sleepHours: metrics?.sleepHours ?? null,
      hrvStatus: metrics?.hrvStatus ?? null,
      bodyBatteryMax: metrics?.bodyBatteryMax ?? null,
      stressAvg: metrics?.stressAvg ?? null,
      mentalMood: mental?.mood ?? null,
      mentalEnergy: mental?.energy ?? null,
      mentalMotivation: mental?.motivation ?? null,
      mentalStress: mental?.stress ?? null,
      tsb: 0,
    });

    const reply_text = simpleCoachReply(parsed.data.message, readiness);

    // Persist session
    const userMsg: PulseCoachMessage = {
      role: 'user',
      content: parsed.data.message,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: PulseCoachMessage = {
      role: 'assistant',
      content: reply_text,
      timestamp: new Date().toISOString(),
    };

    const [existingSession] = await db.select({ id: pulseCoachSessions.id, messages: pulseCoachSessions.messages })
      .from(pulseCoachSessions)
      .where(eq(pulseCoachSessions.userId, userId))
      .orderBy(desc(pulseCoachSessions.lastMessageAt))
      .limit(1);

    if (existingSession) {
      const msgs = (existingSession.messages as PulseCoachMessage[]);
      const updated = [...msgs.slice(-20), userMsg, assistantMsg];
      await db.update(pulseCoachSessions)
        .set({ messages: updated, lastMessageAt: new Date() })
        .where(eq(pulseCoachSessions.id, existingSession.id));
    } else {
      await db.insert(pulseCoachSessions).values({
        userId,
        messages: [userMsg, assistantMsg],
      });
    }

    return { reply: reply_text };
  });

  // Mental check-in
  app.post('/checkin', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      mood:       z.number().int().min(1).max(10),
      energy:     z.number().int().min(1).max(10),
      stress:     z.number().int().min(1).max(10),
      motivation: z.number().int().min(1).max(10),
      notes:      z.string().max(500).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const today = new Date().toISOString().split('T')[0]!;
    const userId = req.user.sub;

    const [existing] = await db.select({ id: pulseMentalCheckins.id })
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));
    if (existing) return reply.status(409).send({ error: 'Heute bereits eingecheckt' });

    const [checkin] = await db.insert(pulseMentalCheckins).values({
      userId, date: today, ...parsed.data, notes: parsed.data.notes ?? null,
    }).returning();

    return reply.status(201).send(checkin);
  });
}
```

- [ ] **Step 4: Register pulse plugin in `backend/src/app.ts`**

Add after the existing route registrations (before the health check `app.get('/api/ping', ...)`):
```typescript
await app.register(import('./pulse/plugin.js'), { prefix: '/api/pulse' });
```

Also add pulse workers in the `if (env.NODE_ENV !== 'test')` block:
```typescript
const { startPulseWorkers } = await import('./pulse/queues/workers.js');
const shutdownPulse = startPulseWorkers();
app.addHook('onClose', async () => { await shutdownPulse(); });
```

- [ ] **Step 5: Run the plugin tests**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/plugin.test.ts
```
Expected: 5 tests pass.

- [ ] **Step 6: Run all tests**

```bash
cd /root/coaching-os-v2/backend && npm test
```
Expected: all 57+ tests pass.

- [ ] **Step 7: Commit**

```bash
git -C /root/coaching-os-v2 add backend/src/pulse/plugin.ts backend/src/pulse/plugin.test.ts backend/src/app.ts
git -C /root/coaching-os-v2 commit -m "feat: add pulse Fastify plugin (/api/pulse/*) with home + coach + checkin routes"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Pulse DB tables (14, pulse_ prefix) | Task 1 |
| Drizzle config includes both schema files | Task 1 |
| Shared types export at `@coaching-os/shared/pulse` | Task 2 |
| Env vars: GARMIN_SIDECAR_URL, GOOGLE_*, APPLE_*, LLM_BUDGET | Task 3 |
| Docker garmin-sidecar service | Task 3 |
| Python sidecar: POST /sync, GET /health | Task 3 |
| BullMQ: 5 queues with correct names | Task 4 |
| BullMQ: workers + shutdown function | Task 4 |
| Fastify plugin at /api/pulse/* | Task 5 |
| JWT auth on protected routes | Task 5 |
| GET /api/pulse/health (public) | Task 5 |
| GET /api/pulse/home with readiness | Task 5 |
| POST /api/pulse/coach with rule-based replies | Task 5 |
| POST /api/pulse/checkin (mental) | Task 5 |
| All existing tests still pass | Tasks 1, 3, 4, 5 |

**Placeholder scan:** None found. All steps have complete code.

**Type consistency:** `PulseReadiness`, `PulseHomeScreenData`, `PulseCoachMessage` defined in Task 2 and used in Task 5 — names match.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-25-v2-phase3a-pulse-foundation.md`.**
