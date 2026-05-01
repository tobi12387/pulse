# Pulse Current Focus

Keep this file short. Update it whenever the active work queue changes.

## Active Sequence

1. All prior implementation plans through Phase 11, the 2026-04-30 follow-up slices, the Trust Wave, Everyday Utility Wave, Reliability Wave, and UI/UX Usability Wave are merged, deployed, and moved to `completed/`.
2. Web Push VAPID production settings are configured on `/root/pulse/.env`.
3. No active implementation wave is open. Next work should start with a new plan in `docs/superpowers/plans/`.

## Current PRs / Branches

- `codex/ux-wave-closeout`: active docs branch closing the UI/UX Usability Wave after PR #61, #63, #64, #65 and #66.
- Recent completed branches:
- `codex/ux-slice-e-density`: merged and deployed via PR #66.
- `codex/ux-slice-d-data-settings`: merged and deployed via PR #65.
- `codex/ux-slice-c-plan-decision`: merged and deployed via PR #64.
- `codex/ux-slice-b-home-coach`: merged and deployed via PR #63.
- `codex/ux-slice-a-closeout`: merged and deployed via PR #62.
- `codex/ux-slice-a-insights`: merged and deployed via PR #61.
- `codex/ux-usability-plans`: merged and deployed via PR #60.
- `codex/reliability-wave-closeout`: merged and deployed via PR #58.
- `codex/bundle-code-splitting`: merged and deployed via PR #57.
- `codex/deploy-smoke`: merged and deployed via PR #56.
- `codex/local-test-env`: merged and deployed via PR #55.
- `codex/e2e-ci-reliability`: merged and deployed via PR #54.
- `codex/browser-e2e-smoke`: merged and deployed via PR #53.
- `codex/everyday-utility-closeout`: merged and deployed via PR #52.
- `codex/mobile-density-qa`: merged and deployed via PR #51.
- `codex/action-closure-review`: merged and deployed via PR #50.
- `codex/plan-feedback-calibration`: merged and deployed via PR #49.
- `codex/garmin-bounded-backfill`: merged and deployed via PR #48.
- `codex/roadmap-after-next-wave`: merged and deployed via PR #47.
- `codex/coach-action-loop`: merged and deployed via PR #46.
- `codex/garmin-data-trust`: merged and deployed via PR #45.
- `codex/plan-trust-learning`: merged and deployed via PR #44.
- `codex/next-roadmap-audit`: merged and deployed via PR #43.
- `codex/race-ctl-context`: merged and deployed via PR #42.
- `codex/status-roadmap-cleanup`: merged and deployed via PR #41.
- `codex/phase11-theme-aware-insights`: merged and deployed via PR #40.
- `codex/phase11-mental-load-overlay`: merged and deployed via PR #39.
- `codex/phase11-mental-themes`: merged and deployed via PR #38.
- `codex/phase10-strength-equipment-ui`: merged and deployed via PR #37.
- `codex/phase10-strength-equipment`: merged and deployed via PR #36.
- `codex/web-push-triggers`: merged and deployed via PR #35.
- `codex/web-push-subscriptions`: merged and deployed via PR #34.
- `codex/plan-coach-browser-qa`: merged and deployed via PR #33.
- `codex/garmin-hr-targets`: merged and deployed via PR #32.
- `codex/plan-intelligence-depth`: merged and deployed via PR #31.
- `codex/pulse-context-routing`: merged and deployed via PR #30.

## Next Recommended Work

- Create the next active plan from the browser UI/UX audit findings if Tobi wants another implementation wave.
- Highest-value candidates: Coach-guided daily briefing, Plan alternatives/adaptation depth, Data backfill observability, and Settings action grouping.
- Ask Tobi to enable Push in Settings on each target browser/device; server VAPID is already present.

## Out Of Scope Unless Reversed

- Telegram integration.
- Habit tracker.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
