# QA — Desktop Plan IA Density

Scope: `/plan` desktop first viewport and Plan tab information architecture.

## Finding

Fresh route evidence after the week-first Plan slice had no horizontal overflow, but the desktop Training tab still felt like a mixed dashboard:

- first it exposed the week and plan action;
- then strategy evidence (`Saisonvertrag` / `Saisonlinie`) or, after moving those, the full manual `Szenario-Vorschau` form occupied the first viewport.

That conflicted with the intended split: Home makes the daily decision, Training manages the week/execution, Ziele carries season strategy.

## Change

- Moved `Saisonvertrag` and `Saisonlinie` from Training to Ziele.
- Kept Training focused on week, plan action, change/sync surfaces and the workout list.
- Collapsed manual `Szenario-Vorschau` by default behind `Szenario-Vorschau öffnen`.
- Preserved auto-open behavior for Home quick decisions, Data handoff and adaptation-review actions.

## Verification

- Red: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium -g "Plan desktop keeps season strategy out" --workers=1`
- Red: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium -g "Plan desktop keeps manual scenario tools collapsed" --workers=1`
- Green: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan season lane|Plan exposes season evidence|Plan desktop keeps season strategy out|Plan desktop keeps manual scenario tools|Plan starts with|Plan desktop starts|mobile Home availability intent|mobile Home free-day intent" --workers=1`
- Green: `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan scenario preview|Plan surfaces Garmin sync failure after applying|Plan custom workout starts neutral|Plan custom workout does not expose|Plan shows persisted adaptation events|Data Plan Load triage|Plan shows season strategy|Plan shows adaptive season contract|Plan season strategy keeps|Plan shows race command" --workers=1`
- Route evidence: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-desktop-plan-ia-density-final npm run qa:ux-evidence`
- Route evidence summary: `npm run qa:ux-summary -- /tmp/pulse-desktop-plan-ia-density-final`

Result: 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow.

## Screenshot Evidence

- Desktop Plan after: `/tmp/pulse-desktop-plan-ia-density-final/<date>-<commit>/desktop-chromium/06-plan.png`
- Ziele now contains strategy evidence in the same route pack after switching the tab manually during smoke coverage.
