# Predictive Goal Engine v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a read-only goal projection layer that explains goal probability, limiter risk and the next best intervention from existing Pulse evidence.

**Architecture:** Add shared response contracts, a deterministic backend service, an authenticated read-only endpoint, and a compact Data > Analyse card. v1 must not mutate plans, workouts, Garmin objects, goals or nutrition logs; it only summarizes existing Personal Response, capability, fueling, race, load and goal evidence.

**Tech Stack:** TypeScript, Fastify, Drizzle, React/Vite, TanStack Query, Playwright.

---

## Implementation Note

Implemented on 2026-05-11 as a read-only Data > Analyse evidence layer. The backend route lives in `backend/src/pulse/routes/training-routes.ts` because it combines goals, races, season strategy, capability, goal limiter and plan evidence; it uses Personal Response evidence read-only and does not trigger plan generation, Garmin writes or LLM calls.

## File Structure

- Modify: `shared/types/pulse/plan.ts`
  - Add `PulseGoalProjection*` types near the existing goal and season contracts.
- Create: `backend/src/pulse/services/predictive-goal-engine.ts`
  - Pure deterministic scoring from typed inputs.
- Create: `backend/src/pulse/services/predictive-goal-engine.test.ts`
  - Unit tests for race, body-composition/weight and insufficient-evidence cases.
- Modify: `backend/src/pulse/routes/training-routes.ts`
  - Add `GET /api/pulse/goal-projection?horizonDays=180`.
  - Load active goals, races, fitness load, season strategy, capability, limiter, fueling baseline, personal response inputs, risks, health states and recent body-composition evidence.
- Modify: `backend/src/pulse/plugin.test.ts`
  - Add route-level read-only test for `/api/pulse/goal-projection`.
- Modify: `frontend/src/pulse/api-client.ts`
  - Add `pulseApi.goalProjection(horizonDays)`.
- Modify: `frontend/src/pulse/hooks.ts`
  - Add query key, hook and invalidations on plan/goal/nutrition/check-in changes.
- Create: `frontend/src/features/data/goals/goal-projection-components.tsx`
  - Compact card for Data > Analyse with top projection, limiter risk, next intervention and evidence gaps.
- Modify: `frontend/src/pages/Insights.tsx`
  - Render the projection card near Personal Response and Limiter evidence.
- Modify: `frontend/e2e/fixtures/pulse-api.ts`
  - Add default mock response.
- Modify: `frontend/e2e/pulse-usability.spec.ts`
  - Add route-level UX assertion that projections load without AI insight calls.
- Modify docs at completion:
  - `docs/decisions.md`
  - `docs/ai/current-focus.md`
  - `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`
  - move this file to `docs/superpowers/plans/completed/`
  - update `docs/superpowers/plans/completed/README.md`

## Contract

`PulseGoalProjectionResponse` should return:

- `generatedAt`
- `horizonDays`
- `headline`
- `projections`
- `missingEvidence`

Each projection should include:

- goal identity: `goalId`, `title`, `category`, `targetDate`, `daysUntil`
- prediction: `probabilityPct`, `status`, `confidence`, `summary`
- risk: `limiterRisk`
- action: `nextBestIntervention`
- compact `evidence`

Statuses:

- `on_track`
- `watch`
- `at_risk`
- `insufficient_evidence`

Intervention kinds:

- `build_long_endurance`
- `fueling_practice`
- `threshold_vo2`
- `protect_recovery`
- `body_composition_consistency`
- `consistency`
- `data_quality`

## Task 1: Shared Types

**Files:**
- Modify: `shared/types/pulse/plan.ts`

- [x] **Step 1: Add shared contract types**

Add the projection types after `PulseRaceCommandResponse` and before season strategy types so frontend and backend can import them from `@coaching-os/shared/pulse`.

- [x] **Step 2: Build shared package**

Run:

```bash
npm run build -w shared
```

Expected: successful TypeScript build.

## Task 2: Pure Projection Service

**Files:**
- Create: `backend/src/pulse/services/predictive-goal-engine.ts`
- Create: `backend/src/pulse/services/predictive-goal-engine.test.ts`

- [x] **Step 1: Write failing service tests**

Tests must cover:

- a 70.3 race with low long-endurance/fueling evidence returns `watch` or `at_risk` and a fueling or long-endurance intervention;
- a weight/body-composition goal with too few weight logs returns `insufficient_evidence` and `data_quality`;
- a stable FTP/VO2 goal with useful response/capability evidence returns `on_track` or `watch` and a threshold/VO2 intervention.

- [x] **Step 2: Run red test**

Run:

```bash
set -a; source .env.test.example; set +a; npm run test -w backend -- predictive-goal-engine
```

Expected: fail because the service does not exist yet.

- [x] **Step 3: Implement deterministic scoring**

The service should:

- start from conservative base probability;
- adjust for days until goal, CTL/TSB, active risks/health states, capability level, goal limiter, personal-response strength, fueling baseline and body-composition trend evidence;
- lower confidence when evidence is missing rather than inventing precision;
- return at most three projections by default, ordered by A-race/target date/priority.

