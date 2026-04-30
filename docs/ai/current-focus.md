# Pulse Current Focus

Keep this file short. Update it whenever the active work queue changes.

## Active Sequence

1. Finish `codex/web-push-triggers`: briefing push, check-in reminder, and risk-critical push triggers.
2. Then return to Phase 10 equipment/strength work.
3. Keep completed Web Push foundation behavior stable while adding trigger jobs.

## Current PRs / Branches

- `codex/web-push-triggers`: active local branch for Web Push trigger jobs.
- `codex/web-push-subscriptions`: merged and deployed via PR #34.
- `codex/plan-coach-browser-qa`: merged and deployed via PR #33.
- `codex/garmin-hr-targets`: merged and deployed via PR #32.
- `codex/plan-intelligence-depth`: merged and deployed via PR #31.
- `codex/pulse-context-routing`: merged and deployed via PR #30.

## Next Recommended Work

- Open, merge, and deploy Web Push triggers after CI passes.
- Verify server has VAPID settings in `/root/pulse/.env`; without them push endpoints remain safely configured-but-skipped.
- Next branch after Web Push triggers: Phase 10 equipment/strength from the active roadmap.

## Out Of Scope Unless Reversed

- Telegram integration.
- Habit tracker.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
