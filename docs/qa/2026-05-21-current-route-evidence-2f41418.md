# 2026-05-21 - Current Route Evidence 2f41418

## Trigger

`main` now includes the latest Performance gate/iPhone command tooling from
PR #632. This pass refreshes the route-evidence baseline on the current
server-verified commit before opening any new UI/UX or product slice.

## Evidence

- Branch: `codex/current-route-evidence`
- Commit: `2f41418`
- Command: `npm run qa:ux-evidence`
- Summary command:
  `npm run qa:ux-summary -- test-results/route-evidence/2026-05-21-2f41418`
- Evidence root:
  `test-results/route-evidence/2026-05-21-2f41418/`

## Result

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Route pack passed for Home, Coach compatibility route, Data, Plan, Activity
  Detail, Insights and Settings.
- Mobile Daily Command scenarios passed for planned workout, free trainable
  day, completed Garmin activity, recovery-protect day, Data Mental first
  viewport, Data Fueling action, Activity Fueling anchor and Plan mobile
  scenario preview.

## Reviewed Screenshots

- Mobile Home planned command:
  `test-results/route-evidence/2026-05-21-2f41418/mobile-chromium/10-home-planned-command.png`
- Mobile Data Fueling action:
  `test-results/route-evidence/2026-05-21-2f41418/mobile-chromium/15-data-fueling-action.png`
- Mobile Activity Fueling anchor:
  `test-results/route-evidence/2026-05-21-2f41418/mobile-chromium/16-activity-fueling-anchor.png`
- Mobile Plan scenario preview:
  `test-results/route-evidence/2026-05-21-2f41418/mobile-chromium/17-plan-mobile-intent-scenario.png`
- Mobile Data Mental first viewport:
  `test-results/route-evidence/2026-05-21-2f41418/mobile-chromium/14-data-mental-first-viewport.png`
- Mobile Plan first viewport:
  `test-results/route-evidence/2026-05-21-2f41418/mobile-chromium/06-plan.png`
- Mobile Settings first viewport:
  `test-results/route-evidence/2026-05-21-2f41418/mobile-chromium/09-settings.png`
- Desktop Home first viewport:
  `test-results/route-evidence/2026-05-21-2f41418/desktop-chromium/01-home.png`

## Findings

- Home remains action-first on mobile and keeps the daily decision readable
  without horizontal overflow.
- Data keeps the primary Fueling action visible and focused on closing
  `GI-Komfort`.
- Activity Detail opens directly on the Fueling closure area with the
  GI-comfort action group visible in the mobile viewport.
- Plan mobile scenario preview keeps preview-first framing, no-hidden-write
  copy and conscious apply/cancel controls visible.
- Settings keeps Push/PWA/Garmin diagnostics reachable in the first mobile
  viewport.
- No concrete route friction or overflow was found that justifies a new UI/UX
  implementation slice from this evidence alone.

## Current Gates

- Combined Performance gate remains `gated` with 2 open gates at `2f41418`.
- First unblock remains Fueling learning: 0/3 comparable complete logs, 2
  existing long carb logs completable with real subjective GI comfort, then 1
  new complete long-session log still needed.
- iPhone/PWA field evidence remains gated until the real iPhone checklist is
  rerun against expected commit `2f41418`.
- Server mirror is ready and verified against `2f41418`.

## Product Conclusion

Do not open a new UI/UX implementation slice from this route pass. The next
Performance-OS movement remains manual Fueling GI comfort capture, followed by
current-commit iPhone/PWA field evidence, fresh user-reported friction or
Tobi's explicit reprioritization.
