# 2026-05-13 Home Check-in Task Contract

## Scope

- Branch: `codex/home-task-contract-copy`
- Route: `/`
- Viewports: desktop Chromium first viewport, mobile regression check
- Goal: Make the no-training Home decision actionable and remove duplicated `Nächster Schritt` / `Nach dem Klick` copy.

## Finding

Fresh route evidence after the Insights density slice showed the no-training Home hero still had a task-contract mismatch:

- `Nächster Schritt`: `Erholungstag abschliessen`
- Detail: `Check-in abschließen und einen klaren Erholungsanker für heute setzen.`
- `Nach dem Klick`: the same sentence again

The CTA did not create a visible state change because its target was `/`. The real missing daily input is the mental check-in, which Data already owns.

Before evidence:

- `/tmp/pulse-data-insights-density-live/2026-05-13-1f163a4/desktop-chromium/01-home.png`
- `/tmp/pulse-data-insights-density-live/2026-05-13-1f163a4/mobile-chromium/01-home.png`

## What Changed

- The fallback no-training Home decision now uses `Check-in öffnen`.
- The target route is `/data?tab=today#data-mental`.
- `Nächster Schritt` explains what to enter.
- `Nach dem Klick` explains that Home, Plan and Coach use the same saved mental day signal.
- Coach remains the optional support action.

## Verification

- `npx playwright test frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium -g "Home no-training daily decision opens" --workers=1`
  - RED before implementation: failed because Home still showed `Erholungstag abschliessen` and duplicated the old completion sentence.
  - GREEN after implementation: passed.
- `npx playwright test frontend/e2e/ux-daily-flow.spec.ts frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Home no-training daily decision opens|Home root-target daily decision|Home daily action explains|Home Focus hero Coach CTA|Home does not show planned-training options" --workers=1`
  - Passed: 10 passed.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-home-task-contract-evidence npm run qa:ux-evidence`
  - Passed: desktop and mobile route packs captured.
- `npm run qa:ux-summary -- /tmp/pulse-home-task-contract-evidence`
  - Passed: 9 desktop screenshots, 15 mobile screenshots, 0 overflow.
- `npm run build -w frontend`
  - Passed.
- `npm run test:e2e:smoke`
  - Passed: 48 passed, 8 skipped.

## Evidence Artifacts

- `/tmp/pulse-home-task-contract-evidence/2026-05-13-1f163a4/desktop-chromium/01-home.png`
- `/tmp/pulse-home-task-contract-evidence/2026-05-13-1f163a4/mobile-chromium/01-home.png`

Artifacts remain outside the repo and are not committed.
