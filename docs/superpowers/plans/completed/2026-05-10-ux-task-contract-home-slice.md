# UX Task Contract Home Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the UX Task Contract to the Home daily decision card so the first viewport answers what to do, why now and what happens after the click without making Tobi read every detail.

**Status 2026-05-10:** Implemented on `codex/ux-task-contract-home`. Verification: focused Home daily-flow tests, completed-training Home tests, `npm run build -w frontend`, and `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/ux-task-contract-home npm run qa:ux-evidence`.

**Architecture:** Keep the daily decision data contract intact and change only the Home/Coach card presentation. The card will show a compact next-step/result preview by default and move detailed steps plus evidence into an optional disclosure.

**Tech Stack:** React/Vite frontend, existing Playwright route evidence and smoke/usability tests.

---

## Evidence

- Fresh route evidence: `test-results/route-evidence/ux-task-contract-pre/2026-05-10-c7c7552/`.
- Mobile Home screenshots show the daily decision card filling most of the first viewport with `Warum`, three `Was jetzt?` lines, evidence chips and two buttons.
- The slice targets `frontend/src/components/DailyDecisionCard.tsx` because Home and Coach already share this presentation.

## File Map

- Modify: `frontend/src/components/DailyDecisionCard.tsx` — compact default contract, optional details/evidence disclosure and localized completed-workout labels.
- Modify: `frontend/src/pulse/daily-decision.ts` — keep data stable, localize completed planned workout label.
- Modify: `frontend/e2e/ux-daily-flow.spec.ts` — assert the contract fields and collapsed details behavior.
- Modify: `frontend/e2e/pulse-usability.spec.ts` — keep completed-training routing/detail assertions aligned with the disclosure.
- Modify: `docs/ai/current-focus.md` — update next recommendation after this slice.
- Modify: `docs/decisions.md` — persist the Home task-contract presentation decision.

## Tasks

### Task 1: Lock The UX Contract With Tests

- [x] **Step 1: Add a Home contract test**

In `frontend/e2e/ux-daily-flow.spec.ts`, extend the no-training daily decision test to assert:

```ts
const decision = page.getByTestId('daily-decision-card');
await expect(decision).toContainText(/Warum jetzt/i);
await expect(decision).toContainText(/Nach dem Klick/i);
await expect(decision.getByText('Readiness 78/100')).not.toBeVisible();
await decision.getByRole('button', { name: /Details & Evidenz/i }).click();
await expect(decision.getByText('Readiness 78/100')).toBeVisible();
```

- [x] **Step 2: Run the focused test to verify failure**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium --grep "Home no-training daily decision"
```

Expected before implementation: the test fails because `Warum jetzt`, `Nach dem Klick` or the details disclosure does not exist.

### Task 2: Implement The Compact Daily Decision Presentation

- [x] **Step 1: Add helper render functions**

In `frontend/src/components/DailyDecisionCard.tsx`, add helpers for:

- action summary label from open/done/note steps;
- result preview from `emptyState` or `completionCriterion`;
- evidence row rendering reused inside the disclosure.

- [x] **Step 2: Change default layout**

Default card layout becomes:

- heading and priority;
- `Warum jetzt` summary;
- `Nächster Schritt` or `Heute fertig` compact panel;
- `Nach dem Klick` result preview;
- primary/support actions;
- collapsed `Details & Evidenz` disclosure.

- [x] **Step 3: Keep compact mode unchanged enough for Coach**

When `density="compact"`, preserve the current small card behavior and avoid adding the disclosure.

### Task 3: Verify Route Evidence

- [x] **Step 1: Run frontend checks**

```bash
npm run build -w frontend
npm run test:e2e -- --project=desktop-chromium --grep "Home no-training daily decision|Home treats completed"
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/ux-task-contract-home npm run qa:ux-evidence
```

- [x] **Step 2: Inspect Home screenshots**

Expected:

- mobile Home first viewport shows the daily decision's next action and result preview without exposing all evidence by default;
- completed-training Home no longer starts with a long checklist;
- route evidence remains free of horizontal overflow.

### Task 4: Close Documentation

- [x] **Step 1: Update current focus and decisions**

Record that Home daily decision is the first implemented UX Task Contract slice and that further pages should follow the same pattern.

- [x] **Step 2: Commit and open PR**

Stage explicit files only and commit:

```bash
git add frontend/src/components/DailyDecisionCard.tsx frontend/src/pulse/daily-decision.ts frontend/e2e/ux-daily-flow.spec.ts frontend/e2e/pulse-usability.spec.ts docs/ai/current-focus.md docs/decisions.md docs/superpowers/plans/2026-05-02-future-direction-roadmap.md docs/superpowers/plans/completed/README.md docs/superpowers/plans/completed/2026-05-10-ux-task-contract-home-slice.md
git commit -m "fix: simplify home daily decision contract"
```
