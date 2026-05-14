# Plan Progression Desktop Density

## Goal

Reduce the first desktop viewport weight on `/plan` after the daily-action cleanup. The next training card should still tell why the unit exists, but detailed progression evidence should not push the week view down.

## Evidence

- Live after PR #363: `/tmp/pulse-live-plan-after.png`
- The primary Plan action is calmer, but `Progression` still renders `Rolle`, `Kalibrierung`, `Wiederholung`, `Ändern wenn` and evidence chips directly above the action.
- That makes Plan feel like another explanation page instead of a week planner.

## Design Decision

1. Keep the progression summary visible: label, fit/status, Athlete-Level and the unit role.
2. Collapse `Kalibrierung`, `Wiederholung`, `Ändern wenn` and evidence chips behind `Progression prüfen`.
3. Keep all existing data and copy. This is a presentation-density change, not a planning-engine change.
4. Keep mobile functional; desktop is the priority for this slice.

## TDD Plan

1. Add a desktop smoke test that expects `Kalibrierung` to be hidden by default and visible after opening `Progression prüfen`.
2. Implement the smallest JSX change in `frontend/src/pages/Plan.tsx`.
3. Verify focused Plan smoke, build, and desktop route evidence.
