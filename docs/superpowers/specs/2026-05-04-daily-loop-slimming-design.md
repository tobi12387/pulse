# Daily Loop Slimming Design

## Evidence

- Baseline route evidence: `test-results/route-evidence/2026-05-04-3d42067/`.
- Command: `npm run qa:ux-evidence`.
- Viewports: desktop Chromium `1280x720`, mobile Chromium `412x839`.
- Result: both manifests report no horizontal overflow on `/`, `/coach`, `/data`, `/plan`, `/insights`, and `/settings`.

## Friction Ranking

1. Daily decision context repeats too heavily across Home, Coach, and Plan. Home should remain the complete dashboard, while task routes should carry only the next useful cue.
2. Coach mobile starts with helpful context, but the input flow feels late because the same large decision card competes with the briefing and sticky composer.
3. Plan explains the no-workout state, but the first screen should stay focused on the next training action rather than repeating the full daily dashboard.
4. Data and Settings are dense but currently stable: no horizontal overflow, touch targets are already guarded, and they are lower priority for this PR.

## Selected Approach

Approach A: Daily Loop Slimming.

Home remains the full daily-loop decision surface with the full boundary, alternative, completion, evidence, and CTA content. Coach and Plan use a compact support variant that preserves the day decision, reason, and next action but removes the boundary/alternative/completion grid and avoids a second full dashboard inside the task route.

## First PR Scope

- Extend `DailyDecisionCard` with a compact support presentation that is stable on mobile and desktop.
- Keep Home unchanged by default.
- Use the compact support presentation in Coach and Plan.
- Add a route-level usability regression test that proves Coach and Plan no longer expose the repeated full decision details while Home still does.
- Refresh route evidence after implementation and document the before/after paths.

## Non-Goals

- No API contract changes.
- No backend or database changes.
- No navigation redesign.
- No Data or Settings restyle in this PR.
- No change to the daily-decision derivation logic.
