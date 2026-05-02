# Pulse Future Direction Roadmap

> Stand: 2026-05-02 after PR #105 and the Adaptive Training v2 implementation branch. This is the active orientation document for future Pulse work. It turns the completed Garmin, PWA, Decision Closure, Daily Loop Explainability and UX waves into a prioritized product direction.

## Product North Star

Pulse should be the quiet daily operating system for training and recovery: one trustworthy daily decision, backed by Garmin and subjective data, visible on the device Tobi actually uses, and explainable enough that he can override it with confidence.

## Principles

1. **One daily loop beats more dashboards.** Home and Coach should answer what matters today; Plan, Data and Insights provide evidence.
2. **Every recommendation needs provenance.** Training, recovery and mental guidance should show the data or preference behind it.
3. **PWA over VPN remains the default platform.** Native iOS is evaluated only after real-device PWA friction is measured.
4. **Mental fitness is first-class but careful.** Pulse can guide reflection, detect patterns and suggest boundaries; it must not infer clinical labels or hide sensitive assumptions.
5. **Garmin is a source, not the product.** Pulse should preserve and reconcile Garmin data, then translate it into useful decisions.
6. **Local ops must be boring.** Deploy, health, test-services and browser QA need repeatable checks so agents do not rediscover the same failures.

## Prioritized Future Waves

| Rank | Wave | Why It Comes Here | Implementation Plan |
|---|---|---|---|
| 1 | Mobile Field Reliability | Pulse becomes useful when it works on iPhone over VPN, not only in desktop preview | `2026-05-02-mobile-field-reliability-wave.md` |
| 2 | Mental Fitness Companion | Guided check-ins become longitudinal reflection and lightweight interventions | `2026-05-02-mental-fitness-companion.md` |
| 3 | Garmin Data Quality Control Center | Make sync freshness, gaps, raw coverage and calendar alignment understandable | `2026-05-02-garmin-data-quality-control-center.md` |
| 4 | Goal / Race Command Center | Turn goals, race dates and constraints into a focused preparation mode | `2026-05-02-goal-race-command-center.md` |
| 5 | Native iOS Evaluation Gate | Only if PWA field evidence shows persistent iOS-specific friction | Decision gate below |

## Recently Completed Directional Waves

| Wave | Outcome | Reference |
|---|---|---|
| Daily Loop Explainability | Home/Coach share visible action history, suppressed reasons are explainable, Insight evidence links to sources, and daily check-ins are date-scoped. | `completed/2026-05-02-daily-loop-explainability-wave.md`, PR #102 |
| Local Ops Autopilot | `npm run pulse:status` separates Mac-local Docker/Postgres/Redis blockers from server deploy mirror health and documents the local ops flow. | `completed/2026-05-02-local-ops-autopilot.md`, PR #105 |
| Adaptive Training Intelligence v2 | Plan generation now uses deterministic execution review for matched, missed, replaced, RPE/recovery and deliberate rest-day rationale. | `completed/2026-05-02-adaptive-training-intelligence-v2.md`, implementation branch `codex/adaptive-training-v2` |

## Next Plan Summaries

### Mental Fitness Companion

Implementation plan: [`2026-05-02-mental-fitness-companion.md`](2026-05-02-mental-fitness-companion.md)

**Goal:** The guided Daily Check-in should become a practical mental-fitness loop without becoming clinical or intrusive.

**Scope:**
- guided question sets for rest days, training days, high-stress days and low-readiness days;
- longitudinal themes and protective factors;
- small suggested actions: boundary, recovery block, reflection, easy movement, social/support prompt;
- visible "why this question" context;
- opt-out and low-friction skip behavior.

**Likely files:**
- `backend/src/pulse/services/coach-engine.ts`
- `backend/src/pulse/services/mental-themes.ts`
- `backend/src/pulse/services/next-best-actions.ts`
- `frontend/src/pages/Data.tsx`
- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/Coach.tsx`

**Acceptance:**
- check-in questions match today's actual state;
- no future workout is framed as today's decision;
- mental-fitness suggestions are supportive, non-diagnostic and grounded in recent check-ins.

### Garmin Data Quality Control Center

Implementation plan: [`2026-05-02-garmin-data-quality-control-center.md`](2026-05-02-garmin-data-quality-control-center.md)

**Goal:** Settings/Data should explain whether Pulse has the Garmin data needed for trustworthy decisions.

**Scope:**
- sync freshness by domain: activities, daily metrics, sleep, HRV, body composition, workouts/calendar;
- missing-data reasons: provider unavailable, not synced yet, no Garmin value, rate limited, local service issue;
- explicit repair actions for safe domains;
- no broad live probing by default.

**Likely files:**
- `backend/src/routes/garmin.ts`
- `backend/src/jobs/garmin-sync.job.ts`
- `backend/src/pulse/plugin.ts`
- `frontend/src/pages/Settings.tsx`
- `frontend/src/pages/Data.tsx`

**Acceptance:**
- Tobi can tell which Garmin domains are fresh without reading logs;
- repair actions are bounded by date/domain;
- rate limiting is visible as a state, not a silent failure.

### Goal / Race Command Center

Implementation plan: [`2026-05-02-goal-race-command-center.md`](2026-05-02-goal-race-command-center.md)

**Goal:** Goals, race dates, constraints and readiness should converge into one preparation view.

**Scope:**
- race/goal summary with current phase, risk, readiness and next key workout;
- taper and comeback logic from existing health-state and recovery signals;
- plan trace highlights for race-impacting changes;
- no new standalone dashboard unless Plan cannot carry the workflow.

**Likely files:**
- `frontend/src/pages/Plan.tsx`
- `backend/src/pulse/services/race-forecast.ts`
- `backend/src/pulse/services/plan-engine.ts`
- `backend/src/pulse/services/adapt-engine.ts`

**Acceptance:**
- the next key workout and the next recovery boundary are obvious;
- health-state changes explain their race-plan impact;
- race readiness uses existing CTL/TSB/recovery data, not static copy.

### Native iOS Evaluation Gate

**Goal:** Decide whether a native wrapper is worth building after the PWA is tested on the real device.

**Scope:**
- compare real iPhone PWA evidence against the expected daily flows;
- list only persistent problems that cannot be solved in the web/PWA layer;
- estimate maintenance cost for a wrapper, local-network auth, push and deployment;
- keep the current answer as "no native wrapper" unless field evidence proves a concrete need.

**Likely files:**
- `docs/qa/2026-05-02-iphone-pwa-real-device.md`
- `docs/superpowers/plans/2026-05-02-mobile-field-reliability-wave.md`
- `docs/decisions.md`

**Acceptance:**
- the decision is based on recorded device evidence, not novelty;
- PWA fixes are exhausted before native work starts;
- the local-server/VPN model is explicitly preserved or explicitly reversed.

## Manual Gates

These are not blocked by implementation skill; they need Tobi's device or approval:

1. Real iPhone/VPN/PWA run using `docs/ai/checklists/iphone-pwa-qa.md`, recorded in `docs/qa/2026-05-02-iphone-pwa-real-device.md`.
2. Canva preview approval before saving changes to `Pulse Everyday Flow UX Board`.
3. Push activation on each browser/device where notifications should work.

## Explicit Non-Goals

- No Telegram integration.
- No data export.
- No habit tracker.
- No direct development on the Ubuntu server.
- No public cloud tunnel unless the local VPN model is explicitly reversed later.
