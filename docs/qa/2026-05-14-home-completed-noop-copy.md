# QA — Home Completed No-op Copy

## Scope

Home should not repeat a completed-day no-op result under `Nach dem Klick` when no user action is open. This slice only suppresses duplicated completed previews inside `DailyDecisionCard`; open daily decisions keep the existing task-contract preview.

## TDD

- Red:
  - `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Home completed off-plan activity with feedback" --project=mobile-chromium`
  - Expected failure before implementation: `daily-decision-next-steps` still contained `NACH DEM KLICK` with the same completed feedback summary.
- Green:
  - `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Home completed off-plan activity with feedback|Home treats completed planned training|Home routes to activity feedback" --project=desktop-chromium --project=mobile-chromium`
  - Result: 6 passed.

## Verification

- `npm run build` — passed.
- `git diff --check` — passed.
- Local route evidence:
  - `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-home-completed-noop-copy-final npm run qa:ux-evidence` — passed, 2/2.
  - `npm run qa:ux-summary -- /tmp/pulse-home-completed-noop-copy-final` — 2 manifests, 24 screenshots, 0 horizontal overflow.
  - Manual screenshot check: `mobile-chromium/12-home-completed-command.png` in the generated evidence pack shows the completed summary once, no duplicated `Nach dem Klick` block, and the existing details disclosure remains available.
- Live route evidence after deploy — pending.

## Notes

- Completed planned training with feedback now asserts no `Nach dem Klick` copy in the next-step card.
- Completed off-plan activity with saved feedback now asserts the completed summary appears once and the no-op post-click label is absent.
- Details and evidence remain available; the guard only applies when the preview text duplicates the completed primary summary.
