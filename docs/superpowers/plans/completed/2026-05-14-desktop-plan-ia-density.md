# Desktop Plan IA Density

## Goal

Make `/plan` calmer on desktop by separating the default training desk from strategy and manual what-if tooling.

## Evidence

- Before: `/tmp/pulse-desktop-home-plan-density-before/2026-05-14-c8f7822/desktop-chromium/06-plan.png`
- After moving season cards, route evidence showed the large `Szenario-Vorschau` form immediately taking the first viewport.
- Final evidence root: `/tmp/pulse-desktop-plan-ia-density-final/`

## Design Decision

1. `Training` owns week, current plan action, changes, Garmin/sync debt and the plan list.
2. `Ziele` owns `Saisonvertrag`, `Saisonlinie` and goal management.
3. Manual `Szenario-Vorschau` is collapsed by default, but opens immediately for Home quick decisions, Data deep-links and adaptation review actions.
4. Do not change plan generation, Garmin writes, workout sync, goal projection or season algorithms.

## TDD Plan

1. Add a desktop smoke proving season strategy is absent from default Training and present in Ziele.
2. Add a desktop smoke proving manual scenario tools are collapsed until opened.
3. Move season cards to `ZieleTab`.
4. Add the scenario preview collapsed state while preserving explicit entry flows.
5. Verify focused Plan smokes, affected usability flows, build and route evidence.
