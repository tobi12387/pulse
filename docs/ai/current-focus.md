# Pulse Current Focus

Keep this file short. Update it whenever the active work queue changes.

## Active Sequence

1. Finish `codex/pulse-context-routing`: Coach typed chat, voice check-in, live briefing, and cache invalidation share PulseContext.
2. Then improve Plan Intelligence depth: goal-specific workout mix, HR-first targets, RPE as safety input.
3. Then harden frontend QA around the Coach/Plan loops with browser checks after deploy.

## Current PRs / Branches

- `codex/pulse-context-routing`: active local branch for Coach/Briefing/cache consolidation.
- Phase 0 Stability Hardening merged and deployed via PR #29.

## Next Recommended Work

- Open, merge, and deploy PulseContext Routing after CI passes.
- Next implementation branch after that: Plan Intelligence depth, especially goal-specific workout mix and HR/RPE-aware workout targets.

## Out Of Scope Unless Reversed

- Telegram integration.
- Habit tracker.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
