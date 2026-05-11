# Data IA Compression v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Data feel like an evidence workspace with four understandable jobs instead of seven equal maintenance tabs.

**Architecture:** Keep existing Data components and API contracts. Compress only the Data route's navigation and orchestration: `Heute relevant`, `Trends`, `Datenqualitaet`, `Analyse`. Preserve old query links such as `tab=mental`, `tab=metrics`, `tab=coverage`, `tab=weight` and `tab=analysen` by mapping them into the new four-area model.

**Tech Stack:** React/Vite, React Router query/hash navigation, existing PulseChrome segmented tabs, Playwright route evidence.

---

## Evidence Inputs

- Canonical roadmap: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`.
- Baseline route evidence: `test-results/route-evidence/data-ia-baseline/2026-05-11-0772b17/`.
- Current Data orchestrator: `frontend/src/pages/Data.tsx`.
- Existing Data tests: `frontend/e2e/ux-data-mental.spec.ts`, `frontend/e2e/ux-a11y-responsive.spec.ts`, `frontend/e2e/pulse-usability.spec.ts`, `frontend/e2e/route-evidence.spec.ts`, `frontend/e2e/pulse-smoke.spec.ts`.

## Design

Data keeps its current role as the evidence route, but the first decision becomes "what evidence job am I doing?" rather than "which implementation tab do I need?"

- `Heute relevant`: default daily evidence triage and the mental check-in when opened through `tab=mental` or `#data-mental`.
- `Trends`: recovery metrics, sleep and weight/body-composition surfaces, with old `tab=metrics`, `tab=sleep` and `tab=weight` links opening the relevant section first.
- `Datenqualitaet`: Garmin coverage, backfill and signal usefulness.
- `Analyse`: existing Data Analysen / former Insights surface.

## Task 1: Compress Data Navigation

**Files:**

- Modify: `frontend/src/pages/Data.tsx`
- Test: `frontend/e2e/ux-data-mental.spec.ts`
- Test: `frontend/e2e/ux-a11y-responsive.spec.ts`
- Test: `frontend/e2e/pulse-usability.spec.ts`
- Test: `frontend/e2e/route-evidence.spec.ts`
- Test: `frontend/e2e/pulse-smoke.spec.ts`

- [x] **Step 1: Preserve old URL contracts in a four-area tab mapper**

  In `frontend/src/pages/Data.tsx`, replace the seven tab IDs with four area IDs and map old query names to the new areas:

  ```ts
  type Tab = 'heute' | 'trends' | 'qualitaet' | 'analyse';
  ```

  Expected behavior:
  - `/data` opens `Heute relevant`.
  - `/data?tab=mental` opens `Heute relevant` with `MentalTab` visible.
  - `/data?tab=metrics`, `/data?tab=sleep`, `/data?tab=weight` open `Trends`.
  - `/data?tab=coverage` opens `Datenqualitaet`.
  - `/data?tab=analysen` opens `Analyse`.

- [x] **Step 2: Recompose existing panels without changing backend contracts**

  Keep `CoverageTab`, `MentalTab`, `MetrikenTab`, `SchlafTab`, `GewichtTab` and `DataAnalysenTab` unchanged. Only move where they render:
  - `Heute relevant`: `DataOverviewTab` by default, `MentalTab` when opened from mental query/hash.
  - `Trends`: `MetrikenTab`, `SchlafTab`, `GewichtTab`.
  - `Datenqualitaet`: `CoverageTab`.
  - `Analyse`: `DataAnalysenTab`.

- [x] **Step 3: Update tests and route evidence expectations**

  Update test labels from implementation tabs to product areas:
  - `Abdeckung` -> `Datenqualitaet`
  - `Metriken`, `Schlaf`, `Gewicht` top-level expectations -> `Trends`
  - `Analysen` top-level expectation -> `Analyse`
  - Page header route text -> `Heute, Trends, Qualitaet & Analyse`

## Task 2: Verify Data Compression

**Files:**

- Modify: `docs/decisions.md`
- Modify: `docs/ai/current-focus.md`

- [x] **Step 1: Run focused E2E**

  ```bash
  npm run test:e2e -- --project=mobile-chromium --grep "Data|Mental|tabs|evidence"
  ```

- [x] **Step 2: Regenerate route evidence**

  ```bash
  PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/data-ia-compression npm run qa:ux-evidence
  ```

- [x] **Step 3: Record the decision and next queue**

  Add a newest-first `docs/decisions.md` entry explaining that Data IA compression is a route orchestration change with old query compatibility, not a backend/API rebuild.

  Update `docs/ai/current-focus.md` so the next autonomous queue advances to `Settings Status First v1`.

## Acceptance

- Data shows four top-level areas, not seven equal tabs.
- Legacy links and hash targets still land on the right evidence surface.
- Mental check-in remains reachable from `/data?tab=mental` and from `#data-mental`.
- Route evidence has no horizontal overflow on Data desktop/mobile.
- No API, migration, Garmin write or server-side behavior changes are introduced.

## Implementation Evidence

- `npm run build -w frontend`
- `npm run test:e2e -- frontend/e2e/ux-data-mental.spec.ts --project=mobile-chromium`
- `npm run test:e2e -- frontend/e2e/ux-a11y-responsive.spec.ts --project=mobile-chromium`
- `npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium --grep "Daily loop keeps context|Home evidence chips|Data shows Garmin domain quality"`
- `npm run test:e2e:smoke`
- `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/data-ia-compression npm run qa:ux-evidence`
- Evidence pack: `test-results/route-evidence/data-ia-compression/2026-05-11-0772b17/`
