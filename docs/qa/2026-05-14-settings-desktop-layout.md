# QA — Settings Desktop Layout

## Scope

Settings now uses the wider desktop shell and a desktop-only two-column layout so status/diagnostics and the athlete profile can be scanned together. The mobile/PWA layout remains stacked.

## TDD

- Red:
  - `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Settings uses desktop width" --project=desktop-chromium`
  - Expected failure before implementation: the profile section started at `y=427.75`, below the diagnostics card, instead of in the same desktop band.
- Green:
  - `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Settings uses desktop width|Settings diagnostics matrix is visible first|Settings groups actions by risk" --project=desktop-chromium --project=mobile-chromium`
  - Result: 6 passed.

## Verification

- `npm run build` — passed.
- Local route evidence:
  - `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-settings-desktop-layout-final npm run qa:ux-evidence` — passed, 2/2.
  - `npm run qa:ux-summary -- /tmp/pulse-settings-desktop-layout-final` — 2 manifests, 24 screenshots, 0 horizontal overflow.
  - Manual screenshot check: desktop Settings shows status/diagnostics and profile side by side; mobile Settings remains one column.

## Notes

- `/settings` now uses the same wider `pulse-page-shell` treatment as daily operational routes.
- Existing section IDs and query-param deep links stay intact because only parent layout wrappers changed.
