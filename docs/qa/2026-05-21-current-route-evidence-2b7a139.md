# 2026-05-21 - Current Route Evidence 2b7a139

## Scope

Fresh route evidence was regenerated on current `main` after the Fueling
candidate URL support landed.

- Commit: `2b7a139`
- Evidence root: `test-results/route-evidence/2026-05-21-2b7a139/`
- Projects: `desktop-chromium`, `mobile-chromium`

## Commands

```bash
npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence
npm run audit:performance-gates -- --today 2026-05-21 --packet
```

## Route Evidence Summary

```text
# Route Evidence Summary

Root: /root/pulse/test-results/route-evidence
Manifests: 2

## desktop-chromium (2026-05-21 - 2b7a139)
- base: https://127.0.0.1:5173
- screenshots: 9
- overflow: 0
- manifest: /root/pulse/test-results/route-evidence/2026-05-21-2b7a139/desktop-chromium/manifest.json

## mobile-chromium (2026-05-21 - 2b7a139)
- base: https://127.0.0.1:5173
- screenshots: 17
- overflow: 0
- manifest: /root/pulse/test-results/route-evidence/2026-05-21-2b7a139/mobile-chromium/manifest.json

No horizontal overflow recorded. Review the screenshots manually before opening a UI/UX implementation slice.
```

## Manual Screenshot Review

Reviewed the key current-gate and daily-flow screenshots:

- `mobile-chromium/01-home.png`: Home command remains readable; no stage-strip clipping or horizontal overflow.
- `mobile-chromium/14-data-mental-first-viewport.png`: mental quick check keeps `Heute speichern` in the captured flow and remains readable on mobile.
- `mobile-chromium/15-data-fueling-action.png`: Data still leads with the Fueling evidence action and shows `Trend-Evidenz 0/3`.
- `mobile-chromium/16-activity-fueling-anchor.png`: Activity Fueling deep link focuses the GI comfort action group and keeps the no-inference copy visible.
- `mobile-chromium/17-plan-mobile-intent-scenario.png`: Plan scenario preview keeps `Nur Vorschau`, no-hidden-write copy and controls readable.

## Gate State

The current Performance-OS gate audit still reports 2 open gates:

1. Fueling learning: `0/3` comparable complete logs; two existing Activity
   Fueling logs need real GI comfort, then one new complete long-session log is
   still needed.
2. iPhone/PWA field: the real-device evidence is stale against `2b7a139` and
   still needs certificate, Push, offline fallback, device and iOS metadata.

## Conclusion

No new route/UI implementation slice is justified from this pass. The next real
unlock remains manual evidence capture: close the two existing Fueling GI comfort
candidates through the Activity Fueling UI, then capture one new complete long
session; rerun the real iPhone/PWA checklist against the current server commit.
