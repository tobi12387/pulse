# Current Main Route Evidence - 2026-06-03

## Scope

- Purpose: refresh route-wide UI/UX evidence after the deployed Performance-OS redesign and the subsequent docs/tooling-only handoff PRs.
- Source commit: `749b9a3`.
- Runtime note: server mirror was verified on `749b9a3`; the app-runtime comparison target for iPhone/PWA field evidence remains the observed Settings `App-Stand`, currently expected to compare against `717d571` unless Settings shows otherwise.
- Evidence root: `/root/pulse/test-results/route-evidence/2026-06-03-main-749b9a3/2026-06-03-749b9a3/`.

## Commands

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/2026-06-03-main-749b9a3 npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-06-03-main-749b9a3
PULSE_EXPECTED_COMMIT="$(git rev-parse --short HEAD)" npm run verify:server
npm run audit:performance-session -- --today 2026-06-03 --all
```

## Result

- `npm run qa:ux-evidence`: passed, 2/2 projects.
- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Server verification: `749b9a3`, clean `main`, PM2 `pulse` and `pulse-frontend` online, public frontend `200`, API ping `ok`, Pulse health `ok`.
- Performance gate state: still gated by manual Fueling learning first, then iPhone/PWA real-device field evidence.

## Manifests

- Desktop manifest: `/root/pulse/test-results/route-evidence/2026-06-03-main-749b9a3/2026-06-03-749b9a3/desktop-chromium/manifest.json`
- Mobile manifest: `/root/pulse/test-results/route-evidence/2026-06-03-main-749b9a3/2026-06-03-749b9a3/mobile-chromium/manifest.json`

## Conclusion

The current main UI evidence does not open a new autonomous UI/UX implementation slice: the route pack reports no horizontal overflow, and no new concrete route friction was observed by the automated evidence. The next product unblock remains manual evidence capture:

- Fueling GI comfort for the first existing long carb log.
- Real iPhone/PWA field evidence against server commit `749b9a3`, using the observed Settings `App-Stand` as the runtime evidence value.
