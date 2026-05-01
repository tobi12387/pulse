# Pulse Current Focus

Keep this file short. Update it whenever the active work queue changes.

## Active Sequence

1. All prior implementation plans through Phase 11, the 2026-04-30 follow-up slices, the Trust Wave, Everyday Utility Wave, Reliability Wave, and UI/UX Usability Wave are merged, deployed, and moved to `completed/`.
2. Web Push VAPID production settings are configured on `/root/pulse/.env`.
3. Garmin repeat sync was fixed in PR #78 and is no longer the active branch.
4. Garmin data/iPhone/PWA roadmap baseline was merged and deployed via PR #79.
5. Garmin Raw Preservation was merged and deployed via PR #80.
6. Garmin Execution Reconciliation was merged and deployed via PR #81.
7. Garmin Recovery Data Depth was merged and deployed via PR #82.
8. Garmin Training Metadata And Profile Quality was merged and deployed via PR #83.
9. Garmin Sync Architecture Cleanup was merged and deployed via PR #84.
10. Daily Briefing / guided Daily Check-in was merged and deployed via PR #85.
11. Plan Personalization Loop was merged and deployed via PR #86.
12. Daily Decision Center was merged and deployed via PR #87.
13. Daily Briefing future-workout correction and stronger guided Mental Check-in was merged and deployed via PR #88.
14. Local Test Services Hardening was merged and deployed via PR #90.
15. Insight Evidence Links was merged and deployed via PR #92.
16. Deep UI/UX Flow Audit baseline and overnight sequencing are documented in `docs/superpowers/plans/2026-05-02-overnight-next-steps.md`.
17. Decision Closure Model was merged and deployed via PR #94.
18. Home/Coach Closure Flow was merged and deployed via PR #95.
19. Explicit Coach Preferences was merged and deployed via PR #96.
20. Push Action Journeys was merged and deployed via PR #97.
21. Active implementation branch: `codex/iphone-qa-recording`.
22. Active implementation wave: Decision Closure & Coach Memory. Current slice: Real iPhone/VPN QA evidence recording.

## Current PRs / Branches

- Open PRs: none.
- Active branch:
- `codex/iphone-qa-recording`: iPhone/VPN/PWA QA evidence record in progress.
- Recent completed branches:
- `codex/push-action-journeys`: merged and deployed via PR #97.
- `codex/coach-preferences`: merged and deployed via PR #96.
- `codex/home-coach-closure-flow`: merged and deployed via PR #95.
- `codex/decision-closure-model`: merged and deployed via PR #94.
- `codex/insight-evidence-links`: merged and deployed via PR #92.
- `codex/local-test-services-hardening`: merged and deployed via PR #90.
- `codex/daily-briefing-guided-checkin`: merged and deployed via PR #88.
- `codex/daily-decision-center`: merged and deployed via PR #87.
- `codex/plan-personalization-rationale`: merged and deployed via PR #86.
- `codex/daily-briefing-checkin`: merged and deployed via PR #85.
- `codex/garmin-sync-access-cleanup`: merged and deployed via PR #84.
- `codex/garmin-profile-provenance`: merged and deployed via PR #83.
- `codex/garmin-recovery-depth`: merged and deployed via PR #82.
- `codex/garmin-execution-reconciliation`: merged and deployed via PR #81.
- `codex/garmin-raw-preservation`: merged and deployed via PR #80.
- `codex/garmin-data-ux-roadmap`: merged and deployed via PR #79.
- `codex/garmin-repeat-sync`: merged and deployed via PR #78.
- `codex/everyday-flow-closeout`: merged and deployed via PR #77.
- `codex/settings-action-grouping`: merged and deployed via PR #76.
- `codex/data-backfill-observability`: merged and deployed via PR #75.
- `codex/insights-reliability`: merged and deployed via PR #74.
- `codex/plan-descriptions-garmin-sync`: merged and deployed via PR #73.
- `codex/phase2-plan-alternatives`: merged and deployed via PR #72.
- `codex/figma-ux-integration`: merged via PR #71.
- `codex/design-system-pass`: merged and deployed via PR #70.
- `codex/phase1-coach-daily-briefing`: merged and deployed via PR #69.
- `codex/ux-wave-closeout`: merged and deployed via PR #67.
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

- Continue Decision Closure & Coach Memory priorities: finish Explicit Coach Preferences, then Push Action Journeys, real iPhone/VPN QA recording, and Canva/Figma UX companion refresh.
- Use `docs/superpowers/plans/2026-05-01-iphone-pwa-readiness.md` for any iPhone/VPN/PWA follow-up; the current branch contains the first baseline.
- Maintain the Canva UX board (`Pulse Everyday Flow UX Board`: https://www.canva.com/d/TGL3ff3MAzXgLkE) as a visual companion for route screenshots, interaction notes and acceptance review.
- Maintain the Figma/FigJam UX loop (`Pulse UX Toolchain Loop`: https://www.figma.com/board/pk4iHWfci7iv9ot5y76j6Z?utm_source=codex&utm_content=edit_in_figjam&oai_id=&request_id=bdcae154-00da-4adb-8a63-e66bbdf25a32) for reusable component states and design-system decisions.
- Use Build Web Apps for PWA/mobile QA if the plugin becomes visible in Codex tools. Use Build iOS Apps only for a later native-wrapper evaluation; current scope remains local web/PWA over VPN.
- Ask Tobi to enable Push in Settings on each target browser/device; server VAPID is already present.

## Out Of Scope Unless Reversed

- Telegram integration.
- Habit tracker.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
