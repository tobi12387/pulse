# Pulse Structure Boundary Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Pulse merge conflicts and cognitive load by extracting large route/page/type monoliths without changing runtime behavior.

**Architecture:** This is a staged refactor, not a product feature. Endpoint paths, shared exports, UI behavior and tests must remain compatible after every slice. The first priority is moving code into clearer boundaries while keeping existing public contracts stable.

**Tech Stack:** Fastify 5, TypeScript 5/6, React 19, Vite, TanStack Query, shared workspace package.

---

## File Map

| Area | Files |
|---|---|
| Backend route split | `backend/src/pulse/plugin.ts`, new files under `backend/src/pulse/routes/` |
| Backend tests | `backend/src/pulse/plugin.test.ts` remains the route-suite safety net |
| Frontend feature split | `frontend/src/pages/Plan.tsx`, `frontend/src/pages/Data.tsx`, `frontend/src/pages/Settings.tsx`, new files under `frontend/src/features/` |
| Shared type split | `shared/types/pulse.ts`, new files under `shared/types/pulse/`, `shared/package.json` exports only if needed |
| Docs | `docs/ai/current-focus.md`, `docs/ai/project-structure-audit.md`, `docs/decisions.md` |

## Phase 1: Secrets And Template Debris Cleanup

- [x] Remove unused Vite starter files from `frontend/src/`.
- [x] Replace the generic Vite `frontend/README.md` with a Pulse-specific guide.
- [x] Remove tracked local TLS certificate material from `frontend/certs/`.
- [x] Make Vite HTTPS certificate loading optional so builds do not require local secrets.
- [x] Rotate/provision new untracked LAN cert/key material on the server before deploying if HTTPS on `:5175` must stay active. Treat the old Git-tracked key as exposed.

## Phase 2: Backend Pulse Route Extraction

- [x] Create `backend/src/pulse/routes/health-routes.ts` for `/health`, `/readiness`, `/load`, `/health-state`, `/metrics`, `/weight`, and `/profile`.
- [x] Create `backend/src/pulse/routes/daily-loop-routes.ts` for `/home`, `/actions`, `/outcomes/daily`, `/decisions/quality`, `/briefing`, `/risk`.
- [x] Create `backend/src/pulse/routes/coach-routes.ts` for `/coach`, `/coach/history`, and `/coach/preferences`.
- [x] Create `backend/src/pulse/routes/checkin-routes.ts` for `/checkin`, `/checkin/voice`, `/checkin/today`, `/checkin/guidance`, `/checkin/history`, `/mental/themes`, and `/mental/load-overlay`.
- [x] Create `backend/src/pulse/routes/training-routes.ts` for plan, workout, strength, equipment, race, season, review, nutrition and training analytics endpoints.
  - [x] Move activity equipment assignment, strength sessions, equipment CRUD, retire and defaults into `training-routes.ts`.
  - [x] Move workout step generation, HR targets and deterministic fallback into `backend/src/pulse/services/workout-steps.ts`.
  - [x] Move plan route helpers, trace mapping and execution-review adaptation into `backend/src/pulse/services/plan-route-helpers.ts`.
  - [x] Move plan/workout, plan generation, plan trace, today adjustment and week availability endpoints into `training-routes.ts`.
  - [x] Move goals, race command and season strategy endpoints into `training-routes.ts`.
  - [x] Move review and nutrition endpoints into `training-routes.ts`.
  - [x] Move training analytics endpoint into `training-routes.ts`.
- [x] Create `backend/src/pulse/routes/garmin-routes.ts` for Pulse-scoped sync status, data coverage, Garmin coverage, backfill, calendar sync, signal usefulness, profile sync and sync endpoints.
- [ ] Create `backend/src/pulse/routes/push-routes.ts` for push settings, subscribe, topics, quiet hours and test push.
- [ ] Keep `backend/src/pulse/plugin.ts` as a thin Fastify plugin that registers the route modules.
- [x] Run `npm test -w backend -- --run src/pulse/plugin.test.ts` where local services are available; otherwise rely on CI and note the local service limitation.
  - Local limitation 2026-05-02: attempted twice; Postgres `5433`/Redis `6380` unavailable because Docker Desktop is not running locally.
- [x] Run `npm run typecheck`.

## Phase 3: Garmin Sync Boundary

