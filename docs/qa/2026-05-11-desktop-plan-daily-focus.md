# Desktop Plan Daily Focus QA — 2026-05-11

## Scope

Reduce `/plan` desktop density by making the route answer the operational question first:

1. current plan action,
2. current week,
3. season and strategy evidence.

No backend, Garmin, workout generation or plan mutation logic was changed.

## Evidence

Fresh route evidence after the change:

- Desktop: `test-results/route-evidence/desktop-density-after/2026-05-11-<commit>/desktop-chromium/`
- Mobile: `test-results/route-evidence/desktop-density-after/2026-05-11-<commit>/mobile-chromium/`

Key screenshots:

- Desktop `/plan`: `test-results/route-evidence/desktop-density-after/2026-05-11-<commit>/desktop-chromium/06-plan.png`
- Mobile `/plan`: `test-results/route-evidence/desktop-density-after/2026-05-11-<commit>/mobile-chromium/06-plan.png`
- Mobile quick scenario: `test-results/route-evidence/desktop-density-after/2026-05-11-<commit>/mobile-chromium/14-plan-mobile-intent-scenario.png`

Manifest overflow check:

- Desktop core routes: no horizontal overflow.
- Mobile core and daily-flow routes: no horizontal overflow.

## Verification Commands

```bash
npm run build -w frontend
npm run lint -w frontend
npm run test:e2e:smoke
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan"
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "adaptive season contract|season strategy"
npm run qa:plan:no-garmin-write
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/desktop-density-after npm run qa:ux-evidence
```

All commands passed. The focused Plan smoke command was run first during TDD; the final regression pass used the full smoke suite.

## Notes

- The first route-evidence attempt was run in parallel with another Playwright command and hit a transient dev-server collision. Re-running `qa:ux-evidence` alone passed for desktop and mobile.
- Route evidence now resets the app scroll container before non-hash screenshots so core screenshots start at the route header, while hash-targeted evidence still preserves the target viewport.
- `Saisonvertrag` remains visible with `70.3 Kraichgau`, `ca. 64%`, `Naechste 14 Tage`, `Hard-Day-Cap` and `Fueling-Praxis absichern`. The deeper rationale opens via `Saisonvertrag anzeigen`.
- Frontend lint is now green after moving shared helper exports out of component files (`Feedback`, contextual Coach prompt and Home surface focus model/hook).
