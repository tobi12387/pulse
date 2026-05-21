# 2026-05-21 - Fueling Long-Session Copy

## Trigger

Fresh route evidence on current `main` at `cd6ae30` showed no horizontal
overflow, but the mobile Activity Fueling closure path still used the fixture
copy `Long-Run-Log` for a bike long-session GI-comfort action.

That wording is misleading in the current first Performance-OS unblock: the
real target is a bike activity (`Datteln Graveln`) and the gate applies to any
long endurance `during` log, not only runs.

## Change

- Updated route-evidence and smoke fixtures from `Long-Run-Log` to the
  sport-neutral `langen During-Log`.
- Aligned the Data action contract test fixture with the production backend
  and Daily Decision wording.
- Did not change gate strictness, nutrition data, Garmin writes or activity
  routing.

## Verification

- `npx tsx --test scripts/data-analysis-action-contracts.test.ts`
- `npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium -g "Data analysis keeps learning calibration gated until comparable fueling evidence is complete|Data today promotes actionable fueling learning gaps"`
- `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence npm run qa:ux-evidence`
- `npm run qa:ux-summary -- test-results/route-evidence`
- `git diff --check`

Route evidence result:

- Evidence root: `test-results/route-evidence/2026-05-21-cd6ae30/`
- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Reviewed screenshot: `test-results/route-evidence/2026-05-21-cd6ae30/mobile-chromium/16-activity-fueling-anchor.png`

## Product Conclusion

This is a narrow copy fix for the MacroFactor-style Fueling learning loop. It
keeps the first manual unblock accurate for bike, run and other long endurance
sessions. It does not unlock nutrition trend summaries; the gate still needs
three comparable complete `during` logs with activity/duration context, carbs
and GI comfort.
