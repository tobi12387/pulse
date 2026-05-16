# 2026-05-16 - Home Power Quality Signal QA

## Scope

- Home Daily Decision now treats blocked Training Analytics power quality as a read-only `Analyse` gate for open planned workouts.
- The primary Home CTA becomes `Power-Daten prüfen` and opens the existing Data > Analyse power-quality evidence anchor.
- Durability-limited decisions still open `#data-power-duration`; load/TSB decisions still open `#data-plan-trace`.
- The action does not write Plan, Garmin, Coach or LLM state.

## Verification

- Red: `npx playwright test frontend/e2e/ux-daily-flow.spec.ts --grep "blocked power quality" --project=desktop-chromium --workers=1` failed because Home led with Garmin instead of blocked Power data quality.
- Green: the same focused command passed after adding the blocked Power-quality Home signal and CTA.
- Neighbor focus: `npx playwright test frontend/e2e/ux-daily-flow.spec.ts --grep "blocked power quality|durability analysis|load pressure" --project=desktop-chromium --project=mobile-chromium --workers=1` passed, 6 tests.
- Daily flow: `npx playwright test frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1` passed, 74 tests.
- Frontend logic: `npm run test:frontend-logic` passed, 21 tests.
- Static gates: `git diff --check`, `npm run lint -w frontend`, and `npm run build` passed.
- Route evidence: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-home-power-quality-signal npm run qa:ux-evidence` passed, 2 tests.
- Route summary: `npm run qa:ux-summary -- /tmp/pulse-home-power-quality-signal` reported 2 manifests, 9 desktop screenshots, 15 mobile screenshots and 0 horizontal overflow.
