# Pulse Product Roadmap

> Stand: 2026-05-10 after the UI/UX benchmark against Garmin, WHOOP, Oura, TrainerRoad, TrainingPeaks, JOIN, Runna, Strava, MacroFactor and Intervals/Xert/WKO-style analytics. This is the canonical product roadmap for future Pulse work. Completed implementation plans remain historical references; new work should start here, then open the smallest matching plan.

## Product North Star

Pulse should be the quiet daily operating system for training, recovery and execution: it turns Garmin, plan, mental, fueling and goal evidence into one understandable next action, then explains enough that Tobi can trust, override or refine it.

The product target is not "more data". The target is better daily judgment:

- what should I do today;
- why is that the right call;
- what happens if I accept, change or skip it;
- how does it affect my goal, recovery, Garmin device and next plan decision.

## Product Principles

1. **Lead, then explain.** Pulse first shows the next useful action; evidence and analysis are available one layer deeper.
2. **Every action has a contract.** Tasks, CTAs and descriptions must answer: what should I do, why now, and what happens afterwards.
3. **Navigation is a product tool.** Pulse may add, rename or remove tabs, areas or modes when that makes a recurring flow clearer, faster or calmer. The number of tabs is not the goal; orientation is.
4. **Daily usefulness beats feature breadth.** A small daily flow that is trusted matters more than a larger dashboard that Tobi must interpret.
5. **Garmin execution must close the loop.** Planning is not complete until the workout's device/calendar/repeat status is understandable and repairable.
6. **Mental fitness is first-class but careful.** Pulse can guide reflection, boundaries and adaptation; it must not infer clinical labels or hide sensitive assumptions.
7. **PWA over VPN remains the default platform.** Native iOS is evaluated only after real iPhone/PWA friction proves a concrete need.
8. **Local ops must be boring.** Deploy, health, test services and browser QA need repeatable checks so agents do not rediscover the same failures.

## UX Task Contract

All visible tasks, descriptions and CTA labels should follow this grammar:

```text
Title: what should I do?
Summary: why is this relevant now?
Primary action: what result does the click create?
Result preview: what changes afterwards?
Evidence: optional, compact and expandable.
```

### Copy Rules

- Prefer outcome labels over destination labels: `Wochenplan erstellen` beats `Zum Plan`.
- Prefer everyday language over internal model terms: `Heute locker bleiben` beats `Plan-/Load pruefen`.
- Keep one primary action per card or first viewport.
- Make optional evidence visibly optional with `Warum?`, `Details` or a compact evidence row.
- Distinguish information cards from action cards. If a card is clickable, the action/result must be obvious.
- When a recommendation repeats, explain why it is still valid or what changed since yesterday.

### Navigation Rules

New navigation is allowed when it improves orientation. A new tab, area or mode is a good candidate when:

- it supports a recurring flow that users understand as its own job;
- it makes an existing page calmer;
- the first mobile viewport can state a single purpose and action;
- it carries work, not just more data;
- it improves the daily path more than embedding the same content in an existing route.

Potential future areas are therefore open product options, not exceptions:

- `Heute` if Home becomes a dedicated daily command surface;
- `Ausfuehrung` if Garmin/device workout execution becomes a recurring flow beyond a Plan subtab;
- `Nutrition` if fueling and recovery become daily/weekly planning work;
- `Coach` if it becomes a true explanation/reflection mode again rather than a fifth dashboard.

## UI/UX Benchmark Translation

| Reference | What It Does Well | Pulse Direction |
|---|---|---|
| Garmin Daily Suggested Workouts / Garmin Coach | Answers "what should I do today" from training load, recovery, sleep and recent workouts. | Pulse should make today's recommendation explicit and device-aware, not bury it under diagnostics. |
| WHOOP | Separates today's state, plan, dashboard and coach surfaces. | Pulse may split flows when it reduces cognitive load; Home/Data/Plan/Settings are not sacred. |
| Oura | Uses calm Today cards and pushes trends/contributors deeper. | Mental and recovery should start with states and suggestions; numbers stay available as evidence. |
| TrainerRoad | TrainNow and Workout Levels make spontaneous workouts and progression easy to understand. | Today options and planned workouts should show fit: productive, maintain, stretch, protect or too hard. |
| TrainingPeaks | Calendar, structured workout builder and device sync make execution concrete. | Plan should feel like calendar plus execution trust, not only a generation surface. |
| JOIN / Runna | Adapts around availability, not-feeling-100%, progress and life context. | Pulse needs first-class "I have little time", "not ready", "change today" and "off-plan activity" flows. |
| Strava | Progress is motivational and understandable. | Data should include motivating goal progress, not only diagnostics. |
| MacroFactor | Dashboard plus quick actions plus weekly coaching updates explain what changed. | Pulse should summarize deltas and plan changes instead of asking Tobi to reinterpret raw metrics. |
| Intervals.icu / Xert / WKO | Deep analytics and model provenance are powerful for experts. | Pulse should keep deep analysis in Data and translate it into next actions before surfacing it elsewhere. |

## Harmonized Roadmap

### Short Term: Make Pulse Easier To Use Daily

These come first because they reduce daily friction before adding more intelligence.

