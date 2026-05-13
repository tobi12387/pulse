# QA — Insights Secondary Signals Disclosure

Date: 2026-05-13
Branch: `codex/insights-secondary-signals-disclosure`

## Scope

- Keep `/insights` focused on the current focus and the next useful check.
- Move secondary synthesis signals (`Ziel`, `Reaktion`, `Planqualität`) behind `Weitere Signale anzeigen`.
- Preserve the existing deep-analysis disclosure and lazy AI analysis behavior.

## Red / Green

- Red: `Insights keeps secondary synthesis signals behind a disclosure` failed because `Ziel` rendered immediately.
- Green: after adding the disclosure, secondary synthesis signals are absent by default and appear after the user opens them.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Insights keeps secondary synthesis signals behind a disclosure" --project=mobile-chromium`
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Insights" --project=desktop-chromium --project=mobile-chromium`
- `npm run build`
- `git diff --check`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-insights-secondary-signals-disclosure-final npm run qa:ux-evidence && npm run qa:ux-summary -- /tmp/pulse-insights-secondary-signals-disclosure-final`

## Evidence

- The focused RED failure showed `Ziel` visible on the initial mobile `/insights` route.
- The GREEN run covers the new disclosure behavior on mobile plus the existing Insights synthesis/deep-analysis behavior on desktop and mobile.
- Local route evidence: `/tmp/pulse-insights-secondary-signals-disclosure-final/`
- Desktop screenshots: 9
- Mobile screenshots: 15
- Horizontal overflow: 0
