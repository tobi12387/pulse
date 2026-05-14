# QA — Home Desktop Action Density

Scope: `/` Focus-Hero on desktop and mobile route evidence.

## Finding

Fresh route evidence after the Plan IA cleanup showed that Home had the right ownership model but still felt heavier than necessary in the first viewport:

- the daily decision showed `Warum jetzt`, `Nächster Schritt` and `Nach dem Klick` at once;
- `Check-in öffnen` and `Coach fragen` looked like two equal primary choices;
- the diary was pushed lower even on desktop, although it is the intended narrative follow-up.

This conflicted with the `Single Decision + Diary` direction: Home should show one daily decision, one primary next action and optional explanation.

## Change

- Added opt-in `deferResultPreview` and `deferSupportAction` props to `DailyDecisionCard`.
- Enabled both only in `DecisionHero`, so Home keeps one visible primary action in the hero.
- Moved `Nach dem Klick` and optional Coach support into `Details & Evidenz anzeigen`.
- Kept evidence chips and Coach prompt routing available after the disclosure.
- Left Plan, Data and Coach task-contract cards unchanged unless they opt in later.

## Verification

- Red: `npx playwright test frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium -g "Home no-training daily decision"`
- Green: `npx playwright test frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium -g "Home no-training daily decision"`
- Green: `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --workers=1 -g "Daily loop clarity keeps Home guidance plain"`
- Green: `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --workers=1 -g "Home daily action explains the next step|Home Focus hero Coach CTA|Home owns the full daily decision|Home daily decision can open Coach"`
- Green: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium -g "Plan starts with the current action contract"`
- Green: `npm run build`
- Green: `git diff --check`
- Route evidence: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-home-desktop-action-density-final npm run qa:ux-evidence`
- Route evidence summary: `npm run qa:ux-summary -- /tmp/pulse-home-desktop-action-density-final`

Result: 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow.

## Screenshot Evidence

- Desktop Home after: `/tmp/pulse-home-desktop-action-density-final/2026-05-14-c108975/desktop-chromium/01-home.png`
- Mobile Home after: `/tmp/pulse-home-desktop-action-density-final/2026-05-14-c108975/mobile-chromium/01-home.png`

Manual screenshot review: Home now shows `Check-in öffnen` as the only visible hero action; `Nach dem Klick` and `Coach fragen` are absent until details are opened. The diary starts higher in the desktop viewport without removing readiness context.
