# Workout Alternatives UX v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Plan and TrainNow alternatives explain their purpose, why-now reason, result impact and safe recommendation without adding another dashboard.

**Architecture:** Keep the existing Today Options and scenario-preview contracts. Add a frontend-only alternative contract layer in `TodayOptionsCard` and split scenario preview pending state from apply pending state so auto-preview never looks like an in-progress apply.

**Tech Stack:** React/Vite, TanStack Query hooks, shared Pulse today-options types, Playwright E2E.

---

## Evidence Inputs

- Canonical roadmap: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`.
- Baseline route evidence: `test-results/route-evidence/workout-alternatives-v2-baseline/2026-05-11-2c67d67/`.
- Current alternatives UI: `frontend/src/components/TodayOptionsCard.tsx`.
- Current scenario preview UI: `frontend/src/pages/Plan.tsx`.
- Existing tests: `frontend/e2e/pulse-smoke.spec.ts`, `frontend/e2e/pulse-usability.spec.ts`, `frontend/e2e/plan-no-garmin-write.spec.ts`, `frontend/e2e/route-evidence.spec.ts`.

## Task 1: Alternative Cards Follow The UX Task Contract

**Files:**

- Modify: `frontend/src/components/TodayOptionsCard.tsx`
- Test: `frontend/e2e/pulse-smoke.spec.ts`
- Test: `frontend/e2e/pulse-usability.spec.ts`

- [x] **Step 1: Write failing tests**

  Add tests that verify Plan's full Today Options alternatives expose:

  - `Ausweichoptionen` as an explicit section.
  - `Sicherste Option` summary before alternative cards.
  - `Zweck`, `Warum jetzt`, `Nach dem Klick` and `Sicher wenn` on visible alternative cards.
  - recovery/rest alternatives do not route directly into Garmin writes; they route to Home/Data or scenario preview only.

- [x] **Step 2: Implement frontend contract helpers**

  In `TodayOptionsCard.tsx`, add local helper functions derived from the existing `PulseTodayOption`:

  - `optionContract(option)` returns a title-safe purpose, why-now text, result preview and safety line.
  - `resultPreview(option)` describes target class: scenario preview, workout open, activity feedback, Data recovery or daily decision.
  - `safetyLine(option)` uses `kind`, `capabilityFit` and `signalLabels` to explain when the option is safest.

- [x] **Step 3: Render the contract only where density allows it**

  For `variant="full"`, render:

  - one compact `Ausweichoptionen` header when there are non-primary options;
  - one `Sicherste Option` line using the first rest/recovery option, otherwise the first secondary option;
  - four short contract rows inside each visible alternative card.

  Keep `variant="compact"` unchanged except for any inherited helper text that already fits.

## Task 2: Scenario Preview Does Not Look Like Apply While Auto-Preview Is Running

**Files:**

- Modify: `frontend/src/pages/Plan.tsx`
- Test: `frontend/e2e/pulse-smoke.spec.ts`
- Test: `frontend/e2e/pulse-usability.spec.ts`

- [x] **Step 1: Write failing tests**

  Add tests for the mobile-intent scenario route:

  - the result card contains a compact `Nach Apply` line with Garmin impact;
  - the apply button does not show `Wende an` while the auto-preview request is still pending;
  - the button remains a conscious apply action after preview data is present.

- [x] **Step 2: Split preview pending from mutation pending**

  In `PlanScenarioPreviewCard`, keep:

  - `previewPending = previewScenario.isPending`
  - `applyPending = createWorkout.isPending || updateWorkout.isPending`

  Disable apply while either is pending, but only use `Wende an…` for `applyPending`.

- [x] **Step 3: Add compact result preview**

  Above the TSS/duration/recovery tiles, add a `data-testid="scenario-result-contract"` block that states:

  - `Nach Apply`: Garmin create/update/delete summary or no Garmin change.
  - `Sicherste Entscheidung`: read warnings first, otherwise apply only if the session still matches today's body and time.

## Task 3: Verify And Close

**Files:**

- Modify: `docs/decisions.md`
- Modify: `docs/ai/current-focus.md`

- [x] **Step 1: Focused E2E**

  ```bash
  npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts frontend/e2e/pulse-usability.spec.ts frontend/e2e/plan-no-garmin-write.spec.ts --project=mobile-chromium --grep "Plan|Tagesoptionen|scenario|Today Options|Garmin"
  ```

- [x] **Step 2: Build and route evidence**

  ```bash
  npm run build -w frontend
  PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/workout-alternatives-v2 npm run qa:ux-evidence
  ```

- [x] **Step 3: Record decision and queue**

  Add a newest-first `docs/decisions.md` entry explaining that Workout Alternatives UX v2 is a frontend explanation layer over existing alternative/scenario contracts. Update `docs/ai/current-focus.md` so the next queue advances to Nutrition Trend Summaries only when repeated logs exist; otherwise keep optional Daily Delta/Garmin polish evidence-gated.

## Acceptance

- Visible Plan alternatives answer what they are for, why now, what happens after click and when they are the safer choice.
- Scenario previews never show an apply-in-progress label while only previewing.
- No Garmin write or plan mutation happens during route evidence or read-only QA.
- No backend, migration or shared contract change is required.

## Implementation Evidence

- Red checks before implementation:
  - `npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts --project=mobile-chromium --grep "Plan alternatives explain|mobile Home availability intent opens"` failed on the missing alternatives contract and missing scenario result contract.
  - `npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium --grep "Home surfaces quick availability intents"` failed on the missing scenario result contract.
- Green focused checks after implementation:
  - `npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts frontend/e2e/pulse-usability.spec.ts frontend/e2e/plan-no-garmin-write.spec.ts --project=mobile-chromium --grep "Plan|Tagesoptionen|scenario|Today Options|Garmin"` passed with 69 tests.
  - `npm run build -w frontend` passed.
  - `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/workout-alternatives-v2 npm run qa:ux-evidence` passed with 2 tests.
- Browser evidence:
  - `test-results/route-evidence/workout-alternatives-v2/2026-05-11-2c67d67/mobile-chromium/13-plan-mobile-intent-scenario.png` shows the scenario result contract and the disabled grey `Vorschau prüft...` state instead of a misleading apply-in-progress label.
