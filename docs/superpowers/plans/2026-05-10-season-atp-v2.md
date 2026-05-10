# Season ATP V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Pulse season planning toward a TrainingPeaks-style annual plan while keeping the UI as one simple, explainable season lane.

**Architecture:** Extend the existing `season-strategy.ts` service with A/B/C event priority, CTL/TSS target ranges, missed-week compensation and taper constraints. Keep the generated week plan bounded by guardrails; do not create a separate ATP calendar surface in this phase.

**Tech Stack:** Existing Season Strategy service, Plan Engine, shared Pulse types, Vitest, React Plan surface.

---

## Files

- Modify: `shared/types/pulse/plan.ts`
- Modify: `backend/src/pulse/services/season-strategy.ts`
- Modify: `backend/src/pulse/services/season-strategy.test.ts`
- Modify: `backend/src/pulse/routes/training-routes.ts`
- Modify: `backend/src/pulse/services/plan-engine.ts`
- Modify: `backend/src/pulse/services/plan-trace.ts`
- Modify: `frontend/src/features/plan/strategy/strategy-components.tsx`
- Test: `frontend/e2e/pulse-smoke.spec.ts` or focused Plan route coverage

## Task 1: Add ATP Fields To Season Strategy

- [ ] **Step 1: Extend shared type**

Add to `PulseSeasonLoadModel`:

```ts
annualTargetHours: number | null;
annualTargetTss: number | null;
eventPriorityBias: 'a_event' | 'b_event' | 'c_event' | 'maintenance';
missedLoadCompensation: {
  missedTssLast14d: number;
  compensationTssNext14d: number;
  capReason: string;
};
```

- [ ] **Step 2: Update backend builders**

In `backend/src/pulse/services/season-strategy.ts`, calculate:

```ts
const TSS_PER_HOUR_TARGET = 48;
const annualTargetHours = Math.round(input.weeklyHoursTarget * 48);
const annualTargetTss = Math.round(input.weeklyHoursTarget * 48 * TSS_PER_HOUR_TARGET);
const eventPriorityBias = race?.priority === 'A' ? 'a_event' : race?.priority === 'B' ? 'b_event' : race?.priority === 'C' ? 'c_event' : 'maintenance';
```

For missed load compensation:

```ts
const missedTssLast14d = Math.max(0, plannedTssLast14d - completedTssLast14d);
const compensationTssNext14d = Math.min(Math.round(missedTssLast14d * 0.35), Math.round(input.fitnessLoad.ctl * 2));
const capReason = missedTssLast14d > 0
  ? 'Nur ein Teil verpasster Last wird nachgeholt; Recovery und Ramp-Cap bleiben wichtiger.'
  : 'Keine Nachhol-Last noetig.';
```

Do not only default these values to `0` in production. Add optional fields to `SeasonStrategyInput`, then update every `buildSeasonStrategy()` caller in `backend/src/pulse/routes/training-routes.ts` to derive and pass:

- `plannedTssLast14d` from planned workouts in the last 14 days;
- `completedTssLast14d` from matched/completed workouts and Garmin activities in the last 14 days;
- the same values for `/season-strategy`, `/plan/generate` and availability regeneration.

Service defaults are allowed only for tests that do not care about missed-load compensation.

## Task 2: Add ATP Tests

- [ ] **Step 1: Test A-event taper protection**

In `season-strategy.test.ts`:

```ts
it('uses A-event bias and caps missed load during taper', () => {
  const strategy = buildSeasonStrategy(input({
    races: [race({ priority: 'A', daysUntil: 10, title: 'A Race', distanceKm: 120 })],
    plannedTssLast14d: 500,
    completedTssLast14d: 260,
  }));

  expect(strategy.loadModel.eventPriorityBias).toBe('a_event');
  expect(strategy.loadModel.currentWeek.kind).toBe('taper');
  expect(strategy.loadModel.missedLoadCompensation.compensationTssNext14d).toBeLessThan(100);
  expect(strategy.loadModel.missedLoadCompensation.capReason).toContain('Ramp-Cap');
});
```

- [ ] **Step 2: Test maintenance without race**

```ts
it('keeps annual targets simple during maintenance', () => {
  const strategy = buildSeasonStrategy(input({
    races: [],
    availability: { availableDays: [0, 1, 2, 3], weeklyHours: 6 },
  }));

  expect(strategy.loadModel.eventPriorityBias).toBe('maintenance');
  expect(strategy.loadModel.annualTargetHours).toBe(288);
  expect(strategy.loadModel.annualTargetTss).toBe(13_824);
});
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm test -w backend -- --run src/pulse/services/season-strategy.test.ts
```

Expected: PASS.

## Task 3: Feed Plan Engine Conservatively

- [ ] **Step 1: Cap weekly target**

In `plan-engine.ts`, when season strategy includes compensation:

```ts
const compensation = params.seasonStrategy?.loadModel.missedLoadCompensation.compensationTssNext14d ?? 0;
const safeWeeklyCompensation = Math.round(compensation / 2);
```

Add only `safeWeeklyCompensation` to target TSS if:

- `params.seasonStrategy.loadModel.currentWeek.kind` is not `taper`, `race_week`, `recovery` or `deload`;
- TSB is greater than `-8`;
- no critical risk signal exists.

- [ ] **Step 2: Trace the decision**

Add to plan reasons:

```ts
reasons.push(`ATP: ${safeWeeklyCompensation} TSS Nachholanteil eingeplant; ${capReason}`);
```

If compensation is blocked:

```ts
reasons.push(`ATP: Nachhol-Last geblockt, weil ${currentKind} / TSB ${params.load.tsb.toFixed(1)} Vorrang hat.`);
```

## Task 4: Keep UI Simple

- [ ] **Step 1: Add a compact ATP row**

In `frontend/src/features/plan/strategy/strategy-components.tsx`, inside the Season Strategy card:

```tsx
<div data-testid="season-atp-row">
  <span>Jahresziel</span>
  <strong>{model.annualTargetHours} h / {model.annualTargetTss} TSS</strong>
  <p>{model.missedLoadCompensation.capReason}</p>
</div>
```

- [ ] **Step 2: Hide when fields are absent**

Keep `loadModel` optional as decided earlier. If `annualTargetHours` is null, do not render the row.

- [ ] **Step 3: Verification**

Run:

```bash
npm test -w backend -- --run src/pulse/services/season-strategy.test.ts src/pulse/services/plan-engine.test.ts src/pulse/services/plan-trace.test.ts
npm run build -w frontend
npm run test:e2e:smoke
```

Expected: PASS.

## Acceptance

- Missed training is not blindly crammed into the next week.
- A events create stronger taper protection than B/C events.
- Plan trace explains season/ATP influence.
- UI remains one season lane, not a TrainingPeaks clone.
