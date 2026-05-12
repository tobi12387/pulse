# Pulse Product Roadmap

> Stand: 2026-05-12 after Focus-Handoff alignment and the fresh top-tools benchmark. This is the canonical product roadmap for future Pulse work. Completed implementation plans remain historical references; new work should start here, then open the smallest matching PR-sized plan.

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

## Benchmark Inputs To Preserve

The 2026-05-09/2026-05-10 benchmark work is part of this roadmap, not disposable history. Use these docs as evidence before changing priority:

- `docs/superpowers/plans/completed/2026-05-09-training-benchmark-gap-plan.md`: TrainerRoad, TrainingPeaks, JOIN, Intervals and WKO gaps that led to capability levels, workout library fit, TrainNow, scenario preview, season load, Garmin sync contracts and goal limiter evidence.
- `docs/qa/2026-05-10-fresh-benchmark-ui-review.md`: UI/UX review against Garmin, WHOOP, Oura, TrainerRoad, TrainingPeaks, JOIN, Runna, MacroFactor and analytics tools; identified daily-command clarity, mobile density, Garmin execution trust and progression visibility.
- `docs/superpowers/plans/completed/2026-05-10-fresh-benchmark-ui-roadmap.md`: execution order for UI Accessibility Polish v2, Daily Command Center v2, Garmin Execution Trust v2 and Progression Library v2.
- `docs/qa/2026-05-10-post-progression-benchmark-ui-review.md`: post-progression review; moved the bottleneck from missing intelligence to plan activation, post-apply Garmin proof, signal labels, fueling closure and limiter mapping.
- `docs/superpowers/plans/completed/2026-05-10-post-progression-next-roadmap.md`: implemented sequence for Plan Refresh Preview, Garmin Readback Closure, Today Options Signal Labels, Fueling Debt Closure, Limiter-To-Workout Mapping and no-Garmin-write QA.
- `docs/qa/2026-05-10-next-options-route-evidence.md`: evidence gate that deferred optional Daily Delta Plan/Data echoes and additional Garmin modal wording because screenshots did not show a current user-facing gap.

### Reconciliation Status

| Benchmark theme | Current status | Roadmap consequence |
|---|---|---|
| Capability levels, workout fit and plan variation | Implemented through the 2026-05-09 benchmark gap wave and later progression-library work. | Do not rebuild the foundations; improve how alternatives and weekly progression are explained only when route evidence or user friction shows confusion. |
| Daily command clarity and mobile density | Implemented in Home/Heute, Daily Command Center, UX Task Contract, Plan Action Hierarchy and Daily Delta Home v1. | Continue reducing density by reorganizing existing pages, not by adding more summary cards. |
| Garmin execution trust | Implemented through sync contract, ledger, readback diff, repeat audit, repair actions and Plan `Ausfuehrung` closure. | Future Garmin work should focus on real-device/write evidence, not generic copy churn. |
| Plan activation | Implemented through Plan Refresh Preview, Apply + Garmin Readback Closure and no-Garmin-write QA. | Keep preview/apply explicit; do not introduce hidden regeneration or automatic Garmin writes. |
| Fueling intelligence | Implemented through MNSTRY guidance, practical logs, GI learning, fueling debt closure and outcome baseline. | Wait for repeated long-session logs before trend summaries; keep sodium/heat/sweat-rate claims as evidence gaps until measured. |
| Data/Settings information architecture | Implemented through Data IA Compression v1 and Settings Status First v1. | Do not rebuild the IA foundations; future work needs route evidence or a concrete reported gap. |
| iPhone/PWA reliability | Evidence record and diagnostics exist; real-device certificate/push gates remain manual. | Keep as a manual/evidence gate unless Tobi reports concrete iPhone friction. |

### 2026-05-12 Fresh Benchmark Translation

The latest benchmark against TrainerRoad, TrainingPeaks, Garmin, JOIN/Runna, WHOOP/Oura, MacroFactor, Intervals.icu and WKO reframes the remaining gap: Pulse has enough intelligence foundations, but must close daily product loops more clearly.

