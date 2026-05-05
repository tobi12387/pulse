# Mobile Touch Target QA

## Scope

First PR-sized slice of `2026-05-05-mobile-a11y-controls-polish.md`: 44px mobile hit areas for daily-use controls. This does not implement segmented-control tab semantics or Mental radio arrow-key behavior; those remain open in the same plan.

## Evidence

- Red test: `npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium --grep "Mobile repeated controls have reliable touch targets"` failed after the stricter width/height >= 44px assertion exposed existing under-sized controls (`Vorherige Woche`, `Sportart ändern`, `Verlauf löschen`, Settings `Bearbeiten`, `Abdeckung`, `ERLEDIGT`, `Push aktivieren`).
- Review follow-up: a read-only subagent review then identified remaining under-44px Data overview CTAs and Mental fine-tune radios, so those controls and their regression assertions were added before merge.
- Green focused test: the same command passed after raising the covered controls to at least 44px, including Data overview CTAs and Mental fine-tune radios.
- Responsive focused tests: `npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts frontend/e2e/ux-a11y-responsive.spec.ts --project=mobile-chromium --grep "Mobile repeated controls have reliable touch targets|Mobile navigation and tabs keep core labels readable|Mobile routes avoid unintended horizontal overflow|mobile Data tabs stay compact"` passed with 4 tests.
- Full E2E regression: `npm run test:e2e` passed with 170 tests and 12 expected skips after updating the Coach send test to use the new accessible button name `Nachricht senden`.
- Build: `npm run build -w frontend` passed.
- Route evidence: `npm run qa:ux-evidence` passed for desktop and mobile Chromium; all captured routes report `horizontalOverflow=false`.

## Covered Controls

- Shared segmented, range and mini buttons.
- Coach mic/send/history controls.
- Data overview CTAs.
- Mental text analysis, save-result, fine-tune, score radio, guided-question, tag and submit controls.
- Plan week navigation and sport-switch controls.
- Settings profile/coach edit, Garmin coverage, health-state and push controls.

## Remaining Work

- Add tablist/tab semantics plus arrow-key navigation for segmented controls.
- Add keyboard-complete Mental state card radio behavior.
