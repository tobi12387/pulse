# Pulse Future Direction Roadmap

> Stand: 2026-05-02 after Garmin Data Quality, Goal/Race Command Center and Daily Outcome Learning Loop implementation. This is the active orientation document for future Pulse work. It turns the completed Garmin, PWA, Decision Closure, Daily Loop Explainability and UX waves into a prioritized product direction.

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
| 1 | Mobile Field Reliability | Pulse becomes useful when it works on iPhone over VPN, not only in desktop preview; this remains a real-device manual gate | `2026-05-02-mobile-field-reliability-wave.md` |
| 2 | Season Strategy Planner | Stop weekly plans from feeling repetitive by making the 8-16 week intent and free-day rationale visible | `2026-05-02-season-strategy-planner.md` |
| 3 | Fueling & Recovery Companion | Practical pre/during/post workout support, but dietary preferences should be confirmed before implementation | Planning candidate below |
| 4 | Native iOS Evaluation Gate | Only if PWA field evidence shows persistent iOS-specific friction | Decision gate below |

## Recently Completed Directional Waves

| Wave | Outcome | Reference |
|---|---|---|
| Daily Loop Explainability | Home/Coach share visible action history, suppressed reasons are explainable, Insight evidence links to sources, and daily check-ins are date-scoped. | `completed/2026-05-02-daily-loop-explainability-wave.md`, PR #102 |
| Local Ops Autopilot | `npm run pulse:status` separates Mac-local Docker/Postgres/Redis blockers from server deploy mirror health and documents the local ops flow. | `completed/2026-05-02-local-ops-autopilot.md`, PR #105 |
| Adaptive Training Intelligence v2 | Plan generation now uses deterministic execution review for matched, missed, replaced, RPE/recovery and deliberate rest-day rationale. | `completed/2026-05-02-adaptive-training-intelligence-v2.md`, PR #106 |
| Mental Fitness Companion | Guided Daily Check-in questions now come from deterministic PulseContext guidance; mental support actions use the existing closure model. | `completed/2026-05-02-mental-fitness-companion.md`, PR #108 |
| Garmin Data Quality Control Center | Settings/Data now show Garmin domain quality, freshness, repairability and blocked provider states. | `completed/2026-05-02-garmin-data-quality-control-center.md`, PR #111 |
| Goal/Race Command Center | Plan now shows race phase, readiness, next key workout, recovery boundary and risk impact from existing evidence. | `completed/2026-05-02-goal-race-command-center.md`, PR #112 |
| Daily Outcome Learning Loop | Home/Coach now show a deterministic learning signal from action decisions, check-ins and Garmin execution without hidden LLM memory. | `completed/2026-05-02-daily-outcome-learning-loop.md`, active PR pending |

## Next Plan Summaries

### Season Strategy Planner

Implementation plan: [`2026-05-02-season-strategy-planner.md`](2026-05-02-season-strategy-planner.md)

**Goal:** Goals and races should create an 8-16 week strategy that guides weekly plans and intentional free days.

**Scope:**
- season blocks for build, peak, taper, deload and maintenance;
- guardrails for max hard days, target session count and free-day rationale;
- Plan UI "Saisonlinie" plus Plan Trace evidence;
- weekly plan generation consumes guardrails without overriding health/risk constraints.

**Acceptance:**
- available days are not automatically filled with training;
- repeated weekly structures are either intentional and explained or changed by evidence;
- the user can see why the current week fits the season.

### Fueling & Recovery Companion

**Goal:** Turn planned workouts and completed activities into practical fueling, sleep and recovery support.

**Scope candidate:**
- pre-workout carbohydrate/hydration guidance from duration, intensity and weather when available;
- during-workout fueling reminders for long sessions;
- post-workout recovery note tied to sleep debt, HRV, soreness and nutrition logs;
- race-day fueling checklist after Season Strategy exists.

**Decision needed before implementation:** dietary constraints, preferred products and how opinionated Pulse should be with calories/carbs/sodium.

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
