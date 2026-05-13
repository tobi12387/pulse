# 2026-05-13 Data Mobile Action Density

## Scope

- Branch: `codex/data-mobile-action-density`
- Route: `/data`
- Viewports: mobile Chromium focus, desktop regression coverage
- Goal: Keep the Data daily task contract complete while making the first mobile viewport less bulky.

## Finding

Fresh live route evidence on `66c5d5e` showed `/data` starts with the right job, but the primary `Daten-Aktion` card used too much vertical space on mobile. The CTA stayed visible, but the card read like a large explanation block instead of a compact daily action.

Before evidence:

- `/tmp/pulse-settings-push-density-live/2026-05-13-66c5d5e/mobile-chromium/03-data.png`

## What Changed

- The Data primary action card now has mobile-specific compact spacing.
- `Warum jetzt` and `Nach dem Klick` remain visible, but align as concise label/value rows on mobile.
- Evidence chips stay in the card.
- The primary CTA stretches full width on mobile for a clearer touch target.
- Desktop layout, Data tabs, secondary areas, Garmin/Data-quality links and Plan handoff behavior are unchanged.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium -g "Data starts with one daily action" --workers=1`
  - RED before implementation: failed because `data-primary-action` was 357px high against the `< 340px` mobile density contract.
  - GREEN after implementation: passed.
- `npx playwright test frontend/e2e/pulse-usability.spec.ts frontend/e2e/ux-data-mental.spec.ts frontend/e2e/ux-a11y-responsive.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Data starts with one daily action|Data overview exposes provenance|Data mobile subnavigation|Data mobile deep links|Heute relevant" --workers=1`
  - Passed: 4 passed.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-data-mobile-action-density-evidence npm run qa:ux-evidence`
  - Passed: desktop and mobile route packs captured.
- `npm run qa:ux-summary -- /tmp/pulse-data-mobile-action-density-evidence`
  - Passed: 9 desktop screenshots, 15 mobile screenshots, 0 overflow.
- `npm run build -w frontend`
  - Passed.
- `npm run test:e2e:smoke`
  - Passed: 48 passed, 8 skipped.
- `git diff --check`
  - Passed.

## Evidence Artifacts

- `/tmp/pulse-data-mobile-action-density-evidence/2026-05-13-79ac372/mobile-chromium/03-data.png`

Artifacts remain outside the repo and are not committed.
