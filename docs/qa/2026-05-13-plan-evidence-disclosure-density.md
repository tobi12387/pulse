# Plan Evidence Disclosure Density

Date: 2026-05-13  
Branch: `codex/plan-evidence-disclosure-density`  
Route: `/plan`  
Viewport: desktop and mobile Chromium

## Finding

Fresh live route evidence on `f86e839` showed no horizontal overflow, but `/plan` still exposed many secondary evidence and deep-link controls in the first viewport:

- `Einbezogen: TSB ...`
- `Ziele ... aktiv`
- `Risiko ...`
- `Metriken prüfen`
- `Mental prüfen`
- `Ziele prüfen`

These controls are useful for trust and debugging, but they competed with the primary Plan action and made the first screen feel more like an evidence dashboard than a training decision.

Before evidence:

- `/tmp/pulse-home-free-day-snapshot-live/2026-05-13-f86e839/desktop-chromium/06-plan.png`
- `/tmp/pulse-home-free-day-snapshot-live/2026-05-13-f86e839/mobile-chromium/06-plan.png`

## Change

The Plan decision now keeps the primary action, adaptation status and alternatives visible, while moving source chips and supporting deep links behind `Details & Evidenz anzeigen`.

The evidence remains interactive:

- the TSB chip still deep-links to `Data > Analyse > Plan Trace`;
- goal and risk links remain available after opening details;
- stale-trace protection is still covered by tests.

## Verification

Red:

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "Plan evidence chips deep-link" --workers=1`
- The new assertion failed because `Einbezogen: TSB -5.7` was visible before the disclosure.

Green:

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "Plan evidence chips deep-link|Plan desktop keeps the primary action CTA|Plan desktop avoids nesting" --workers=1`
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan evidence chips|Plan decision uses current fitness load|Plan alternatives adapt|Plan alternatives avoid stale trace context|Plan desktop|Plan mobile|Mobile routes avoid unintended horizontal overflow" --workers=1`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-evidence-disclosure-density-final npm run qa:ux-evidence`
- `npm run qa:ux-summary -- /tmp/pulse-plan-evidence-disclosure-density-final`

After evidence:

- `/tmp/pulse-plan-evidence-disclosure-density-final/2026-05-13-aee015a/desktop-chromium/06-plan.png`
- `/tmp/pulse-plan-evidence-disclosure-density-final/2026-05-13-aee015a/mobile-chromium/06-plan.png`

Route evidence summary:

- desktop screenshots: 9
- mobile screenshots: 15
- horizontal overflow: 0
