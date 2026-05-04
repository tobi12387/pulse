# Daily Loop Slimming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce repeated daily-loop bulk by keeping the full daily decision on Home and using slimmer contextual daily-decision support cards on Coach and Plan.

**Architecture:** `DailyDecisionCard` already owns density and route-specific presentation, so this PR extends that component instead of adding new route-level duplicates. Home keeps the default card; Coach and Plan pass the compact density and get a short route-support surface with the same decision title, reason, and prompt or CTA.

**Tech Stack:** React 19, Vite, React Router, TanStack Query hooks, Playwright route tests, existing inline style and component patterns.

---

### Task 1: Lock the Desired Route Behavior

**Files:**
- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [ ] **Step 1: Add a failing route-level usability test**

Add a test that visits Home, Coach, and Plan with mocked Pulse API data. Assert that Home still shows the full daily decision details (`GRENZE`, `ALTERNATIVE`, `ABSCHLUSS`), while Coach and Plan do not show those repeated detail blocks in their daily-decision cards. Also assert that Coach still exposes `Gespräch damit starten` and Plan still exposes `Coach fragen` so the compact cards remain actionable.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:e2e -- --project=mobile-chromium --grep "Daily loop slimming"`

Expected: FAIL because Coach currently renders the full daily-decision details.

### Task 2: Implement Compact Support Presentation

**Files:**
- Modify: `frontend/src/components/DailyDecisionCard.tsx`
- Modify: `frontend/src/pages/Coach.tsx`
- Modify: `frontend/src/pages/Plan.tsx`

- [ ] **Step 1: Extend the compact DailyDecisionCard behavior**

Update `DailyDecisionCard` so `density="compact"` renders a smaller support card:

- lower padding
- `h2` at compact size
- no boundary/alternative/completion grid
- no evidence chip list
- clear top label and priority
- one action row when `onActivate` or `onPrompt` is present

- [ ] **Step 2: Use compact route support on Coach**

Coach already passes `density={compact ? 'compact' : 'default'}` inside `DailyBriefingGuide`. Change the default route behavior so Coach uses the compact variant for daily decision support, while preserving the prompt action.

- [ ] **Step 3: Keep Plan compact**

Plan already passes `density="compact"`. Confirm the revised card remains actionable and does not reintroduce the full detail grid.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:e2e -- --project=mobile-chromium --grep "Daily loop slimming"`

Expected: PASS.

### Task 3: Verify and Capture Evidence

**Files:**
- Modify: `docs/qa/2026-05-04-daily-loop-slimming.md`

- [ ] **Step 1: Run focused frontend verification**

Run: `npm run build -w frontend`

Expected: PASS.

- [ ] **Step 2: Run relevant route usability tests**

Run: `npm run test:e2e -- --project=mobile-chromium --grep "Daily loop slimming|Home daily action|Coach|Plan"`

Expected: PASS.

- [ ] **Step 3: Regenerate route screenshot evidence**

Run: `npm run qa:ux-evidence`

Expected: PASS with desktop and mobile screenshot packs under `test-results/route-evidence/<date>-<commit>/`.

- [ ] **Step 4: Document QA conclusions**

Create `docs/qa/2026-05-04-daily-loop-slimming.md` with baseline evidence path, after evidence path, route observations, and commands run.

### Self-Review

- Spec coverage: Approach A is covered by Task 1 tests, Task 2 component and route usage changes, and Task 3 evidence.
- Placeholder scan: no placeholders remain.
- Scope check: one frontend presentation slice; no backend, API, navigation, Data, or Settings work included.
