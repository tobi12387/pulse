# Data Mental Suggestion Disclosure Implementation Plan

Status: Completed 2026-05-14.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Mental Check-in should keep the quick state choice and save action first, while keeping Pulse's Garmin/readiness suggestion available behind an explicit `Warum dieser Vorschlag?` disclosure.

**Architecture:** Keep the existing deterministic suggestion and preselected quick choices. Change only the `MentalTab` render path so the suggestion factors are hidden by default and revealed on demand; no API, Garmin or scoring changes.

**Tech Stack:** React/Vite, Playwright, existing Pulse Data mental components.

---

## Context

Live mobile evidence showed `/data?tab=today#data-mental` with the simplified mental choice, but the `Pulse Vorschlag` evidence card still consumed a large block directly below `Heute speichern`. Since the user can already save from the selected state, the evidence should be optional context.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/features/data/mental/mental-components.tsx` | Add the suggestion disclosure and keep factors hidden by default. |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Assert the suggestion is disclosed only after `Warum dieser Vorschlag?`. |
| Modify | `docs/decisions.md` | Record the UX scope decision. |
| Create | `docs/qa/2026-05-14-data-mental-suggestion-disclosure.md` | Capture TDD and route evidence. |

## Task 1: Red Test

- [x] **Step 1: Update the Mental check-in test**

  In `frontend/e2e/pulse-usability.spec.ts`, update `Data mental check-in uses quick choices with guided context` so it asserts:
  - `Warum dieser Vorschlag?` is visible;
  - `mental-suggestion-panel` is not rendered initially;
  - after clicking the toggle, `Pulse Vorschlag` and `Schlafscore 82` are visible.

- [x] **Step 2: Run the focused test and verify red**

  ```bash
  npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Data mental check-in uses quick choices" --project=mobile-chromium
  ```

  Expected before implementation: fails because the toggle is missing and the suggestion card is visible by default.

## Task 2: Minimal Implementation

- [x] **Step 1: Add disclosure state**

  Add `suggestionOpen` state in `MentalTab`.

- [x] **Step 2: Replace the always-visible suggestion card**

  Render a compact button labeled `Warum dieser Vorschlag?` with `aria-expanded` and `aria-controls="mental-suggestion-panel"`. Render the current `Pulse Vorschlag` content only when the disclosure is open and give it `data-testid="mental-suggestion-panel"`.

- [x] **Step 3: Verify green**

  ```bash
  npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Data mental check-in uses quick choices" --project=mobile-chromium
  ```

## Task 3: QA And Finish

- [x] **Step 1: Record QA evidence**

  Create `docs/qa/2026-05-14-data-mental-suggestion-disclosure.md` with red/green checks, build, focused Data/Mental tests and route evidence.

- [x] **Step 2: Verify the full slice**

  ```bash
  npm run build
  git diff --check
  npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Data mental|Mental Check-in|touch targets" --project=desktop-chromium --project=mobile-chromium
  PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-data-mental-suggestion-disclosure npm run qa:ux-evidence
  npm run qa:ux-summary -- /tmp/pulse-data-mental-suggestion-disclosure
  ```

- [x] **Step 3: Prepare PR workflow**

  Stage only touched files, commit, push, open PR, wait for checks, squash merge, deploy and capture live route evidence as the operational finish outside this implementation plan.

## Acceptance

- Mental Check-in first viewport prioritizes state choice and save.
- Suggestion evidence remains reachable and keyboard/touch accessible.
- Check-in scoring, notes, guidance and Garmin/readiness inputs are unchanged.
