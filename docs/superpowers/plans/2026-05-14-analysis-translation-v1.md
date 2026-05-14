# Analysis Translation v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Data > Analyse shows which deep signal currently matters for the daily action and which signal is interesting but not actionable yet.

**Architecture:** Add a frontend-only analysis translation model over existing read-only evidence: Goal Projection, Personal Response, Plan Trace, Daily Decision Quality and Training Analytics. Render one compact Data analysis card before the detailed evidence cards. Do not add backend endpoints, migrations, LLM calls, plan mutations or Garmin writes.

**Tech Stack:** React 19, TypeScript, Vite, Playwright, existing Pulse hooks and shared Pulse types.

---

## Tasks

- [x] Create `frontend/src/features/data/analysis/analysis-translation-model.ts` with a pure `buildAnalysisTranslation` function. It should choose one `primary` action signal, one `watch` signal and up to three supporting evidence labels from existing response objects.
- [x] Add `frontend/src/features/data/analysis/AnalysisTranslationCard.tsx` that renders `Analyse -> Tageswirkung`, `Handlungsrelevant`, `Interessant, aber noch nicht entscheidend`, support evidence and a read-only/no-write contract.
- [x] Render `AnalysisTranslationCard` near the top of `DataAnalysenTab` in `frontend/src/pages/Insights.tsx`, using the existing queries already loaded on that tab.
- [x] Add Playwright smoke coverage in `frontend/e2e/pulse-smoke.spec.ts` proving Data > Analyse shows the translation card, names the actionable goal/fueling signal, labels the weak evidence gap and does not open `/api/pulse/insights`.
- [x] Record the product decision in `docs/decisions.md` and update `docs/ai/current-focus.md`.
- [x] Verify with `npm run build -w frontend`, focused desktop/mobile smoke, `git diff --check` and stale-marker scan.
