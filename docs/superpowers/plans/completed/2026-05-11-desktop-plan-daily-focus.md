# Desktop Plan Daily Focus Implementation Plan

**Date:** 2026-05-11  
**Branch:** `codex/desktop-density-focus`  
**Scope:** `/plan` desktop density and route evidence reliability only.

## Goal

Make the Plan route answer the daily question faster: first show the current plan action and the week, then strategy evidence. Preserve all existing season, goal projection, Garmin and adaptation evidence, but move deep explanations behind progressive disclosure or lower on the page.

## Context

- Fresh route evidence showed `/plan` as the strongest desktop density issue: the first viewport is dominated by `Saisonvertrag` and `Saisonlinie` while the week strip is below the fold.
- Product principle from the canonical roadmap: lead, then explain. The week strip is the operational answer; season evidence is support.
- `AdaptiveSeasonContractCard` is read-only and should remain read-only. No Garmin writes, workout generation, plan refresh or backend logic changes in this slice.

## Slice

1. Add a smoke test that proves `/plan` starts with the action contract and week strip before season evidence.
2. Move `WeekStrip` above season/strategy evidence in `TrainingTab`, keeping urgent Garmin/adaptation cards above it when present.
3. Make `AdaptiveSeasonContractCard` compact by default with a clear `Saisonvertrag anzeigen` toggle for details.
4. Reset the app scroll container in route evidence capture before screenshots so desktop evidence starts at the route header.
5. Record QA evidence and decision-log entry.

## Non-Goals

- No redesign of Data, Insights or Settings in this PR.
- No changes to training selection, plan generation, Garmin sync, goal projection or season strategy algorithms.
- No new top-level route or tab.

## Verification

Run:

```bash
npm run build -w frontend
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan"
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "adaptive season contract|season strategy"
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/desktop-density-after npm run qa:ux-evidence
```

Expected route evidence:

- Desktop `/plan` shows the Plan header, current action contract and week strip before season details.
- Mobile `/plan` remains without horizontal overflow.
- `Saisonvertrag`, `70.3 Kraichgau`, `ca. 64%` and `Fueling-Praxis absichern` remain visible without expanding details.

## Implementation Result

- `WeekStrip` now renders before season/strategy evidence in `TrainingTab`, while urgent Garmin/adaptation cards still stay above it.
- `AdaptiveSeasonContractCard` is compact by default and exposes deep factors/evidence through `Saisonvertrag anzeigen`.
- Route evidence resets non-hash app scroll before screenshots and now verifies the `data-analysis` route detail check correctly.
- QA evidence is recorded in `docs/qa/2026-05-11-desktop-plan-daily-focus.md`.