- [x] **Step 4: Run green test**

Run:

```bash
set -a; source .env.test.example; set +a; npm run test -w backend -- predictive-goal-engine
```

Expected: pass.

## Task 3: Backend Route

**Files:**
- Modify: `backend/src/pulse/routes/training-routes.ts`
- Modify: `backend/src/pulse/plugin.test.ts`

- [x] **Step 1: Write failing route test**

Add a test that creates a race goal, calls `GET /api/pulse/goal-projection?horizonDays=180`, verifies a projection is returned, and verifies no plan or goal rows are mutated.

- [x] **Step 2: Run red route test**

Run:

```bash
set -a; source .env.test.example; set +a; npm run test -w backend -- plugin.test.ts -t "goal projection"
```

Expected: 404 or missing route.

- [x] **Step 3: Implement route**

Add a read-only route beside existing goals/race/season routes. Reuse existing loaders where possible:

- `getFitnessLoadCached`
- `getActiveRaces`
- `loadTrainingCapabilitySummary(userId, { persist: false })`
- `deriveGoalLimiter`
- `loadFuelingOutcomeBaseline`
- `buildSeasonStrategy`
- `buildPersonalResponseSummary`

Do not call Garmin write APIs, plan generation, LLMs or mutation helpers.

- [x] **Step 4: Run route test**

Run the route test again. Expected: pass.

## Task 4: Frontend Hook And Card

**Files:**
- Modify: `frontend/src/pulse/api-client.ts`
- Modify: `frontend/src/pulse/hooks.ts`
- Create: `frontend/src/features/data/goals/goal-projection-components.tsx`
- Modify: `frontend/src/pages/Insights.tsx`

- [x] **Step 1: Add API client and hook**

Expose `useGoalProjection(horizonDays = 180)` with five-minute stale time and invalidation after goals, plan context, check-ins and nutrition changes.

- [x] **Step 2: Add compact Data card**

The card should:

- show one headline and top projection first;
- show probability/status/confidence without pretending certainty;
- show next best intervention as the only action row;
- keep evidence compact and optional;
- handle loading/error/empty states locally.

- [x] **Step 3: Build frontend**

Run:

```bash
npm run build -w frontend
```

Expected: successful build.

## Task 5: E2E And UX Evidence

**Files:**
- Modify: `frontend/e2e/fixtures/pulse-api.ts`
- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [x] **Step 1: Add mock fixture**

Provide a default projection response with a 70.3 projection, limiter risk and next intervention.

- [x] **Step 2: Add usability test**

Assert Data > Analyse shows the projection card, status, next intervention and does not request `/api/pulse/insights` before insight cards are opened.

- [x] **Step 3: Run focused browser tests**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "goal projection|Data analyses"
```

Expected: pass.

- [x] **Step 4: Capture route evidence**

Run:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/predictive-goal-engine-v1 npm run qa:ux-evidence
```

Expected: pass, with Data > Analyse screenshots showing no mobile overflow.

## Task 6: Docs, Review, PR

**Files:**
- Modify: `docs/decisions.md`
- Modify: `docs/ai/current-focus.md`
- Modify: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`
- Move: `docs/superpowers/plans/2026-05-11-predictive-goal-engine-v1.md` to `docs/superpowers/plans/completed/2026-05-11-predictive-goal-engine-v1.md`
- Modify: `docs/superpowers/plans/completed/README.md`

- [x] **Step 1: Record decision**

Append newest-first decision:

```markdown
## 2026-05-11 — Predictive Goal Engine v1 bleibt read-only

- Entscheidung: Pulse zeigt Zielwahrscheinlichkeit, Limiter-Risiko und nächste Intervention als deterministic read-only Evidence Layer in Data > Analyse.
- Warum: Die Roadmap braucht bessere Coach-Qualität, aber automatische Plan-/Garmin-Mutationen wären ohne Browser- und Nutzerevidenz zu riskant.
- Konsequenz: v1 darf bestehende Planentscheidungen erklären und Folgearbeit priorisieren, aber keine Workouts, Garmin-Syncs oder Ziele verändern.
```

- [x] **Step 2: Update roadmap state**

Mark Predictive Goal Engine v1 as implemented and set Adaptive Season Builder v1 as next non-gated long-term build.

- [x] **Step 3: Verification**

Run:

```bash
npm run check:migrations
set -a; source .env.test.example; set +a; npm run test -w backend -- predictive-goal-engine personal-response-model goal-limiters season-strategy
set -a; source .env.test.example; set +a; npm run test -w backend -- plugin.test.ts -t "goal projection|Personal response model"
npm run build -w shared && npm run build -w backend && npm run build -w frontend
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "goal projection|Data analyses"
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/predictive-goal-engine-v1 npm run qa:ux-evidence
```

- [x] **Step 4: Review and publish**

Stage explicit files, commit, push, open PR, wait for required checks, merge after green, deploy from server mirror and verify.
