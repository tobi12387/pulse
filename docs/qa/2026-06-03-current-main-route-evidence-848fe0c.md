# Current Main Route Evidence - 2026-06-03

## Scope

- Purpose: refresh route-wide UI/UX evidence after the Today Options availability bridge shipped and deployed.
- Source commit: `848fe0c`.
- Runtime note: server mirror was verified on `848fe0c` during this route-evidence pass. Later docs-only commits can move the mirror without changing the deployed app bundle, so iPhone/PWA field runs must rerun `npm run audit:performance-session -- --today 2026-06-03 --all` and use its printed server commit under test. The app-runtime value remains the observed Settings `App-Stand`, not a copied expected value.
- Evidence root: `/tmp/pulse-codex-route-evidence-848fe0c/test-results/route-evidence/2026-06-03-main-848fe0c/2026-06-03-848fe0c/`.

## Commands

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/2026-06-03-main-848fe0c npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-06-03-main-848fe0c
PULSE_EXPECTED_COMMIT=848fe0c npm run verify:server
npm run audit:performance-session -- --today 2026-06-03 --all
```

## Result

- `npm run qa:ux-evidence`: passed, 2/2 projects.
- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Server verification: `848fe0c`, clean `main`, PM2 `pulse` and `pulse-frontend` online, public frontend `200`, API ping `ok`, Pulse health `ok`.
- Performance gate state: still gated by manual Fueling learning first, then iPhone/PWA real-device field evidence.

## Manual Screenshot Review

- Mobile Home first viewport: focus card, readiness grid and bottom nav remain stable without overflow.
- Mobile Activity Fueling anchor: GI comfort closure is focused, the three structured choices are visible, and the manual rule says not to infer GI comfort from notes, route, RPE, g/h, result or pace.
- Mobile Settings first viewport: iPhone field evidence and Push handoffs are visible before the profile rows.
- Desktop Plan: weekly decision and preview controls remain readable with no horizontal crowding.

## Manifests

- Desktop manifest: `/tmp/pulse-codex-route-evidence-848fe0c/test-results/route-evidence/2026-06-03-main-848fe0c/2026-06-03-848fe0c/desktop-chromium/manifest.json`
- Mobile manifest: `/tmp/pulse-codex-route-evidence-848fe0c/test-results/route-evidence/2026-06-03-main-848fe0c/2026-06-03-848fe0c/mobile-chromium/manifest.json`

## Conclusion

The current main UI evidence does not open a new autonomous UI/UX implementation slice after the availability bridge. The automated route pack records no horizontal overflow, and the reviewed daily gate surfaces remain actionable. The next product unblock remains manual evidence capture:

- Fueling GI comfort for the first existing carb log, then the second existing candidate, followed by one new complete long-session log.
- Real iPhone/PWA field evidence against the live audit's printed server commit, using the observed Settings `App-Stand` as the runtime evidence value.
