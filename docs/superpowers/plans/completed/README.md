# Completed Plans — Read-Only History

> **⚠ Hinweis für Codex und andere AI-Tools:** Diese Pläne sind **bereits implementiert**.
> Sie dienen als historische Referenz, nicht als Aufgaben-Backlog. Lies sie nur, wenn du
> verstehen willst *warum* etwas im Code so ist, wie es ist. Implementiere **nichts** aus
> diesem Ordner.

## Was hier liegt

| Datei | Phase | Implementiert in (commit) |
|---|---|---|
| `2026-04-25-v2-phase3a-pulse-foundation.md` | Phase 3a — Pulse Foundation | DB-Schema, BullMQ, Plugin-Skeleton |
| `2026-04-25-v2-phase3b-pulse-services.md` | Phase 3b — Pulse Services | Services-Layer, Garmin-Sidecar |
| `2026-04-25-v2-phase3c-pulse-frontend.md` | Phase 3c — Pulse Frontend | React-19-App mit 5 Tabs |
| `2026-04-26-phase4-plan-charts-weight.md` | Phase 4 — Plan/Charts/Weight | Plan-Engine, Body-Comp, Weight-Log |
| `2026-04-26-phase5-coach-intelligence.md` | Phase 5 — Coach Intelligence | Compliance-Score, Workout-Feedback |
| `2026-04-26-mental-checkin-proactive-coach.md` | Mental-Check-in Voice | Voice-Check-in, Theme-Extraktion |
| `2026-04-28-cross-cutting-hr-first.md` | Cross-cutting | HR-First-Steuerung in allen Engines |
| `2026-04-28-phase6-health-states-adaptive-plan.md` | Phase 6 | `9786983 feat: phase 6` |
| `2026-04-28-phase7-race-mode.md` | Phase 7 | `0d49346 feat: phase 7 — race mode` |
| `2026-04-28-phase8-activity-intelligence.md` | Phase 8 | `6d37f79 feat: phase 8 — activity intelligence` |
| `2026-04-28-phase9-recovery-fueling-depth.md` | Phase 9 | `096136f feat: phase 9 — recovery metrics, ...` |
| `2026-04-29-bundle-a-context-unification.md` | Bündel A — Context Unification | PR #10, PR #30 |
| `2026-04-29-bundle-b-thresholds-canonicalization.md` | Bündel B — Thresholds | PR #11 |
| `2026-04-29-bundle-c-endpoint-page-consolidation.md` | Bündel C — Endpoints/Pages | `6d6330c`, `f350bc3` |
| `2026-04-29-rpe-post-workout-feedback.md` | RPE Feedback Loop | `e447fd0`, PR #20 |
| `2026-04-29-risk-watch.md` | Risk Watch | PR #21, PR #22, PR #23, PR #26 |
| `2026-04-29-web-push-notifications.md` | Web Push | PR #34, PR #35 + Server-VAPID |
| `2026-04-30-phase0-stability-hardening.md` | Phase 0 — Stability Hardening | PR #29 |
| `2026-04-30-pulse-context-routing.md` | PulseContext Routing | PR #30 |
| `2026-04-30-plan-intelligence-depth.md` | Plan Intelligence Depth | PR #31 |
| `2026-04-30-garmin-hr-targets.md` | Garmin HR Targets | PR #32 |
| `2026-04-28-phase10-auxiliary-tracking.md` | Phase 10 — Strength & Equipment | PR #36, PR #37 |
| `2026-04-28-phase11-mental-polish.md` | Phase 11 — Mental Themes | PR #38, PR #39, PR #40 |
| `2026-05-01-next-wave-product-technical-audit.md` | Trust Wave — Plan Trace, Garmin Coverage, Coach Action Loop | PR #44, PR #45, PR #46 |
| `2026-05-01-everyday-utility-wave.md` | Everyday Utility Wave — Garmin Backfill, Plan Calibration, Action Closure, Mobile Density | PR #48, PR #49, PR #50, PR #51 |
| `2026-05-01-reliability-wave.md` | Reliability Wave — E2E CI, Local Tests, Deploy Smoke, Bundle Cleanup | PR #54, PR #55, PR #56, PR #57 |
| `2026-05-01-ui-ux-usability-wave.md` | UI/UX Usability Wave — Insights resilience, daily action, Plan decision, Data/Settings trust, mobile density | PR #61, PR #63, PR #64, PR #65, PR #66 |
| `2026-05-01-everyday-flow-deepening-wave.md` | Everyday Flow Deepening Wave — Coach daily briefing, UI chrome, Figma integration, plan alternatives, Garmin fallback, Insights/Data/Settings reliability | PR #69, PR #70, PR #71, PR #72, PR #73, PR #74, PR #75, PR #76 |
| `2026-05-01-daily-intelligence-next-wave.md` | Daily Intelligence — execution reconciliation, personalization, daily decision, insight evidence, UI/UX audit | PR #81, PR #86, PR #87, PR #92, PR #99 |
| `2026-05-01-garmin-data-enrichment-wave.md` | Garmin Enrichment — raw preservation, execution reconciliation, recovery depth, profile provenance, sync cleanup | PR #80, PR #81, PR #82, PR #83, PR #84 |
| `2026-05-01-iphone-pwa-readiness.md` | iPhone/PWA Readiness — safe-area, service worker, diagnostics, WebKit/manual QA gate | PR #79, PR #98 |
| `2026-05-01-decision-closure-coach-memory-wave.md` | Decision Closure & Coach Memory — action decisions, Home/Coach closure, preferences, push journeys | PR #94, PR #95, PR #96, PR #97 |
| `2026-05-01-pulse-app-potential-audit.md` | Potential and gap audit after Garmin repeat sync | Planning audit closed by PR #79-#100 |
| `2026-05-02-overnight-next-steps.md` | Overnight sequence closeout and morning gates | PR #94-#100 |
| `2026-05-02-daily-loop-explainability-wave.md` | Daily Loop Explainability — visible action history, suppressed reasons, evidence links, briefing guard | PR #102 |
| `2026-05-02-local-ops-autopilot.md` | Local Ops Autopilot — separated local Docker/Postgres/Redis status from server mirror health | PR #105 |
| `2026-05-02-adaptive-training-intelligence-v2.md` | Adaptive Training Intelligence v2 — deterministic execution review, plan adaptation trace, deliberate rest days | PR #106 |
| `2026-05-02-mental-fitness-companion.md` | Mental Fitness Companion — guided check-in questions and visible mental support actions | PR #108 |
| `2026-05-02-garmin-data-quality-control-center.md` | Garmin Data Quality — domain freshness, gaps, repairability and blocked provider state | PR #111 |
| `2026-05-02-goal-race-command-center.md` | Goal/Race Command Center — race phase, readiness, key workout, recovery boundary and evidence in Plan | PR #112 |
| `2026-05-02-daily-outcome-learning-loop.md` | Daily Outcome Learning Loop — deterministic learning signal from action decisions, check-ins and Garmin execution in Home/Coach | PR #113 |
| `2026-05-02-season-strategy-planner.md` | Season Strategy Planner — deterministic season line and weekly plan guardrails for target sessions, hard days, deloads and intentional free days | PR #114 |
| `2026-05-02-garmin-signal-usefulness-wave.md` | Garmin Signal Usefulness — ranked used, underused and missing Garmin signals in Data without live Garmin page probes | PR #116 |
| `2026-05-02-daily-decision-quality-loop.md` | Daily Decision Quality Loop — score helpful/stale/strategy-change recommendation quality in Home, Coach and Insights | PR #117 |
| `2026-05-02-structure-boundary-cleanup.md` | Structure Boundary Cleanup — route/page/shared-type extraction and ops/design handoff cleanup | PR #136-#148 |
| `2026-05-02-ui-ux-deep-friction-roadmap.md` | UI/UX Deep Friction Closure — mobile containment, daily-loop priority, feedback recovery, Settings diagnostics and route evidence refresh | PR #155-#160 |
| `2026-05-04-daily-loop-slimming.md` | Daily Loop Slimming — Home owns the full daily decision while Coach and Plan show compact support cards | PR #163 |
| `2026-05-04-insights-into-data.md` | Insights Into Data — Insights moved into Data as `Analysen`, `/insights` redirects for compatibility | PR #165 |
| `2026-05-04-mental-checkin-simplification.md` | Mental Check-in Simplification — quick choices, free-text preview, Home entry and Coach context | PR #167-#171 |
| `2026-05-05-home-daily-decision-closure.md` | Home Daily Decision Closure — no-training days close locally on Home while Coach remains support | PR #178 |
| `2026-05-05-mental-signal-impact-loop.md` | Mental Signal Impact Loop — shared mental impact language appears in Data, Home, Plan and Coach | PR #180 |
| `2026-05-05-garmin-workout-sync-confidence.md` | Garmin Workout Sync Confidence — Plan rows and workout detail modal show local/template/calendar/completed/missed/replaced confidence without live Garmin calls | PR #182 |
| `2026-05-05-mobile-a11y-controls-polish.md` | Mobile/A11y Controls Polish — 44px touch targets, tab semantics and Mental radio keyboard support | PR #184, PR #186 |
| `2026-05-05-data-decision-evidence-trail.md` | Data Decision Evidence Trail — Home/Plan evidence chips deep-link into Data anchors with hash tab selection and visible focus | PR #188 |
| `2026-05-09-training-benchmark-gap-plan.md` | Training Benchmark Gap Plan — capability levels, workout library fit, TrainNow, scenario preview, season load model, Garmin sync contract and goal limiter evidence | `8a384ab`-`6de9f86` |
| `2026-05-10-garmin-execution-ledger.md` | Garmin Execution Ledger — durable Garmin upload/delete ledger, payload snapshots, Plan modal visibility and Settings Plan link | PR #261 |
| `2026-05-10-adaptation-event-queue.md` | Adaptation Event Queue — persisted write-triggered adaptation events for activity/RPE/mental/fueling/recovery/sync debt with Home and Plan visibility | PR #262 |
| `2026-05-10-workout-library-v2.md` | Workout Library v2 — 20 deterministic workout variants, scored selection, Garmin-safe steps and preserved archetypes through Plan/Today Options | Workout Library v2 PR |
| `2026-05-10-mobile-plan-flow.md` | Mobile Plan Flow — Home availability intents, auto-computed Plan scenario preview and mobile route evidence for iPhone/PWA planning | Mobile Plan Flow PR |
| `2026-05-10-power-data-quality-foundation.md` | Power Data Quality Foundation — stream/lap/unavailable provenance for training analytics with compact Data evidence before future durability claims | Power Data Quality PR |
| `2026-05-10-power-duration-durability.md` | Power Duration/Durability — quality-gated best efforts, durability snapshots, Data summary and Plan durability limiter | Power Duration PR |
| `2026-05-10-season-atp-v2.md` | Season ATP v2 — annual hours/TSS, A/B/C event bias, safe missed-load compensation and compact Plan ATP guardrail row | Season ATP PR |
| `2026-05-10-strength-mobility-companion.md` | Strength Mobility Companion — concrete support block lists, clearer Today Options and note-based Garmin handoff for strength | Strength Mobility PR |
| `2026-05-02-fueling-recovery-companion.md` | Fueling & Recovery Companion — MNSTRY-aware guidance, 750 ml bottle math, Garmin description handoff and activity fueling logs | Fueling companion wave |
| `2026-05-10-training-benchmark-upgrade-roadmap.md` | Training Benchmark Upgrade Roadmap — benchmark-derived sequence for device trust, adaptation, library depth and modeling | Superseded by canonical product roadmap |
| `2026-05-10-fresh-benchmark-ui-roadmap.md` | Fresh Benchmark UI Roadmap — UI/accessibility, Daily Command Center, Garmin trust and progression execution order | Completed 2026-05-10 wave |
| `2026-05-10-ui-accessibility-polish-v2.md` | UI Accessibility Polish v2 — route evidence artifacts, focus, touch targets, tab semantics and contrast cleanup | Fresh Benchmark UI Roadmap Phase 1 |
| `2026-05-10-daily-command-center-v2.md` | Daily Command Center v2 — one daily truth on Home, compact mental entry and calmer desktop/mobile layout | Fresh Benchmark UI Roadmap Phase 2 |
| `2026-05-10-garmin-execution-trust-v2.md` | Garmin Execution Trust v2 — Garmin readback/diff, broken repeat visibility and explicit repair actions | Fresh Benchmark UI Roadmap Phase 3 |
| `2026-05-10-progression-library-v2.md` | Progression Library v2 — capability language, rotation memory, fit modifiers and safer workout selection | Fresh Benchmark UI Roadmap Phase 4 |
| `2026-05-10-post-progression-next-roadmap.md` | Post-Progression Next Roadmap — Plan refresh preview, Garmin readback closure, signal labels, fueling debt and no-write QA | Implemented 2026-05-10 |
| `2026-05-10-ux-task-contract-home-slice.md` | UX Task Contract Home Slice — Home daily decision shows why now, next step, result preview and optional details/evidence | UX Task Contract Home PR |
| `2026-05-10-home-heute-orientation.md` | Home Heute Orientation — root route stays `/`, visible navigation label becomes `Heute` for daily orientation | Heute Orientation PR |
| `2026-05-10-plan-action-hierarchy.md` | Plan Action Hierarchy — Plan starts with a primary action, why-now copy and result preview before evidence/tools | Plan Action Hierarchy PR |
| `2026-05-10-daily-delta-home-v1.md` | Daily Delta Home v1 — Home shows a compact plan-vs-execution loop from existing workouts, activities and daily metrics | Daily Delta PR |
| `2026-05-10-garmin-execution-closure-polish.md` | Garmin Execution Closure Polish — Plan Ausführung verifies repeat counts, separates Pulse-known from Garmin-readback IDs and routes Settings directly to execution readback | Garmin Closure Polish PR |
| `2026-05-10-athlete-level-decision-language-v1.md` | Athlete-Level Decision Language v1 — Today Options and Plan translate capability fit into Machbar/Produktiv/Stretch/Zu hart heute action language | Athlete Level Decision Language PR |
| `2026-05-10-scenario-preview-capability-fit.md` | Scenario Preview Capability Fit — Plan scenario previews show projected archetype, workout level and capability fit before apply without Garmin writes | Scenario Preview Capability Fit PR |
| `2026-05-10-nutrition-intelligence-v1.md` | Nutrition Intelligence v1 — low-intake GI logs lower the next long-session target to a controlled 50-70 g/h with 750-ml bottle and powder math | Nutrition Intelligence PR |
| `2026-05-10-nutrition-outcome-baseline.md` | Nutrition Outcome Baseline — recent long-session logs become a structured baseline for carb target, bottles, powder, fluid and sodium evidence gaps | Nutrition Outcome Baseline PR |
| `2026-05-11-personal-response-model-v1.md` | Personal Response Model v1 — deterministic read-only response summary, API endpoint and compact Data > Analyse evidence block | Personal Response Model PR |
| `2026-05-11-predictive-goal-engine-v1.md` | Predictive Goal Engine v1 — deterministic read-only goal probability, limiter risk and next-intervention evidence in Data > Analyse | Predictive Goal Engine PR |
| `2026-05-11-adaptive-season-builder-v1.md` | Adaptive Season Builder v1 — read-only Plan Saisonvertrag from Season Strategy and Goal Projection evidence | Adaptive Season Builder PR |
| `2026-05-11-contextual-coach-mode-v1.md` | Contextual Coach Mode v1 — read-only Coach context card from Personal Response, Goal Projection and Season Strategy evidence | Contextual Coach Mode PR |
| `2026-05-11-customizable-daily-surface-v1.md` | Customizable Daily Surface v1 — local per-device Home focus-card ordering with safe defaults and no backend/Garmin writes | Customizable Daily Surface PR |
| `2026-05-11-desktop-plan-daily-focus.md` | Desktop Plan Daily Focus — Plan starts with action plus week before compact season evidence, backed by route evidence | Desktop Density PR |
| `2026-05-11-insights-synthesis-focus.md` | Insights Synthesis Focus — top-level Insights becomes a synthesis surface while Data Analyse remains the deep evidence workbench | Insights Density PR |
| `2026-05-11-data-daily-action-focus.md` | Data Daily Action Focus — Data starts with one daily data action while triage and secondary evidence stay optional | Data Density PR |
| `2026-05-11-data-backfill-touch-polish.md` | Data Backfill Touch Polish — Garmin Backfill preview/write buttons meet the mobile touch-target baseline | Data A11y PR |
| `2026-05-12-workout-progression-clarity-v3.md` | Workout Progression Clarity v3 — Plan explains progression role, calibration, repetition rationale and change triggers without plan/Garmin writes | Workout Progression Clarity PR |
| `2026-05-12-garmin-execution-chain-ui.md` | Garmin Execution Chain UI — Plan Ausführung shows template, calendar, readback, repeats and execution as one compact chain with one next action | Garmin Execution Chain PR |
| `2026-05-12-weekly-coach-review.md` | Weekly Coach Review — Plan Review starts with learned/proposed/decision summary and one next action from existing evidence | Weekly Coach Review PR |
| `2026-05-12-recovery-mental-resilience.md` | Recovery Mental Resilience — Data Mental translates recovery/readiness/load/check-in evidence into boundary guidance without clinical labels | Recovery Mental Resilience PR |
| `2026-05-13-settings-profile-preferences-disclosure.md` | Settings Profile Preferences Disclosure — secondary Fueling & Recovery preferences collapse behind an explicit profile disclosure | Settings Density PR |

## Bekannte veraltete Stellen

- Phase 3a/3b/3c geben `Repo root: /root/coaching-os-v2` an. Aktueller Repo-Pfad ist `/root/pulse` — die Phasen wurden vor dem Rename geschrieben. Aktuell ist [AGENTS.md](../../../../AGENTS.md).
- Frühe Phasen erwähnen Tabellen-Namen ohne `pulse_`-Präfix. Ab Phase 3a wurde der Präfix verbindlich.

## Wo finde ich aktive Pläne?

→ [../](../) (`docs/superpowers/plans/`) ohne `completed/`
→ Aktuelle Reihenfolge in [../2026-05-02-future-direction-roadmap.md](../2026-05-02-future-direction-roadmap.md)
→ Tool-Workflow in [AGENTS.md](../../../../AGENTS.md)
