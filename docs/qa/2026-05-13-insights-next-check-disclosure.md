# QA — Insights Next Check Disclosure

Date: 2026-05-13
Branch: `codex/insights-next-check-primary-only`

## Scope

- Keep the `/insights` next-check section focused on the primary intervention.
- Move secondary checks (`Datenqualität`, `Capability`) behind `Weitere Prüfungen anzeigen`.
- Preserve the existing compact row pattern and avoid nested cards.

## Red / Green

- Red: `Insights keeps next checks compact without nested cards` failed because three next-check rows rendered immediately.
- Green: after adding the disclosure, only `Intervention` is visible by default; opening the disclosure reveals all three rows.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Insights keeps next checks compact without nested cards" --project=mobile-chromium`
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Insights" --project=desktop-chromium --project=mobile-chromium`
- `npm run build`
- `git diff --check`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-insights-next-check-disclosure-final npm run qa:ux-evidence && npm run qa:ux-summary -- /tmp/pulse-insights-next-check-disclosure-final`

## Evidence

- The focused RED failure showed three `insights-next-check-item` rows on initial mobile `/insights`.
- The GREEN run covers the next-check disclosure together with the existing Insights synthesis and deep-analysis behavior on desktop and mobile.
- Local route evidence: `/tmp/pulse-insights-next-check-disclosure-final/`
- Desktop screenshots: 9
- Mobile screenshots: 15
- Horizontal overflow: 0
