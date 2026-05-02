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
16. Deep UI/UX Flow Audit baseline and overnight sequencing are documented in `docs/superpowers/plans/completed/2026-05-02-overnight-next-steps.md`.
17. Decision Closure Model was merged and deployed via PR #94.
18. Home/Coach Closure Flow was merged and deployed via PR #95.
19. Explicit Coach Preferences was merged and deployed via PR #96.
20. Push Action Journeys was merged and deployed via PR #97.
21. Real iPhone/VPN QA evidence recording was merged and deployed via PR #98.
22. Canva/Figma UX companion refresh was merged and deployed via PR #99.
23. Future Direction Roadmap reset was merged and deployed via PR #101.
24. Daily Loop Explainability was merged and deployed via PR #102.
25. Mobile Field Reliability runbook/manual-gate cleanup was merged and deployed via PR #103.
26. Future wave implementation plans were merged and deployed via PR #104.
27. Local Ops Autopilot was merged and deployed via PR #105.
28. Adaptive Training Intelligence v2 was merged and deployed via PR #106.
29. Mental Fitness Companion was merged and deployed via PR #108.
30. Garmin Data Quality Control Center was merged and deployed via PR #111.
31. Goal/Race Command Center was merged and deployed via PR #112.
32. Daily Outcome Learning Loop was merged and deployed via PR #113.
33. Season Strategy Planner was merged and deployed via PR #114.
34. Future direction plan pack was merged and deployed via PR #115.
35. Garmin Signal Usefulness was merged and deployed via PR #116.
36. Daily Decision Quality Loop was merged and deployed via PR #117.
37. Daily Quality status closeout was merged and deployed via PR #118.
38. Deploy Cert Guard was merged and deployed via PR #120 so the structure cleanup can remove tracked cert files without losing HTTPS on `:5175`.
39. Project Structure Audit was merged and deployed via PR #119.
40. Backend Health Route Extraction was merged and deployed via PR #121.
41. Backend Daily Loop Route Extraction was merged and deployed via PR #122.
42. Backend Coach Route Extraction was merged and deployed via PR #123.
43. Backend Check-in Route Extraction was merged and deployed via PR #124.
44. Backend Training Strength/Equipment Route Extraction was merged and deployed via PR #125.
45. Backend Workout Step Service Extraction was merged and deployed via PR #126.
46. Backend Plan Route Helper Extraction was merged and deployed via PR #127.
47. Backend Plan/Workout Route Extraction was merged and deployed via PR #128.
48. Backend Strategy Route Extraction was merged and deployed via PR #129.
49. Backend Review/Nutrition Route Extraction was merged and deployed via PR #130.
50. Backend Training Analytics Route Extraction was merged and deployed via PR #131.
51. Backend Garmin Route Extraction was merged and deployed via PR #132.
52. Backend Push Route Extraction was merged and deployed via PR #133.
53. Backend Activity Route Extraction was merged and deployed via PR #134.
54. Backend Insight Route Extraction was merged and deployed via PR #135.
55. Garmin Sync Boundary was merged and deployed via PR #136.
56. Frontend Plan Utils Split was merged and deployed via PR #137.
57. Frontend Plan Training Components Split was merged and deployed via PR #138.
58. Frontend Plan Strategy Components Split was merged and deployed via PR #139.
59. Frontend Plan Goal Components Split was merged and deployed via PR #140.
60. Frontend Data Coverage Components Split was merged and deployed via PR #141.
61. Frontend Data Mental Components Split was merged and deployed via PR #142.
62. Frontend Data Recovery Components Split was merged and deployed via PR #143.
63. Frontend Settings Push Components Split is active on `codex/frontend-settings-push-components`.

## Current PRs / Branches

