# UX Evidence Toolchain Refresh Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use pulse-frontend-qa for route evidence. Use Figma skills only before Figma writes, and use Canva skills only when updating the Canva companion artifact is explicitly part of the slice.

**Goal:** Keep Pulse UI/UX decisions tied to current screenshots, browser evidence and design companion artifacts instead of stale historical handoff material.

**Architecture:** Treat repo markdown as the source of truth for decisions and acceptance, with Canva/Figma as visual companions. Browser screenshots and Playwright/WebKit checks provide evidence; companion boards organize review, but do not override code or repo plans.

**Tech Stack:** Playwright, optional WebKit project (`PULSE_E2E_WEBKIT=true`), Canva board, Figma/FigJam board, GitHub PR workflow.

---

## Context

The previous Canva/Figma refresh established a useful toolchain, but the Canva board is recorded as stale/unsaved and the app has changed since the last major route screenshot pass. The current audit generated fresh local screenshots under `/private/tmp/pulse-ux-audit/`, but these are session artifacts, not durable design evidence.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `docs/qa/2026-05-02-ux-companion-refresh.md` | Record current Canva/Figma status and what was refreshed |
| Modify/Add | `docs/qa/*ui-ux*` | Keep route audit summaries and screenshot references |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Add route evidence checks if screenshots reveal gaps |
| Modify | `playwright.config.ts` | Adjust WebKit/PWA project only if deterministic and maintainable |
| External | Canva `Pulse Everyday Flow UX Board` | Current route screenshots, findings, review notes |
| External | Figma/FigJam `Pulse UX Toolchain Loop` | Flow map, component state inventory, design-system decisions |

## Task 1: Create A Repeatable Screenshot Pack

- [ ] Add or document a command that captures desktop and iPhone screenshots for the six core routes.
- [ ] Store durable references or metadata in markdown without committing large image files unless the repo explicitly chooses that policy.
- [ ] Include viewport, URL, commit SHA and date in the evidence record.

## Task 2: Refresh Canva Route Review

- [ ] Use the latest route screenshots as the Canva review basis.
- [ ] Organize the board by route and priority: P1 mobile/touch, P1 daily flow, P1 recovery states, P2 diagnostics, P2 design evidence.
- [ ] Save only after preview approval if the Canva tool requires a destructive or non-preview update.
- [ ] Record Canva design link and status in `docs/qa/2026-05-02-ux-companion-refresh.md`.

## Task 3: Refresh Figma/FigJam Flow And Component States

- [ ] Update the daily loop map: Home -> Coach -> Plan -> Data/Insights -> Settings support.
- [ ] Add component states for daily context panel, next training decision, Settings diagnostics matrix and inline mutation recovery.
- [ ] Keep implementation decisions in `docs/decisions.md`; Figma is the visual companion, not the legal source of truth.

## Task 4: Add A WebKit/PWA Regression Slice

- [ ] Evaluate enabling the existing WebKit project in a bounded CI/manual command rather than every default local run.
- [ ] Add checks for route load, standalone/PWA diagnostics, Settings push states and offline fallback if deterministic.
- [ ] Keep real-device-only gates in the manual iPhone QA record.

## Verification

- [ ] `npm run test:e2e -- --grep "Mobile navigation|PWA|Settings"`
- [ ] Optional: `PULSE_E2E_WEBKIT=true npm run test:e2e -- --project="iPhone WebKit"` if the environment supports WebKit.
- [ ] Updated QA record links to current Canva/Figma status.

## Acceptance

- Route evidence can be regenerated without improvising a new script each session.
- Canva and Figma/FigJam reflect the current deployed app or are explicitly marked stale/blocked.
- WebKit/PWA coverage is intentionally scoped and does not make normal local runs flaky.
- Future UI/UX work starts from evidence, not memory.
