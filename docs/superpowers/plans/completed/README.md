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

## Bekannte veraltete Stellen

- Phase 3a/3b/3c geben `Repo root: /root/coaching-os-v2` an. Aktueller Repo-Pfad ist `/root/pulse` — die Phasen wurden vor dem Rename geschrieben. Aktuell ist [CLAUDE.md](../../../../CLAUDE.md).
- Frühe Phasen erwähnen Tabellen-Namen ohne `pulse_`-Präfix. Ab Phase 3a wurde der Präfix verbindlich.

## Wo finde ich aktive Pläne?

→ [../](../) (`docs/superpowers/plans/`) ohne `completed/`
→ Aktuelle Reihenfolge in [../2026-04-28-roadmap.md](../2026-04-28-roadmap.md)
→ Tool-übergreifender Workflow in [AGENTS.md](../../../../AGENTS.md) bzw. [CLAUDE.md](../../../../CLAUDE.md)
