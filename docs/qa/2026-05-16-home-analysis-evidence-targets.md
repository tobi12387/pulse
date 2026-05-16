# 2026-05-16 - Home Analysis Evidence Targets QA

## Scope

- Home Daily Decision now routes stale decision-quality learning to the existing Data > Analyse decision-quality evidence card.
- Home Daily Decision now routes Durability-led analysis to the existing Power / Durability evidence card.
- Acute load pressure remains on the Plan Trace evidence anchor; the new Durability route must not steal TSB/load checks.
- All actions are read-only navigations. They do not write Plan, Garmin, Coach or LLM state.

## Verification

- Red: focused Home routing tests failed while `Lernen pruefen` and Durability-led `Analyse pruefen` still opened `#data-plan-trace`.
- Guard red: the combined focus run exposed an over-broad route change where the load-pressure CTA opened `#data-power-duration` instead of `#data-plan-trace`.
- Green focus: `npx playwright test frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium --project=mobile-chromium --grep "Home daily decision uses (stale decision quality|load pressure|durability analysis)" --workers=1` passed, 6 tests.
- Static gates: `git diff --check`, `npm run lint -w frontend`, and `npm run build` passed.
