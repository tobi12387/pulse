# 2026-05-11 Data Backfill Touch Polish

## Scope

- Branch: `codex/data-backfill-touch-polish`
- Route: `/data?tab=coverage`
- Area: Garmin Backfill controls in Data > Datenqualität.

## What Changed

- Added mobile touch-target regression coverage for `Vorschau` and `Nachladen`.
- Set both Backfill action buttons to at least `44x44px`.
- No API contract, Garmin write boundary, copy, payload or mutation behavior changed.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium -g "Mobile repeated controls"`
  - RED before implementation: `Vorschau` was 35px tall.
  - GREEN after implementation: passed.
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Data coverage explains status|Data backfill shows preview|Data Garmin backfill failure"`
  - Passed: 6/6.
- `npm run lint -w frontend`
  - Passed.
- `npm run build -w frontend`
  - Passed.
