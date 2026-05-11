# Data Daily Action Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/data` open with one clear daily data action instead of several equal entry cards.

**Architecture:** Keep the existing Data route, tab mapping, anchors and deep links. Replace only the default `Heute relevant` overview orchestration with a primary action contract plus compact evidence summary; move secondary data-area cards and provenance shortcuts behind an explicit disclosure. No backend, Garmin, check-in or plan mutations are introduced.

**Tech Stack:** React/Vite, React Router, TanStack Query hooks via `@/pulse/hooks`, Playwright E2E, route evidence QA.

---

## Files

- Modify: `frontend/src/pages/Data.tsx`
  - Add a compact primary Data action contract to `DataOverviewTab`.
  - Keep `EvidenceTriage` and all existing deep sections intact.
  - Move current triage, secondary cards and provenance shortcuts behind `Weitere Datenbereiche anzeigen`.
- Modify: `frontend/e2e/pulse-usability.spec.ts`
  - Add regression coverage that `/data` starts with one primary action and hides secondary cards until requested.
  - Update mobile touch-target coverage to open the disclosure before checking secondary controls.
- Add then move on completion: `docs/superpowers/plans/2026-05-11-data-daily-action-focus.md`.
- Add: `docs/qa/2026-05-11-data-daily-action-focus.md`.
- Modify: `docs/decisions.md`, `docs/ai/current-focus.md`, `docs/superpowers/plans/completed/README.md`.

---

## Task 1: Failing Data UX Regression

- [x] **Step 1: Add an E2E test for the default Data action contract**

  In `frontend/e2e/pulse-usability.spec.ts`, near the existing Data overview tests, add a test that:

  - opens `/data`;
  - expects `data-primary-action` to be visible;
  - expects the primary card to include `Daten-Aktion`, `Warum jetzt` and `Nach dem Klick`;
  - expects `data-secondary-areas` not to be visible initially;
  - opens `Weitere Datenbereiche anzeigen`;
  - expects `Analyse öffnen`, `Check-in öffnen`, `Trends öffnen` and provenance shortcuts to become visible.

- [x] **Step 2: Run the focused test and confirm RED**

  Run:

  ```bash
  npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "Data starts with one daily action"
  ```

  Expected: FAIL because `data-primary-action` does not exist yet.

---

## Task 2: Compact Data Default Surface

- [x] **Step 1: Implement the primary action contract**

  In `frontend/src/pages/Data.tsx`, update `DataOverviewTab` to read existing `usePulseHome()` and `useCheckinToday()` data, then derive one primary action:

  - If today's check-in is missing: title `Mental Check-in abschliessen`, CTA `Check-in öffnen`, target `data-mental`.
  - Else if Garmin is not ready: title `Garmin-Daten prüfen`, CTA `Datenqualität öffnen`, target `data-garmin-quality`.
  - Else: title `Planwirkung prüfen`, CTA `Planwirkung öffnen`, target `/plan?tab=training&source=data-load#plan-scenario-preview`.

  The card must show:

  - eyebrow `DATEN-AKTION`;
  - `Warum jetzt`;
  - `Nach dem Klick`;
  - compact evidence row with Readiness, TSB, Mental and Garmin.

- [x] **Step 2: Put secondary areas behind disclosure**

  Add local state to `DataOverviewTab` and render the current three secondary cards plus `ENTSCHEIDUNGS-EVIDENZ` only when `secondaryOpen` is true. The disclosure button label must toggle between:

  - `Weitere Datenbereiche anzeigen`
  - `Weitere Datenbereiche ausblenden`

- [x] **Step 3: Keep existing deep-link behavior untouched**

  Do not change:

  - `tabFromQuery`
  - `focusFromQuery`
  - `HASH_TAB`
  - `EvidenceTriage`
  - `DataHeuteTab`, `DataTrendsTab`, `DataQualitaetTab`, `DataAnalysenTab`

---

## Task 3: Green Tests And Route Evidence

- [x] **Step 1: Run focused Data tests**

  ```bash
  npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Data starts with one daily action|Data overview exposes provenance shortcuts|Data Plan Load triage|Mobile repeated controls"
  ```

- [x] **Step 2: Run frontend verification**

  ```bash
  npm run lint -w frontend
  npm run build -w frontend
  ```

- [x] **Step 3: Capture route evidence**

  ```bash
  PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/data-daily-action-focus-after npm run qa:ux-evidence
  ```

  Review desktop and mobile `/data` screenshots for the first-viewport hierarchy and ensure manifests report no document-level horizontal overflow.

---

## Task 4: Documentation, PR And Deploy

- [x] **Step 1: Write QA evidence**

  Add `docs/qa/2026-05-11-data-daily-action-focus.md` with:

  - scope and route evidence path;
  - key change;
  - verification commands and outcomes.

- [x] **Step 2: Update AI context**

  Update:

  - `docs/ai/current-focus.md` with one short completed-state bullet;
  - `docs/superpowers/plans/completed/README.md` with the completed plan;
  - move this plan to `docs/superpowers/plans/completed/`.

- [ ] **Step 3: Commit, push, PR, merge and deploy**

  Use:

  ```bash
  git add <explicit paths>
  git commit -m "Focus Data daily action"
  git push -u origin codex/data-daily-action-focus
  gh pr create --base main --head codex/data-daily-action-focus
  gh pr checks --watch
  gh pr merge --squash --delete-branch
  ssh root@192.168.178.46 "cd /root/pulse && bash scripts/deploy.sh"
  bash scripts/verify-server.sh
  ```

---

## Acceptance Criteria

- `/data` default view starts with one visible daily data action.
- Secondary area cards are hidden until explicitly opened.
- Existing Data tabs, old query aliases and hash deep links still work.
- `data-triage-plan-load` still routes to Plan scenario preview.
- Mobile touch targets remain at least 44px for daily-use controls.
- Route evidence shows no document-level horizontal overflow.

## Implementation Notes

- Implemented as one frontend-only PR-sized slice.
- `/data` default now shows one `data-primary-action` contract derived from existing Home/Garmin/Check-in evidence.
- Secondary triage, Data area cards and decision-evidence shortcuts are still available after `Weitere Datenbereiche anzeigen`.
- Existing Data query aliases, hash anchors and Plan scenario handoff remain covered by Playwright.
