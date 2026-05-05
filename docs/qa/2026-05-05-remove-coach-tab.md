# Remove Coach Tab QA

## Scope

This PR removes Coach from the desktop sidebar and mobile bottom navigation, remaps numeric top-level hotkeys to the four-tab model, and keeps `/coach` as a compatibility route for existing deep links, push actions and route-specific entry points.

## Evidence

- Route evidence command: `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/remove-coach-tab npm run qa:ux-evidence`
- Initial Playwright sandbox result: failed because Vite could not bind to `127.0.0.1:5173`.
- Rerun outside the sandbox: passed.
- Path: `test-results/route-evidence/remove-coach-tab/2026-05-05-6eb99d8/`
- Viewports:
  - Desktop Chromium: `1280x720`
  - Mobile Chromium: `412x839`
- Manifest result: no horizontal overflow on `/`, `/coach`, `/data`, `/data?tab=mental`, `/data?tab=analysen`, `/plan`, or `/settings`.

## Verification

- `git diff --check`: passed.
- `npm run build -w frontend`: passed.
- `npm run test:e2e -- --project=desktop-chromium --grep "top-level hotkeys|primary navigation reaches|primary navigation exposes"`: passed, `3 passed`.
- `npm run test:e2e -- --project=mobile-chromium --grep "primary navigation reaches|primary navigation exposes|Coach renders"`: passed, `3 passed`.
- `npm run test:e2e -- --project=desktop-chromium --project=mobile-chromium --grep "renders without runtime errors|primary navigation|top-level hotkeys|/insights redirects"`: passed, `17 passed`, `1 skipped`.
- `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/remove-coach-tab npm run qa:ux-evidence`: passed, `2 passed`.

## Route Notes

- Primary navigation now exposes only Home, Data, Plan and Settings.
- Desktop hotkeys now map `1` Home, `2` Data, `3` Plan and `4` Settings.
- `/coach` still renders without runtime errors on desktop and mobile.
- `/insights` still redirects to `/data?tab=analysen`.
- Mobile bottom nav has four labels and no horizontal overflow in route evidence.
