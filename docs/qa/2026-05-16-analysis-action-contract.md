# 2026-05-16 Analysis Action Contract

## Evidence

- Branch: `codex/analysis-action-contract`
- Baseline: `origin/main` after PR #451 (`0ed4859`)
- Current friction: Data > Analyse translated deep evidence into `Handlungsrelevant`, but the Goal Projection `nextBestIntervention` action remained plain text even though the backend contract already provides a `targetPath`.

## Scope

- Use the existing Goal Projection `targetPath` inside the analysis translation model.
- Render a compact `Nach dem Klick` preview plus one explicit CTA when a signal has both `actionLabel` and `targetPath`.
- Keep the Analysis card read-only: no plan, Garmin, Coach or LLM write is triggered by rendering or clicking the CTA.
- Do not add new analysis cards, new routes or new nutrition trend claims.

## Verification Plan

- Red/green `Data analysis translates deep evidence into daily impact without AI cards`.
- Run focused smoke coverage for Data analysis on desktop and mobile.
- Run frontend lint/build.
- Regenerate route evidence and summary for desktop/mobile screenshots.

## Verification Results

- Red: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "Data analysis translates deep evidence" --project=desktop-chromium --workers=1` failed because the analysis card still rendered only text.
- Green: same focused command passed after adding the clickable action contract.
- Green: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "Data analysis" --project=desktop-chromium --project=mobile-chromium --workers=1` with 6 passed.
- Green: `git diff --check`.
- Green: `npm run lint -w frontend`.
- Green: `npm run build`.
- Green: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-analysis-action-contract npm run qa:ux-evidence`.
- Green: `npm run qa:ux-summary -- /tmp/pulse-analysis-action-contract` with 2 manifests, 9 desktop screenshots, 15 mobile screenshots and 0 horizontal overflow.

Manual screenshot review: mobile `05-data-analysis.png` shows the `Nach dem Klick` preview and `Plan pruefen` CTA inside the existing analysis translation card without overlap.
