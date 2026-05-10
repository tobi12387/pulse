# Fresh Benchmark UI Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 2026-05-10 benchmark and UI review into the next ordered Pulse roadmap.

**Architecture:** This is the orchestration document. Execute the linked implementation plans in order; each plan should become its own PR unless a slice is docs-only.

**Tech Stack:** Pulse monorepo, React/Vite frontend, Fastify backend, Playwright QA, GitHub PR workflow.

---

## Evidence Inputs

- QA report: `docs/qa/2026-05-10-fresh-benchmark-ui-review.md`.
- Route evidence: `test-results/route-evidence/fresh-benchmark-ui-review/2026-05-10-c1af5b9/`.
- Existing product direction: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`.
- Completed benchmark foundations: `docs/superpowers/plans/2026-05-10-training-benchmark-upgrade-roadmap.md`.

## Roadmap Order

### Phase 1: UI Accessibility Polish v2

- Plan: `docs/superpowers/plans/2026-05-10-ui-accessibility-polish-v2.md`.
- Why first: fixes route-evidence artifacts, focus, hash clipping, tablet targets and stale 155-km QA leakage before larger UI changes.
- PR size: small frontend/QA PR.
- Exit criteria:
  - `npm run qa:ux-evidence` passes.
  - Plan mobile-intent screenshot starts at scenario heading/context.
  - Generic screenshots no longer contain `155 km simuliert`.

### Phase 2: Daily Command Center v2

- Plan: `docs/superpowers/plans/2026-05-10-daily-command-center-v2.md`.
- Why second: resolves Home contradiction and makes the iPhone/PWA daily flow faster.
- PR size: one or two frontend PRs.
- Exit criteria:
  - Home has one daily truth.
  - Mental Check-in save is visible in the first mobile viewport.
  - Desktop Home uses space better without becoming another dashboard.

### Phase 3: Garmin Execution Trust v2

- Plan: `docs/superpowers/plans/2026-05-10-garmin-execution-trust-v2.md`.
- Why third: closes the largest benchmark trust gap against TrainingPeaks/JOIN/Garmin Coach.
- PR size: backend service/route PR, then frontend Plan `Ausführung` PR if needed.
- Exit criteria:
  - Plan can show remote Garmin readback/diff for future workouts.
  - Broken repeats/missing calendar/missing template states are explicit.
  - Repair actions are explicit clicks and ledger-backed.

### Phase 4: Progression Library v2

- Plan: `docs/superpowers/plans/2026-05-10-progression-library-v2.md`.
- Why fourth: once execution and daily UX are trusted, make workouts feel less repetitive and more capability-driven.
- PR size: backend logic PR plus frontend visibility PR if needed.
- Exit criteria:
  - Energy-system progression is visible.
  - Workout variants rotate safely.
  - RPE, GI/fueling and mental state affect fit and Today Options.

## Tab / IA Decision

No new top-level tab is added in this roadmap. The only recommended new tab-like surface is a nested Plan `Ausführung` area for Garmin device trust. This keeps the top-level set stable:

- Home.
- Data.
- Plan.
- Settings.

## Deferred Ideas

- Data IA compression from seven equal tabs to fewer grouped evidence areas.
- Coach deep-link cleanup so `/coach` feels like a contextual support layer, not a hidden fifth tab.
- Native iOS remains evidence-gated behind the PWA/VPN workflow.

## Verification Loop After Each Phase

Run at least:

```bash
npm run build -w frontend
npm run qa:ux-evidence
npm run test:e2e -- --project=mobile-chromium --grep "Home|Data|Plan|Settings|Mental|Garmin"
```

For backend phases, add the relevant backend service tests and `npm run check:migrations`.

