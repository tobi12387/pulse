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

## Bekannte veraltete Stellen

- Phase 3a/3b/3c geben `Repo root: /root/coaching-os-v2` an. Aktueller Repo-Pfad ist `/root/pulse` — die Phasen wurden vor dem Rename geschrieben. Aktuell ist [AGENTS.md](../../../../AGENTS.md).
- Frühe Phasen erwähnen Tabellen-Namen ohne `pulse_`-Präfix. Ab Phase 3a wurde der Präfix verbindlich.

## Wo finde ich aktive Pläne?

→ [../](../) (`docs/superpowers/plans/`) ohne `completed/`
→ Aktuelle Reihenfolge in [../2026-05-02-future-direction-roadmap.md](../2026-05-02-future-direction-roadmap.md)
→ Tool-Workflow in [AGENTS.md](../../../../AGENTS.md)
