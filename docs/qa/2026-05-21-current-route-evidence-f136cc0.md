# 2026-05-21 - Current Route Evidence f136cc0

## Scope

Fresh route evidence was regenerated on current `main` after the combined
Performance gate handoff learned to print the focused Fueling new-log
checklist command.

- Commit: `f136cc0`
- Evidence root: `test-results/route-evidence/2026-05-21-f136cc0/`
- Projects: `desktop-chromium`, `mobile-chromium`

## Commands

```bash
npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence
npm run audit:performance-gates -- --today 2026-05-21 --packet
```

The Performance gate packet was run from the evidence branch, so its server
subcheck reported the local branch as non-`main`. Re-verify the server mirror
from local `main` after this evidence note merges when server readiness matters.

## Route Evidence Summary

```text
# Route Evidence Summary

Root: /root/pulse/test-results/route-evidence
Manifests: 2

## desktop-chromium (2026-05-21 - f136cc0)
- base: https://127.0.0.1:5173
- screenshots: 9
- overflow: 0
- manifest: /root/pulse/test-results/route-evidence/2026-05-21-f136cc0/desktop-chromium/manifest.json

## mobile-chromium (2026-05-21 - f136cc0)
- base: https://127.0.0.1:5173
- screenshots: 17
- overflow: 0
- manifest: /root/pulse/test-results/route-evidence/2026-05-21-f136cc0/mobile-chromium/manifest.json

No horizontal overflow recorded. Review the screenshots manually before opening a UI/UX implementation slice.
```

## Manual Screenshot Review

Reviewed the key current-gate and daily-flow screenshots:

- `mobile-chromium/10-home-planned-command.png`: Home remains action-first; primary CTA buttons fit and the daily decision stays readable.
- `mobile-chromium/14-data-mental-first-viewport.png`: mental quick check keeps `Heute speichern` in the captured mobile flow.
- `mobile-chromium/15-data-fueling-action.png`: Data still leads with `Fueling-Evidenz schließen`, a visible `GI-Komfort ergänzen` CTA and `Trend-Evidenz 0/3`.
- `mobile-chromium/16-activity-fueling-anchor.png`: Activity Fueling deep link focuses the GI comfort action group, shows all three structured stomach-response options and keeps the no-inference copy visible.
- `mobile-chromium/17-plan-mobile-intent-scenario.png`: Plan scenario preview keeps `Nur Vorschau`, no-hidden-write copy and apply/cancel controls readable.

## Gate State

The current Performance-OS gate audit still promotes Fueling first:

1. Fueling learning: `0/3` comparable complete logs; two existing Activity
   Fueling logs need real GI comfort, then one new complete long-session log is
   still needed. The combined packet now also prints
   `npm run audit:fueling-gate -- --today 2026-05-21 --new-log-checklist`.
2. iPhone/PWA field: real-device evidence is stale against `f136cc0` and still
   needs certificate trust, Push activation/test push, real iPhone offline
   fallback, device and iOS metadata.

## Conclusion

No new route/UI implementation slice is justified from this pass. The next real
unlock remains manual evidence capture: close the two existing Fueling GI
comfort candidates through the Activity Fueling UI, then capture one new
complete long session; rerun the real iPhone/PWA checklist against the current
server commit.
