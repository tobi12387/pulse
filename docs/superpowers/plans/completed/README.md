# Completed Plans — Read-Only History

> **⚠ Hinweis für AI-Tools (Claude Code, Codex):** Diese Pläne sind **bereits implementiert**.
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

## Bekannte veraltete Stellen

- Phase 3a/3b/3c geben `Repo root: /root/coaching-os-v2` an. Aktueller Repo-Pfad ist `/root/pulse` — die Phasen wurden vor dem Rename geschrieben. Aktuell ist [AGENTS.md](../../../../AGENTS.md).
- Frühe Phasen erwähnen Tabellen-Namen ohne `pulse_`-Präfix. Ab Phase 3a wurde der Präfix verbindlich.

## Wo finde ich aktive Pläne?

→ [../](../) (`docs/superpowers/plans/`) ohne `completed/`
→ Aktuelle Reihenfolge in [../2026-04-28-roadmap.md](../2026-04-28-roadmap.md)
→ Tool-Workflow in [AGENTS.md](../../../../AGENTS.md)
