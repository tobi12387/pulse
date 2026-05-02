# Daily Loop Route Priority UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. If splitting work, keep Home/Coach/Plan files separate between workers to avoid conflicts.

**Goal:** Make Home, Coach and Plan feel like one coherent daily loop: today's state, the next meaningful action, the reason behind it and the user's override/closure path.

**Architecture:** Preserve the existing route model, but add URL-backed sub-state and route-specific priority. Home owns the daily decision overview, Coach owns guided reflection/action support, and Plan owns training choice/rationale. Shared components should expose variants instead of duplicating daily decision UI.

**Tech Stack:** React/Vite, TanStack Query, existing Pulse actions/closure APIs, Playwright route journey tests.

---

## Context

The audit found that Plan can repeat the Home day-off decision before showing the next training decision, while Coach can lose the guided daily context once chat history exists. The E2E suite covers many pieces independently but not one continuous morning flow.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/pages/Home.tsx` | Keep the daily decision as the main overview and ensure outbound actions preserve context |
| Modify | `frontend/src/pages/Coach.tsx` | Add persistent daily context/guided panel above chat history |
| Modify | `frontend/src/pages/Plan.tsx` | Prioritize the next training decision and make rest-day rationale compact when it duplicates Home |
| Modify | `frontend/src/components/DailyDecisionCard.tsx` | Add route-aware variants if needed |
| Modify | `frontend/src/components/AdjustTodayCard.tsx` | Connect dismiss/keep decisions to durable action state |
| Modify | `frontend/src/pages/Data.tsx` | Make tab state URL-backed for evidence links |
| Modify | `frontend/src/pages/Settings.tsx` | Make section state URL-backed for support links |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Add continuous Home -> Coach -> Plan -> evidence scenario |

## Task 1: Add A Continuous Daily Journey Test

- [ ] Create an E2E scenario that starts at Home, opens Coach with today's context, submits or selects a guided question, moves to Plan for the next training decision, then follows an evidence link to Data or Insights.
- [ ] Assert no prompt is auto-sent before user intent.
- [ ] Assert returning to Home/Plan preserves the visible outcome or decision state.

## Task 2: Make Tabs And Sections Addressable

- [ ] Add URL-backed tab state for `/data?tab=coverage|sleep|metrics|weight|mental`.
- [ ] Add URL-backed tab state for `/plan?tab=training|goals|review|stats`.
- [ ] Add URL-backed Settings sections such as `/settings?section=device|push|garmin|profile|coach|health|equipment`.
- [ ] Preserve existing defaults when no query parameter is present.
- [ ] Use these links from Coach/Home/Insights instead of top-level-only route links where possible.

## Task 3: Keep Coach Daily Guidance Persistent

- [ ] Move the daily briefing/guided question panel out of the empty state.
- [ ] Keep it compact when chat history exists.
- [ ] Include today's date, training availability, recovery/mental cue and one primary guided question.
- [ ] Make mental fitness prompts visible without implying clinical diagnosis.

## Task 4: Reprioritize Plan First Viewport

- [ ] On days without training, show the rest-day rationale compactly and bring the next meaningful training decision into the first viewport.
- [ ] Make it clear when Pulse intentionally does not use every available day.
- [ ] Show the Garmin/mental/goal signals that explain why the next session is placed, moved, shortened or skipped.
- [ ] Keep override/alternative actions close to the decision.

## Task 5: Make Today's Adjustment Durable

- [ ] Audit `AdjustTodayCard` and the existing action closure model.
- [ ] Connect `Beibehalten`/dismiss behavior to durable state for the current day.
- [ ] Ensure refetches do not resurrect a dismissed proposal unless underlying data changes materially.

## Verification

- [ ] `npm run typecheck`
- [ ] `npm run test:e2e -- --grep "Daily|Coach|Plan|Data|Settings"`
- [ ] Manual iPhone screenshot pass for Home, Coach and Plan first viewports

## Acceptance

- A user can understand "what should I do today and why?" without jumping between disconnected route states.
- Coach still shows today's guided support even with existing chat history.
- Plan's first viewport prioritizes the next useful training decision, not duplicated route context.
- Evidence/support links can land on the relevant tab or section.
