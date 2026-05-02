# Decision Closure & Coach Memory Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulse should not only recommend actions; it should remember whether they were accepted, deferred, completed or contradicted by real data, then use that history to improve future coaching.

**Architecture:** This wave comes after Garmin Execution Reconciliation and Plan Personalization Loop. It uses small explicit records for decisions and preferences instead of hidden prompt memory. All LLM calls remain routed through `backend/src/lib/llm.ts`, and user-editable preferences stay visible in Settings/Coach.

**Tech Stack:** Fastify, Drizzle/Postgres, PulseContext, React, TanStack Query, Web Push.

---

## Context

Pulse already has Next Best Actions, plan traces, RPE, health states, push topics and Coach check-ins. The remaining product gap is closure: Home/Coach can say "do this", but Pulse does not always know whether the recommendation was acted on, postponed, ignored or replaced by a real Garmin activity. That creates repeated prompts and makes the app feel less adaptive than the data allows.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `backend/src/db/pulse-schema.ts` | Add decision/action history and preference records |
| Create | `backend/src/db/migrations/00XX_decision_closure_memory.sql` | Additive migration |
| Create | `backend/src/pulse/services/decision-closure.ts` | Pure state transitions for recommended actions |
| Modify | `backend/src/pulse/services/next-best-actions.ts` | Include closure state and suppress stale actions |
| Modify | `backend/src/pulse/lib/pulse-context.ts` | Add recent decisions/preferences to context |
| Modify | `backend/src/pulse/plugin.ts` | Endpoints for action state and preference updates |
| Modify | `frontend/src/pages/Home.tsx` | Show primary decision, completion/defer controls |
| Modify | `frontend/src/pages/Coach.tsx` | Let Coach reference visible decision state |
| Modify | `frontend/src/pages/Settings.tsx` | Preference review/edit surface |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Closure and preference flow tests |

## Task 1: Decision Closure Model

- [ ] **Step 1: Write failing tests**

Tests cover transitions:

- `open -> completed`;
- `open -> deferred`;
- `open -> superseded`;
- Garmin matched activity closes a workout decision automatically;
- stale check-in action disappears once a check-in exists.

- [ ] **Step 2: Add additive table**

Create `pulse_action_decisions` with `user_id`, `source`, `source_id`, `kind`, `title`, `status`, `created_at`, `resolved_at`, `resolution_reason`, `target_route`, `raw_context`.

- [ ] **Step 3: Build pure service**

`decision-closure.ts` exposes `deriveDecisionStatus()` and `shouldSuppressAction()`.

- [ ] **Step 4: Verify and commit**

```bash
npm run check:migrations
npm run typecheck
cd backend && set -a; source ../.env.test.example; set +a; npm test -- --run src/pulse/services/decision-closure.test.ts src/pulse/services/next-best-actions.test.ts
git add backend/src/db/pulse-schema.ts backend/src/db/migrations/00XX_decision_closure_memory.sql backend/src/pulse/services/decision-closure.ts backend/src/pulse/services/decision-closure.test.ts backend/src/pulse/services/next-best-actions.ts
git commit -m "feat: add decision closure state"
```

## Task 2: Home And Coach Closure Flow

- [ ] **Step 1: Add API endpoints**

Add endpoints under `/api/pulse/actions`:

- `GET /actions` returns current prioritized actions with closure state;
- `PATCH /actions/:id` accepts `completed`, `deferred`, `dismissed`.

- [ ] **Step 2: Add UI controls**

Home shows one primary decision with compact controls. Coach shows the same state and can prepare a prompt, but does not auto-send.

- [ ] **Step 3: Add E2E**

Test Home action completion removes or changes the card and Coach sees the updated state.

- [ ] **Step 4: Verify and commit**

```bash
npm run typecheck
npm run test:e2e -- --grep "daily action|closure|Coach"
git add backend/src/pulse/plugin.ts frontend/src/pages/Home.tsx frontend/src/pages/Coach.tsx frontend/src/pulse/api-client.ts frontend/src/pulse/hooks.ts frontend/e2e/pulse-usability.spec.ts
git commit -m "feat: close daily decisions from home"
```

## Task 3: Explicit Coach Preferences

- [ ] **Step 1: Define preference scope**

Store only project-relevant coaching preferences: time windows, disliked workout patterns, preferred long days, injury-sensitive constraints, communication style. Do not infer sensitive traits.

- [ ] **Step 2: Add visible preference store**

Add `pulse_coach_preferences` or fields in `pulse_user_profile` if small enough. Preferences must be editable and reviewable.

- [ ] **Step 3: Feed PulseContext**

Coach/Briefing/Plan use preferences through PulseContext, never hidden chat-only memory.

- [ ] **Step 4: Verify and commit**

```bash
npm run check:migrations
npm run typecheck
cd backend && set -a; source ../.env.test.example; set +a; npm test -- --run src/pulse/lib/pulse-context.test.ts src/pulse/plugin.test.ts
git add backend/src/db/pulse-schema.ts backend/src/db/migrations/00XX_coach_preferences.sql backend/src/pulse/lib/pulse-context.ts backend/src/pulse/plugin.ts frontend/src/pages/Settings.tsx
git commit -m "feat: add visible coach preferences"
```

## Task 4: Push Action Journeys

- [ ] **Step 1: Link push to action state**

Push payloads include `url` and action IDs only when an action record exists. Notification click opens the relevant route.

- [ ] **Step 2: Suppress repeated pushes**

Do not send the same risk/check-in/briefing push repeatedly if the associated action is already completed/deferred inside quiet period rules.

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck
cd backend && set -a; source ../.env.test.example; set +a; npm test -- --run src/jobs/briefing-generation.job.test.ts src/jobs/checkin-reminder.job.test.ts src/pulse/services/risk-engine.push.test.ts
git add backend/src/lib/push.ts backend/src/jobs/briefing-generation.job.ts backend/src/jobs/checkin-reminder.job.ts backend/src/pulse/services/risk-engine.ts
git commit -m "feat: connect push journeys to actions"
```

## Acceptance

- Home answers "what now?" and remembers the answer.
- Coach references visible action state instead of repeating stale prompts.
- Preferences are explicit, editable and used through PulseContext.
- Push opens relevant flows and does not spam already-handled actions.
- No hidden personal memory or sensitive inference is introduced.
