# Pulse Project Structure Audit

Date: 2026-05-02
Branch: `codex/project-structure-audit`

## Scope

This audit reviewed tracked project files plus ignored local artifacts across the root, backend, frontend, shared contracts, docs, skills, plugins, scripts and design handoff folders.

The repository currently has about 340 tracked files:

- `backend/src`: 149 files
- `frontend/src`: 54 files
- `docs`: 67 files
- Workspaces: `backend`, `frontend`, `shared`

## Immediate Cleanup Done

- Removed unused Vite template artifacts:
  - `frontend/src/App.css`
  - `frontend/src/assets/hero.png`
  - `frontend/src/assets/react.svg`
  - `frontend/src/assets/vite.svg`
- Replaced the generic Vite template `frontend/README.md` with a Pulse-specific frontend guide.
- Removed tracked local TLS certificate material from `frontend/certs/` and replaced it with a README. Private keys must never live in Git.
- Made Vite HTTPS certificate loading optional so builds still work when local certs are not present.

## Ignored Local Artifacts

The workspace contains ignored local/generated files:

- `.DS_Store` files under root, `backend`, `frontend`, `shared`, `docs`, and `docs/superpowers`
- `backend/dist/`
- `frontend/dist/`
- `shared/dist/`
- `node_modules/`, `backend/node_modules/`, `frontend/node_modules/`
- `test-results/.last-run.json`

Recommendation:

- It is safe to delete `.DS_Store` files and `test-results/` when cleaning the Mac workspace.
- Keep `node_modules/` and `dist/` locally unless disk cleanup is the goal; they are ignored and regenerated, but deleting them slows the next local verification.
- Do not add generated `dist/` directories to Git.

## Security Finding

`frontend/certs/192.168.178.46+2-key.pem` was tracked even though `.gitignore` intended to exclude private keys. The file was removed from the index in this cleanup.

Follow-up:

- Rotate/provision the LAN certificate and private key on the server and any Mac checkout.
- Treat the old key as exposed because it existed in Git history; removing it from HEAD does not make the old key trustworthy again.
- Keep certificate material as local runtime state, not repository content.
- Before deploying this cleanup to the server, ensure `/root/pulse/frontend/certs/192.168.178.46+2-key.pem` and `/root/pulse/frontend/certs/192.168.178.46+2.pem` are restored as untracked local files or accept an HTTP fallback for the Vite frontend process.

## Backend Findings

### `backend/src/pulse/plugin.ts` Is The Main Structural Risk

`backend/src/pulse/plugin.ts` is roughly 4,900 lines and registers more than 70 Pulse endpoints. It mixes:

- route registration
- zod schemas
- route-local query orchestration
- Garmin calendar upload/repair logic
- plan generation orchestration
- push settings
- health state CRUD
- nutrition CRUD
- profile and weight endpoints
- dashboard data assembly

This file is now the highest-risk place for merge conflicts and accidental regressions.

Recommended split:

- `backend/src/pulse/routes/home-routes.ts`
- `backend/src/pulse/routes/decision-routes.ts`
- `backend/src/pulse/routes/coach-routes.ts`
- `backend/src/pulse/routes/checkin-routes.ts`
- `backend/src/pulse/routes/garmin-routes.ts`
- `backend/src/pulse/routes/plan-routes.ts`
- `backend/src/pulse/routes/goal-routes.ts`
- `backend/src/pulse/routes/health-routes.ts`
- `backend/src/pulse/routes/push-routes.ts`
- `backend/src/pulse/routes/data-routes.ts`
- `backend/src/pulse/plugin.ts` as thin route aggregator only

Each extracted route file should keep endpoint paths unchanged and reuse the current authentication hook.

### `backend/src/routes/garmin.ts` Is A Legacy Boundary

`backend/src/routes/garmin.ts` still writes a legacy `garmin_daily_health` compatibility path and also contains Garmin sync, workout matching and LLM feedback logic. It remains active and should not be deleted, but the sync orchestration deserves a dedicated service boundary.

Recommended split:

- keep public `/api/garmin` routes in `backend/src/routes/garmin.ts`
- move day sync orchestration into `backend/src/pulse/services/garmin-sync-day.ts`
- move activity/workout matching helpers into `backend/src/pulse/services/workout-execution-sync.ts`
- keep raw Garmin API adapters under `backend/src/lib/garmin-client.ts` and `backend/src/lib/garmin-activities.ts`

### Backend Services Are Mostly Well Clustered

`backend/src/pulse/services/` follows the current architecture well: focused domain services with colocated unit tests. Do not flatten or merge these files. The next improvement is subfolders by domain only after the router split:

