# Home Desktop Action Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the Home hero's first-viewport decision density by keeping one primary action visible and moving secondary result/support context behind the existing details disclosure.

**Architecture:** Keep `DailyDecisionCard` as the shared task-contract component. Add opt-in props for the Focus hero only, so Plan/Data/Coach cards keep their current contracts and tests. The Home hero remains the owner of the full daily decision; evidence and Coach support stay reachable after an explicit click.

**Tech Stack:** React, TypeScript, Vite, Playwright, Pulse Focus design system.

---

### Task 1: Document the Home density contract with a failing test

**Files:**
- Modify: `frontend/e2e/ux-daily-flow.spec.ts`
- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [ ] **Step 1: Change the no-training Home expectation**

In `frontend/e2e/ux-daily-flow.spec.ts`, update `Home no-training daily decision opens the missing check-in before Coach support` so it expects `Nach dem Klick` and `Coach fragen` to be hidden before the details disclosure, then visible after opening it.

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npx playwright test frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium -g "Home no-training daily decision"
```

Expected: FAIL, because the current Home hero still renders `Nach dem Klick` and `Coach fragen` immediately.

### Task 2: Add an opt-in calm Home mode to `DailyDecisionCard`

**Files:**
- Modify: `frontend/src/components/DailyDecisionCard.tsx`
- Modify: `frontend/src/features/today/DecisionHero.tsx`

- [ ] **Step 1: Add optional props**

Add optional `deferResultPreview?: boolean` and `deferSupportAction?: boolean` props to `DailyDecisionCard`, defaulting to `false`.

- [ ] **Step 2: Move result preview into details when opted in**

When `deferResultPreview` is true, hide `Nach dem Klick` from the visible next-step box and render it inside the details area, unless the existing duplicate-completed-preview guard suppresses it.

- [ ] **Step 3: Move secondary support CTA into details when opted in**

When `deferSupportAction` is true, keep the primary CTA visible as a full-width action, and render the support CTA under an `Optionale Hilfe` label inside the details area.

- [ ] **Step 4: Opt in from the Home Focus hero**

Pass `deferResultPreview` and `deferSupportAction` from `frontend/src/features/today/DecisionHero.tsx`.

- [ ] **Step 5: Verify the focused test passes**

Run:

```bash
npx playwright test frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium -g "Home no-training daily decision"
```

Expected: PASS.

### Task 3: Verify route quality and document evidence

**Files:**
- Create: `docs/qa/2026-05-14-home-desktop-action-density.md`
- Modify: `docs/decisions.md`

- [ ] **Step 1: Run focused regression tests**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "Home daily action|Daily loop clarity|Home owns the full daily decision"
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium -g "Plan starts with the current action contract"
```

Expected: PASS.

- [ ] **Step 2: Run build and diff checks**

Run:

```bash
npm run build
git diff --check
```

Expected: both pass.

- [ ] **Step 3: Capture fresh route evidence**

Run:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-home-desktop-action-density-final npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-home-desktop-action-density-final
```

Expected: no overflow findings; Home screenshot shows one primary action with details available.

- [ ] **Step 4: Record the scope decision**

Append a decision that Home keeps one visible primary action and moves secondary result/support context behind details; Plan/Data remain unchanged.

