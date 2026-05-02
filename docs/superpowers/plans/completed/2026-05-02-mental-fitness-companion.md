# Mental Fitness Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily Check-in should provide guided, state-aware mental-fitness questions and small supportive actions without clinical labeling or hidden inference.

**Architecture:** Use deterministic context policy to choose questions, then let the Coach explain them with the existing LLM wrapper when needed. Store only normal check-in fields, themes, `coachQuestions` and visible action decisions; do not add hidden psychological memory. Keep all language supportive, non-diagnostic and grounded in recent check-ins, readiness, training state and user-visible preferences.

**Tech Stack:** Fastify, Drizzle/Postgres, React 19, TanStack Query, Vite, Playwright, shared Pulse types.

---

## Context

Pulse already extracts check-ins, themes, voice-derived follow-up questions and mental/load overlays. The next gap is the quality of the starting questions: they should match today, especially rest days, low-readiness days, high Garmin stress, high subjective stress and resurfacing themes, and they should not ask about a future workout as if it were today.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Create | `backend/src/pulse/services/mental-companion.ts` | Pure question/action selection by daily state |
| Create | `backend/src/pulse/services/mental-companion.test.ts` | Non-clinical, state-aware policy tests |
| Modify | `shared/types/pulse.ts` | Shared guided check-in question/action types |
| Modify | `backend/src/pulse/lib/pulse-context.ts` | Provide compact mental context and next-workout/today distinction |
| Modify | `backend/src/pulse/services/coach-engine.ts` | Include question rationale and non-clinical boundaries in Coach context |
| Modify | `backend/src/pulse/services/next-best-actions.ts` | Add one supportive mental-fitness action source without creating habit tracking |
| Modify | `backend/src/pulse/plugin.ts` | Return guided check-in suggestions through existing Pulse endpoints |
| Modify | `frontend/src/pages/Coach.tsx` | Render guided questions without auto-send |
| Modify | `frontend/src/pages/Home.tsx` | Surface one mental-fitness nudge only when relevant |
| Modify | `frontend/src/pages/Data.tsx` | Show recent themes/protective factors in the Mental tab |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Browser coverage for rest-day and high-stress guided questions |

## Task 1: Guided Question Policy

- [x] **Step 1: Write failing policy tests**

  Create `backend/src/pulse/services/mental-companion.test.ts` with these cases:
  - rest day with no workout today asks about recovery boundary and mental load;
  - workout day asks about readiness and confidence for today's workout only;
  - high stress with low motivation suggests a boundary/reflection action;
  - resurfacing themes produce visible rationale rather than hidden inference;
  - policy output never contains diagnostic words such as `depression`, `anxiety disorder`, `burnout diagnosis`, `ADHD`, `trauma`, `insomnia`, `addiction` or clinical risk scoring language.

- [x] **Step 2: Implement `selectMentalCompanionGuidance`**

  Create `backend/src/pulse/services/mental-companion.ts` with:

  ```ts
  export interface GuidedCheckinQuestion {
    id: string;
    label: string;
    rationale: string;
    answerMode: 'scale' | 'short_text' | 'choice';
  }

  export interface GuidedMentalAction {
    id: string;
    label: string;
    rationale: string;
    targetRoute: '/coach' | '/data' | '/plan';
    closureKind: 'reflection' | 'boundary' | 'recovery' | 'movement' | 'support';
  }
  ```

  Keep selection deterministic and capped at three questions plus one action.

- [x] **Step 3: Verify policy**

  Run:

  ```bash
  npm test -w backend -- --run src/pulse/services/mental-companion.test.ts
  npm run typecheck
  ```

## Task 2: Backend Contract And Coach Context

- [x] **Step 1: Add shared types**

  Add `PulseGuidedCheckinQuestion`, `PulseGuidedMentalAction` and `PulseGuidedCheckinResponse` to `shared/types/pulse.ts`.

- [x] **Step 2: Return guided questions from Pulse**

  In `backend/src/pulse/plugin.ts`, expose a small authenticated endpoint such as `GET /api/pulse/checkin/guidance` or extend the existing briefing response if that endpoint already carries daily guidance. Prefer a dedicated endpoint if it keeps Home/Coach queries small.

- [x] **Step 3: Add Coach prompt guardrails**

  In `backend/src/pulse/services/coach-engine.ts`, include:
  - today's workout date distinction;
  - selected guided question rationale;
  - explicit "non-clinical, no diagnosis, no hidden trait inference" instruction;
  - crisis-language fallback that stops normal coaching and points to emergency/crisis support when immediate danger or self-harm is mentioned.

- [x] **Step 4: Add mental next-best action integration**

  Extend `PulseNextBestActionSource` with a mental-support source only if shared types allow it cleanly. The action must be closable/deferable through existing action decisions and must not become a recurring habit tracker.

- [x] **Step 5: Verify backend**

  Run:

  ```bash
  npm test -w backend -- --run src/pulse/services/mental-companion.test.ts src/pulse/services/coach-engine.test.ts src/pulse/services/next-best-actions.test.ts src/pulse/plugin.test.ts
  npm run typecheck
  ```

## Task 3: Coach/Home/Data UI

- [x] **Step 1: Add API client and hooks**

  Add a TanStack Query hook for the guidance endpoint in `frontend/src/pulse/hooks.ts` and `frontend/src/pulse/api-client.ts`.

- [x] **Step 2: Render guided questions in Coach**

  In `frontend/src/pages/Coach.tsx`, show guided question buttons near the Daily Briefing guide. Clicking a question fills the input; it must not auto-send.

- [x] **Step 3: Add Home nudge and Data context**

  In `frontend/src/pages/Home.tsx`, show at most one mental-fitness nudge when it is the primary next-best action or when no training action is open. In `frontend/src/pages/Data.tsx`, show recent themes/protective factors without clinical labels.

- [x] **Step 4: Add E2E coverage**

  Extend `frontend/e2e/fixtures/pulse-api.ts` and `frontend/e2e/pulse-usability.spec.ts` so rest-day guidance never references a future workout as today's decision.

- [x] **Step 5: Verify frontend**

  Run:

  ```bash
  npm run typecheck
  npm run test:e2e -- --grep "guided|Check-in|Coach|Mental"
  ```

## Acceptance

- Guided questions reflect today's actual training/rest state.
- Mental-fitness suggestions are supportive, non-diagnostic and visible to the user.
- Coach does not reopen completed hidden actions and does not frame future workouts as today's task.
- Users can skip the guided flow and still write freely.
- Self-harm or immediate danger language does not continue into normal coaching.
