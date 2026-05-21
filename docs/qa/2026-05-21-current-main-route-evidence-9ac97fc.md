# 2026-05-21 - Current Main Route Evidence 9ac97fc

## Trigger

`main` now includes the iPhone field-packet server verify clarification from
PR #595. This pass refreshes the full route-evidence baseline on that current
`main` commit before opening another Performance-OS product slice.

## Evidence

- Branch: `codex/current-main-route-evidence-9ac97fc`
- Commit: `9ac97fc`
- Command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-route-evidence-9ac97fc npm run qa:ux-evidence`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-route-evidence-9ac97fc`
- Evidence root: `/tmp/pulse-route-evidence-9ac97fc/2026-05-21-9ac97fc/`

## Result

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Route pack passed for Home, Coach compatibility route, Data, Plan, Activity Detail, Insights and Settings.
- Mobile Daily Command scenarios passed for planned workout, free trainable day, completed Garmin activity, recovery-protect day, Data Mental first viewport, Data Fueling action, Activity Fueling anchor and Plan mobile scenario preview.

## Reviewed Screenshots

- Home first decision: `/tmp/pulse-route-evidence-9ac97fc/2026-05-21-9ac97fc/mobile-chromium/01-home.png`
- Data Fueling primary action: `/tmp/pulse-route-evidence-9ac97fc/2026-05-21-9ac97fc/mobile-chromium/15-data-fueling-action.png`
- Activity Fueling anchor: `/tmp/pulse-route-evidence-9ac97fc/2026-05-21-9ac97fc/mobile-chromium/16-activity-fueling-anchor.png`
- Plan mobile intent scenario: `/tmp/pulse-route-evidence-9ac97fc/2026-05-21-9ac97fc/mobile-chromium/17-plan-mobile-intent-scenario.png`
- Desktop Data first viewport: `/tmp/pulse-route-evidence-9ac97fc/2026-05-21-9ac97fc/desktop-chromium/03-data.png`
- Desktop Plan first viewport: `/tmp/pulse-route-evidence-9ac97fc/2026-05-21-9ac97fc/desktop-chromium/06-plan.png`

## Findings

- Home remains action-first on mobile and keeps the current daily decision readable without horizontal overflow.
- Data keeps the primary Fueling action visible and focused on closing `GI-Komfort`.
- Activity Detail opens the Fueling closure area with GI-comfort choices visible in the mobile viewport.
- Plan mobile scenario preview keeps `Nur Vorschau`, no-hidden-write framing and conscious apply/cancel controls visible.
- Desktop Data and Plan first viewports remain scannable after the iPhone field-packet docs/tooling merge.
- No horizontal overflow or concrete route friction was found in this current-main pass.

## Current Gates

- Fueling learning remains the next product unblock: two existing comparable logs can be completed with subjective GI comfort, and one new complete long-session log is still needed after those candidates.
- iPhone/PWA remains open for real-device field evidence.
- Server mirror verification remains blocked by SSH preflight; PR #594 is still the review-held server recovery packet.

## Product Conclusion

Do not open a new UI/UX implementation slice from this evidence alone. The
autonomous Performance-OS backlog remains gated until real Fueling evidence,
real iPhone/PWA field proof, restored server verification or Tobi's explicit
direction creates a stronger product signal.
