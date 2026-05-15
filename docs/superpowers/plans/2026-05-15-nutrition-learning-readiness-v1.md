# Nutrition Learning Readiness v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pulse show why Nutrition Trend Summaries are still gated, while making new during-workout fueling logs harder to save without the structured evidence the learning loop needs.

**Architecture:** Extend the existing `PulseFuelingOutcomeBaseline` contract with a small deterministic learning-readiness object. Reuse the current fueling baseline endpoint and Activity/Workout baseline components, and add a local frontend save guard in `NutritionLogModal` so future logs include carbs and GI comfort. No migration, no new route, no plan/Garmin write, no trend claim when evidence is insufficient.

**Tech Stack:** TypeScript, Vitest, React/Vite, Playwright smoke/usability fixtures.

---

### Task 1: Backend Contract And Tests

**Files:**
- Modify: `shared/types/pulse/fueling.ts`
- Modify: `backend/src/pulse/services/fueling-outcome-baseline.ts`
- Modify: `backend/src/pulse/services/fueling-outcome-baseline.test.ts`

- [x] **Step 1: Write failing readiness tests**

Add tests that prove:
- zero complete comparable during logs returns `learningReadiness.comparableCompleteLogs = 0`, `requiredComparableCompleteLogs = 3`, `readyForTrendSummary = false`, and missing evidence for structured GI comfort.
- three bike/run/hike during logs with duration, carbs and GI comfort return `readyForTrendSummary = true`.

Run:

```bash
npm run test -w backend -- fueling-outcome-baseline
```

Expected: fail because `learningReadiness` does not exist yet.

- [x] **Step 2: Implement minimal readiness contract**

Add a `PulseFuelingLearningReadiness` type and a `learningReadiness` field on `PulseFuelingOutcomeBaseline`. Calculate readiness from relevant endurance during logs. A comparable complete log must have:
- `context` equal to `during` or `null`
- activity type `bike`, `run` or `hike`
- duration at least 75 minutes
- structured `carbsG` value, including `0`
- structured `giComfort`

Keep trend readiness separate from the existing single-log baseline status.

- [x] **Step 3: Verify backend tests**

Run:

```bash
npm run test -w backend -- fueling-outcome-baseline
```

Expected: pass.

### Task 2: Fueling UI Shows Readiness

**Files:**
- Modify: `frontend/src/components/FuelingOutcomeBaseline.tsx`
- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [x] **Step 1: Write failing UI assertion**

Extend the existing activity fueling usability test so the baseline block shows a compact learning-readiness line such as `Trend-Evidenz: 1/3` and the missing GI/sodium evidence where applicable.

Run:

```bash
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --grep "Activity fueling log captures"
```

Expected: fail because the UI does not render the readiness line yet.

- [x] **Step 2: Render readiness in the existing block**

Render `learningReadiness.comparableCompleteLogs` over `requiredComparableCompleteLogs` as a compact chip. If `readyForTrendSummary` is false, show the first missing-evidence sentence under the summary. Keep the block hidden only when there is no baseline and no readiness detail.

- [x] **Step 3: Verify UI assertion**

Run:

```bash
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --grep "Activity fueling log captures"
```

Expected: pass.

### Task 3: During Log Save Guard

**Files:**
- Modify: `frontend/src/components/NutritionLogModal.tsx`
- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [x] **Step 1: Write failing guard assertion**

Extend the activity fueling test so `SPEICHERN` is disabled before GI comfort is selected and becomes enabled after carbs are present and a GI option is selected.

Run:

```bash
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --grep "Activity fueling log captures"
```

Expected: fail because the button is currently enabled without GI comfort.

- [x] **Step 2: Implement local guard**

Disable save until:
- GI comfort is selected.
- There is an explicit carb value from powder, gels, products or manual carb input.

Preserve inferred carbs from powder and products. Do not add a server validation change in this slice, because the current route still supports historical and non-activity nutrition writes.

- [x] **Step 3: Verify focused frontend test**

Run:

```bash
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --grep "Activity fueling log captures"
```

Expected: pass.

### Task 4: Docs, Build, PR

**Files:**
- Modify: `backend/src/pulse/plugin.test.ts`
- Modify: `docs/ai/current-focus.md`
- Modify: `docs/decisions.md`

- [x] **Step 1: Record product decision**

Add a newest-first decision entry: Nutrition Learning Readiness v1 keeps trend summaries gated but exposes the exact evidence count and missing structured fields.

- [x] **Step 2: Update current focus**

Replace the stale 2026-05-11 nutrition gate note with the 2026-05-15 live-data audit result: 5 logs, 4 during, 0 comparable complete during logs due missing structured GI comfort and incomplete practical fields.

- [x] **Step 3: Run final verification**

Run:

```bash
npm run test -w backend -- fueling-outcome-baseline
npm run test -w backend
npm run build -w frontend
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --grep "Activity fueling log captures"
git diff --check
git status --short --branch
```

Expected: all pass and only intended files are modified.

- [ ] **Step 4: Commit, push, PR**

Stage explicit files only, commit with:

```bash
git commit -m "feat: show nutrition learning readiness"
```

Push immediately and open a PR against `main`.
