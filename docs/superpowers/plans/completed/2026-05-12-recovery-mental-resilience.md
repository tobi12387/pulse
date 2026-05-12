# Recovery Mental Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Data > Mental explain today's recovery/mental resilience as one calm boundary decision instead of another metric wall.

**Architecture:** Frontend-first and deterministic. Reuse `usePulseHome()` recovery/readiness/load evidence and the existing daily mental check-in; do not add backend endpoints, migrations, LLM calls, clinical labels or plan/Garmin writes. The UI adds one compact card inside the existing Mental surface, with three short lanes and one next action.

**Tech Stack:** React/Vite, shared Pulse types, pure TypeScript model tests via `tsx --test`, Playwright E2E and route evidence.

---

### Task 1: Pure Resilience Guidance Model

**Files:**
- Create: `frontend/src/features/data/resilience/resilience-guidance-model.ts`
- Create: `scripts/resilience-guidance.test.ts`

- [x] **Step 1: Write failing tests**

Test that the model:
- returns `protect` when mental stress is high or recovery is clearly constrained;
- returns `steady` when signals are mixed but not hard-stop;
- returns `ready` when recovery and mental signals are calm;
- labels missing evidence as signal quality, not as failure.

- [x] **Step 2: Verify red**

Run:

```bash
npm run test:frontend-logic -- scripts/resilience-guidance.test.ts
```

Expected: fail because `resilience-guidance-model.ts` does not exist.

- [x] **Step 3: Implement model**

Create `buildResilienceGuidance()` returning:
- `state`: `protect | steady | ready | unknown`;
- `title`, `summary`, `tone`;
- exactly three lanes: `Grenze`, `Planwirkung`, `Signalqualität`;
- one primary action: `check_in`, `open_plan`, or `open_recovery`;
- compact evidence chips.

- [x] **Step 4: Verify green**

Run the same command and expect pass.

### Task 2: Mental Surface UI

**Files:**
- Create: `frontend/src/features/data/resilience/ResilienceGuidanceCard.tsx`
- Modify: `frontend/src/features/data/mental/mental-components.tsx`
- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [x] **Step 1: Write failing UI assertions**

Add a focused Playwright test for `/data?tab=today#data-mental` that expects:
- `data-testid="resilience-guidance-card"`;
- copy for `Resilienz heute`, `Grenze`, `Planwirkung`, `Signalqualität`;
- no clinical diagnosis language;
- one visible primary action.

- [x] **Step 2: Implement UI**

Render one compact card after `GarminDomainHint` and before the check-in form. The card uses existing `home` and `today?.checkin` data, keeps copy short, and routes:
- `check_in` to `#mental-checkin-form`;
- `open_plan` to `/plan?tab=training&source=resilience#plan-scenario-preview`;
- `open_recovery` to `/data?tab=trends#data-recovery`.

- [x] **Step 3: Verify UI**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Data Mental shows resilience guidance" --workers=1
```

Expected: pass.

### Task 3: QA And Closeout

**Files:**
- Modify: `docs/decisions.md`
- Modify: `docs/ai/current-focus.md`
- Modify: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`
- Move: this plan to `docs/superpowers/plans/completed/2026-05-12-recovery-mental-resilience.md`
- Modify: `docs/superpowers/plans/completed/README.md`
- Create: `docs/qa/2026-05-12-recovery-mental-resilience.md`

- [x] **Step 1: Verify**

Run:

```bash
npm run test:frontend-logic
npm run build -w frontend
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Data Mental shows resilience guidance" --workers=1
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-recovery-mental-resilience npm run qa:ux-evidence
git diff --check
```

- [x] **Step 2: Commit**

Stage explicit files and commit:

```bash
git add docs/ai/current-focus.md docs/decisions.md docs/qa/2026-05-12-recovery-mental-resilience.md docs/superpowers/plans/2026-05-02-future-direction-roadmap.md docs/superpowers/plans/completed/README.md docs/superpowers/plans/completed/2026-05-12-recovery-mental-resilience.md frontend/e2e/pulse-usability.spec.ts frontend/src/features/data/mental/mental-components.tsx frontend/src/features/data/resilience/ResilienceGuidanceCard.tsx frontend/src/features/data/resilience/resilience-guidance-model.ts scripts/resilience-guidance.test.ts
git commit -m "feat: add resilience guidance"
```
