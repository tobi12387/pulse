# QA — Home Inline Decision Actions

Date: 2026-05-13
Branch: `codex/home-inline-decision-actions`

## Scope

- Keep the Home Focus hero as one daily decision surface.
- Move the hero's primary/support actions into the `Nächster Schritt` block of `DailyDecisionCard`.
- Leave non-Home `DailyDecisionCard` placements unchanged.

## Red / Green

- Red: `Home skips empty workout snapshot when no workout or completed activity exists` failed because the `Check-in öffnen` button was outside `daily-decision-next-steps`.
- Green: after adding the opt-in inline action placement, the Home hero has exactly one `Check-in öffnen` button and it lives inside the next-step block.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Home skips empty workout snapshot" --project=mobile-chromium`
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Home|daily decision|Daily decision|completed workout|free day" --project=desktop-chromium --project=mobile-chromium`
- `npx playwright test frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium --project=mobile-chromium`
- `npm run build`
- `git diff --check`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-home-inline-decision-actions-final npm run qa:ux-evidence && npm run qa:ux-summary -- /tmp/pulse-home-inline-decision-actions-final`

## Evidence

- The focused RED failure showed the Home CTA outside the task-contract block.
- The GREEN runs cover Home daily decisions, Coach handoff, completed workout states and mobile/desktop daily-flow regressions.
- Local route evidence: `/tmp/pulse-home-inline-decision-actions-final/`
- Desktop screenshots: 9
- Mobile screenshots: 15
- Horizontal overflow: 0
