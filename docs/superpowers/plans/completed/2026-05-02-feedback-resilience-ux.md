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

- [x] Identify repeated mutation states: idle, pending, success, error, retryable error, non-retryable blocked state.
- [x] Decide whether a small shared component is warranted or route-local patterns are clearer.
- [x] Keep success copy quiet and brief; avoid toast-only feedback for important actions.

## Task 2: Degrade Home Per Card

- [x] Keep still-available daily cards visible when one Home query fails.
- [x] Show stale data context where cached/Home data is used.
- [x] Give each failed card a local retry action.
- [x] Add E2E coverage for one failed Home endpoint while the route remains usable.

## Task 3: Add Mutation Recovery To Daily Actions

- [x] Coach send: preserve draft/user message and offer retry when sending fails.
- [x] Plan alternatives/generation: show why the request failed and keep previous plan visible.
- [x] Availability save: preserve edits and show retry.
- [x] Health-state save/complete: show inline error and do not pretend the state changed.
- [x] Garmin sync/backfill: separate queued/running/blocked/failed outcomes visibly.

## Task 4: Make Runtime Errors Human-Readable

- [x] Update the app error boundary to show a calm user-facing message first.
- [x] Keep stack/details behind a development-only or expandable detail area.
- [x] Ensure production UI does not expose raw stack traces as the primary experience.

## Verification

- [x] `npm run typecheck`
- [x] `npm run test:e2e -- --grep "error|retry|Coach|Plan|Settings|Garmin|Home"`
- [x] Manual route pass with API failure mocks where deterministic Playwright mocks are not enough.

## QA Evidence

- RED: new failure-state E2E cases failed before implementation for Home readiness degradation, Coach send retry, Plan alternative retry, Plan generation retry, Health-State save error and Garmin Backfill failure.
- GREEN: `npm run typecheck` passed.
- GREEN: `npm run test:e2e -- --grep "error|retry|Coach|Plan|Settings|Garmin|Home"` passed with 82 tests.
- Additional focused check: `npm run test:e2e -- --grep "Data Garmin backfill failure shows local recovery"` passed after removing the unhandled rejection path.

## Acceptance

- A single failed request no longer makes the whole daily dashboard unusable.
- Important mutations have visible error and retry paths.
- Existing successful flows remain quiet and do not become noisy with notifications.
- Runtime errors are understandable to a daily user while still debuggable by developers.
