# Pulse Future Direction Roadmap

> Stand: 2026-05-02 after Garmin Data Quality, Goal/Race Command Center, Daily Outcome Learning Loop, Season Strategy Planner and Garmin Signal Usefulness implementation/deploy sequence. This is the active orientation document for future Pulse work. It turns the completed Garmin, PWA, Decision Closure, Daily Loop Explainability and UX waves into a prioritized product direction.

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
| 1 | Navigation IA Continuation | Insights is now planned as a Data capability; the next daily-flow step is moving Coach into contextual Home/Plan/Data surfaces without losing voice or history | `../specs/2026-05-04-nav-ia-design.md` |
| 2 | Mental Check-in Simplification | Tobi explicitly reported that choosing the right mental values is hard; a Garmin-assisted quick check-in directly improves daily iPhone/PWA use | `2026-05-04-mental-checkin-simplification.md` |
| 3 | Mobile Field Reliability | Pulse becomes useful when it works on iPhone over VPN, not only in desktop preview; remaining work is mostly manual push/certificate evidence and diagnostics | `2026-05-02-mobile-field-reliability-wave.md` |
| 4 | Fueling & Recovery Companion | Practical pre/during/post workout support, but dietary preferences must be confirmed before implementation | `2026-05-02-fueling-recovery-companion.md` |
| 5 | Native iOS Evaluation Gate | Only if PWA field evidence shows persistent iOS-specific friction | Decision gate below |

## Recently Completed Directional Waves

| Wave | Outcome | Reference |
|---|---|---|
| Daily Loop Explainability | Home/Coach share visible action history, suppressed reasons are explainable, Insight evidence links to sources, and daily check-ins are date-scoped. | `completed/2026-05-02-daily-loop-explainability-wave.md`, PR #102 |
| Local Ops Autopilot | `npm run pulse:status` separates Mac-local Docker/Postgres/Redis blockers from server deploy mirror health and documents the local ops flow. | `completed/2026-05-02-local-ops-autopilot.md`, PR #105 |
| Adaptive Training Intelligence v2 | Plan generation now uses deterministic execution review for matched, missed, replaced, RPE/recovery and deliberate rest-day rationale. | `completed/2026-05-02-adaptive-training-intelligence-v2.md`, PR #106 |
| Mental Fitness Companion | Guided Daily Check-in questions now come from deterministic PulseContext guidance; mental support actions use the existing closure model. | `completed/2026-05-02-mental-fitness-companion.md`, PR #108 |
| Garmin Data Quality Control Center | Settings/Data now show Garmin domain quality, freshness, repairability and blocked provider states. | `completed/2026-05-02-garmin-data-quality-control-center.md`, PR #111 |
| Goal/Race Command Center | Plan now shows race phase, readiness, next key workout, recovery boundary and risk impact from existing evidence. | `completed/2026-05-02-goal-race-command-center.md`, PR #112 |
| Daily Outcome Learning Loop | Home/Coach now show a deterministic learning signal from action decisions, check-ins and Garmin execution without hidden LLM memory. | `completed/2026-05-02-daily-outcome-learning-loop.md`, PR #113 |
| Season Strategy Planner | Plan now shows a deterministic 8-16 week season line and weekly generation uses target-session, hard-day, deload and free-day guardrails. | `completed/2026-05-02-season-strategy-planner.md`, PR #114 |
| Garmin Signal Usefulness Wave | Data now shows which Garmin signals are already used, underused or missing/sparse, without live Garmin probing from UI routes. | `completed/2026-05-02-garmin-signal-usefulness-wave.md`, PR #116 |
| Daily Decision Quality Loop | Home, Coach and Insights now show whether recent recommendations helped, repeated usefully, became stale or need a strategy change. | `completed/2026-05-02-daily-decision-quality-loop.md`, PR #117 |
| Structure Boundary Cleanup | Pulse route, feature and shared-type monoliths were split; future structure work needs fresh file counts before planning. | `completed/2026-05-02-structure-boundary-cleanup.md`, PR #136-#148 |
| UI/UX Deep Friction Closure | Mobile containment, daily-loop priority, local feedback recovery, Settings diagnostics and route evidence refresh are complete. | `completed/2026-05-02-ui-ux-deep-friction-roadmap.md`, PR #155-#160 |

## Next Plan Summaries

### Standing UI/UX Evidence Rule

The UI/UX Deep Friction Closure roadmap is completed. New UI/UX work should begin by regenerating the route evidence pack in `docs/qa/route-evidence-pack.md`, then turning only observed friction into a narrow plan or PR.

### Mobile Field Reliability

Implementation plan: [`2026-05-02-mobile-field-reliability-wave.md`](2026-05-02-mobile-field-reliability-wave.md)

**Goal:** Prove Pulse on the real iPhone over VPN before changing platform strategy.

**Scope:**
- record real-device reachability, certificate, login, route, Add-to-Home-Screen and push evidence;
- convert only observed friction into deterministic browser checks;
- keep Settings diagnostics accurate without promising unsupported iOS capabilities.

**Acceptance:**
- evidence is recorded from Tobi's device;
- any real issue has a reproducible regression check;
- the local-server/VPN model remains the default until evidence says otherwise.

### Mental Check-in Simplification

Implementation plan: [`2026-05-04-mental-checkin-simplification.md`](2026-05-04-mental-checkin-simplification.md)

**Goal:** Make the daily Mental Check-in easy enough to complete without deciding exact 1-10 values.

**Scope:**
- show a Garmin/recovery-informed suggestion before the input;
- replace required numeric bars with three-state choices and a clear daily need;
- keep exact 1-10 correction optional behind a small disclosure;
- preserve the existing backend contract in the first PR by mapping choices to the current numeric fields.

**Acceptance:**
- a valid check-in takes only a few taps and no free text;
- the UI explains which signals shaped the suggestion;
- mental trends and Coach context continue to use the stored numeric fields;
- mobile route evidence shows no overflow or tiny primary controls.

### Fueling & Recovery Companion

Implementation plan: [`2026-05-02-fueling-recovery-companion.md`](2026-05-02-fueling-recovery-companion.md)

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
- No direct development on the Ubuntu server.
- No public cloud tunnel unless the local VPN model is explicitly reversed later.
