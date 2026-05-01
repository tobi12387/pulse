# Pulse Current Focus

Keep this file short. Update it whenever the active work queue changes.

## Active Sequence

1. All prior implementation plans through Phase 11, the 2026-04-30 follow-up slices, the Trust Wave, and the Everyday Utility Wave are merged, deployed, and moved to `completed/`.
2. Web Push VAPID production settings are configured on `/root/pulse/.env`.
3. Active implementation wave: `docs/superpowers/plans/2026-05-01-ui-ux-usability-wave.md`.

## Current PRs / Branches

- `codex/ux-slice-a-closeout`: active branch for marking UI/UX Slice A as merged and deployed.
- Recent completed branches:
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

- Start UI/UX Slice B: Home/Coach daily flow.
- Then implement Plan decision flow, Data/Settings trust, and visual density pass in separate PRs.
- Ask Tobi to enable Push in Settings on each target browser/device; server VAPID is already present.

## Out Of Scope Unless Reversed

- Telegram integration.
- Habit tracker.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
