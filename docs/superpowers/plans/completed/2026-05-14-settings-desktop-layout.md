# Settings Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settings should use desktop width to reduce vertical scanning while preserving the current mobile/PWA stacked flow.

**Architecture:** Keep all existing Settings sections and diagnostics logic. Add a desktop-only layout wrapper that places the readiness/status card and profile card side by side, then arranges secondary Settings groups in a responsive two-column grid. Mobile remains one column.

**Tech Stack:** React/Vite, CSS media queries in `frontend/src/index.css`, Playwright layout regression and route evidence.

---

## Context

Live route evidence on `2bd6419` shows `/settings` rendered as a narrow single column on desktop, with large unused space to the right. The page is not broken, but it reads longer than necessary and contributes to the "full pages" feeling because desktop width does not reduce vertical work.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/components/Layout.tsx` | Treat Settings as an operational route so desktop can use the wider page shell. |
| Modify | `frontend/src/pages/Settings.tsx` | Wrap primary and secondary Settings sections in desktop-aware layout containers. |
| Modify | `frontend/src/index.css` | Add desktop-only Settings grids; keep mobile one-column defaults. |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Add regression proving status/profile are side by side on desktop and mobile remains stacked. |
| Modify | `docs/decisions.md` | Record the desktop layout rule for Settings. |
| Create | `docs/qa/2026-05-14-settings-desktop-layout.md` | Capture TDD and browser evidence. |

## Tasks

- [x] **Task 1: Red test**
  - Add a desktop Settings regression that asserts `settings-diagnostics-matrix` and `settings-section-profile` start in the same vertical band but separate columns.
  - Add a mobile guard that asserts Settings remains stacked.
  - Run the focused test and verify the desktop assertion fails on the current one-column layout.

- [x] **Task 2: Minimal implementation**
  - Add `settings-layout`, `settings-primary-grid` and `settings-secondary-grid` wrappers in `Settings.tsx`.
  - Include `/settings` in the wide operational route shell.
  - Add CSS media queries so the primary/secondary grids become two columns only at desktop width.
  - Preserve existing section IDs, query-param scrolling and all buttons/actions.

- [x] **Task 3: Verification and evidence**
  - Run the focused Settings tests.
  - Run `npm run build`, `git diff --check` and route evidence.
  - Inspect desktop and mobile Settings screenshots before PR.

## Acceptance

- Desktop Settings shows the readiness/status card and profile section side by side.
- Mobile Settings stays one column with the status card above the profile section.
- Existing Settings section anchors and URL-backed state still work.
- No horizontal overflow in route evidence.
