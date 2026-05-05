# Home Daily Decision Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home should let Tobi close or anchor the daily decision locally before Coach is needed.

**Architecture:** Keep Home as the canonical daily-decision surface and keep `/coach` as a compatible support route. Add local no-training and check-in-aware actions through existing action/decision endpoints instead of creating a new top-level route or new backend memory model.

**Tech Stack:** React/Vite, TanStack Query, Pulse API client, Playwright.

---

## Context

Current friction: on a no-training day, `deriveDailyDecision()` falls back to `cta: "Coach fragen"` and `targetPath: "/coach?focus=daily"`. That makes Home explain the day but not always close it.

Do not duplicate completed Daily Loop Slimming or contextual Coach prompt work. This plan only changes the local closure affordance on Home.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/pulse/daily-decision.ts` | Derive local closure action metadata for no-training and check-in-sensitive days |
| Modify | `frontend/src/components/DailyDecisionCard.tsx` | Render local primary action and optional Coach support action without duplicate CTAs |
| Modify | `frontend/src/pages/Home.tsx` | Wire local close/defer action to existing action mutation where an action id exists |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Regression coverage for no-training closure and Coach as secondary support |
| Modify | `frontend/e2e/ux-daily-flow.spec.ts` | Focused daily-flow tests |

## Task 1: Test No-Training Closure Before Code

- [ ] **Step 1: Add failing E2E for local no-training closure**

Add this test to `frontend/e2e/ux-daily-flow.spec.ts`:

```ts
test('Home no-training daily decision offers local closure before Coach support', async ({ page }) => {
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  await expect(decision).toContainText('Heute ist kein Training geplant.');
  await expect(decision.getByRole('button', { name: /Erholungstag abschliessen|Heute abschliessen/i })).toBeVisible();
  await expect(decision.getByRole('button', { name: /Coach/i })).toHaveCount(1);
});
```

- [ ] **Step 2: Run the test and verify red**

Run:

```bash
npm run test:e2e -- frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium
```

Expected: FAIL because Home still exposes Coach as the primary no-training action.

## Task 2: Derive Local Closure Metadata

- [ ] **Step 1: Extend the daily decision shape**

In `frontend/src/pulse/daily-decision.ts`, add optional support-action metadata:

```ts
export interface DailyDecision {
  title: string;
  reason: string;
  boundary: string;
  alternative: string;
  completionCriterion: string;
  cta: string;
  targetPath: string;
  prompt: string;
  priority: PulseNextBestAction['priority'];
  evidence: string[];
  supportCta?: string;
  supportPath?: string;
}
```

- [ ] **Step 2: Change the no-training fallback**

In the no-action/no-training branch, keep Coach as support and make local closure primary:

```ts
const cta = action?.cta ?? (todayWorkout ? 'Plan pruefen' : 'Erholungstag abschliessen');
const targetPath = action?.targetPath ?? (todayWorkout ? '/plan?tab=training' : '/');
const supportCta = !action && !todayWorkout ? 'Coach fragen' : undefined;
const supportPath = !action && !todayWorkout ? '/coach?focus=daily' : undefined;
```

Return `supportCta` and `supportPath` with the decision object.

## Task 3: Render Primary And Support Actions

- [ ] **Step 1: Keep existing Coach prompt behavior for Coach-target decisions**

In `frontend/src/components/DailyDecisionCard.tsx`, preserve the current `promptIsPrimary` behavior when `decision.targetPath.startsWith('/coach')`.

- [ ] **Step 2: Render optional support action**

Add a second button only when `decision.supportCta` and `decision.supportPath` exist:

```tsx
{decision.supportCta && decision.supportPath && onActivate && (
  <button
    type="button"
    onClick={() => onActivate(decision.supportPath!)}
    style={secondaryButtonStyle}
  >
    {decision.supportCta}
  </button>
)}
```

Use the existing secondary action styling in the component. Do not add a new card.

## Task 4: Wire Local Closure In Home

- [ ] **Step 1: Keep local closure route-local**

In `frontend/src/pages/Home.tsx`, when `onActivate('/')` is received from a daily decision, scroll/focus the action area or simply keep the user on Home. Do not navigate to Coach.

- [ ] **Step 2: If the decision is backed by a `nextBestAction`, use `useUpdatePulseAction`**

Only call the mutation when an action id exists in the source data. Do not invent a completion event for pure fallback days in this PR.

## Task 5: Verify

- [ ] **Step 1: Run focused tests**

```bash
npm run test:e2e -- frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium --project=mobile-chromium
```

Expected: PASS.

- [ ] **Step 2: Run broad daily-flow coverage**

```bash
npm run test:e2e -- --grep "daily decision|Daily loop|Home daily|Coach prompt"
```

Expected: PASS.

- [ ] **Step 3: Run build**

```bash
npm run build -w frontend
```

Expected: PASS.

## Acceptance

- No-training days can be closed or anchored from Home without starting Coach.
- Coach remains available as support, not the primary no-training path.
- `/coach` deep links and prompt links still work.
- Home remains the only full daily decision source.
