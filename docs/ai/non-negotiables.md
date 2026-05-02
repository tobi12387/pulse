# Pulse Non-Negotiables

This is the compact working set for AI sessions. `docs/decisions.md` remains the full append-only history.

## Git / Deployment

- GitHub `main` is the single source of truth.
- Mac and server are consumers. Never edit code directly on the server.
- Every session uses a feature branch and PR.
- Codex branches use `codex/<topic>`.
- Never commit directly to `main`.
- Never use `git add .`; stage explicit files only.
- Push immediately after every meaningful commit.

## Architecture

- All LLM calls go through `backend/src/lib/llm.ts`.
- No secrets in code. Never commit `.env`.
- DB migrations are additive-only: no `DROP`, no `NOT NULL` without `DEFAULT`.
- Briefing and Coach context should use the Pulse schema and shared PulseContext, not legacy Garmin/check-in tables.
- Thresholds for Readiness, TSB, HRV, and RPE belong in shared contracts, not duplicated frontend/server heuristics.

## Product Scope

- No Telegram integration. Web Push is the planned notification channel.
- No Habit Tracker. Voice check-ins plus Risk Watch cover this need.
- No Data Export unless Tobi explicitly reverses this decision.
- Completed plans are historical references only. Do not rebuild them.

## Current Priority

- The previous sequence (Bundle A/B/C, RPE, Risk Watch, Web Push, Phase 10/11, Trust Wave, Everyday Utility Wave, Reliability Wave, UI/UX Usability Wave, Everyday Flow Deepening Wave) is implemented and belongs to `docs/superpowers/plans/completed/`.
- Current active plan family: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`, plus Mobile Field Reliability.
- Next implementation order: real iPhone/PWA field evidence, Mobile Field Reliability fixes if evidence reveals any, then Adaptive Training Intelligence v2, Mental Fitness Companion, Garmin Data Quality Control Center, Goal/Race Command Center and Local Ops Autopilot.
- Local iPhone access stays web/PWA over VPN for now. Native iOS wrapper work is only a later evaluation unless Tobi explicitly changes scope.
- Do not rebuild completed plans unless Tobi explicitly reverses scope.
