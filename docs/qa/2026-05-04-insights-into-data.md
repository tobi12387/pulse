# Insights Into Data QA

## Scope

This PR moves Insights into Data as the `Analysen` tab, removes Insights from primary navigation, keeps `/insights` as a redirect to `/data?tab=analysen`, and points stale analysis evidence back to the new Data surface.

## Evidence

- Route evidence command: `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/insights-into-data npm run qa:ux-evidence`
- Initial sandbox result: failed because Vite could not bind to `127.0.0.1:5173`.
- Rerun outside the sandbox: passed.
- Path: `test-results/route-evidence/insights-into-data/2026-05-04-fc0e6a9/`
- Viewports:
  - Desktop Chromium: `1280x720`
  - Mobile Chromium: `412x839`
- Manifest result: no horizontal overflow on `/`, `/coach`, `/data`, `/data?tab=analysen`, `/plan`, or `/settings`.

## Verification

- `npm run build -w frontend`: passed.
- `npm run build -w backend`: passed.
- `npm run test -w backend -- insight-engine.test.ts`: passed, `7 passed`.
- `npm run test:e2e -- --project=desktop-chromium --grep "primary navigation|/insights redirects"`: passed, `3 passed`.
- `npm run test:e2e -- --project=desktop-chromium --project=mobile-chromium --grep "Data analyses classify missing data|primary navigation|/insights redirects"`: passed, `8 passed`.
- `npm run test:e2e`: passed after rerun outside the sandbox because Vite could not bind locally in the sandbox, `113 passed`, `7 skipped`.
- `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/insights-into-data npm run qa:ux-evidence`: passed after rerun outside the sandbox, `2 passed`.

## Route Notes

- `/data?tab=analysen`: renders the migrated analysis surface and lazy-loads analysis only after a card opens.
- `/insights`: redirects to `/data?tab=analysen`.
- Mobile bottom nav: no longer shows Insights; Settings remains visible and readable.
- Home KI-Analyse CTA: opens Data Analysen directly.
- Backend insight evidence: Mental/TSB overlay now targets `/data?tab=analysen` with `Analysen öffnen` instead of stale `/insights` copy.
