# 2026-05-16 Analysis Secondary Actions

## Scope

- Data > Analyse keeps `Analyse -> Tageswirkung` as the read-only translation layer.
- If Goal Projection still has a secondary evidence gap, the `Interessant, aber noch nicht entscheidend` block now opens the existing Goal Projection evidence anchor instead of ending as plain text.
- If no Goal Projection leads and the Plan Trace limiter is the strongest analysis signal, the primary Action Contract opens the existing Plan scenario preview via `source=data-load`.
- No Plan, Garmin, Coach or LLM write happens from the analysis card.

## Verification

- Red: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "Data analysis opens secondary goal evidence" --project=desktop-chromium --workers=1` failed because the Watch signal had no `Zielevidenz prüfen` contract.
- Green: same command passed after adding the Goal Projection evidence path.
- Group: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "Data analysis" --project=desktop-chromium --project=mobile-chromium --workers=1` passed with 10 tests.
- Green: `npm run test:e2e -- --grep "Data analysis opens secondary goal evidence from the watch signal|Data analysis opens plan impact from plan limiter evidence|Data analysis translates deep evidence into daily impact without AI cards|Data analysis action contract follows non-plan goal interventions" --workers=1` with 8 passed.
- Green: `git diff --check`.
- Green: `npm run lint -w frontend`.
- Green: `npm run build`.
- `git diff --check` passed.
- `npm run lint -w frontend` passed.
- `npm run build` passed.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-analysis-secondary-actions npm run qa:ux-evidence` passed.
- `npm run qa:ux-summary -- /tmp/pulse-analysis-secondary-actions` reported 2 manifests, 9 desktop screenshots, 15 mobile screenshots and 0 horizontal overflow.
