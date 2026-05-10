# Home Heute Orientation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the primary daily entry point read as `Heute` while preserving the stable `/` route, numeric hotkey and existing deep links.

**Status 2026-05-10:** Implemented on `codex/home-heute-orientation`. Verification: desktop navigation/hotkey smoke tests, frontend build and route evidence.

**Architecture:** Rename only the visible navigation label for the root route. Do not change route paths, auth flow, hotkeys, data contracts or the top-level route count.

**Tech Stack:** React Router navigation, existing Playwright smoke and route-evidence tests.

---

## Evidence

- The canonical roadmap allows new naming and navigation changes when they make recurring flows clearer.
- The Home route is now a daily command surface after the UX Task Contract slice; `Heute` better describes the job than the generic English label `Home`.
- Keeping `/` avoids breaking push targets, browser bookmarks, PWA launch behavior and existing tests that navigate to the root.

## Tasks

### Task 1: Lock Navigation Label Behavior

- [x] **Step 1: Update smoke expectations**

Change `frontend/e2e/pulse-smoke.spec.ts` so the primary navigation expects `Heute` for `a[href="/"]`, while route path `/` and hotkey order stay unchanged.

- [x] **Step 2: Verify the test fails before implementation**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium --grep "primary navigation exposes only Heute|primary navigation reaches"
```

Expected before implementation: the label assertion fails with `Home1`.

### Task 2: Rename The Root Navigation Label

- [x] **Step 1: Update `NAV_ITEMS`**

In `frontend/src/components/Layout.tsx`, change only the root item:

```ts
{ to: '/', label: 'Heute', mobileLabel: 'Heute', key: '1', end: true }
```

- [x] **Step 2: Verify navigation and hotkeys**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium --grep "primary navigation exposes only Heute|primary navigation reaches|top-level hotkeys"
```

Expected: all tests pass, `/` still opens the same route and `1` still focuses the daily entry.

### Task 3: Close Evidence And Docs

- [x] **Step 1: Run final checks**

```bash
npm run build -w frontend
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/home-heute-orientation npm run qa:ux-evidence
```

- [x] **Step 2: Update roadmap context**

Record the decision in `docs/decisions.md`, update `docs/ai/current-focus.md`, and keep this plan under `completed/`.
