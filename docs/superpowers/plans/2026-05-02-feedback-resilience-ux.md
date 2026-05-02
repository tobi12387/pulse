# Feedback Resilience UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:systematic-debugging when reproducing a failure state, then superpowers:test-driven-development for each fix.

**Goal:** Make Pulse feel reliable when one request, mutation or background capability fails by showing local recovery instead of hiding the whole daily workflow.

**Architecture:** Keep data fetching in the existing TanStack Query hooks and API wrappers. Add per-card loading/error/stale states and a small shared mutation feedback pattern rather than route-wide catch-all states.

**Tech Stack:** React/Vite, TanStack Query v5, existing Pulse API helpers, Playwright E2E and component-level route tests where available.

---

## Context

The audit found that Home can collapse to a route-level error if a critical query fails. Several mutations show pending state but do not consistently expose retry/error outcomes: Coach send, Plan alternatives, plan generation, availability save, Garmin actions and Settings health-state updates.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/pages/Home.tsx` | Split route-level error into per-card degraded states |
| Modify | `frontend/src/pages/Coach.tsx` | Show send failure, retry and preserved draft state |
| Modify | `frontend/src/pages/Plan.tsx` | Show plan-generation/alternative/availability failure recovery |
| Modify | `frontend/src/features/settings/health/health-components.tsx` | Show health-state save/complete failure recovery |
| Modify | `frontend/src/features/data/coverage/coverage-components.tsx` | Clarify Garmin sync/backfill failure state |
| Modify | `frontend/src/App.tsx` | Make runtime boundary user-friendly while keeping dev details available |
| Add/Modify | `frontend/src/components/*` | Add shared feedback primitive only if repeated patterns justify it |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Add mocked failure-state coverage |

## Task 1: Define The Feedback Pattern

- [ ] Identify repeated mutation states: idle, pending, success, error, retryable error, non-retryable blocked state.
- [ ] Decide whether a small shared component is warranted or route-local patterns are clearer.
- [ ] Keep success copy quiet and brief; avoid toast-only feedback for important actions.

## Task 2: Degrade Home Per Card

- [ ] Keep still-available daily cards visible when one Home query fails.
- [ ] Show stale data timestamps where cached data is used.
- [ ] Give each failed card a local retry action.
- [ ] Add E2E coverage for one failed Home endpoint while the route remains usable.

## Task 3: Add Mutation Recovery To Daily Actions

- [ ] Coach send: preserve draft/user message and offer retry when sending fails.
- [ ] Plan alternatives/generation: show why the request failed and keep previous plan visible.
- [ ] Availability save: preserve edits and show retry.
- [ ] Health-state save/complete: show inline error and do not pretend the state changed.
- [ ] Garmin sync/backfill: separate queued/running/blocked/failed outcomes visibly.

## Task 4: Make Runtime Errors Human-Readable

- [ ] Update the app error boundary to show a calm user-facing message first.
- [ ] Keep stack/details behind a development-only or expandable detail area.
- [ ] Ensure production UI does not expose raw stack traces as the primary experience.

## Verification

- [ ] `npm run typecheck`
- [ ] `npm run test:e2e -- --grep "error|retry|Coach|Plan|Settings|Garmin|Home"`
- [ ] Manual route pass with API failure mocks where deterministic Playwright mocks are not enough.

## Acceptance

- A single failed request no longer makes the whole daily dashboard unusable.
- Important mutations have visible error and retry paths.
- Existing successful flows remain quiet and do not become noisy with notifications.
- Runtime errors are understandable to a daily user while still debuggable by developers.
