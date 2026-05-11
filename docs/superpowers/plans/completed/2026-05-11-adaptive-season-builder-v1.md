# Adaptive Season Builder v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn existing season strategy plus Predictive Goal Engine evidence into a visible, read-only season contract in Plan.

**Architecture:** Do not add a new mutation path or duplicate the already-implemented season model. v1 is a frontend orchestration layer over `GET /api/pulse/season-strategy` and `GET /api/pulse/goal-projection`: it explains the current block, next 14-day contract, hard-day cap, recovery/taper boundary, top goal probability and next best intervention. It does not generate, apply, sync or change workouts.

**Tech Stack:** React/Vite, TanStack Query, shared Pulse contracts, Playwright.

---

## File Structure

- Modify: `frontend/src/features/plan/strategy/strategy-components.tsx`
  - Add `AdaptiveSeasonContractCard`.
- Modify: `frontend/src/pages/Plan.tsx`
  - Load `useGoalProjection(180)` in the Training tab and render the card beside the existing season line.
- Modify: `frontend/e2e/pulse-usability.spec.ts`
  - Add a Plan test proving the season contract renders from mocked season and goal projection evidence.
- Modify docs:
  - `docs/decisions.md`
  - `docs/ai/current-focus.md`
  - `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`
  - move this plan to `docs/superpowers/plans/completed/`
  - update `docs/superpowers/plans/completed/README.md`

## Task 1: Frontend Season Contract

**Files:**
- Modify: `frontend/src/features/plan/strategy/strategy-components.tsx`
- Modify: `frontend/src/pages/Plan.tsx`

- [x] **Step 1: Add the card component**

The card must show:

- one headline: keep building, protect recovery, taper/race boundary or evidence open;
- top goal probability/status from `PulseGoalProjectionResponse`;
- next 14-day contract from `PulseSeasonStrategy.guardrails` and `loadModel.currentWeek`;
- next best intervention from the top goal projection;
- compact evidence and missing-evidence copy.

- [x] **Step 2: Render without new API**

Use `useGoalProjection(180)` in `TrainingTab` and render:

```tsx
<AdaptiveSeasonContractCard
  strategy={seasonStrategy.data?.strategy ?? planTrace?.inputSnapshot.seasonStrategy ?? null}
  goalProjection={goalProjection.data ?? null}
  isLoading={seasonStrategy.isLoading || goalProjection.isLoading}
/>
```

Place it near `SeasonStrategyCard` so Plan reads as: Race Command, Season Contract, Season Line.

## Task 2: Browser Coverage

**Files:**
- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [x] **Step 1: Add a Plan test**

Mock API already returns season strategy and goal projection defaults. Add a test that navigates to `/plan?tab=training` and expects:

- `Saisonvertrag`
- `70.3 Kraichgau`
- `ca. 64%`
- `Fueling-Praxis absichern`
- no hidden `/api/pulse/insights` call.

- [x] **Step 2: Run browser test**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "season contract|Plan"
```

## Task 3: Docs And PR

- [x] **Step 1: Record decision**

Decision:

```markdown
## 2026-05-11 — Adaptive Season Builder v1 nutzt vorhandene Season- und Goal-Evidenz

- Entscheidung: Adaptive Season Builder v1 wird als read-only Saisonvertrag in Plan umgesetzt, der bestehende Season Strategy und Goal Projection Evidence kombiniert.
- Warum: Die Backend-Season-Foundation existiert bereits; der naechste Nutzen ist sichtbare Orientierung, nicht ein weiterer paralleler Modellpfad.
- Konsequenz: v1 darf Saison- und Ziel-Evidenz erklaeren, aber keine Workouts, Garmin-Syncs oder Ziele automatisch veraendern.
```

- [x] **Step 2: Update roadmap**

Mark Adaptive Season Builder v1 as implemented and make Contextual Coach Mode the next non-gated long-term step.

- [x] **Step 3: Verification**

Run:

```bash
npm run build -w frontend
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "season contract|Plan"
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/adaptive-season-builder-v1 npm run qa:ux-evidence
```

- [ ] **Step 4: PR**

Stage explicit files, commit, push, create PR, wait for CI, merge after green and deploy runtime changes.

## Implementation Note

Implemented as a frontend-only, read-only Plan orchestration slice:

- `AdaptiveSeasonContractCard` combines `useSeasonStrategy()` and `useGoalProjection(180)`.
- No new API, mutation, Garmin write or duplicate backend season model was added.
- Plan now reads as Race Command, Saisonvertrag, Saisonlinie.
