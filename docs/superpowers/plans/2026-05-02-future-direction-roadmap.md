# Pulse Future Direction Roadmap

> Stand: 2026-05-05 after Daily Loop Slimming, Insights into Data, Mental Check-in Simplification and Coach primary-nav removal. This is the active orientation document for future Pulse work. It keeps completed implementation plans out of the active plan surface and turns the remaining gated work into a prioritized product direction.

## Product North Star

Pulse should be the quiet daily operating system for training and recovery: one trustworthy daily decision, backed by Garmin and subjective data, visible on the device Tobi actually uses, and explainable enough that he can override it with confidence.

## Principles

1. **One daily loop beats more dashboards.** Home should answer what matters today; Coach is a callable support layer, while Plan and Data provide decisions and evidence.
2. **Every recommendation needs provenance.** Training, recovery and mental guidance should show the data or preference behind it.
3. **PWA over VPN remains the default platform.** Native iOS is evaluated only after real-device PWA friction is measured.
4. **Mental fitness is first-class but careful.** Pulse can guide reflection, detect patterns and suggest boundaries; it must not infer clinical labels or hide sensitive assumptions.
5. **Garmin is a source, not the product.** Pulse should preserve and reconcile Garmin data, then translate it into useful decisions.
6. **Local ops must be boring.** Deploy, health, test-services and browser QA need repeatable checks so agents do not rediscover the same failures.

## Prioritized Future Waves

| Rank | Wave | Why It Comes Here | Implementation Plan |
|---|---|---|---|
| 1 | Home Daily Decision Closure | Home should close or anchor no-training days locally before Coach is needed | `2026-05-05-home-daily-decision-closure.md` |
| 2 | Mental Signal Impact Loop | PR #176 made input easier; now saved mental state must visibly affect Home, Plan and Coach | `2026-05-05-mental-signal-impact-loop.md` |
| 3 | Garmin Workout Sync Confidence | PR #176 fixed 0-repeat repair detection; Plan now needs a clear trust surface for watch/Edge readiness | `2026-05-05-garmin-workout-sync-confidence.md` |
| 4 | Mobile/A11y Controls Polish | Route evidence has no document overflow, but touch targets and custom radio/tab semantics still need hardening | `2026-05-05-mobile-a11y-controls-polish.md` |
| 5 | Data Decision Evidence Trail | Evidence should deep-link from Home/Plan to the exact Data section behind a recommendation | `2026-05-05-data-decision-evidence-trail.md` |
| 6 | Mobile Field Reliability | Pulse becomes useful when it works on iPhone over VPN, not only in desktop preview; remaining work is mostly manual push/certificate evidence and diagnostics | `2026-05-02-mobile-field-reliability-wave.md` |
| 7 | Fueling & Recovery Companion | Practical pre/during/post workout support, but dietary preferences must be confirmed before implementation | `2026-05-02-fueling-recovery-companion.md` |
| 8 | Native iOS Evaluation Gate | Only if PWA field evidence shows persistent iOS-specific friction | Decision gate below |

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
| Daily Loop Slimming | Home remains the full daily decision source; Coach and Plan use compact support cards instead of repeating the whole decision grid. | `completed/2026-05-04-daily-loop-slimming.md`, PR #163 |
| Insights Into Data | Insights is rendered as Data `Analysen`, removed from primary navigation, and `/insights` redirects to `/data?tab=analysen`. | `completed/2026-05-04-insights-into-data.md`, PR #165 |
| Mental Check-in Simplification | Data, Home and Coach now share a lower-friction mental check-in flow with quick choices, free-text preview and visible Coach context. | `completed/2026-05-04-mental-checkin-simplification.md`, PR #167-#171 |
| Coach Primary-Nav Removal | The primary navigation is now Home, Data, Plan and Settings; `/coach` remains a compatibility/deep-link route. | `../specs/2026-05-04-nav-ia-design.md`, `../../qa/2026-05-05-remove-coach-tab.md`, PR #172 |
| UI/UX Foundation And Trust Slice | Login, Data overview, daily-flow deduplication, Mental qualitative cards and Garmin 0-repeat repair detection are live. | `../../qa/2026-05-05-ui-ux-phase2-review.md`, PR #175-#176 |

## Next Plan Summaries

### Standing UI/UX Evidence Rule

The UI/UX Deep Friction Closure roadmap is completed. New UI/UX work should begin by regenerating the route evidence pack in `docs/qa/route-evidence-pack.md`, then turning only observed friction into a narrow plan or PR.

### Navigation IA Continuation

Implementation spec: [`../specs/2026-05-04-nav-ia-design.md`](../specs/2026-05-04-nav-ia-design.md)
Current next slice: [`2026-05-05-home-daily-decision-closure.md`](2026-05-05-home-daily-decision-closure.md)

**Goal:** Finish the transition from Coach as a place to Coach as a contextual action layer.

**Scope:**
- embed the remaining Coach composer/history affordances where they support Home, Plan and Data flows;
- keep `/coach` compatible until route evidence and normal use prove it can be redirected or hidden further;
- preserve voice and existing Home/Plan/push deep links during the transition.

**Acceptance:**
- Home/Data/Plan/Settings remain the only primary navigation destinations;
- `/coach` is not a dead end;
- route evidence shows the contextual surfaces do not make the daily iPhone/PWA flow bulky again.

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
