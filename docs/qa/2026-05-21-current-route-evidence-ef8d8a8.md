# 2026-05-21 - Current Route Evidence ef8d8a8

## Trigger

`main` now includes the latest Performance-gate packet support changes through
PR #612. Because the autonomous product backlog is still gated by manual
Fueling, iPhone/PWA and server evidence, this pass refreshes rendered route
evidence before proposing any new UI/UX implementation slice.

## Evidence

- Branch: `codex/current-route-evidence`
- Commit: `ef8d8a8`
- Command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-route-evidence-ef8d8a8 npm run qa:ux-evidence`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-2026-05-21-route-evidence-ef8d8a8`
- Evidence root: `/tmp/pulse-2026-05-21-route-evidence-ef8d8a8/2026-05-21-ef8d8a8/`

## Result

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Route pack passed for Home, Coach compatibility route, Data, Plan, Activity Detail, Insights and Settings.
- Mobile Daily Command scenarios passed for planned workout, free trainable day, completed Garmin activity, recovery-protect day, Data Mental first viewport, Data Fueling action, Activity Fueling anchor and Plan mobile scenario preview.

## Evidence Files

- Mobile Home first decision: `/tmp/pulse-2026-05-21-route-evidence-ef8d8a8/2026-05-21-ef8d8a8/mobile-chromium/01-home.png`
- Mobile Data Fueling primary action: `/tmp/pulse-2026-05-21-route-evidence-ef8d8a8/2026-05-21-ef8d8a8/mobile-chromium/15-data-fueling-action.png`
- Mobile Activity Fueling anchor: `/tmp/pulse-2026-05-21-route-evidence-ef8d8a8/2026-05-21-ef8d8a8/mobile-chromium/16-activity-fueling-anchor.png`
- Mobile Plan scenario preview: `/tmp/pulse-2026-05-21-route-evidence-ef8d8a8/2026-05-21-ef8d8a8/mobile-chromium/17-plan-mobile-intent-scenario.png`
- Desktop Data first viewport: `/tmp/pulse-2026-05-21-route-evidence-ef8d8a8/2026-05-21-ef8d8a8/desktop-chromium/03-data.png`
- Desktop Plan first viewport: `/tmp/pulse-2026-05-21-route-evidence-ef8d8a8/2026-05-21-ef8d8a8/desktop-chromium/06-plan.png`

## Findings

- No horizontal overflow was recorded in the current desktop or mobile route pack.
- The rendered mobile evidence paths for Data Fueling and Activity Fueling are still present after the gate-packet tooling changes.
- The route-evidence assertions still prove the Activity Fueling anchor focuses the GI-comfort action and keeps the `Magen ok` choice in the mobile viewport.
- The Plan mobile scenario preview still renders the preview-only path with no hidden Garmin/Plan write implied by the route pack.
- No concrete UI/UX regression or daily-flow friction was proven by this current-main pass.

## Current Gates

- Fueling learning remains the first product unblock: the two existing long carb logs need explicit GI comfort, then one new complete long-session log is still needed.
- iPhone/PWA remains open for real-device field evidence against the expected commit.
- Server mirror verification remains blocked by SSH preflight/auth.

## Product Conclusion

Do not open a new UI/UX implementation slice from this evidence alone. The
autonomous Performance-OS backlog remains gated until real Fueling evidence,
real iPhone/PWA field proof, restored server verification, a fresh user-reported
friction point or Tobi's explicit direction creates a stronger product signal.
