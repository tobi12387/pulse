# Strength Mobility Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Pulse's generic `strength_support` idea into concrete, low-friction strength/mobility sessions that support cycling/running without adding training stress confusion.

**Architecture:** Add a small deterministic support-session library, preference-light equipment assumptions and reuse existing Plan/detail surfaces. Keep strength as a supporting plan element; do not create a habit tracker, streak system or new top-level area.

**Tech Stack:** TypeScript pure service, existing planned-workout steps/description fields, React Plan/Data surfaces, Vitest.

---

## Files

- Create: `backend/src/pulse/services/support-session-library.ts`
- Create: `backend/src/pulse/services/support-session-library.test.ts`
- Modify: `backend/src/pulse/services/workout-library.ts`
- Modify: `backend/src/pulse/services/today-options.ts`
- Modify: `frontend/src/components/WorkoutDetailModal.tsx`
- Modify: `frontend/src/pages/Plan.tsx` only for the existing `StrengthStatsCard` / Today Options placement
- Modify: `frontend/e2e/fixtures/pulse-api.ts`
- Modify: `shared/types/pulse/plan.ts`
- Test: `frontend/e2e/pulse-smoke.spec.ts` or focused Plan detail coverage

## Task 1: Add A Support Session Library

- [ ] **Step 1: Create tests**

Create `backend/src/pulse/services/support-session-library.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSupportSession } from './support-session-library.js';

describe('support-session-library', () => {
  it('creates a short cycling prehab session with concrete blocks', () => {
    const session = buildSupportSession({ focus: 'cycling_prehab', durationMin: 25, fatigue: 'normal' });

    expect(session.title).toBe('Cycling Prehab 25');
    expect(session.blocks.map(block => block.label)).toEqual(['Mobility', 'Core', 'Glutes', 'Cooldown']);
    expect(session.description).toContain('kein Zusatzstress');
  });

  it('downshifts when fatigue is high', () => {
    const session = buildSupportSession({ focus: 'mobility_only', durationMin: 15, fatigue: 'high' });

    expect(session.blocks.every(block => block.intensity === 'easy')).toBe(true);
    expect(session.planNote).toContain('Recovery');
  });
});
```

- [ ] **Step 2: Implement service**

Create `backend/src/pulse/services/support-session-library.ts`:

```ts
export type SupportSessionFocus = 'cycling_prehab' | 'run_prehab' | 'mobility_only' | 'core_stability';

export interface SupportSessionBlock {
  label: string;
  minutes: number;
  intensity: 'easy' | 'controlled';
  examples: string[];
}

export interface SupportSession {
  title: string;
  description: string;
  planNote: string;
  blocks: SupportSessionBlock[];
}

export function buildSupportSession(input: {
  focus: SupportSessionFocus;
  durationMin: number;
  fatigue: 'normal' | 'high';
}): SupportSession {
  const duration = Math.max(10, Math.min(45, input.durationMin));
  const easy = input.fatigue === 'high';
  const blockIntensity = easy ? 'easy' : 'controlled';
  const mobilityMin = Math.max(5, Math.round(duration * 0.25));
  const coreMin = input.focus === 'mobility_only' ? 0 : Math.max(5, Math.round(duration * 0.25));
  const gluteMin = input.focus === 'cycling_prehab' || input.focus === 'run_prehab' ? Math.max(5, Math.round(duration * 0.25)) : 0;
  const cooldownMin = Math.max(3, duration - mobilityMin - coreMin - gluteMin);

  const blocks: SupportSessionBlock[] = [
    { label: 'Mobility', minutes: mobilityMin, intensity: 'easy', examples: ['Hips', 'T-spine', 'ankle rocks'] },
    ...(coreMin > 0 ? [{ label: 'Core', minutes: coreMin, intensity: blockIntensity, examples: ['dead bug', 'side plank', 'bird dog'] } satisfies SupportSessionBlock] : []),
    ...(gluteMin > 0 ? [{ label: 'Glutes', minutes: gluteMin, intensity: blockIntensity, examples: ['glute bridge', 'monster walk', 'single-leg hinge'] } satisfies SupportSessionBlock] : []),
    { label: 'Cooldown', minutes: cooldownMin, intensity: 'easy', examples: ['breathing', 'easy stretch'] },
  ];

  return {
    title: `${input.focus === 'cycling_prehab' ? 'Cycling Prehab' : input.focus === 'run_prehab' ? 'Run Prehab' : input.focus === 'core_stability' ? 'Core Stability' : 'Mobility'} ${duration}`,
    description: easy
      ? 'Sehr leichte Support-Session fuer Beweglichkeit und Recovery; kein Zusatzstress.'
      : 'Support-Session fuer Belastbarkeit; kontrolliert ausfuehren, kein Muskelversagen.',
    planNote: easy
      ? 'Recovery bleibt Prioritaet; diese Einheit darf sich leichter anfuehlen als geplant.'
      : 'Unterstuetzt Haltung, Core und robuste Wiederholbarkeit.',
    blocks,
  };
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm test -w backend -- --run src/pulse/services/support-session-library.test.ts
```

