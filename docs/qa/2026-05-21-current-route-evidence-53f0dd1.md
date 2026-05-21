# 2026-05-21 - Current Route Evidence 53f0dd1

## Scope

Fresh route evidence was regenerated on current `main` after the Performance
gate handoff learned to preserve the `--local-planning` rerun flag in packet
output.

- Commit: `53f0dd1`
- Evidence root: `/tmp/pulse-2026-05-21-current-route-evidence-53f0dd1/2026-05-21-53f0dd1/`
- Projects: `desktop-chromium`, `mobile-chromium`

The evidence was written outside the repository so this docs-only handoff would
not replace earlier local route artifacts.

## Commands

```bash
npm run audit:performance-gates -- --today 2026-05-21 --local-planning --packet
npm run audit:performance-next -- --today 2026-05-21 --target-urls --local-planning
npm run audit:fueling-gate -- --today 2026-05-21 --new-log-checklist
npm run audit:iphone-pwa-gate -- --expected-commit 53f0dd1 --packet
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-current-route-evidence-53f0dd1 npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-21-current-route-evidence-53f0dd1
```

The Performance gate packet used `--local-planning`, so server mirror
verification stayed deferred and did not count as the next open manual gate.
Rerun the normal packet from clean `main` before deploy-sensitive or current
field-evidence claims.

## Route Evidence Summary

```text
# Route Evidence Summary

Root: /tmp/pulse-2026-05-21-current-route-evidence-53f0dd1
Manifests: 2

## desktop-chromium (2026-05-21 - 53f0dd1)
- base: https://127.0.0.1:5173
- screenshots: 9
- overflow: 0
- manifest: /tmp/pulse-2026-05-21-current-route-evidence-53f0dd1/2026-05-21-53f0dd1/desktop-chromium/manifest.json

## mobile-chromium (2026-05-21 - 53f0dd1)
- base: https://127.0.0.1:5173
- screenshots: 17
- overflow: 0
- manifest: /tmp/pulse-2026-05-21-current-route-evidence-53f0dd1/2026-05-21-53f0dd1/mobile-chromium/manifest.json

No horizontal overflow recorded. Review the screenshots manually before opening a UI/UX implementation slice.
```

## Manual Screenshot Review

Reviewed the current-gate and daily-flow screenshots:

- `mobile-chromium/01-home.png`: Home remains action-first; the daily decision,
  next step card and bottom navigation fit without horizontal overflow.
- `mobile-chromium/14-data-mental-first-viewport.png`: the mental quick check
  keeps the state choices, `Heute speichern` action and optional details visible
  in the captured mobile flow.
- `mobile-chromium/15-data-fueling-action.png`: Data still leads with
  `Fueling-Evidenz schliessen`, a visible `GI-Komfort ergaenzen` CTA and
  `Trend-Evidenz 0/3`.
- `mobile-chromium/16-activity-fueling-anchor.png`: the Activity Fueling deep
  link focuses the missing GI-comfort action group, shows all three structured
  stomach-response options and keeps the no-inference copy readable.
- `mobile-chromium/17-plan-mobile-intent-scenario.png`: Plan scenario preview
  keeps `Nur Vorschau`, no-hidden-write copy and apply/cancel controls readable.
- `desktop-chromium/03-data.png` and `desktop-chromium/06-plan.png`: desktop
  Data and Plan remain readable, with no new layout or overflow regression.

## Gate State

The current Performance-OS gate audit still promotes Fueling first:

1. Fueling learning: `0/3` comparable complete logs; two existing Activity
   Fueling logs need real GI comfort, then one new complete long-session log is
   still needed.
2. Existing Fueling completion targets:
   - `https://192.168.178.46:5175/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`
   - `https://192.168.178.46:5175/plan/activity/4f4b873d-bb64-4410-8e63-a382e9729863#activity-fueling-log`
3. The focused future-log checklist remains:
   `npm run audit:fueling-gate -- --today 2026-05-21 --new-log-checklist`.
4. iPhone/PWA field evidence is stale against `53f0dd1`; the old field record
   tested `9e05189`. Certificate trust, Push activation/test push, real iPhone
   offline fallback and device/iOS metadata remain open.

## Conclusion

No new route/UI implementation slice is justified from this pass. The next real
unlock remains manual evidence capture: close the two existing Fueling GI
comfort candidates through the Activity Fueling UI, then capture one new
complete long session; rerun the real iPhone/PWA checklist against the current
server commit.
