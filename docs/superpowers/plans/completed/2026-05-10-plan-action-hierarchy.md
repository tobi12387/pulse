# Plan Action Hierarchy Implementation Plan

**Status:** Implemented 2026-05-10.

**Goal:** Make the first Plan viewport answer the current job before showing diagnostics, alternatives, season modeling and tools.

## Why

The fresh UI/UX benchmark and Pulse roadmap require visible tasks to follow the UX Task Contract: what to do, why now and what happens afterwards. The Plan route already had strong planning, Garmin and scenario machinery, but the first visible decision could disappear behind Today Options or show evidence/actions before the user knew the primary job.

## Implemented Slice

- Added a `plan-primary-action` contract to the next-training decision card.
- For an open workout, Plan now leads with:
  - `Plan-Aktion`
  - a concrete action title;
  - `Warum jetzt`;
  - `Nach dem Klick`;
  - primary `Einheit öffnen`;
  - secondary `Garmin prüfen`.
- For no open workout, Plan now leads with availability as the next action before generator/custom/coach alternatives.
- When Today Options carries the planned-workout job but the plan list has no open workout fixture yet, the full Today Options card also exposes the same `Plan-Aktion` contract instead of starting with a dense option grid.
- Kept evidence chips, adaptation status, alternatives, Garmin sync debt, scenario preview and season modeling below the primary action.

## Verification

- RED: `npm run test:e2e -- --project=desktop-chromium --grep "Plan starts with the current action contract"` failed because `plan-primary-action` did not exist.
- RED: `npm run test:e2e -- --project=desktop-chromium --grep "Plan keeps the action contract when only Today Options has the planned workout"` failed because the default Plan first card had no action contract.
- GREEN: the same test passed after the Plan contract was implemented.

## Follow-Up

Next product work should continue with Daily Delta and Planned-vs-Completed closure so Plan/Home can explain what changed since the last real Garmin activity and what should happen next.
