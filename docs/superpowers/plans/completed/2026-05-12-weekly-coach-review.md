# Weekly Coach Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Plan > Review start with a calm weekly coach summary that says what Pulse learned, which plan changes need attention, and what Tobi should accept, reject or defer.

**Architecture:** Frontend-first and deterministic. Reuse existing queries (`review/latest`, `plan/adaptation-events`, `personal-response`, `goal-projection`, `season-strategy`) and the existing explicit review generation mutation; do not add backend endpoints, migrations, automatic LLM calls or Garmin writes.

**Tech Stack:** React/Vite, TanStack Query hooks, shared Pulse types, Playwright E2E, Node test runner via `tsx --test`.

---

### Task 1: Pure Weekly Review Model

**Files:**
- Create: `frontend/src/features/plan/weekly-coach-review-model.ts`
- Create: `scripts/weekly-coach-review.test.ts`

- [x] **Step 1: Write failing tests**

Test that the model:
- prioritizes unresolved action adaptation events;
- still gives a useful stable-week review when no action event exists;
- asks for explicit review generation when no review exists.

- [x] **Step 2: Verify red**

Run:

```bash
npm run test:frontend-logic -- scripts/weekly-coach-review.test.ts
```

Expected: fail because the model file does not exist.

- [x] **Step 3: Implement model**

Create a pure `buildWeeklyCoachReview()` that returns `title`, `summary`, `tone`, `primaryAction`, three compact lanes and evidence chips. Action kinds are only `open_plan_inbox`, `read_review` and `generate_review`.

- [x] **Step 4: Verify green**

Run the same command and expect pass.

### Task 2: Plan Review UI

**Files:**
- Modify: `frontend/src/pages/Plan.tsx`
- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [x] **Step 1: Write failing UI assertions**

Add a focused Playwright test for `/plan?tab=review` that expects:
- `data-testid="weekly-coach-review"`;
- copy for `Gelernt`, `Planänderung`, `Entscheidung`;
- primary action `Planpunkte prüfen` when an action adaptation event is present;
- click routes to `/plan?tab=training&source=weekly-review#plan-change-inbox`.

- [x] **Step 2: Implement UI**

In `ReviewTab`, load `useAdaptationEvents`, `usePersonalResponse`, `useGoalProjection` and `useSeasonStrategy`, compute the model and render a single compact card before the full generated narrative.

- [x] **Step 3: Verify UI**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan Review surfaces the weekly coach review" --workers=1
```

Expected: pass.

### Task 3: QA And Closeout

**Files:**
- Modify: `docs/decisions.md`
- Modify: `docs/ai/current-focus.md`
- Modify: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`
- Move: this plan to `docs/superpowers/plans/completed/2026-05-12-weekly-coach-review.md`
- Modify: `docs/superpowers/plans/completed/README.md`
- Create: `docs/qa/2026-05-12-weekly-coach-review.md`

- [x] **Step 1: Verify**

Run:

```bash
npm run test:frontend-logic
npm run build -w frontend
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan Review surfaces the weekly coach review" --workers=1
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-weekly-coach-review npm run qa:ux-evidence
git diff --check
```

- [x] **Step 2: Commit**

Stage explicit files and commit:

```bash
git add docs/ai/current-focus.md docs/decisions.md docs/qa/2026-05-12-weekly-coach-review.md docs/superpowers/plans/2026-05-02-future-direction-roadmap.md docs/superpowers/plans/completed/README.md docs/superpowers/plans/completed/2026-05-12-weekly-coach-review.md frontend/e2e/pulse-usability.spec.ts frontend/src/features/plan/PlanChangeInboxCard.tsx frontend/src/features/plan/weekly-coach-review-model.ts frontend/src/pages/Plan.tsx scripts/weekly-coach-review.test.ts
git commit -m "feat: add weekly coach review"
```