Expected: PASS.

## Task 2: Integrate With Workout Library

- [ ] **Step 1: Use support descriptions for strength**

In `workout-library.ts`, when `archetype.id === 'strength_support' || archetype.id === 'strength_prehab'`, call `buildSupportSession` and convert blocks into `WorkoutStep[]`:

```ts
return session.blocks.map(block => ({
  type: 'steady',
  durationMin: block.minutes,
  zone: 1,
  description: `${block.label}: ${block.examples.join(', ')}`,
}));
```

- [ ] **Step 2: Include support note in description**

Append `session.planNote` to the generated library description for strength workouts.

- [ ] **Step 3: Test generated steps**

Add to `workout-library.test.ts`:

```ts
it('turns strength support into concrete blocks instead of a generic note', () => {
  const prescription = buildWorkoutLibraryPrescription({ activityType: 'strength', zone: 1, durationMin: 25, targetTss: 15 });

  expect(prescription.steps.length).toBeGreaterThanOrEqual(3);
  expect(prescription.steps.map(step => step.description).join(' ')).toContain('Core');
});
```

## Task 3: Surface Without Creating Habit Tracking

- [ ] **Step 1: Plan detail UI**

In `frontend/src/components/WorkoutDetailModal.tsx`, show support blocks inside the existing workout detail modal only for `activityType === 'strength'`. Reuse the existing step list styling where it fits, but label the section as a support session, not a Garmin interval workout:

```tsx
{workout.activityType === 'strength' && workout.steps && (
  <section className="card" data-testid="support-session-blocks">
    <span className="label-mono">SUPPORT-SESSION</span>
    <p>Nicht als Garmin-Intervallstruktur gedacht; Fokus liegt auf sauberer Ausfuehrung.</p>
    {workout.steps.map(step => (
      <div key={`${step.description}-${step.durationMin}`}>
        <strong>{step.durationMin} min</strong>
        <span>{step.description}</span>
      </div>
    ))}
  </section>
)}
```

For strength/support workouts, either hide the Garmin upload CTA or show the existing sync contract as degraded with copy: `Support-Session wird als Notiz/Blockliste behandelt, nicht als Intervallstruktur.`

- [ ] **Step 2: Today Options**

In `today-options.ts`, make Skills/Mobility option clearer:

```ts
title: input.readinessScore < 60 ? 'Mobility leicht' : 'Strength Support',
detail: input.readinessScore < 60
  ? '15-20 min Beweglichkeit und Atmung, ohne Trainingsstress.'
  : '25 min Core, Mobility und Glutes als Unterstuetzung fuer Rad/Lauf.',
```

- [ ] **Step 3: Existing strength summary**

Do not add a new Data card for support sessions in this slice. If a count is useful, add it to the existing `StrengthStatsCard` in `frontend/src/pages/Plan.tsx` with neutral language such as `Support-Sessions diesen Monat`; no streaks, badges or habit language.

- [ ] **Step 4: Verification**

Run:

```bash
npm test -w backend -- --run src/pulse/services/support-session-library.test.ts src/pulse/services/workout-library.test.ts src/pulse/services/today-options.test.ts
npm run build -w frontend
npm run test:e2e:smoke
```

Expected: PASS.

## Acceptance

- Strength/Mobility suggestions are concrete enough to execute.
- High fatigue downshifts to mobility/recovery.
- No habit tracker, streak or new navigation is introduced.
- Garmin sync degrades gracefully as notes when strength is not structured like endurance intervals.
- Browser coverage proves the strength detail modal shows support blocks and does not present them as a normal Garmin interval workout.