- Open PRs: none known from Codex.
- Active branch: `codex/frontend-settings-push-components` for moving push notification and PWA device UI into `frontend/src/features/settings/push/`.
- Recent completed branches:
- `codex/frontend-data-recovery-components`: merged and deployed via PR #143.
- `codex/frontend-data-mental-components`: merged and deployed via PR #142.
- `codex/frontend-data-coverage-components`: merged and deployed via PR #141.
- `codex/frontend-plan-goal-components`: merged and deployed via PR #140.
- `codex/frontend-plan-strategy-components`: merged and deployed via PR #139.
- `codex/frontend-plan-training-components`: merged and deployed via PR #138.
- `codex/frontend-plan-utils`: merged and deployed via PR #137.
- `codex/garmin-sync-boundary`: merged and deployed via PR #136.
- `codex/pulse-insight-routes`: merged and deployed via PR #135.
- `codex/pulse-activity-routes`: merged and deployed via PR #134.
- `codex/pulse-push-routes`: merged and deployed via PR #133.
- `codex/pulse-garmin-routes`: merged and deployed via PR #132.
- `codex/pulse-training-analytics-routes`: merged and deployed via PR #131.
- `codex/pulse-review-nutrition-routes`: merged and deployed via PR #130.
- `codex/pulse-strategy-routes`: merged and deployed via PR #129.
- `codex/pulse-plan-routes`: merged and deployed via PR #128.
- `codex/pulse-plan-route-helpers`: merged and deployed via PR #127.
- `codex/pulse-workout-steps-service`: merged and deployed via PR #126.
- `codex/pulse-training-routes`: merged and deployed via PR #125.
- `codex/pulse-checkin-routes`: merged and deployed via PR #124.
- `codex/pulse-coach-routes`: merged and deployed via PR #123.
- `codex/pulse-daily-loop-routes`: merged and deployed via PR #122.
- `codex/pulse-health-route-extraction`: merged and deployed via PR #121.
- `codex/project-structure-audit`: merged and deployed via PR #119.
- `codex/deploy-cert-guard`: merged and deployed via PR #120.
- `codex/daily-quality-status-closeout`: merged and deployed via PR #118.
- `codex/daily-decision-quality`: merged and deployed via PR #117.
- `codex/garmin-signal-usefulness`: merged and deployed via PR #116.
- `codex/future-direction-plans`: merged and deployed via PR #115.
- `codex/season-strategy`: merged and deployed via PR #114.
- `codex/daily-outcome-learning`: merged and deployed via PR #113.
- `codex/goal-race-command`: merged and deployed via PR #112.
- `codex/garmin-data-quality`: merged and deployed via PR #111.
- `codex/mental-fitness-companion`: merged and deployed via PR #108.
- `codex/adaptive-training-v2`: merged and deployed via PR #106.
- `codex/local-ops-autopilot`: merged and deployed via PR #105.
- `codex/future-wave-plans`: merged and deployed via PR #104.
- `codex/mobile-ops-runbook`: merged and deployed via PR #103.
- `codex/daily-loop-explainability`: merged and deployed via PR #102.
- `codex/autonomous-future-plans`: merged and deployed via PR #101.
- `codex/ux-companion-refresh`: merged and deployed via PR #99.
- `codex/iphone-qa-recording`: merged and deployed via PR #98.
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

- Use `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md` as the active orientation document.
- Use `docs/ai/project-structure-audit.md` and `docs/superpowers/plans/2026-05-02-structure-boundary-cleanup.md` before broad refactors.
- Next autonomous engineering work can be the staged Structure Boundary Cleanup, starting with `backend/src/pulse/plugin.ts` route extraction.
- Implement autonomous follow-up work from `docs/superpowers/plans/2026-05-02-mobile-field-reliability-wave.md` only where it does not require Tobi's real iPhone or push permission decisions.
- No further broad autonomous feature plan is currently ungated; the remaining feature plans need real-device evidence or preference decisions.
- Mobile Field Reliability still needs real-device iPhone/VPN/PWA evidence from Tobi's device before UI fixes are implemented.
- Fueling & Recovery needs dietary/preference decisions before implementation; Native iOS remains a later evidence gate.
- Use `npm run pulse:status` for first-pass ops triage; it separates Mac-local Docker/Postgres/Redis status from the server deploy mirror health.
- The real iPhone/VPN/PWA field run is still a manual gate for Tobi's device; record evidence in `docs/qa/2026-05-02-iphone-pwa-real-device.md`.
- Maintain the Canva UX board (`Pulse Everyday Flow UX Board`: https://www.canva.com/d/TGL3ff3MAzXgLkE) as a visual companion for route screenshots, interaction notes and acceptance review.
- Maintain the Figma/FigJam UX loop (`Pulse UX Toolchain Loop`: https://www.figma.com/board/pk4iHWfci7iv9ot5y76j6Z?utm_source=codex&utm_content=edit_in_figjam&oai_id=&request_id=bdcae154-00da-4adb-8a63-e66bbdf25a32) for reusable component states and design-system decisions.
- Latest UX companion record: `docs/qa/2026-05-02-ux-companion-refresh.md`.
- Use Build Web Apps for PWA/mobile QA if the plugin becomes visible in Codex tools. Use Build iOS Apps only for a later native-wrapper evaluation; current scope remains local web/PWA over VPN.
- Ask Tobi to enable Push in Settings on each target browser/device; server VAPID is already present.

## Out Of Scope Unless Reversed

- Telegram integration.
- Habit tracker.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
