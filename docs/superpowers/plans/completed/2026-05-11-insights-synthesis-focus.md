# Insights Synthesis Focus Implementation Plan

**Date:** 2026-05-11  
**Branch:** `codex/insights-synthesis-focus`  
**Scope:** `/insights` route differentiation only.

## Goal

Make `/insights` feel like a synthesis surface instead of a duplicate of `Data > Analyse`. The first viewport should answer: what is the current pattern, why does it matter, and where should Tobi act or inspect deeper evidence?

## Context

- Route evidence showed `/insights` and `/data?tab=analysis` as nearly identical dense stacks.
- `DataAnalysenTab` is still valuable as the deep evidence workbench and should remain unchanged for Data.
- Top-level Insights should be calmer: fewer always-visible cards, more interpretation, and explicit links to Data/Plan for detail.

## Slice

1. Add tests proving `/insights` starts with a dedicated synthesis hero, not the Data analysis card stack.
2. Create an `InsightsSynthesis` surface from existing read-only hooks: personal response, goal projection, decision quality, plan trace and training analytics.
3. Keep deep AI/domain cards behind an explicit `Tiefe Analyse anzeigen` control so no deep insight requests are made on first load.
4. Preserve `/data?tab=analysis` behavior and legacy Data hashes.
5. Record QA evidence.

## Non-Goals

- No backend endpoint changes.
- No new LLM calls, writes, Garmin sync or plan mutation.
- No change to Data IA or Data analysis tab behavior.
- No new top-level navigation item.

## Verification

Run:

```bash
npm run lint -w frontend
npm run build -w frontend
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Insights|Data analysis"
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "Insights|Data analyses"
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/insights-synthesis-after npm run qa:ux-evidence
```

## Implementation Result

- `/insights` now renders a dedicated `InsightsSynthesis` surface instead of `DataAnalysenTab mode="insights"`.
- Data analysis remains unchanged and still owns the deep evidence stack.
- Deep insight domain cards remain read-only and deferred behind `Tiefe Analyse anzeigen`.
- QA evidence is recorded in `docs/qa/2026-05-11-insights-synthesis-focus.md`.