| Rank | Theme | Outcome | Likely Plan |
|---|---|---|---|
| 1 | Roadmap and active-plan cleanup | Active docs point to this roadmap; completed docs stop looking like backlog. | Docs-only roadmap hygiene PR |
| 2 | UX Task Contract foundation | Shared copy/action rules are documented and then applied to Home, Plan, Data and Settings. | New focused implementation plan |
| 3 | Today/Home simplification | The first screen gives one daily decision, one primary action and optional `Warum?`. Consider renaming Home to `Heute` if evidence supports it. | Home/Daily Command PR |
| 4 | Plan action hierarchy | Implemented: Plan starts with the current job, why-now copy, result preview and a primary action before evidence/tools. | Completed Plan Action Hierarchy PR |
| 5 | Daily Delta Coach | Implemented v1 on Home: Pulse shows latest plan-vs-execution status, load delta and next plan effect from existing data. | Completed Daily Delta Home v1 PR |
| 6 | Planned-vs-Completed Score | Implemented v1 on Home with match score and TSS delta; Plan/Data echoes remain optional polish. | Completed Daily Delta Home v1 PR |
| 7 | Garmin execution closure polish | Implemented v1: Plan `Ausfuehrung` verifies readback repeat counts, separates Pulse-known from Garmin-readback IDs and routes Settings directly to the execution check. | Completed Garmin Closure Polish PR |

### Medium Term: Make The Intelligence Understandable

These build on the calmer daily UI.

| Theme | Outcome | Benchmark Link |
|---|---|---|
| Pulse Athlete Levels | Implemented: energy-system capability is visible in daily decisions and scenario previews as `Machbar`, `Produktiv`, `Stretch` or `Zu hart heute` before apply. | TrainerRoad Workout/Progression Levels |
| Workout Alternatives v2 | Every relevant workout can offer shorter, easier, same-purpose, outside/indoor, group/solo or recovery alternatives. | TrainerRoad TrainNow, JOIN availability |
| Data IA Compression | Data becomes `Heute relevant`, `Trends`, `Datenqualitaet` and `Analyse`, instead of many equal tabs. | Oura Trends, Intervals analytics |
| Settings Status First | Settings starts with `Alles bereit` or `Problem beheben`, then details. | Garmin/WHOOP app diagnostics |
| Nutrition Intelligence | Fueling guidance learns from real rides, 750 ml bottles, MNSTRY products, GI comfort and workout intensity. | MacroFactor coaching update pattern |
| iPhone/PWA Field Reliability | Real device evidence decides whether PWA fixes are enough or whether a native/wrapper path is worth planning. | WHOOP/Oura mobile-first reliability |

### Long Term: Become A Personal Coach, Not A Dashboard

| Theme | Outcome |
|---|---|
| Personal Response Model | Pulse learns how Tobi responds to training, sleep, mental state, fueling and RPE over time. |
| Predictive Goal Engine | Pulse shows goal probability, limiter risk and the next best intervention for 70.3, endurance, recovery and body composition goals. |
| Adaptive Season Builder | Season planning handles build, recovery, specificity, taper, missed load, availability and event priority as one model. |
| Contextual Coach Mode | Coach becomes an explanation/reflection mode that can live as a tab, overlay or route depending on evidence. |
| Customizable Daily Surface | Tobi can choose which focus cards appear first, while Pulse keeps safe defaults for the daily decision. |

## Active Plan Surface

Use this roadmap as the product orientation. Before implementation, open or create the smallest PR-sized plan for the next slice.

The active plan folder is intentionally small:

- `2026-05-02-future-direction-roadmap.md`: canonical product roadmap and ordering.
- `2026-05-02-mobile-field-reliability-wave.md`: real-device/manual evidence gate for iPhone/PWA reliability.
- `2026-04-28-roadmap.md`: historical pointer kept for older prompts; it points forward to this roadmap and completed phase docs.

Completed benchmark and implementation plans from the 2026-05-10 wave now live under `completed/`. Do not reopen them as backlog unless a new regression or explicit product decision creates a fresh PR-sized plan.

## Next Implementation Order

1. **Nutrition Intelligence:** turn fueling logs and product preferences into practical per-session guidance.
2. **Optional Daily Delta echoes:** add compact Plan/Data mirrors only if route evidence shows the Home v1 card is insufficient.
3. **Optional Garmin modal polish:** refine workout-detail copy only if route evidence shows `vor Upload`/readback wording still confuses execution.

## Manual Gates

These still need Tobi's device, approval or live environment:

1. Real iPhone/VPN/PWA run using `docs/ai/checklists/iphone-pwa-qa.md`, recorded in `docs/qa/2026-05-02-iphone-pwa-real-device.md`.
2. Push activation on each browser/device where notifications should work.
3. Real Garmin calendar/workout writes only when explicitly testing or repairing sync.
4. Native iOS decision only after PWA/VPN evidence shows an unresolved recurring problem.

## Explicit Non-Goals

- No Telegram integration.
- No data export.
- No copied proprietary TrainerRoad, TrainingPeaks, JOIN, Runna, Xert or WKO plan/workout content.
- No direct development on the Ubuntu server.
- No public cloud tunnel unless the local VPN model is explicitly reversed later.
- No clinical mental-health diagnosis or hidden sensitive inference.
