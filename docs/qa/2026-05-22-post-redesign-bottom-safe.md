# Post-Redesign Bottom-Safe Route Evidence - 2026-05-22

Branch: `codex/post-redesign-current-route-evidence`
Track: UI/UX evidence support

## Trigger

After the route-wide UI/UX redesign and control/readiness surface work, a fresh
route-evidence pass on current `main` was needed before claiming the mobile
surfaces were still calm and usable.

## Before Evidence

Command:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-22-post-redesign-current-main npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-22-post-redesign-current-main
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.

Manual review found one concrete mobile friction in
`mobile-chromium/16-activity-fueling-anchor.png`: the Activity Fueling anchor
already showed the large GI comfort options, but the Fueling baseline repeated a
secondary `GI-Komfort ergaenzen` button lower in the same flow. In the full-page
mobile evidence screenshot that duplicate control sat at the bottom navigation
edge, adding clutter and a possible touch conflict.

## Change

- Increased the mobile page shell bottom safe area so route content has more
  breathing room above the fixed bottom navigation.
- Hid the Fueling baseline's primary next-action button in Activity Detail when
  the page already renders the focused GI comfort action for the current log.
- Kept the Fueling baseline explanation, readiness chips, gaps and next evidence
  text visible.
- Added a route-evidence assertion that the final primary GI option stays above
  the fixed mobile bottom navigation and that Activity Detail no longer renders
  the duplicate baseline `GI-Komfort ergaenzen` button in this anchored state.

## After Evidence

Focused mobile proof:

```bash
PULSE_ROUTE_EVIDENCE=true PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-22-post-redesign-bottom-safe npx playwright test frontend/e2e/route-evidence.spec.ts --project=mobile-chromium
```

Full route proof:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-22-post-redesign-bottom-safe-final npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-22-post-redesign-bottom-safe-final
```

Result:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Final mobile Activity Fueling evidence:
  `/tmp/pulse-2026-05-22-post-redesign-bottom-safe-final/2026-05-22-242f824/mobile-chromium/16-activity-fueling-anchor.png`

## Conclusion

The post-redesign route set remains overflow-free. The only concrete friction
found in this pass was a duplicate Fueling action near the mobile bottom nav; it
is removed from the anchored Activity Detail state while the focused GI comfort
options remain visible, touchable and explicit.
