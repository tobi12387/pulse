# Contextual Coach Mode v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Coach visibly use Personal Response, Goal Projection and Season Strategy evidence before changing any LLM or plan behavior.

**Architecture:** v1 is a frontend-only, read-only context layer on the existing `/coach` route. It consumes existing TanStack hooks for `GET /api/pulse/personal-response`, `GET /api/pulse/goal-projection` and `GET /api/pulse/season-strategy`, summarizes the current coaching basis, and pre-fills a focused prompt only after an explicit click. It must not send a Coach message, mutate plans, write Garmin data, trigger AI Insights or add a new backend endpoint.

**Tech Stack:** React/Vite, TanStack Query hooks, shared Pulse contracts, Playwright.

---

## File Structure

- Create: `frontend/src/features/coach/contextual-coach-mode.tsx`
  - Owns copy, prompt composition and display for the Coach context layer.
- Modify: `frontend/src/pages/Coach.tsx`
  - Load existing evidence hooks and render `ContextualCoachModeCard` on the empty Coach state.
- Modify: `frontend/e2e/pulse-usability.spec.ts`
  - Add browser coverage proving the card renders and only pre-fills the prompt.
- Modify docs:
  - `docs/decisions.md`
  - `docs/ai/current-focus.md`
  - `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`
  - move this plan to `docs/superpowers/plans/completed/`
  - update `docs/superpowers/plans/completed/README.md`

## Task 1: Coach Context Card

**Files:**
- Create: `frontend/src/features/coach/contextual-coach-mode.tsx`
- Modify: `frontend/src/pages/Coach.tsx`

- [x] **Step 1: Create the component**

Create `ContextualCoachModeCard` with props:

```ts
{
  personalResponse: PulsePersonalResponseResponse | null;
  goalProjection: PulseGoalProjectionResponse | null;
  seasonStrategy: PulseSeasonStrategyResponse | null;
  isLoading: boolean;
  onPrompt: (prompt: string) => void;
}
```

The card must:

- render `data-testid="coach-contextual-mode-card"`;
- headline the mode as `Coach-Kontext`;
- show one current personal-response signal, one top-goal signal and one season signal;
- show compact evidence/missing-evidence chips;
- expose one button `Mit Kontext fragen`;
- prefill a prompt that includes personal response, goal projection, next intervention and season contract;
- avoid automatic POSTs or navigation.

- [x] **Step 2: Integrate into Coach**

In `frontend/src/pages/Coach.tsx`:

- import `usePersonalResponse`, `useGoalProjection`, `useSeasonStrategy`;
- import `ContextualCoachModeCard`;
- call the hooks in `Coach()`;
- render the card in the empty Coach state after `DailyBriefingGuide` and before `QuickPrompts`;
- hide the card once a conversation is active by using the same `!hasMessages && !voiceCard` condition as QuickPrompts.

## Task 2: Browser Coverage

**Files:**
- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [x] **Step 1: Add a Coach test**

Add a test that:

- calls `mockPulseApi` with an `onRequest` collector;
- navigates to `/coach`;
- expects `coach-contextual-mode-card` to contain `Coach-Kontext`, `Pulse lernt deine Reaktionsmuster`, `70.3 Kraichgau`, `Fueling-Praxis absichern`, `Build`;
- clicks `Mit Kontext fragen`;
- expects the textarea to contain those same evidence anchors;
- expects no `POST /api/pulse/coach`, no `/api/pulse/insights`, and no write methods.

- [x] **Step 2: Run focused browser test**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Contextual Coach|Coach"
```

## Task 3: Docs And PR

- [x] **Step 1: Record decision**

Decision:

```markdown
## 2026-05-11 — Contextual Coach Mode v1 bleibt read-only

- **Decision:** Contextual Coach Mode v1 wird als read-only Coach-Kontextkarte umgesetzt, die Personal Response, Goal Projection und Season Strategy Evidence sichtbar macht und nur per Klick eine fokussierte Frage vorbereitet.
- **Why:** Coach soll persoenlicher wirken, aber nicht heimlich LLM-Kontext, Planlogik oder Garmin-Writes veraendern. Erst muss sichtbar werden, welche Evidenz der Coach nutzt.
- **Alternatives:** Backend-/LLM-Prompt sofort erweitern; Coach als neuen Haupttab bauen; automatische Coach-Nachricht senden.
```

- [x] **Step 2: Update roadmap**

Mark Contextual Coach Mode v1 as implemented and make Customizable Daily Surface the next non-gated long-term step.

- [x] **Step 3: Verification**

Run:

```bash
npm run build -w frontend
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Contextual Coach|Coach"
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/contextual-coach-mode-v1 npm run qa:ux-evidence
```

- [ ] **Step 4: PR**

Stage explicit files, commit, push, create PR, wait for CI, merge after green and deploy runtime changes.

## Implementation Note

Implemented as a frontend-only, read-only Coach slice:

- `ContextualCoachModeCard` consumes existing Personal Response, Goal Projection and Season Strategy query data.
- `/coach` shows the card only in the empty conversation state, before generic quick prompts.
- `Mit Kontext fragen` prepares a draft prompt; it does not send, navigate, mutate plans, call Insights or touch Garmin.
