# Pulse Current Focus

Keep this file short. Update it whenever the active work queue changes.

## Active Sequence

1. Finish `codex/garmin-hr-targets`: structured workout steps and Garmin upload carry HR targets.
2. Then harden frontend QA around the Coach/Plan loops with browser checks after deploy.
3. Then continue with the next active roadmap slice selected from the audit/open-plan queue.

## Current PRs / Branches

- `codex/garmin-hr-targets`: active local branch for Garmin HR target export.
- `codex/plan-intelligence-depth`: merged and deployed via PR #31.
- `codex/pulse-context-routing`: merged and deployed via PR #30.

## Next Recommended Work

- Open, merge, and deploy Garmin HR Targets after CI passes.
- After deploy, run browser QA on the Plan workout-detail flow and verify HR target chips in generated steps.
- Follow-up branch: choose the next narrow slice from the active roadmap/audit queue.

## Out Of Scope Unless Reversed

- Telegram integration.
- Habit tracker.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