- `training/`
- `garmin/`
- `daily-loop/`
- `mental/`
- `goals/`
- `notifications/`

This should be postponed until route extraction reduces import churn.

## Frontend Findings

### Route Pages Are Too Large

Current large pages:

- `frontend/src/pages/Plan.tsx`: about 2,300 lines
- `frontend/src/pages/Data.tsx`: about 1,470 lines
- `frontend/src/pages/Settings.tsx`: about 1,380 lines
- `frontend/src/pages/Home.tsx`: about 1,000 lines
- `frontend/src/pages/Coach.tsx`: about 750 lines

Recommended structure:

- Keep `frontend/src/pages/*.tsx` as route orchestration.
- Introduce `frontend/src/features/plan/`
- Introduce `frontend/src/features/data/`
- Introduce `frontend/src/features/settings/`
- Later, if useful, introduce `frontend/src/features/daily-loop/` for Home/Coach shared decision and outcome components.

Suggested first slices:

- Move plan helpers and cards from `Plan.tsx` into `features/plan/`.
- Move coverage/backfill and mental check-in UI from `Data.tsx` into `features/data/`.
- Move push/PWA, profile, coach preferences and health state cards from `Settings.tsx` into `features/settings/`.

### Shared Components Are A Mixed Layer

`frontend/src/components/` currently mixes UI primitives, shared charts and route-specific domain components. This is acceptable for now, but new components should land closer to their feature unless they are reused by at least two routes.

Keep:

- `frontend/src/components/ui/`
- `frontend/src/components/PulseChrome.tsx`
- generic visual primitives like `SparkChart`, `Skeleton`, `StatCard`

Move later:

- `StrengthLogger` to `features/plan/strength/`
- `EquipmentList` to `features/settings/equipment/`
- `GarminQualityList` to `features/data/coverage/`
- `MentalLoadOverlay` to `features/insights/` or `features/data/mental/` depending on reuse
- `NutritionLogModal` to `features/activity/nutrition/`

Additional low-risk checks before deleting more frontend files:

- `frontend/src/components/StatCard.tsx` appears unused.
- `frontend/src/components/ui/badge.tsx` and `frontend/src/components/ui/separator.tsx` appear unused.
- `SparkChart.tsx` contains exports that may be unused even though other exports from the same file are active.

These should be verified with typecheck/build in a dedicated small cleanup PR.

## Shared Contract Findings

`shared/types/pulse.ts` is about 1,040 lines and now contains almost every Pulse domain contract. It is useful as a single import today, but it is growing into a merge-conflict hotspot.

Recommended split after backend route extraction:

- `shared/types/pulse/activity.ts`
- `shared/types/pulse/daily-loop.ts`
- `shared/types/pulse/garmin.ts`
- `shared/types/pulse/mental.ts`
- `shared/types/pulse/plan.ts`
- `shared/types/pulse/profile.ts`
- `shared/types/pulse/push.ts`
- `shared/types/pulse/index.ts` as compatibility barrel

Keep `@coaching-os/shared/pulse` exporting the same public API during migration.

## Docs And Planning Findings

The docs split is mostly sound:

- `docs/ai/` is the token-efficient working set.
- `docs/superpowers/plans/` is the active plan backlog.
- `docs/superpowers/plans/completed/` is the historical archive.
- `docs/qa/` contains evidence records.
- `design-handoff/` is historical visual reference.

Do not delete `design-handoff/`; it is explicitly marked historical and still preserves the cockpit design reference. Moving it under `docs/design/` would be cleaner, but it would require link updates and should be a small docs-only PR.

## Ops And Tooling Findings

- `plugins/pulse-ops` still points some health checks to `https://192.168.178.46` and `/api/ping`; current frontend URL is `https://192.168.178.46:5175` and Pulse health is `/api/pulse/health`.
- `pm2.config.js` describes only the backend `pulse` process, while the server currently also uses `pulse-frontend`.
- Root `package.json` is still named `coaching-os-v2`; runtime impact is low, but naming no longer matches Pulse.

These are not safe one-line deletions. They should be handled as a follow-up ops/tooling cleanup so diagnostics and PM2 bootstrap do not drift.

## Recommended Refactor Order

1. Backend Pulse route extraction.
2. Frontend route-page feature extraction.
3. Shared Pulse type split with compatibility barrel.
4. Ops/tooling cleanup for Pulse Ops plugin, `pm2.config.js` and package naming.
5. Optional docs/design-handoff relocation.
6. Optional service subfolder grouping after imports stabilize.

Avoid a big-bang restructure. The risk is not the folder names; the risk is changing endpoint contracts, cache invalidation and tests while moving too much at once.
