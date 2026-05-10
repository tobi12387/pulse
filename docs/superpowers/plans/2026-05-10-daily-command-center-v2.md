# Daily Command Center v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Home and the Mental Check-in feel like a fast daily operating system on iPhone/PWA and desktop.

**Architecture:** Introduce one derived daily command state that owns Home wording and Today Options visibility. Keep Plan as preview/apply and Data as evidence; do not add a new top-level tab.

**Tech Stack:** React 19, TanStack Query, Pulse typed API client, Playwright, existing Pulse inline styles.

---

## Files

- Create: `frontend/src/pulse/daily-command.ts` for single daily state resolution.
- Modify: `frontend/src/pulse/daily-decision.ts` to consume the resolved state or expose compatible metadata.
- Modify: `frontend/src/components/TodayOptionsCard.tsx` to render only when the command state allows options.
- Modify: `frontend/src/pages/Home.tsx` for a tighter first viewport and desktop two-column layout.
- Modify: `frontend/src/features/data/mental/mental-components.tsx` for one-tap-first check-in.
- Modify: `frontend/e2e/pulse-usability.spec.ts` for contradiction and mobile first-viewport tests.
- Modify: `frontend/e2e/fixtures/pulse-api.ts` for explicit daily-command fixtures.

## Task 1: Add Daily Command State

- [ ] **Step 1: Write failing tests**

Add tests to `frontend/e2e/pulse-usability.spec.ts`:

```ts
test('Home does not show planned-training options when the daily decision says no training is planned', async ({ page }) => {
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
    todayOptionsState: 'planned_workout',
    home: { todayWorkout: null, nextWorkout: null },
  });
  await seedAuth(page);
  await page.goto('/');
  await expect(page.getByTestId('daily-decision-card')).toContainText('Heute ist kein Training geplant');
  await expect(page.getByTestId('today-options-card')).not.toContainText('Heute ist Training geplant');
});
```

Expected before implementation: fail or expose the contradiction seen in route evidence.

- [ ] **Step 2: Create `daily-command.ts`**

Implement a pure resolver:

```ts
export type DailyCommandKind =
  | 'completed_planned'
  | 'completed_off_plan'
  | 'planned'
  | 'recovery'
  | 'free_trainable'
  | 'free_rest';

export function resolveDailyCommand(home: PulseHomeScreenData, options: PulseTodayOptionsResponse | null): DailyCommandKind {
  if (home.todayWorkout?.plannedDate === home.date && (home.todayWorkout.status === 'completed' || home.todayWorkout.completedActivityId || home.todayWorkout.executionStatus === 'completed_matched')) return 'completed_planned';
  if (!home.todayWorkout && (home.todayActivities ?? []).some(a => (a.durationSec ?? 0) >= 600)) return 'completed_off_plan';
  if (home.todayWorkout?.plannedDate === home.date) return 'planned';
  if (options?.state === 'recovery_protect') return 'recovery';
  if (options?.state === 'unplanned_trainable') return 'free_trainable';
  return 'free_rest';
}
```

- [ ] **Step 3: Wire Home and TodayOptions**

In `Home.tsx`, derive `commandKind` from `home` and `todayOptions`. Pass it to `TodayOptionsCard`.

In `TodayOptionsCard.tsx`, hide mobile intent when `commandKind` is `completed_planned`, `completed_off_plan`, `recovery`, or `free_rest`.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:e2e -- --project=mobile-chromium --grep "Home does not show planned-training options|Home treats completed"
```

Expected: contradiction test and completed-training tests pass.

## Task 2: Tighten Home First Viewport

- [ ] **Step 1: Add screenshot/e2e expectation**

Add a mobile test that Home first viewport contains:

- Daily Decision title.
- One primary CTA.
- Readiness/TSB summary.
- No Recent Trainings card.
- No more than one secondary command card above recovery strip.

- [ ] **Step 2: Refactor Home layout**

In `Home.tsx`, create a `HomeCommandSection` that renders:

1. `DailyDecisionCard`.
2. `TodayOptionsCard` only if `commandKind === 'planned' || commandKind === 'free_trainable'`.
3. One compact recovery strip.

Move lower-priority cards below this section.

- [ ] **Step 3: Add desktop two-column Home shell**

In `Layout.tsx`, include Home in the wider operational shell:

```ts
const isOperationalRoute = location.pathname === '/' || location.pathname.startsWith('/data') || location.pathname.startsWith('/plan');
```

In `Home.tsx`, use a responsive grid for lower evidence cards while keeping the command section first.

- [ ] **Step 4: Run route evidence**

Run:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/daily-command-center npm run qa:ux-evidence
```

Expected: no overflow, mobile Home first screenshot answers the daily action without conflicting copy.

## Task 3: Make Mental Check-in One-Tap-First

- [ ] **Step 1: Write failing viewport test**

In mobile `Data?tab=mental`, assert that the first viewport contains a primary save button:

```ts
await page.goto('/data?tab=mental');
await expect(page.getByRole('button', { name: /Check-in speichern|Stabil speichern|Heute speichern/i })).toBeInViewport();
```

- [ ] **Step 2: Reorder Mental form**

In `mental-components.tsx`, put these elements before optional detail:

1. State profile choices.
2. Derived summary.
3. Primary submit button.
4. Pulse suggestion in one compact line.

Move quick-choice fine detail, free text, guided questions, tags and notes behind two `<details>` sections:

- `Mehr beschreiben`.
- `Feinjustieren`.

- [ ] **Step 3: Keep mental health/fintess language but reduce labels**

Use copy:

- Primary: `Wie ist deine mentale Lage?`
- Submit: `Heute speichern`
- Summary: `Health: stabil · Fitness: bereit`

Avoid long explanatory text above the save action.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:e2e -- --project=mobile-chromium --grep "Mental|Check-in|Data"
npm run build -w frontend
```

Expected: Mental tests and frontend build pass.

## Task 4: Update Evidence Pack

- [ ] **Step 1: Extend route evidence labels**

Add screenshots for:

- `home-planned-command`.
- `home-free-command`.
- `home-completed-command`.
- `data-mental-first-viewport`.

- [ ] **Step 2: Run and inspect**

Run:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/daily-command-center-final npm run qa:ux-evidence
```

Expected: no horizontal overflow; screenshots show one consistent daily command.

## Non-Goals

- No new top-level tab.
- No Coach primary-nav return.
- No live Garmin sync.
- No new habit/streak system.

