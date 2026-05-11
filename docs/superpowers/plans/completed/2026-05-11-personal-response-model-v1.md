# Personal Response Model v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a read-only Personal Response Model that explains how Tobi tends to respond to training, recovery, mental load and fueling signals without pretending to be predictive beyond the available evidence.

**Architecture:** Start with a deterministic backend summary service over existing Pulse tables and contracts. Expose it through one read-only endpoint, surface it in Data > Analyse as a compact evidence block, and feed only safe summaries into later Plan/Coach phases. No migration is required for v1.

**Tech Stack:** TypeScript, Fastify, Drizzle, React/Vite, TanStack Query, shared Pulse contracts, Vitest, Playwright.

**Implementation note:** The endpoint was implemented in `backend/src/pulse/routes/daily-loop-routes.ts` rather than `training-routes.ts`, because the final integration point combines Daily Outcome Learning, Daily Decision Quality, mental check-ins, execution/RPE and Fueling Baseline as a daily-loop evidence surface.

---

## Evidence Inputs

- Canonical roadmap: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`.
- Existing daily learning: `backend/src/pulse/services/daily-outcome-learning.ts`, `backend/src/pulse/services/daily-decision-quality.ts`.
- Existing prognosis guardrail: `backend/src/pulse/services/prognosis-engine.ts`.
- Existing plan learning: `backend/src/pulse/services/plan-learning.ts`, `backend/src/pulse/services/training-execution-review.ts`.
- Existing data surfaces: `frontend/src/pages/Data.tsx`, `frontend/src/features/data/analysen/`.
- Existing route and API patterns: `backend/src/pulse/routes/training-routes.ts`, `frontend/src/pulse/api-client.ts`, `frontend/src/pulse/hooks.ts`.

## Product Contract

Personal Response Model v1 answers three questions:

1. **What pattern is visible?** Example: hard workouts after low sleep and high mental stress tend to create watch-level follow-up signals.
2. **How strong is the evidence?** `insufficient`, `learning`, or `useful`.
3. **What should Pulse do next?** A conservative next coaching adjustment such as keep intensity capped, ask for feedback, or repeat the same strategy only when the last outcome was reinforced.

It must not:

- diagnose mental health or medical conditions;
- create hidden Garmin writes, plan changes or LLM calls;
- infer heat, sodium or sweat-rate trends without measured data;
- replace the existing plan engine in v1.

## Phase Decomposition

### Phase 1: Read-Only Summary In Data

This plan implements Phase 1 only. It creates the deterministic model and a Data evidence surface.

### Phase 2: Plan Influence Preview

Later PR: include the summary as read-only `personalResponse` evidence in Plan Refresh Preview and scenario previews before apply.

### Phase 3: Predictive Goal Engine Input

Later PR: feed stable response signals into goal probability and limiter-risk summaries.

### Phase 4: Coach Reflection Mode

Later PR: let Coach explain response patterns and ask one focused follow-up question after important workouts.

## Task 1: Shared Contract

**Files:**

- Modify: `shared/types/pulse/daily-loop.ts`
- Test: `backend/src/pulse/services/personal-response-model.test.ts`

- [x] **Step 1: Add response model types**

  Add these exports near the existing daily-learning contracts:

  ```ts
  export type PulsePersonalResponseEvidenceStrength = 'insufficient' | 'learning' | 'useful';
  export type PulsePersonalResponseSignalKind =
    | 'load_response'
    | 'mental_response'
    | 'fueling_response'
    | 'recovery_response'
    | 'execution_response';

  export interface PulsePersonalResponseSignal {
    kind: PulsePersonalResponseSignalKind;
    label: string;
    strength: PulsePersonalResponseEvidenceStrength;
    summary: string;
    evidence: string[];
    nextAdjustment: string;
  }

  export interface PulsePersonalResponseSummary {
    generatedAt: string;
    range: { from: string; to: string; days: number };
    strength: PulsePersonalResponseEvidenceStrength;
    headline: string;
    signals: PulsePersonalResponseSignal[];
    missingEvidence: string[];
  }

  export interface PulsePersonalResponseResponse {
    summary: PulsePersonalResponseSummary;
  }
  ```

- [x] **Step 2: Write a compile-facing service test**

  Create `backend/src/pulse/services/personal-response-model.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { buildPersonalResponseSummary } from './personal-response-model.js';

  describe('buildPersonalResponseSummary', () => {
    it('reports insufficient evidence when comparable outcomes are missing', () => {
      const summary = buildPersonalResponseSummary({
        today: '2026-05-11',
        days: 42,
        dailyOutcomes: [],
        decisionQuality: null,
        fuelingBaseline: null,
        mentalCheckins: [],
        executionReviews: [],
      });

      expect(summary.strength).toBe('insufficient');
      expect(summary.missingEvidence).toContain('Mindestens drei abgeschlossene Trainings-/Recovery-Tage mit Folgeevidenz fehlen.');
    });
  });
  ```

- [x] **Step 3: Run the failing test**

  Run:

  ```bash
  npm run test -w backend -- personal-response-model
  ```

  Expected: fail because `personal-response-model.ts` does not exist yet.

## Task 2: Deterministic Backend Model

**Files:**

- Create: `backend/src/pulse/services/personal-response-model.ts`
- Modify: `backend/src/pulse/services/personal-response-model.test.ts`

- [x] **Step 1: Implement the model input and summary builder**

  Create `backend/src/pulse/services/personal-response-model.ts`:

  ```ts
  import type {
    PulseDailyDecisionQualityResponse,
    PulseDailyOutcomeLearningItem,
    PulseFuelingOutcomeBaseline,
    PulsePersonalResponseSignal,
    PulsePersonalResponseSummary,
  } from '@coaching-os/shared/pulse';

  export interface PersonalResponseMentalCheckin {
    date: string;
    mood: number;
    energy: number;
    stress: number;
    motivation: number;
  }

  export interface PersonalResponseExecutionReview {
    date: string;
    plannedZone: number | null;
    rpe: number | null;
    durationMin: number | null;
    tss: number | null;
  }

  export interface BuildPersonalResponseSummaryInput {
    today: string;
    days: number;
    dailyOutcomes: PulseDailyOutcomeLearningItem[];
    decisionQuality: PulseDailyDecisionQualityResponse | null;
    fuelingBaseline: PulseFuelingOutcomeBaseline | null;
    mentalCheckins: PersonalResponseMentalCheckin[];
    executionReviews: PersonalResponseExecutionReview[];
  }

  function shiftIsoDate(date: string, days: number): string {
    const current = new Date(`${date}T00:00:00Z`);
    current.setUTCDate(current.getUTCDate() + days);
    return current.toISOString().split('T')[0]!;
  }

  function evidenceStrength(count: number): PulsePersonalResponseSummary['strength'] {
    if (count >= 6) return 'useful';
    if (count >= 3) return 'learning';
    return 'insufficient';
  }

  function buildExecutionSignal(input: BuildPersonalResponseSummaryInput): PulsePersonalResponseSignal {
    const usefulOutcomes = input.dailyOutcomes.filter(item => item.status === 'reinforced' || item.status === 'superseded_by_data');
    const staleOutcomes = input.dailyOutcomes.filter(item => item.status === 'stale_pattern');
    const strength = evidenceStrength(usefulOutcomes.length + staleOutcomes.length);
    return {
      kind: 'execution_response',
      label: strength === 'insufficient' ? 'Ausfuehrung noch lernen' : 'Ausfuehrung reagiert sichtbar',
      strength,
      summary: strength === 'insufficient'
        ? 'Pulse hat noch zu wenige abgeschlossene Entscheidungen mit Folgeevidenz.'
        : `${usefulOutcomes.length} Entscheidung(en) wurden bestaetigt, ${staleOutcomes.length} wiederholte Muster sollten vorsichtig angepasst werden.`,
      evidence: [
        `${usefulOutcomes.length} bestaetigte oder durch Garmin ersetzte Entscheidung(en)`,
        `${staleOutcomes.length} stale Entscheidungsmuster`,
      ],
      nextAdjustment: strength === 'insufficient'
        ? 'Nach wichtigen Einheiten Feedback, Fueling und naechste Tagesdaten erfassen.'
        : 'Bestaetigte Entscheidungstypen beibehalten und stale Muster kleiner oder anders getaktet anbieten.',
    };
  }

  function buildMentalSignal(input: BuildPersonalResponseSummaryInput): PulsePersonalResponseSignal {
    const lowEnergy = input.mentalCheckins.filter(checkin => checkin.energy <= 4 || checkin.stress >= 7);
    const strength = evidenceStrength(input.mentalCheckins.length);
    return {
      kind: 'mental_response',
      label: strength === 'insufficient' ? 'Mentaler Kontext offen' : 'Mentale Last einbeziehen',
      strength,
      summary: strength === 'insufficient'
        ? 'Zu wenige Check-ins fuer ein stabiles persoenliches Muster.'
        : `${lowEnergy.length} von ${input.mentalCheckins.length} Check-ins zeigen niedrige Energie oder hohen Stress.`,
      evidence: [
        `${input.mentalCheckins.length} Check-in(s) im Zeitraum`,
        `${lowEnergy.length} Check-in(s) mit Energie <=4 oder Stress >=7`,
      ],
      nextAdjustment: lowEnergy.length >= 2
        ? 'An Tagen mit niedriger Energie oder hohem Stress zuerst Boundary, Warm-up und leichtere Alternative anbieten.'
        : 'Mentalen Kontext weiter erfassen, aber keine harte Planbremse daraus ableiten.',
    };
  }

  function buildFuelingSignal(input: BuildPersonalResponseSummaryInput): PulsePersonalResponseSignal {
    const baseline = input.fuelingBaseline;
    const strength = baseline?.status === 'stable' ? 'useful' : baseline?.status === 'learning' ? 'learning' : 'insufficient';
    return {
      kind: 'fueling_response',
      label: baseline?.label ?? 'Fueling-Baseline offen',
      strength,
      summary: baseline?.summary ?? 'Noch keine belastbare Fueling-Baseline fuer lange Einheiten.',
      evidence: baseline?.evidence ?? ['Fueling-Logs mit Carbs, Dauer, Flaschen und GI-Komfort fehlen.'],
      nextAdjustment: strength === 'insufficient'
        ? 'Lange Einheiten mit vollstaendigem During-Log abschliessen.'
        : 'Naechste lange Einheit nur in kleinen Schritten veraendern und GI-Komfort wieder loggen.',
    };
  }

  export function buildPersonalResponseSummary(input: BuildPersonalResponseSummaryInput): PulsePersonalResponseSummary {
    const signals = [
      buildExecutionSignal(input),
      buildMentalSignal(input),
      buildFuelingSignal(input),
    ];
    const usefulCount = signals.filter(signal => signal.strength === 'useful').length;
    const learningCount = signals.filter(signal => signal.strength === 'learning').length;
    const strength = usefulCount >= 2 ? 'useful' : usefulCount + learningCount >= 2 ? 'learning' : 'insufficient';
    const missingEvidence = [
      input.dailyOutcomes.length < 3 ? 'Mindestens drei abgeschlossene Trainings-/Recovery-Tage mit Folgeevidenz fehlen.' : null,
      input.mentalCheckins.length < 3 ? 'Mindestens drei aktuelle mentale Check-ins fehlen.' : null,
      input.fuelingBaseline?.status === 'insufficient_data' || input.fuelingBaseline == null ? 'Mindestens drei vergleichbare vollstaendige During-Fueling-Logs fehlen.' : null,
    ].filter((item): item is string => item != null);

    return {
      generatedAt: `${input.today}T00:00:00.000Z`,
      range: { from: shiftIsoDate(input.today, -Math.max(1, input.days)), to: input.today, days: input.days },
      strength,
      headline: strength === 'useful'
        ? 'Pulse erkennt persoenliche Reaktionsmuster.'
        : strength === 'learning'
        ? 'Pulse lernt deine Reaktionsmuster.'
        : 'Pulse sammelt noch belastbare Reaktionsdaten.',
      signals,
      missingEvidence,
    };
  }
  ```

- [x] **Step 2: Extend tests for useful/learning states**

  Add tests that pass representative `dailyOutcomes`, `mentalCheckins` and a learning `fuelingBaseline`, then assert:

  ```ts
  expect(summary.signals.map(signal => signal.kind)).toEqual(['execution_response', 'mental_response', 'fueling_response']);
  expect(summary.headline).toMatch(/Pulse lernt|Pulse erkennt/);
  expect(summary.signals.find(signal => signal.kind === 'mental_response')?.nextAdjustment).toContain('Boundary');
  ```

- [x] **Step 3: Run backend service tests**

  Run:

  ```bash
  npm run test -w backend -- personal-response-model daily-outcome-learning daily-decision-quality fueling-outcome-baseline
  ```

  Expected: all selected tests pass.

## Task 3: Read-Only API Endpoint

**Files:**

- Modify: `backend/src/pulse/routes/training-routes.ts`
- Test: `backend/src/pulse/services/personal-response-model.test.ts`

- [x] **Step 1: Add a route-level loader**

  In `training-routes.ts`, add a read-only `GET /personal-response` endpoint near existing `/outcomes/daily` and `/fueling/debt` routes. Reuse existing loaders where possible:

  - daily outcome learning for the last 42 days;
  - daily decision quality for the same range;
  - `loadFuelingOutcomeBaseline(userId, today)`;
  - latest 42 days of `pulseMentalCheckins`;
  - recent RPE/activity review rows already used by plan trace or execution review.

  Return:

  ```ts
  { summary: buildPersonalResponseSummary(...) }
  ```

- [x] **Step 2: Keep the endpoint side-effect-free**

  Verify the endpoint does not call:

  - Garmin write/sync endpoints;
  - plan apply/regeneration mutations;
  - LLM helpers;
  - migration or profile write paths.

- [x] **Step 3: Run backend build**

  Run:

  ```bash
  npm run build -w backend
  ```

  Expected: TypeScript build passes.

## Task 4: Frontend Data Surface

**Files:**

- Modify: `frontend/src/pulse/api-client.ts`
- Modify: `frontend/src/pulse/hooks.ts`
- Create: `frontend/src/features/data/response/personal-response-components.tsx`
- Modify: `frontend/src/pages/Data.tsx`
- Test: `frontend/e2e/pulse-usability.spec.ts`

- [x] **Step 1: Add API client and hook**

  Add `pulseApi.personalResponse.get()` and `usePersonalResponse()` following the existing query-key style.

- [x] **Step 2: Render inside Data > Analyse**

  Create `PersonalResponsePanel` with:

  - headline from `summary.headline`;
  - one compact row per signal;
  - `strength` as a small status badge;
  - `missingEvidence` as a collapsed or subdued evidence list;
  - no new top-level tab in v1.

- [x] **Step 3: Add Playwright coverage**

  In `frontend/e2e/pulse-usability.spec.ts`, add a mocked API test:

  ```ts
  test('Data Analyse shows personal response patterns without adding another dashboard', async ({ page }) => {
    await mockPulseApi(page, {
      personalResponse: {
        summary: {
          generatedAt: '2026-05-11T00:00:00.000Z',
          range: { from: '2026-03-30', to: '2026-05-11', days: 42 },
          strength: 'learning',
          headline: 'Pulse lernt deine Reaktionsmuster.',
          signals: [{
            kind: 'mental_response',
            label: 'Mentale Last einbeziehen',
            strength: 'learning',
            summary: '2 von 4 Check-ins zeigen niedrige Energie oder hohen Stress.',
            evidence: ['4 Check-ins im Zeitraum', '2 Check-ins mit Energie <=4 oder Stress >=7'],
            nextAdjustment: 'Boundary und leichtere Alternative anbieten.',
          }],
          missingEvidence: ['Mindestens drei vergleichbare vollstaendige During-Fueling-Logs fehlen.'],
        },
      },
    });

    await page.goto('/data?tab=analysis#data-personal-response');
    await expect(page.getByTestId('personal-response-panel')).toContainText('Pulse lernt deine Reaktionsmuster');
    await expect(page.getByTestId('personal-response-panel')).toContainText('Mentale Last einbeziehen');
    await expect(page.getByTestId('personal-response-panel')).toContainText('Boundary');
  });
  ```

- [x] **Step 4: Run focused frontend checks**

  Run:

  ```bash
  npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium --grep "personal response|Data Analyse"
  npm run build -w frontend
  ```

  Expected: focused E2E and frontend build pass.

## Task 5: Verification And Close

**Files:**

- Modify: `docs/decisions.md`
- Modify: `docs/ai/current-focus.md`
- Move on completion: this plan to `docs/superpowers/plans/completed/2026-05-11-personal-response-model-v1.md`

- [x] **Step 1: Full touched-surface verification**

  Run:

  ```bash
  npm run test -w backend -- personal-response-model daily-outcome-learning daily-decision-quality fueling-outcome-baseline
  npm run build -w backend
  npm run build -w frontend
  npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium --grep "personal response|Data Analyse"
  ```

- [x] **Step 2: Route evidence if the Data layout changes visibly**

  If `Data.tsx` changes layout or ordering beyond adding the panel, run:

  ```bash
  PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/personal-response-v1 npm run qa:ux-evidence
  ```

- [x] **Step 3: Record decision**

  Add a newest-first `docs/decisions.md` entry:

  - Personal Response Model v1 is deterministic, read-only and Data-first.
  - It is evidence-strength based, not a hidden plan mutation engine.
  - Plan/Coach/Goal consumers come in later PRs after the Data explanation is visible.

## Acceptance

- `GET /api/pulse/personal-response` returns a deterministic read-only summary from existing data.
- Data > Analyse explains response patterns and missing evidence without adding another dashboard.
- Weak evidence is labeled as weak; Pulse does not overstate nutrition, heat, sodium, sweat-rate or mental-health inference.
- No Garmin writes, plan mutations, migrations or LLM calls are introduced.
- The implementation creates the foundation for Predictive Goal Engine v1 without building that engine yet.
