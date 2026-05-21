# 2026-05-21 - Current Route Evidence 048b10b

## Trigger

`main` now includes the latest Performance gate handoff support through PR
#663. Product work is still gated by manual Fueling and iPhone/PWA evidence, so
this pass refreshes the UI/UX route baseline before opening any new
implementation slice.

## Evidence

- Branch during capture: `main`
- Commit: `048b10b`
- Command: `npm run qa:ux-evidence`
- Summary command:
  `npm run qa:ux-summary -- test-results/route-evidence/2026-05-21-048b10b`
- Evidence root: `test-results/route-evidence/2026-05-21-048b10b/`

The evidence root is under `test-results/` and remains git-ignored.

## Route Evidence Summary

```text
# Route Evidence Summary

Root: /root/pulse/test-results/route-evidence/2026-05-21-048b10b
Manifests: 2

## desktop-chromium (2026-05-21 - 048b10b)
- base: https://127.0.0.1:5173
- screenshots: 9
- overflow: 0
- manifest: /root/pulse/test-results/route-evidence/2026-05-21-048b10b/desktop-chromium/manifest.json

## mobile-chromium (2026-05-21 - 048b10b)
- base: https://127.0.0.1:5173
- screenshots: 17
- overflow: 0
- manifest: /root/pulse/test-results/route-evidence/2026-05-21-048b10b/mobile-chromium/manifest.json

No horizontal overflow recorded. Review the screenshots manually before opening a UI/UX implementation slice.
```

## Reviewed Screenshots

- `mobile-chromium/01-home.png`: Home stays action-first; the daily decision,
  next-step card and bottom navigation fit without horizontal overflow.
- `mobile-chromium/15-data-fueling-action.png`: Data still leads with
  `Fueling-Evidenz schliessen`, visible readiness/context chips and a clear
  `GI-Komfort ergaenzen` action.
- `mobile-chromium/16-activity-fueling-anchor.png`: the Activity Fueling deep
  link lands on the missing GI-comfort action, keeps the no-inference copy
  readable and shows all three structured stomach-response options.
- `mobile-chromium/17-plan-mobile-intent-scenario.png`: Plan scenario preview
  keeps `Nur Vorschau`, no-hidden-write copy, apply/cancel controls and impact
  tiles readable.
- `mobile-chromium/09-settings.png`: Settings keeps the Push/PWA/Garmin
  readiness area and profile controls reachable without horizontal overflow.

## Current Gates

`npm run audit:performance-gates -- --today 2026-05-21 --json` still reports:

1. Fueling learning is the first unblock: `0/3` comparable complete logs, two
   existing Activity Fueling logs can count after real GI comfort, then one new
   complete long-session log is still needed.
2. Existing Fueling completion URLs:
   - `https://192.168.178.46:5175/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`
   - `https://192.168.178.46:5175/plan/activity/4f4b873d-bb64-4410-8e63-a382e9729863#activity-fueling-log`
3. iPhone/PWA field evidence is stale against `048b10b`; the latest recorded
   field run tested `9e05189`. Certificate trust, Push activation/test push,
   real iPhone offline fallback and device/iOS metadata remain open.
4. Server mirror is ready and verified against `048b10b`.

## Conclusion

No new route/UI implementation slice is justified from this pass. The next real
Performance-OS unlock remains manual evidence capture: add real GI comfort to
the two existing Fueling candidates through the Activity Fueling UI, capture one
new complete long-session log, then rerun the real iPhone/PWA checklist against
the current server commit.
