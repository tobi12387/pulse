# Pulse Current Focus

Keep this file short. Update it whenever the active work queue changes.

## Active Sequence

1. Finish `codex/phase10-strength-equipment`: Phase 10 backend foundation for Strength + Equipment.
2. Then add Phase 10 UI surfaces: Strength Logger, Equipment Settings card, ActivityDetail override, Plan analytics.
3. Then continue Phase 11 Mental Themes.

## Current PRs / Branches

- `codex/phase10-strength-equipment`: active local branch for Phase 10 backend foundation.
- `codex/web-push-triggers`: merged and deployed via PR #35.
- `codex/web-push-subscriptions`: merged and deployed via PR #34.
- `codex/plan-coach-browser-qa`: merged and deployed via PR #33.
- `codex/garmin-hr-targets`: merged and deployed via PR #32.
- `codex/plan-intelligence-depth`: merged and deployed via PR #31.
- `codex/pulse-context-routing`: merged and deployed via PR #30.

## Next Recommended Work

- Open, merge, and deploy Phase 10 backend foundation after CI passes.
- Next branch after backend foundation: Phase 10 UI integration against the new Strength/Equipment API.
- Verify server has VAPID settings in `/root/pulse/.env`; without them push endpoints remain safely configured-but-skipped.

## Out Of Scope Unless Reversed

- Telegram integration.
- Habit tracker.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
