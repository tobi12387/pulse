# QA — Home Free-Day Snapshot Density

Date: 2026-05-13  
Branch: `codex/home-free-day-snapshot-density`  
Scope: Home/Heute hero on days without a planned workout or completed activity.

## Intent

On a free day, Home should focus on the daily task contract instead of rendering an empty workout snapshot. If a workout is planned or an activity was completed, the workout snapshot remains useful and stays visible.

## Red / Green

- Red: `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium -g "Home skips empty workout snapshot" --workers=1`
  - Expected failures before implementation:
    - `WORKOUT · HEUTE` existed on a no-workout/no-activity day.
    - After hiding the empty snapshot, duplicate `Check-in öffnen` actions were exposed (`2`, expected `1`).
- Green: same command after implementation.
  - Result: `1 passed`.

## Regression Checks

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Home daily action explains|Home skips empty workout snapshot|Home Focus hero Coach CTA|Home diary treats today nextWorkout|Daily loop clarity keeps Home guidance|Mobile routes avoid unintended horizontal overflow|Mobile repeated controls" --workers=1`
  - Result: `12 passed`, `2 skipped`.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-home-free-day-snapshot-evidence-final npm run qa:ux-evidence`
  - Result: desktop and mobile route evidence passed.
- `node scripts/route-evidence-summary.mjs /tmp/pulse-home-free-day-snapshot-evidence-final`
  - Result: desktop `9` screenshots, mobile `15` screenshots, `0` horizontal overflow.

## Evidence

- Evidence root: `/tmp/pulse-home-free-day-snapshot-evidence-final`
- Mobile Home screenshot: `<evidence-root>/<date>-<commit>/mobile-chromium/01-home.png`
- Desktop Home screenshot: `<evidence-root>/<date>-<commit>/desktop-chromium/01-home.png`

## Notes

This is presentation-only. It does not change Daily Decision generation, check-in submission, Coach prompt preparation, planned workout detection or Garmin behavior.
