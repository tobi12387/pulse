# Everyday Adaptation Inbox v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan exposes one calm everyday-adaptation entry point for "less time", "not ready", "done differently" and "skip" decisions, routing each to an explicit preview or feedback flow without hidden Plan or Garmin writes.

**Architecture:** Reuse the existing Plan scenario preview and activity feedback surfaces. Add a small frontend-only card, extend Plan's quick scenario entry source to `everyday-adaptation`, and cover the no-write preview path in Playwright.

**Tech Stack:** React 19, TypeScript, Vite, Playwright, existing Pulse Plan scenario preview API.

---

## Tasks

- [x] Create `frontend/src/features/plan/EverydayAdaptationInboxCard.tsx` with four explicit intent rows: less time, not ready, done differently and skip today.
- [x] Render the card in `frontend/src/pages/Plan.tsx` near the existing Plan Change Inbox.
- [x] Extend `PlanScenarioPreviewCard` so `entrySource === 'everyday-adaptation'` is treated as a quick preview source.
- [x] Add a Playwright smoke test proving the card opens scenario preview, shows the everyday-adaptation context and does not call plan-workout mutation endpoints before Apply.
- [x] Record the product decision in `docs/decisions.md` and update `docs/ai/current-focus.md`.
- [x] Verify with `npm run build -w frontend`, focused smoke, `git diff --check` and stale-marker scan.
