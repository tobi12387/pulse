# 2026-05-21 — Current Main Route Evidence 20caf40

## Trigger

PR #553 merged the Home learning-language fix into `main`. This pass refreshes the
full route-evidence baseline after that merge so the compact AI context no longer
points future UI work at the older pre-language-fix snapshot.

## Evidence

- Branch: `codex/post-home-language-route-evidence`
- Commit: `20caf40`
- Command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-main-20caf40-route-evidence npm run qa:ux-evidence`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-2026-05-21-main-20caf40-route-evidence`
- Evidence root: `/tmp/pulse-2026-05-21-main-20caf40-route-evidence/2026-05-21-20caf40/`

## Result

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Route pack passed for Home, Coach compatibility route, Data, Plan, Activity Detail, Insights and Settings.
- Mobile Daily Command scenarios passed for planned workout, free trainable day, completed Garmin activity, recovery-protect day, Data Mental first viewport, Data Fueling action, Activity Fueling anchor and Plan mobile scenario preview.

## Reviewed Screenshots

- Home first decision: `/tmp/pulse-2026-05-21-main-20caf40-route-evidence/2026-05-21-20caf40/mobile-chromium/01-home.png`
- Data Fueling primary action: `/tmp/pulse-2026-05-21-main-20caf40-route-evidence/2026-05-21-20caf40/mobile-chromium/15-data-fueling-action.png`
- Activity Fueling anchor: `/tmp/pulse-2026-05-21-main-20caf40-route-evidence/2026-05-21-20caf40/mobile-chromium/16-activity-fueling-anchor.png`
- Plan mobile intent scenario: `/tmp/pulse-2026-05-21-main-20caf40-route-evidence/2026-05-21-20caf40/mobile-chromium/17-plan-mobile-intent-scenario.png`
- Settings first viewport: `/tmp/pulse-2026-05-21-main-20caf40-route-evidence/2026-05-21-20caf40/mobile-chromium/09-settings.png`

## Findings

- Home uses `Lernschleife` and `Muster pruefen` in the primary daily contract and no longer exposes `Kalibrierung` or `Watch-Kontext` in the primary card.
- Data keeps the next Fueling action focused on `GI-Komfort ergaenzen`.
- Activity Detail opens the Fueling closure area with the GI-comfort choices visible in the mobile viewport.
- Plan mobile scenario preview keeps `Nur Vorschau`, the no-hidden-write framing and the conscious apply/cancel controls visible.
- Settings shows no new first-viewport blocker in the current route pack.
- No horizontal overflow or concrete route friction was found in this current-main pass.

## Product Conclusion

Do not open a new UI/UX implementation slice from this evidence alone. The
autonomous Performance-OS backlog remains gated until comparable complete
nutrition logs, real iPhone/PWA evidence, a new route/user friction point or
Tobi's explicit direction creates a stronger product signal.
