# Pulse Current Focus

Keep this file short. Update it whenever the active work queue changes.

## Active Sequence

1. Finish `codex/plan-intelligence-depth`: goal-specific workout mix, HR-first targets, and RPE as safety input.
2. Then harden frontend QA around the Coach/Plan loops with browser checks after deploy.
3. Then extend Garmin workout export so device-side workout steps also carry explicit HR targets.

## Current PRs / Branches

- `codex/plan-intelligence-depth`: active local branch for deeper plan intelligence.
- `codex/pulse-context-routing`: merged and deployed via PR #30.

## Next Recommended Work

- Open, merge, and deploy Plan Intelligence Depth after CI passes.
- After deploy, run browser QA on the Plan flow and verify generated descriptions/planDecision reasons in the UI.
- Follow-up branch: Garmin device HR targets in structured workout steps.

## Out Of Scope Unless Reversed

- Telegram integration.
- Habit tracker.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