- [ ] Move day-sync orchestration out of `backend/src/routes/garmin.ts` into `backend/src/pulse/services/garmin-sync-day.ts`.
- [ ] Move activity-to-workout matching helpers into `backend/src/pulse/services/workout-execution-sync.ts`.
- [ ] Keep `/api/garmin` routes backwards-compatible.
- [ ] Update `backend/src/jobs/garmin-sync.job.ts`, `backend/src/scripts/backfill-garmin.ts`, and Pulse backfill routes to call the service layer.
- [ ] Run Garmin-focused tests: `npm test -w backend -- --run src/lib/garmin-activities.test.ts src/lib/garmin-recovery.test.ts src/routes/garmin.test.ts src/pulse/services/workout-reconciliation.test.ts`.
- [ ] Run `npm run typecheck`.

## Phase 4: Frontend Plan Page Split

- [ ] Create `frontend/src/features/plan/` and move pure date/plan helpers from `frontend/src/pages/Plan.tsx` into `frontend/src/features/plan/plan-utils.ts`.
- [ ] Move Week strip and workout-row UI into `frontend/src/features/plan/training/`.
- [ ] Move plan trace, race command and season strategy cards into `frontend/src/features/plan/strategy/`.
- [ ] Move goal forms and cards into `frontend/src/features/plan/goals/`.
- [ ] Keep `frontend/src/pages/Plan.tsx` as route orchestration.
- [ ] Run `npm run build -w frontend`.
- [ ] Run focused E2E for Plan: `npm run test:e2e -- --grep "Plan"`.

## Phase 5: Frontend Data And Settings Split

- [ ] Create `frontend/src/features/data/coverage/` for Garmin coverage, backfill and signal usefulness UI now embedded in `Data.tsx`.
- [ ] Create `frontend/src/features/data/mental/` for mental check-in and mental trend UI.
- [ ] Create `frontend/src/features/data/recovery/` for sleep, metrics and body composition UI.
- [ ] Create `frontend/src/features/settings/push/` for PWA device and push notification cards.
- [ ] Create `frontend/src/features/settings/profile/` for athlete profile and Garmin profile sync UI.
- [ ] Create `frontend/src/features/settings/coach/` for coach preferences.
- [ ] Create `frontend/src/features/settings/health/` for health-state controls.
- [ ] Keep `frontend/src/pages/Data.tsx` and `frontend/src/pages/Settings.tsx` as route orchestration.
- [ ] Run `npm run build -w frontend`.
- [ ] Run focused E2E for Data and Settings: `npm run test:e2e -- --grep "Data|Settings|Garmin|Push"`.

## Phase 6: Shared Type Split With Compatibility Barrel

- [ ] Create `shared/types/pulse/` and split domain types into activity, daily-loop, garmin, mental, plan, profile, push and index files.
- [ ] Keep `shared/types/pulse.ts` as a compatibility barrel that re-exports the same public names.
- [ ] Do not force all imports to change in the same PR; let feature files adopt domain imports gradually.
- [ ] Run `npm run build -w shared`.
- [ ] Run `npm run typecheck`.

## Phase 7: Ops And Tooling Cleanup

- [ ] Update `plugins/pulse-ops` to use `https://192.168.178.46:5175` and `/api/pulse/health`.
- [ ] Update `pm2.config.js` to document or manage both `pulse` and `pulse-frontend`.
- [ ] Decide whether root `package.json` should be renamed from `coaching-os-v2` to `pulse`; if yes, update lockfile and docs in one PR.
- [ ] Run `npm run pulse:status`.
- [ ] Run `npm run verify:server`.

## Phase 8: Optional Docs Relocation

- [ ] Move `design-handoff/` to `docs/design/handoff/` only in a docs-only PR.
- [ ] Update all links from `design-handoff/...` to `docs/design/handoff/...`.
- [ ] Keep the historical warning at the top of the README and HANDOFF docs.
- [ ] Run `rg "design-handoff"` and confirm no stale links remain.

## Acceptance

- Every phase compiles independently.
- Existing endpoint paths remain unchanged.
- Existing shared import `@coaching-os/shared/pulse` remains valid until all consumers have migrated.
- Browser E2E for touched routes remains green.
- No private keys or local certificate material are tracked.
- `docs/decisions.md` records each non-trivial boundary decision.
