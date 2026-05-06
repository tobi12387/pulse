# Fueling Recovery Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulse should turn planned and completed workouts into practical pre-, during- and post-workout fueling/recovery guidance.

**Architecture:** Start with explicit user preferences and conservative defaults. Keep guidance educational and operational, not medical. Do not infer dietary constraints from check-ins or free-text notes.

**Tech Stack:** Fastify, Drizzle/Postgres, React 19, TanStack Query, Vite, Playwright.

---

## Decision Gate

Gate status as of 2026-05-06: **answered by Tobi**.

Confirmed preferences:

- No dietary restrictions or excluded foods/products.
- Tobi primarily uses Ministry products; guidance should use this as the preferred product anchor without hard-coding a single product dependency.
- Pulse may propose grams-per-hour carbohydrate ranges.
- Pulse may propose sodium ranges; keep them conservative and explain that real sweat-rate data would improve precision.
- Body-weight-based recommendations are acceptable in the UI.

Original gate:

1. dietary constraints or excluded foods/products;
2. whether Pulse may give gram-per-hour carbohydrate and sodium ranges;
3. preferred product style for long bike/run sessions;
4. whether body-weight-based recommendations are acceptable in the UI.

Implementation can now start in narrow PR-sized slices. Guidance must stay educational and operational, not medical, and must avoid implying precision beyond the available data.

## Context

Pulse already has nutrition logs, sleep debt, HRV deviation, soreness/RPE feedback, planned workouts, Race Command and Season Strategy. The missing practical layer is: "What do I do before/during/after this workout today?"

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `backend/src/db/pulse-schema.ts` | Add additive preference fields only after gate approval |
| Create | `backend/src/db/migrations/0025_fueling_preferences.sql` | Add nullable/defaulted fueling preference fields if 0025 is still the next free migration number |
| Create | `backend/src/pulse/services/fueling-recovery-guidance.ts` | Pure guidance builder from workout, recovery, race and preferences |
| Create | `backend/src/pulse/services/fueling-recovery-guidance.test.ts` | Tests for short/easy, long, intense and recovery-limited cases |
| Modify | `shared/types/pulse.ts` | Add `PulseFuelingRecoveryGuidanceResponse` |
| Modify | `backend/src/pulse/plugin.ts` | Add read-only guidance endpoint |
| Modify | `frontend/src/pulse/api-client.ts` | Add client method |
| Modify | `frontend/src/pulse/hooks.ts` | Add query hook and invalidation |
| Modify | `frontend/src/pages/Plan.tsx` | Show guidance in workout modal / next workout card |
| Modify | `frontend/src/pages/Settings.tsx` | Add preference capture after decision gate |
| Modify | `frontend/e2e/fixtures/pulse-api.ts` | Mock guidance endpoint |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Browser coverage for guidance visibility |

## Task 1: Preference Gate Capture

- [x] **Step 1: Confirm scope**

  Decision gate answered by Tobi on 2026-05-06. See the confirmed preferences above and `docs/decisions.md`.

- [x] **Step 2: Add additive schema fields**

  After approval, add only nullable/defaulted fields such as:
  - `fueling_enabled`;
  - `dietary_constraints`;
  - `preferred_fueling_products`;
  - `carb_guidance_style`;
  - `sodium_guidance_style`.

- [x] **Step 3: Verify migration**

  ```bash
  npm run check:migrations
  npm run typecheck
  ```

## Task 2: Guidance Builder

- [x] **Step 1: Write failing tests**

  Cover:
  - no fueling card for short easy workouts unless recovery is poor;
  - long bike/run gets pre/during/post checklist;
  - high sleep debt or poor HRV shifts emphasis toward recovery and simplicity;
  - race-week guidance uses Race Command/Season Strategy context but remains conservative.

- [x] **Step 2: Implement pure service**

  Return:
  - `before`;
  - `during`;
  - `after`;
  - `recoveryCautions`;
  - `evidence`;
  - `preferenceStatus`.

- [x] **Step 3: Verify service**

  ```bash
  npm test -w backend -- --run src/pulse/services/fueling-recovery-guidance.test.ts
  npm run typecheck
  ```

## Task 3: API and UI

- [ ] **Step 1: Add endpoint**

  Add `GET /api/pulse/fueling-recovery/guidance?workoutId=...`. It must return a preference-gated response if preferences are incomplete.

- [ ] **Step 2: Add Plan UI**

  In the workout modal or next workout decision card, show:
  - short checklist;
  - recovery caution if present;
  - evidence chips for workout duration/intensity, sleep, HRV, soreness and race context.

- [ ] **Step 3: Verify browser behavior**

  ```bash
  npm run test:e2e -- --grep "Fueling|Recovery|Plan"
  ```

## Acceptance

- No opinionated fueling prescription appears before preferences are explicit.
- Guidance is tied to concrete workouts and recovery state, not generic nutrition advice.
- Race and long-session support becomes practical on the day of execution.
- Medical or clinical claims remain out of scope.
