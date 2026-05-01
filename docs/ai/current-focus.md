# Pulse Current Focus

Keep this file short. Update it whenever the active work queue changes.

## Active Sequence

1. Finish `codex/phase11-mental-themes`: Phase 11 Theme-Aggregation endpoint plus Data/Mental ThemeTimeline.
2. Then continue Phase 11 Mental-Load-Overlay in Insights and theme-aware mental insight engine.
3. Keep Web Push production activation on the ops checklist: server still needs real VAPID settings before pushes can send.

## Current PRs / Branches

- `codex/phase11-mental-themes`: active local branch for Phase 11 ThemeTimeline slice.
- `codex/phase10-strength-equipment-ui`: merged and deployed via PR #37.
- `codex/phase10-strength-equipment`: merged and deployed via PR #36.
- `codex/web-push-triggers`: merged and deployed via PR #35.
- `codex/web-push-subscriptions`: merged and deployed via PR #34.
- `codex/plan-coach-browser-qa`: merged and deployed via PR #33.
- `codex/garmin-hr-targets`: merged and deployed via PR #32.
- `codex/plan-intelligence-depth`: merged and deployed via PR #31.
- `codex/pulse-context-routing`: merged and deployed via PR #30.

## Next Recommended Work

- Open, merge, and deploy Phase 11 ThemeTimeline after CI passes.
- Next branch after ThemeTimeline: Phase 11 Mental-Load-Overlay and theme-aware Insights.
- Verify server has VAPID settings in `/root/pulse/.env`; without them push endpoints remain safely configured-but-skipped.

## Out Of Scope Unless Reversed

- Telegram integration.
- Habit tracker.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
