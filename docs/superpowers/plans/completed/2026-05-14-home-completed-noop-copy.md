# Home Completed No-op Copy Implementation Plan

**Goal:** When Home is already complete for the day, the decision card should not repeat a no-op `Nach dem Klick` explanation. It should state the completed outcome once and keep deeper evidence behind details.

**Architecture:** Change the shared `DailyDecisionCard` with a narrow guard: hide the `Nach dem Klick` preview only when there are no open steps and the preview duplicates the primary completed summary. Do not change open-action decisions, Coach prompts, Plan decisions or evidence details.

**Tech Stack:** React/Vite, shared DailyDecisionCard, Playwright regression.

---

## Context

Live mobile evidence for the completed-activity Home state showed `Alles Relevante ist erledigt` and `Nach dem Klick` repeating the same message. For a completed day, Pulse should not imply another action contract.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/components/DailyDecisionCard.tsx` | Hide duplicate no-op result preview for completed/no-open-step decisions. |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Add regressions for completed planned and off-plan training states. |
| Modify | `docs/decisions.md` | Record the no-op completion copy rule. |
| Create | `docs/qa/2026-05-14-home-completed-noop-copy.md` | Capture TDD and route evidence. |

## Tasks

- [x] **Task 1: Red test**
  - Extend the completed planned training test to assert the primary next-step card does not show `Nach dem Klick` when no work is open.
  - Add an off-plan completed activity regression with saved feedback that fails when the no-op preview is duplicated.

- [x] **Task 2: Minimal implementation**
  - Compute whether the result preview duplicates the completed summary.
  - Suppress only that duplicated post-click block.

- [x] **Task 3: Verification**
  - Run focused Home decision tests, build, diff check and route evidence.

## Acceptance

- Completed Home decision states show the completed summary once.
- Open decisions still show `Nach dem Klick`.
- Details/evidence remain accessible.
