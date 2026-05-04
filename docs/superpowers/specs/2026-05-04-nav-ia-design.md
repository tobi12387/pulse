# Pulse Navigation IA Design

Date: 2026-05-04
Status: review-ready spec
Decision owner: Tobi + Codex

## Problem

Pulse currently has six primary destinations: Home, Coach, Data, Plan, Insights and Settings. The current route evidence does not show broken responsive layout, but the app still feels heavier than it needs to feel in daily iPhone/PWA and desktop use. The friction is information architecture, not a missing screen polish pass.

Coach and Insights are the two weakest top-level tabs:

- Coach is an interaction mode. It is useful when asking a question, recording a check-in or reviewing conversation context, but it does not need to be a separate place every day.
- Insights is an evidence mode. Its domains overlap with Data, and its evidence links already point back into Data, Plan and activities.
- Home and Plan already carry Coach entry points, which makes a separate Coach tab feel like a second path into the same daily loop.
- Data already has internal tabs for coverage, sleep, metrics, weight and mental signals, which makes it the natural home for analysis.

## Evidence

Fresh route evidence was regenerated before writing this spec:

- Command: `npm run qa:ux-evidence`
- Initial sandbox result: failed because Vite could not bind to `127.0.0.1:5173` inside the sandbox.
- Rerun outside the sandbox: passed.
- Output: `test-results/route-evidence/2026-05-04-21eef77/`
- Viewports:
  - Desktop Chromium: `1280x720`
  - Mobile Chromium: `412x839`
- Routes captured: `/`, `/coach`, `/data`, `/plan`, `/insights`, `/settings`
- Manifest result: no horizontal overflow on any captured route.

Relevant code shape:

- `frontend/src/components/Layout.tsx` defines six top-level nav items and maps all six into the mobile bottom nav.
- `frontend/src/pages/Data.tsx` already uses internal URL-backed tabs for Data subdomains.
- `frontend/src/pages/Insights.tsx` is made of analysis domains (`overall`, `sleep`, `hrv`, `load`, `weight`, `mental`) and evidence cards, which fit the Data mental/recovery model.
- `frontend/src/pages/Coach.tsx` owns chat, voice check-in, guided prompts, history and daily context. These should become callable surfaces, not a primary destination.
- `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md` says "one daily loop beats more dashboards", which supports collapsing modes into the route where the user is already making the decision.

Visual companion used during design:

- Option comparison: `.superpowers/brainstorm/62839-1777918846/content/nav-models.html`
- Approved target detail: `.superpowers/brainstorm/62839-1777918846/content/nav-model-a-detail.html`

## Target IA

The target model is four top-level tabs:

1. Home
2. Data
3. Plan
4. Settings

Coach and Insights do not disappear as capabilities. They move into the routes where they reduce friction:

- Home owns the daily loop and gets the primary compact Coach composer.
- Data owns evidence and gets an `Analysen` section for the current Insights domains.
- Plan keeps training decisions and gets contextual Coach prompts where a planning question naturally starts.
- Settings keeps diagnostics, integrations, profile, preferences and Coach preferences.

No new top-level tabs should be added for this wave. Adding a replacement tab would preserve the same daily navigation weight under a new label.

## Staged Implementation Plan

### PR 1: Move Insights Into Data

This is the active implementation PR.

Scope:

- Add a Data tab or section named `Analysen`.
- Move the reusable Insights content under Data without changing backend contracts.
- Remove `Insights` from the primary nav.
- Preserve `/insights` as a redirect to `/data?tab=analysen` so existing links and stale browser sessions recover cleanly.
- Re-map hotkeys so the remaining top-level nav stays contiguous.

Expected nav after PR 1:

1. Home
2. Coach
3. Data
4. Plan
5. Settings

Why first:

- It removes one top-level tab immediately.
- It is lower risk than moving Coach because Insights is mostly read-only analysis.
- It proves the "capability inside route" pattern before touching voice, input state or conversation history.

