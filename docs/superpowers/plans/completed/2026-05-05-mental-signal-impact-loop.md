# Mental Signal Impact Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a Mental Check-in, Pulse should visibly show how the saved mental state affects today's decision, Plan caution and Coach context.

**Architecture:** Reuse the existing numeric check-in contract and PulseContext. Add a small shared frontend classifier for qualitative labels so Home, Data and Coach use the same language; surface impact text near existing daily-decision and Plan components without adding new routes.

**Tech Stack:** React/Vite, shared Pulse API types, TanStack Query, Playwright.

---

## Context

PR #176 made the input easier. The next product proof is not another input redesign; it is visible signal impact.

Do not rebuild the Mental Check-in form, voice preview, Home compact check-in or Coach context card. This plan aligns language and makes the saved signal consequential.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Create | `frontend/src/features/mental/mental-impact.ts` | Shared qualitative mapping and impact copy from saved check-in scores |
| Modify | `frontend/src/features/data/mental/mental-components.tsx` | Use shared labels for state cards and saved summary |
| Modify | `frontend/src/pages/Home.tsx` | Show post-save impact line in the daily decision area |
| Modify | `frontend/src/pages/Plan.tsx` | Show mental caution next to next workout / plan decision when relevant |
| Modify | `frontend/src/pages/Coach.tsx` | Reuse shared labels in mental context summary |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | End-to-end evidence that one saved check-in affects Home, Plan and Coach wording |
| Modify | `frontend/e2e/ux-data-mental.spec.ts` | Focused tests for shared labels after save |

## Task 1: Add Shared Mental Impact Classifier

- [ ] **Step 1: Create failing unit-like E2E expectation**

Add to `frontend/e2e/ux-data-mental.spec.ts`:

```ts
test('saved Schutzmodus check-in uses the same mental impact language across Data, Home and Coach', async ({ page }) => {
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
  });

  await page.goto('/data?tab=mental');
  await page.getByRole('radio', { name: 'Mentale Lage: Schutzmodus' }).click();
  await page.getByRole('button', { name: 'Check-in senden' }).click();
  await expect(page.getByText('CHECK-IN HEUTE ERLEDIGT')).toBeVisible();

  await page.goto('/');
  await expect(page.getByText(/Mental Health: schuetzen/i)).toBeVisible();

  await page.goto('/coach');
  await expect(page.getByTestId('coach-mental-context-summary')).toContainText(/schuetzen/i);
});
```

- [ ] **Step 2: Run and verify red**

```bash
npm run test:e2e -- frontend/e2e/ux-data-mental.spec.ts --project=desktop-chromium
```

Expected: FAIL until the shared impact copy is rendered outside the Data form.

- [ ] **Step 3: Create `frontend/src/features/mental/mental-impact.ts`**

```ts
export type MentalImpactLevel = 'stable' | 'steady' | 'protect';

export type MentalScores = {
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
};

export function mentalImpactLevel(scores: MentalScores): MentalImpactLevel {
  if (scores.mood <= 4 || scores.energy <= 3 || scores.stress >= 7 || scores.motivation <= 3) return 'protect';
  if (scores.mood <= 6 || scores.energy <= 5 || scores.stress >= 5 || scores.motivation <= 6) return 'steady';
  return 'stable';
}

export function mentalImpactLabels(level: MentalImpactLevel): {
  health: string;
  fitness: string;
  dailyImpact: string;
  planImpact: string;
} {
  if (level === 'protect') {
    return {
      health: 'schuetzen',
      fitness: 'schonen',
      dailyImpact: 'Heute kleinere Schritte, klare Grenze und kein Zusatzdruck.',
      planImpact: 'Plan vorsichtig interpretieren: Intensitaet nur bewusst halten.',
    };
  }
  if (level === 'steady') {
    return {
      health: 'sensibel',
      fitness: 'dosieren',
      dailyImpact: 'Heute hilft ein klarer Rahmen mehr als mehr Optionen.',
      planImpact: 'Plan bleibt moeglich, aber mit enger Belastungsgrenze.',
    };
  }
  return {
    health: 'stabil',
    fitness: 'bereit',
    dailyImpact: 'Heute reicht ein normaler Startimpuls ohne Sonderbremse.',
    planImpact: 'Plan kann normal bewertet werden, solange Garmin/Readiness mitziehen.',
  };
}
```

## Task 2: Use Shared Labels In Data

- [ ] **Step 1: Replace duplicated profile label constants where practical**

In `frontend/src/features/data/mental/mental-components.tsx`, import `mentalImpactLabels` and keep the existing state cards visually unchanged. Use the shared labels for summary and saved notes.

- [ ] **Step 2: Verify Data-focused tests**

```bash
npm run test:e2e -- frontend/e2e/ux-data-mental.spec.ts --project=desktop-chromium --project=mobile-chromium
```

Expected: PASS.

## Task 3: Surface Impact On Home And Plan

- [ ] **Step 1: Home impact line**

In `frontend/src/pages/Home.tsx`, near the daily decision card, render:

```tsx
<p data-testid="mental-impact-summary">
  Mental Health: {labels.health}. Mental Fitness: {labels.fitness}. {labels.dailyImpact}
</p>
```

Only render when today's check-in data is available in the Home/PulseContext data used by the page.

- [ ] **Step 2: Plan caution line**

In `frontend/src/pages/Plan.tsx`, near the next training decision, render:

```tsx
<p data-testid="mental-plan-impact">
  Mentale Lage: {labels.planImpact}
</p>
```

Only render when a current check-in is available and the level is `steady` or `protect`.

## Task 4: Coach Context Alignment

- [ ] **Step 1: Replace local Coach wording**

In `frontend/src/pages/Coach.tsx`, use the shared labels in `coach-mental-context-summary`.

- [ ] **Step 2: Keep prompt explicit**

Prepared Coach prompts should mention the same labels:

```ts
`Mentale Lage: Mental Health ${labels.health}, Mental Fitness ${labels.fitness}.`
```

## Task 5: Verify

- [ ] **Step 1: Focused tests**

```bash
npm run test:e2e -- --grep "Mental|Check-in|Coach uses today mental"
```

Expected: PASS.

- [ ] **Step 2: Full frontend build**

```bash
npm run build -w frontend
```

Expected: PASS.

## Acceptance

- Home, Data and Coach use one shared qualitative mental language.
- A saved check-in visibly changes at least one daily decision or plan caution line.
- No new backend contract or migration is introduced.
- The Mental Check-in input UI is not rebuilt.
