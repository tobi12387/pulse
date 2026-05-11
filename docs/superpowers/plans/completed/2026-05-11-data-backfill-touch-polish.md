# Data Backfill Touch Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure Data backfill controls meet the 44px mobile/PWA touch-target baseline.

**Architecture:** Keep the Garmin Backfill behavior, copy, mutation flow and data contracts unchanged. Add regression coverage for the existing `Vorschau` and `Nachladen` controls, then adjust only their visual target size.

**Tech Stack:** React/Vite, Playwright E2E.

---

## Tasks

- [x] Add mobile E2E assertions for Data coverage backfill `Vorschau` and `Nachladen` touch targets.
- [x] Verify the new assertions fail before the UI change.
- [x] Add stable `minHeight: 44` and `minWidth: 44` to both backfill action buttons in `frontend/src/features/data/coverage/coverage-components.tsx`.
- [x] Run focused mobile regression, frontend lint and build.
- [x] Add QA notes, move this plan to completed, update current focus and completed README.
- [ ] Commit, PR, merge and deploy.

## Acceptance Criteria

- `Vorschau` and `Nachladen` in `Data > Datenqualität > Garmin Backfill` are at least 44px tall on mobile.
- No behavior, endpoint, copy, Garmin write boundary or backfill payload changes.

## Implementation Notes

- The new `Mobile repeated controls` assertion failed before implementation because `Vorschau` was 35px tall.
- Both Garmin Backfill buttons now have explicit `minWidth: 44` and `minHeight: 44`.
- Existing backfill preview, write, local-recovery and status tests still pass on desktop and mobile.
