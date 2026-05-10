# Mobile Plan Flow Implementation Plan

> **Status:** Completed 2026-05-10 by Codex on `codex/mobile-plan-flow`.
> **Implementation note:** The compact Home slot now renders one `Heute möglich` intent row for planned or unplanned trainable days, while completed-activity and recovery-protect states keep their non-workout guidance. Mobile/today scenario links auto-compute the Plan preview before any write; Garmin remains untouched until explicit Apply.

**Goal:** Make daily iPhone/PWA planning feel closer to JOIN's low-friction flow: choose today/time/intent, review impact, apply explicitly, and understand Garmin status.

**Architecture:** Keep Home as the quiet daily decision surface and Plan as the review/apply surface. Replace or extend the existing compact `TodayOptionsCard` with a mobile-first "Heute moeglich" control; do not render a second card beside the current TrainNow/Today Options surface. Deep-link into existing scenario preview instead of creating another planner.

**Tech Stack:** React/Vite, React Router, existing Pulse API hooks, Playwright route evidence.

---

## Files

- Modify: `frontend/src/pages/Home.tsx`
- Modify: `frontend/src/components/TodayOptionsCard.tsx`
- Modify: `frontend/src/pages/Plan.tsx`
- Modify: `frontend/src/pulse/api-client.ts`
- Modify: `frontend/src/pulse/hooks.ts`
- Modify: `frontend/e2e/fixtures/pulse-api.ts`
- Test: `frontend/e2e/route-evidence.spec.ts`
- Test: `frontend/e2e/pulse-smoke.spec.ts`
- Docs: `docs/qa/route-evidence-pack.md`

## Task 1: Add A Compact Availability Intent Mode

- [x] **Step 1: Define the UI states**

Use these options only:

```ts
const TODAY_INTENTS = [
  { id: 'none', label: 'Frei', durationMin: 0, activityType: null },
  { id: 'short', label: '30 min', durationMin: 30, activityType: 'bike' },
  { id: 'medium', label: '60 min', durationMin: 60, activityType: 'bike' },
  { id: 'long', label: '2h+', durationMin: 120, activityType: 'bike' },
] as const;
```

- [x] **Step 2: Render it by reusing the existing Today Options slot**

In `frontend/src/pages/Home.tsx` and `frontend/src/components/TodayOptionsCard.tsx`, render the intent row in the existing Today Options/TrainNow area when:

- no completed activity today;
- no critical recovery blocker;
- a Today Option exists or the day is unplanned/trainable.

Do not render both the old compact TrainNow card and the new intent row for the same state. The intent mode should be a replacement compact mode of `TodayOptionsCard`, not another Home section.

UI inside the existing card:

```tsx
<section className="daily-card" data-testid="today-availability-intent">
  <span className="label-mono">HEUTE MOEGLICH</span>
  <div role="group" aria-label="Heute moegliche Trainingszeit">
    {TODAY_INTENTS.map(option => (
      <button key={option.id} className="touch-button" onClick={() => openIntent(option)}>
        {option.label}
      </button>
    ))}
  </div>
</section>
```

- [x] **Step 3: Deep-link to scenario preview**

`openIntent` should navigate to:

```ts
const params = new URLSearchParams({
  tab: 'training',
  source: 'mobile-intent',
  scenario: option.id === 'none' ? 'reduce_volume' : 'workout',
  activityType: option.activityType ?? 'bike',
  durationMin: String(option.durationMin),
  zone: option.id === 'long' ? '2' : '1',
  description: option.id === 'none'
    ? 'Heute bewusst frei halten.'
    : `Heute ${option.label} moeglich; Pulse prueft Auswirkung auf Woche und Garmin.`,
});
navigate(`/plan?${params.toString()}#plan-scenario-preview`);
```

## Task 2: Make Plan Scenario Preview Mobile-First

- [x] **Step 1: Teach Plan to hydrate mobile-intent query params**

Current `frontend/src/pages/Plan.tsx` hydrates scenario params for `source=today-options` and `scenario=workout`. Extend the parser to accept `source=mobile-intent` and both:

- `scenario=workout` with `activityType`, `durationMin`, `zone`, `description`;
- `scenario=reduce_volume` for the `Frei` option, using a conservative factor such as `0.7` and the description `Heute bewusst frei halten.`

Add a frontend/E2E test that clicking `60 min` fills the preview as a workout scenario and clicking `Frei` fills a reduce-volume preview without writing to Garmin.

- [x] **Step 2: Put the decision summary first**

In `frontend/src/pages/Plan.tsx`, when `source=mobile-intent` or `source=today-options`, the scenario preview card should order content as:

1. Summary sentence.
2. Apply/cancel buttons.
3. Load/Garmin impact chips.
4. Detailed changed days.

- [x] **Step 3: Keep buttons within 44px baseline**

Use existing touch classes or inline styles:

```tsx
style={{ minHeight: 44, minWidth: 44 }}
```

No text button should become narrower than 44px on mobile.

- [x] **Step 4: Add a Garmin impact chip**

Display:

```tsx
<span className="chip" data-testid="scenario-garmin-impact">
  Garmin: {preview.applySupported ? 'nach Apply synchronisierbar' : 'keine Aenderung'}
</span>
```

If the Garmin execution ledger plan has already landed, replace this static chip with latest sync debt summary.

## Task 3: Browser Evidence

- [x] **Step 1: Add route evidence markers**

In `frontend/e2e/route-evidence.spec.ts`, ensure screenshots include:

- Home mobile with `today-availability-intent` under a deterministic `unplanned_trainable` fixture.
- Plan mobile with `plan-scenario-preview-card`.
- Negative evidence for `completed_activity` and `recovery_protect`: the intent row is not visible.

- [x] **Step 2: Add smoke assertions**

In `frontend/e2e/pulse-smoke.spec.ts`:

```ts
await page.goto('/');
await mockPulseApi(page, { todayOptionsState: 'unplanned_trainable' }); // use the existing fixture helper or add this focused override in `fixtures/pulse-api.ts`
await expect(page.getByTestId('today-availability-intent')).toBeVisible();
await page.getByRole('button', { name: '60 min' }).click();
await expect(page).toHaveURL(/source=mobile-intent/);
await expect(page.getByTestId('plan-scenario-preview-card')).toBeVisible();
await expect(page.getByTestId('scenario-garmin-impact')).toBeVisible();
```

Add deterministic fixture overrides in `frontend/e2e/fixtures/pulse-api.ts`; do not rely on the default fixture because it may be `planned_workout` and intentionally suppress compact options.

- [x] **Step 3: Run UI verification**

Run:

```bash
npm run build -w frontend
npm run test:e2e:smoke
npm run qa:ux-evidence
```

Expected: PASS and `docs/qa/route-evidence-pack.md` is refreshed if the evidence command writes new route notes.

## Acceptance

- Home gives a quick "today is possible" path without implying every free day must be used.
- Home adds at most one compact action row and does not render both TrainNow card and intent row for the same state.
- A completed activity day suppresses new workout planning and prioritizes feedback/fueling/recovery.
- Plan scenario preview is readable and actionable on mobile.
- The flow does not add a new route or top-level nav.