| Fresh benchmark theme | Pulse direction | Status |
|---|---|---|
| Plan changes need an inbox | Centralize refresh preview, adaptation events and Garmin sync debt into one `what changed / why / what happens after click` surface. | Implemented v1 in the 2026-05-12 Plan Change Inbox slice. |
| Today change flow must be direct | Planned-day alternatives from Home must route to the existing workout decision, not create a new custom workout scenario. | Implemented v1 in the 2026-05-12 Today Change Flow slice. |
| Progression needs calibration clarity | Every workout should explain the progression purpose and why repetition is still valid or why the stimulus changed. | Implemented v3 in the 2026-05-12 Workout Progression Clarity slice. |
| Garmin execution chain needs one visible path | Template, calendar, device/readback, repeat audit, repair and execution result should read as one chain. | Implemented in the 2026-05-12 Garmin Execution Chain UI slice. |
| Weekly coaching ritual is missing | Weekly update should summarize what Pulse learned, what changes this week and what Tobi can accept/reject. | Medium-term candidate. |
| Recovery/Mental should become resilience guidance | Reduce metric-wall feel; explain boundaries, energy/stress signal quality and recovery actions without clinical labeling. | Medium-term candidate. |
| Nutrition trends stay gated | Trend summaries only after enough comparable complete logs. | Still gated. |

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
| Workout Alternatives v2 | Implemented: full Plan alternatives now state purpose, why-now, result impact and safest recommendation; scenario previews distinguish preview-loading from apply-running. | TrainerRoad TrainNow, JOIN availability |
| Data IA Compression | Implemented: Data uses `Heute relevant`, `Trends`, `Datenqualitaet` and `Analyse`, while old query/hash links remain compatible. | Oura Trends, Intervals analytics |
| Settings Status First | Implemented: Settings starts with `Alles bereit` or `Problem beheben`, then details for Garmin, PWA, Push, profile and local ops. | Garmin/WHOOP app diagnostics |
| Nutrition Intelligence | Implemented: low-intake GI logs change the concrete next long-session target to a controlled `50-70 g/h`, and outcome baselines now structure carb target, bottles, powder, fluid and sodium evidence gaps in Activity and Plan. Future slices should add repeated-log trend summaries and real heat/sweat-rate context. | MacroFactor coaching update pattern |
| iPhone/PWA Field Reliability | Real device evidence decides whether PWA fixes are enough or whether a native/wrapper path is worth planning. | WHOOP/Oura mobile-first reliability |

### Long Term: Become A Personal Coach, Not A Dashboard

| Theme | Outcome |
|---|---|
| Personal Response Model | Implemented v1: Pulse exposes deterministic, read-only response evidence in Data > Analyse and labels weak evidence instead of mutating plans or Garmin. |
| Predictive Goal Engine | Implemented v1: Pulse exposes deterministic, read-only goal probability, limiter risk and next best intervention in Data > Analyse, using Personal Response, capability, fueling, load and execution evidence without mutating plan or Garmin. |
| Adaptive Season Builder | Implemented v1: Plan shows a read-only `Saisonvertrag` that combines Season Strategy and Goal Projection evidence, including top-goal probability, next 14-day contract, hard-day cap, load guardrail and next intervention without hidden mutations. |
| Contextual Coach Mode | Implemented v1: Coach shows a read-only context card that combines Personal Response, Goal Projection and Season Strategy evidence, then prepares a focused prompt only after an explicit click. |
| Customizable Daily Surface | Implemented v1: Home lets Tobi choose a local per-device focus-card order while the main daily decision, warnings and Garmin-sensitive controls keep safe defaults. |

## Active Plan Surface

Use this roadmap as the product orientation. Before implementation, open or create the smallest PR-sized plan for the next slice.

The active plan folder is intentionally small:

- `2026-05-02-future-direction-roadmap.md`: canonical product roadmap and ordering.
- `2026-05-02-mobile-field-reliability-wave.md`: real-device/manual evidence gate for iPhone/PWA reliability.
- `2026-04-28-roadmap.md`: historical pointer kept for older prompts; it points forward to this roadmap and completed phase docs.

Completed benchmark and implementation plans from the 2026-05-10 wave now live under `completed/`. Do not reopen them as backlog unless a new regression or explicit product decision creates a fresh PR-sized plan.

## Next Implementation Order

1. **Plan Change Inbox v1:** implemented as a frontend-first, read-only Plan surface combining refresh preview, adaptation events and Garmin sync debt. It routes to preview, scenario review or execution checks; it does not write plan or Garmin by itself.
2. **Today Change Flow v1:** implemented for planned-day Home alternatives. `Leichtere Alternative` and `Bewusst frei lassen` now open the existing Plan decision via `source=today-change` instead of the custom-workout scenario path.
3. **Workout Progression Clarity v3:** implemented as a frontend-first, read-only Plan explanation for progression role, calibration, repetition rationale and change triggers.
4. **Garmin Execution Chain UI:** implemented as a frontend-first Plan execution chain from template to calendar, readback, repeats and execution result, with one explicit next action and no automatic writes on load.
5. **Weekly Coach Review:** next PR-sized candidate. Summarize what Pulse learned this week, which plan changes are proposed and what Tobi should accept, reject or defer.
6. **Recovery & Mental Resilience:** turn recovery/mental evidence into calmer boundary guidance and signal-quality explanations, not another metrics wall.
7. **Nutrition trend summaries:** only after at least three comparable, complete `during` logs exist with activity/duration context, carbs and GI comfort. Summarize stable/learning trends and heat/sodium gaps without medical claims.
8. **iPhone/PWA field reliability:** only with real-device evidence from Tobi's iPhone/VPN/PWA flow; keep the local web/PWA model unless a recurring friction point appears.

Keep each theme as a separate PR-sized slice unless a test-only or docs-only update is required to keep the roadmap coherent.

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