### PR 2: Move Coach Into Daily Surfaces

Scope:

- Introduce a compact Coach composer that can be embedded on Home and Plan.
- Keep voice check-in available from Home as the primary daily check-in action.
- Keep Coach history available as a panel, sheet or focused subview instead of a top-level route.
- Move route-specific prompts into the route where they are useful:
  - Home: "Was soll ich heute tun?"
  - Plan: training adjustment and availability questions.
  - Data/Mental: reflection and signal interpretation questions.
- Preserve `/coach` as a redirect or compatibility route until the new surfaces have full QA coverage.

Expected nav after PR 2:

1. Home
2. Data
3. Plan
4. Settings

### PR 3: Remove Compatibility Weight

Scope:

- Review old redirects, labels, hotkeys and tests after at least one normal usage cycle.
- Remove stale copy that still describes Coach or Insights as separate places.
- Update QA docs and route evidence to treat Home/Data/Plan/Settings as the primary route set.

This PR should only happen after PR 1 and PR 2 have been used enough to catch awkward daily flow regressions.

## UX Rules

- Home is the only complete daily-decision source.
- Data is the only evidence and trend source.
- Plan is the only training-plan editing source.
- Settings is the only diagnostics and preference source.
- Coach is a callable action layer, not a place.
- Insights is an analysis layer inside Data, not a place.
- Existing deep links should recover through redirects during the transition.
- Mobile bottom nav labels must remain short enough for iPhone/PWA use.

## Habit/Routine Scope Boundary

Habit Tracker is not listed in this IA spec's Non-Goals because this spec only decides the navigation model for Coach and Insights. That does not reverse Pulse's broader non-negotiable against a Habit Tracker. A separate explicit decision would be required before any habit or routine implementation work.

Boundary assessment:

- It does not justify a new top-level tab. A separate Habits/Routine tab would work against the target of making daily iPhone/PWA use less bulky.
- If Tobi later explicitly reverses the no-Habit-Tracker constraint, Home should own the daily action surface and Data should own trend/evidence review.
- Coach could support reflection through prompts or check-in extraction, but should still be a callable layer rather than a separate place.
- Any future reversal would need its own evidence, product boundary and QA plan before it becomes implementation scope.
- The staged order still stands: Insights into Data first, Coach into daily surfaces second, compatibility cleanup third.

## QA Requirements

Each implementation PR must include:

- `npm run build -w frontend`
- focused Playwright coverage for changed navigation, redirects and route tabs
- `npm run qa:ux-evidence`
- desktop Chromium route screenshots
- mobile Chromium route screenshots
- manifest check for horizontal overflow
- manual review of iPhone-sized bottom nav density

PR 1 should specifically verify:

- `/data?tab=analysen` renders the migrated analysis surface.
- `/insights` redirects to the Data analysis tab.
- mobile nav no longer shows `Insights`.
- Data tab selection survives reload through the query string.

PR 2 should specifically verify:

- Home exposes the primary Coach composer without burying the daily decision.
- Plan exposes contextual Coach prompts without replacing plan actions.
- voice check-in still invalidates the same Pulse context queries.
- Coach history remains reachable without a top-level tab.
- `/coach` does not become a dead end.

## Non-Goals

- No new top-level tab for "Assistant", "Analyse", "Routine" or similar labels.
- No Telegram or new notification channel.
- No backend LLM-provider changes.
- No migration or schema work.
- No native iOS work.

## Spec Self-Review

- Placeholder scan: no unresolved placeholder markers remain.
- Consistency check: the target IA, habit/routine boundary assessment, staged plan and QA expectations all use the same final four-tab model.
- Scope check: this spec is intentionally broader than one implementation PR, but each staged PR is narrow enough to implement and review separately.
- Ambiguity check: Coach and Insights are kept as capabilities, while top-level navigation ownership moves to Home/Data/Plan/Settings.
