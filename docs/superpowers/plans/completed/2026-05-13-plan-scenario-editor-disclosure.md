# Plan Scenario Editor Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Status: implemented in the `codex/plan-scenario-editor-disclosure` slice.

**Goal:** Mobile quick scenario previews should show the preview decision first and keep the full scenario editor behind an explicit `Option ändern` control.

**Architecture:** Keep the read-only preview/apply contract unchanged. Add a frontend-only disclosure inside `PlanScenarioPreviewCard`: quick-entry previews collapse the editor once a preview result exists, while non-quick scenario flows keep the existing always-visible editor.

**Tech Stack:** React/Vite, Playwright, existing Pulse Plan scenario hooks.

---

## Context

Live route evidence on `c19f143` shows `/plan` after a mobile quick decision with a clean preview result, but the complete scenario mode grid and form remain visible immediately below it. This makes the preview/apply decision compete with editing controls, especially on iPhone/PWA.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/pages/Plan.tsx` | Add quick-entry editor disclosure state and render the editor only when needed. |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Preserve the mobile quick decision UX contract. |
| Modify | `frontend/e2e/pulse-smoke.spec.ts` | Keep smoke coverage aligned with the collapsed editor. |
| Modify | `docs/decisions.md` | Record the UX scope decision. |
| Create | `docs/qa/2026-05-13-plan-scenario-editor-disclosure.md` | Capture red/green checks and route evidence. |

## Task 1: Red Test

- [x] **Step 1: Update the quick decision test**

  In `frontend/e2e/pulse-usability.spec.ts`, update `Home surfaces quick availability intents when no workout is planned` so it asserts:
  - preview result is visible;
  - `plan-scenario-editor` is not rendered while preview is visible;
  - `plan-scenario-edit-toggle` is visible;
  - after clicking `Option ändern`, the editor appears and preserved values (`bike`, `Z1`, `60`) are still present.

- [x] **Step 2: Update the smoke tests**

  In `frontend/e2e/pulse-smoke.spec.ts`, apply the same interaction to the mobile workout scenario preview smoke test and keep the free-day reduce-volume smoke expectation focused on the visible intent hint.

- [x] **Step 3: Run the focused test and verify red**

  ```bash
  npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Home surfaces quick availability intents" --project=mobile-chromium
  ```

  Expected before implementation: fails because `plan-scenario-edit-toggle` is missing and the editor is still visible.

## Task 2: Minimal Implementation

- [x] **Step 1: Add disclosure state**

  In `PlanScenarioPreviewCard`, add state that opens the editor by default for normal flows, collapses it after quick auto-preview/manual-preview success, and reopens it when the user clicks `Option ändern`.

- [x] **Step 2: Wrap the existing form**

  Give the existing form `data-testid="plan-scenario-editor"` and render it only when:
  - the entry is not a quick scenario; or
  - no preview exists yet; or
  - the user explicitly opened the editor; or
  - an error needs the editor to stay actionable.

- [x] **Step 3: Add the edit control**

  When a quick scenario preview exists and the editor is collapsed, render a compact secondary action with `data-testid="plan-scenario-edit-toggle"` and label `Option ändern`.

- [x] **Step 4: Verify green**

  ```bash
  npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Home surfaces quick availability intents" --project=mobile-chromium
  npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "mobile Home availability intent opens a workout scenario preview" --project=mobile-chromium
  ```

## Task 3: QA And Finish

- [x] **Step 1: Record QA evidence**

  Create `docs/qa/2026-05-13-plan-scenario-editor-disclosure.md` with the red failure, green checks, build, route evidence and live evidence paths.

- [x] **Step 2: Verify the full slice**

  ```bash
  npm run build
  git diff --check
  npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "scenario|Szenario|availability intents|Vorschau" --project=desktop-chromium --project=mobile-chromium
  npm run test:e2e:smoke
  PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-scenario-editor-disclosure npm run qa:ux-evidence
  npm run qa:ux-summary -- /tmp/pulse-plan-scenario-editor-disclosure
  ```

- [x] **Step 3: Commit, PR, merge and deploy**

  Stage only the touched files, commit, push `codex/plan-scenario-editor-disclosure`, open a PR, wait for checks, squash merge, deploy with `scripts/deploy.sh`, run `scripts/verify-server.sh`, and capture live route evidence.

## Acceptance

- Quick mobile scenario previews show the preview/apply decision before edit controls.
- `Option ändern` restores the editor without losing the prefilled scenario values.
- Normal Plan scenario flows still show the editor directly.
- No Garmin or plan write behavior changes.
