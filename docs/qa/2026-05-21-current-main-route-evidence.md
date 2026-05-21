# 2026-05-21 — Current Main Route Evidence

## Evidence

- Branch: `codex/current-route-evidence-refresh`
- Commit: `7a09cd2`
- Command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-current-route-evidence npm run qa:ux-evidence`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-2026-05-21-current-route-evidence`
- Evidence root: `/tmp/pulse-2026-05-21-current-route-evidence/2026-05-21-7a09cd2/`

## Result

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Route pack passed for Home, Coach compatibility route, Data, Plan, Activity Detail, Insights and Settings.
- Mobile Daily Command scenarios passed for planned workout, free trainable day, completed Garmin activity, recovery-protect day, Data Mental first viewport, Data Fueling action, Activity Fueling anchor and Plan mobile scenario preview.

## Reviewed Screenshots

- Data Fueling primary action: `/tmp/pulse-2026-05-21-current-route-evidence/2026-05-21-7a09cd2/mobile-chromium/15-data-fueling-action.png`
- Activity Fueling anchor: `/tmp/pulse-2026-05-21-current-route-evidence/2026-05-21-7a09cd2/mobile-chromium/16-activity-fueling-anchor.png`
- Plan mobile intent scenario: `/tmp/pulse-2026-05-21-current-route-evidence/2026-05-21-7a09cd2/mobile-chromium/17-plan-mobile-intent-scenario.png`
- Mobile manifest: `/tmp/pulse-2026-05-21-current-route-evidence/2026-05-21-7a09cd2/mobile-chromium/manifest.json`

## Findings

- The Data Fueling action stays first-viewport clear on mobile and keeps the next action on `GI-Komfort ergänzen`.
- The Activity Fueling deep link focuses the closure card, shows `GI-Komfort fehlt`, and keeps sodium, heat and sweat-rate as measured-only evidence gaps.
- The mobile Plan scenario preview keeps the `Nur Vorschau` language and no-hidden-write framing visible.
- No horizontal overflow or concrete route friction was found in this current-main pass.

## Product Conclusion

Do not open a new UI/UX implementation slice from this evidence alone. The autonomous Performance-OS backlog remains gated until comparable complete nutrition logs, real iPhone/PWA evidence, a new route/user friction point or Tobi's explicit direction creates a stronger product signal.
