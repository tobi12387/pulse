# Settings Status First v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Settings open with one clear status answer before technical diagnostics.

**Architecture:** Keep the existing Settings route, hooks, diagnostics rows and section deep links. Add a status-first layer inside `SettingsDiagnosticsMatrix` that derives `Alles bereit` or `Problem beheben` from the existing browser, Push and Garmin signals and lists the highest-priority repair actions before the technical grid.

**Tech Stack:** React/Vite, React Router, TanStack Query hooks already used by Settings, Playwright E2E.

---

## Evidence Inputs

- Canonical roadmap: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`.
- Current Settings route: `frontend/src/pages/Settings.tsx`.
- Existing tests: `frontend/e2e/pulse-usability.spec.ts`, `frontend/e2e/ux-auth-settings.spec.ts`, `frontend/e2e/plan-no-garmin-write.spec.ts`, `frontend/e2e/route-evidence.spec.ts`.

## Design

Settings already has the right detail surfaces, but the first viewport still asks the user to scan a technical matrix. The first object should answer:

- `Alles bereit`: no operational blocker is detected; optional setup such as Push activation can still be shown as a secondary action.
- `Problem beheben`: one or more readiness blockers need attention; the first actions route directly to Garmin, Push, device/PWA or Data quality details.

This is a frontend orchestration change only. It must not trigger Garmin writes, Push permission prompts, migrations or server-side changes.

## Task 1: Add Status-First Contract To Settings

**Files:**

- Modify: `frontend/src/pages/Settings.tsx`
- Test: `frontend/e2e/pulse-usability.spec.ts`
- Test: `frontend/e2e/ux-auth-settings.spec.ts`

- [x] **Step 1: Extend diagnostic row metadata**

  In `SettingsDiagnosticsMatrix`, add readiness metadata to each existing row:

  - `blocksReadiness: true` for insecure access, missing service worker, denied/unsupported/unconfigured Push, blocked/unknown/stale/partial/disconnected Garmin, and insecure certificate context.
  - `blocksReadiness: false` for browser/PWA mode, optional Push activation and secure-but-manual certificate trust.

- [x] **Step 2: Render summary before the technical grid**

  Add `data-testid="settings-status-summary"` above shortcuts and diagnostic cards:

  - show `Problem beheben` when at least one row blocks readiness.
  - show `Alles bereit` when no row blocks readiness.
  - show a compact count/detail sentence.
  - show up to three primary action buttons for blockers, otherwise one optional Push activation action when Push is configured and supported but not subscribed.

- [x] **Step 3: Preserve existing route actions**

  Summary buttons must use the existing row routes:

  - Garmin blocker -> `/settings?section=garmin`
  - Push blocker/setup -> `/settings?section=push`
  - Device/access/service-worker/certificate -> `/settings?section=device`
  - Garmin secondary quality action remains `/data?tab=quality`

## Task 2: Verify Settings Status First

**Files:**

- Modify: `docs/decisions.md`
- Modify: `docs/ai/current-focus.md`

- [x] **Step 1: Focused E2E**

  ```bash
  npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts frontend/e2e/ux-auth-settings.spec.ts frontend/e2e/plan-no-garmin-write.spec.ts --project=mobile-chromium --grep "Settings"
  ```

- [x] **Step 2: Build and route evidence**

  ```bash
  npm run build -w frontend
  PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/settings-status-first npm run qa:ux-evidence
  ```

- [x] **Step 3: Record the decision and next queue**

  Add a newest-first `docs/decisions.md` entry explaining that Settings Status First is a frontend status orchestration layer over existing diagnostics.

  Update `docs/ai/current-focus.md` so the next autonomous queue advances to `Workout Alternatives UX v2`.

## Acceptance

- `/settings` first shows either `Alles bereit` or `Problem beheben`.
- Blocked Garmin and denied Push states are visible in the first Settings card without scanning the technical grid.
- Summary actions route to existing support sections and do not trigger writes.
- Existing Settings deep links still scroll to their sections.
- No backend, migration, Garmin write or Push-permission side effects are introduced.

## Implementation Evidence

- Added a `settings-status-summary` layer in `frontend/src/pages/Settings.tsx` that derives readiness from existing local/PWA, Push and Garmin diagnostics.
- Updated mocked Garmin default status so the normal Settings fixture reflects a healthy connected provider while blocked Garmin remains explicitly testable.
- Verified Settings status behavior with focused mobile E2E, frontend production build and fresh route evidence screenshots.

Commands:

```bash
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts frontend/e2e/ux-auth-settings.spec.ts frontend/e2e/plan-no-garmin-write.spec.ts --project=mobile-chromium --grep "Settings"
npm run build -w frontend
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/settings-status-first npm run qa:ux-evidence
```
