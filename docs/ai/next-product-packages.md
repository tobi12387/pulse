# Pulse Performance-OS Backlog

Purpose: keep autonomous work pointed at the 2026 Performance Operating System goal without re-deriving the next slice from shipped PR history.

Use this file after `docs/ai/current-focus.md`. This file is the hard ordering for product work unless Tobi explicitly reverses it.

## Build Rules

- Prefer weekly, package-shaped PRs over isolated micro-slices. A package PR should usually contain 3-5 tightly related changes that share one user-facing outcome and one verification surface.
- A micro-slice is allowed for urgent bugs, regressions, CI/deploy repair, docs-only workflow updates, or when a package would cross unrelated ownership boundaries.
- Every product PR must name one backlog track: `Tagesentscheidung`, `Trainingsanpassung` or `Lernschleifen`.
- Work outside those tracks is deferred unless Tobi explicitly reprioritizes it.
- Keep Home as the daily translator, Plan as the adaptation/execution surface, Data as the evidence workbench and Settings as readiness/diagnostics unless fresh route evidence proves a clearer navigation.
- Do not add hidden Plan, Garmin, Coach, notification or LLM writes. Action contracts must preview what changes after a click.

## Verification Rules

- For `frontend/src/pulse/daily-decision.ts`, add or extend fast unit/golden scenario tests before Playwright. Cover signal priority, CTA label/target, safest option and goal impact.
- Use `npm run verify:<track>:fast` for the first implementation loop, `npm run verify:<track>:pr` before Fast Lane PRs, and the full `npm run verify:<track>` gate for Full Lane, high-risk UI changes or slices where local rendered proof is the point.
- Use Playwright for 1-2 package-level UI smokes that prove rendered route behavior, responsive safety or click-path handoff; for normal Fast Lane PRs this rendered proof may be left to CI `browser-tests` after the local `:pr` gate is green.
- If a package touches several Home decision signals, move toward a data-driven signal registry/priority table instead of adding more one-off branches.
- PR bodies should name the track, package outcome, local checks, CI state and whether deploy is required.

## Automerge Rule

- When manifest-selected local `:pr` checks are green and CI has no special review risk, prefer GitHub auto-merge instead of blocking the session on active waiting.
- Inspect and fix failed checks.
- Runtime changes still deploy only after the PR is merged to `main`.
- Docs-only and planning-only PRs normally do not require server deploy.

## Current Product State

The first two passes through all three Performance-OS tracks are shipped, and the later Home/Plan/Data quiet-continuity packages are also shipped. Keep detailed shipped history out of this session-start document:

- Use completed plans, GitHub PRs and `docs/decisions.md` for historical detail.
- Use `docs/qa/` records for route evidence, UI before/after notes and gate refreshes.
- Use this file only to decide whether a new product package is currently allowed.

Shipped track baselines:

- **Tagesentscheidung:** Home/Heute can already combine readiness, load, recovery, mental boundary, weekly availability/alltag, data trust, Garmin execution, goal progress, adaptation, response, fueling, analysis, feedback, receipt trust and continuity into one daily action, safe option, explanation and routed CTA. On free days outside weekly availability, Today Options protects the day instead of offering quick training intents.
- **Trainingsanpassung:** Plan can already show a shared weekly decision contract, preview-only accept/adapt/defer controls, Home/Data handoffs, local weekly receipts, learning calibration, tradeoff/source-trend continuity, receipt trust and quiet goal-progress confidence without hidden Plan/Garmin writes.
- **Lernschleifen:** Data can already classify evidence as Home action, Plan decision, watch context or evidence gap; show Data action contracts, training-risk contracts, learning calibration, tradeoff/source-trend confidence, receipt trust, renewal checks and motivating goal-progress evidence.
- **UI/UX:** Route-wide top-app shell, command surfaces, mobile chrome, compact Plan/Activity/Data follow-ups and desktop focus surface are shipped with current route evidence showing 0 horizontal overflow through 2026-06-03.

## Current Package Order

No ungated product package is currently queued after the Today Options availability bridge. The remaining named roadmap themes are still manual gates, not implementation cards:

1. **Fueling/Nutrition trend summaries** remain gated until at least three comparable complete `during` logs exist with activity/duration context, carbs and structured GI comfort.
2. **iPhone/PWA field reliability** remains gated until current-commit real-device iPhone/VPN/PWA evidence shows a recurring reliability gap or a required pass/fail gap.

Until one of those gates opens, a new route/user-friction report appears, or Tobi explicitly reprioritizes, autonomous work should stay limited to evidence capture, docs/tooling support, CI/deploy repair, or a fresh route-evidence pass that proves a concrete regression.

## Manual Gate Handoff

- Refresh all current blockers with `npm run audit:performance-session -- --today <YYYY-MM-DD> --all` for the compact ordered session card.
- Use `npm run audit:performance-gates -- --today <YYYY-MM-DD>` for the full gate audit and JSON metadata.
- Use `npm run audit:performance-checklist -- --today <YYYY-MM-DD>` for a shorter checkbox handoff.
- From feature branches, handoff modes auto-defer server verification while planning; rerun the normal audit from clean `main` before deploy-sensitive or current iPhone field claims.
- Add `--expected-commit <short>` only when intentionally pinning a known deployed/runtime commit for a manual field run.

Current first unblock:

- Fueling is first. The audit names the first target URL, allowed GI choices and directly completable logs.
- GI comfort must come from the real stomach response. Do not infer it from notes, route, RPE, g/h, result, pace or how the workout looks afterward.
- Use the Activity Fueling UI for normal evidence capture; do not edit database rows directly.
- After existing candidates, one new complete long-session log is still needed with activity/duration context, during carbs and structured GI comfort.

Current second unblock:

- iPhone/PWA follows Fueling unless Tobi explicitly runs the field session in parallel.
- Open Settings first from the printed `/settings?section=device` URL.
- Record Device, iOS version, launch mode, server commit under test and observed Settings `App-Stand` as app runtime commit under test.
- Append the real-device field run to `docs/qa/2026-05-02-iphone-pwa-real-device.md`.
- Simulated WebKit/Chromium evidence does not close the real iPhone/VPN/PWA field gate.

## Gate-Open Package Seeds - Do Not Implement While Gated

These seeds keep the next package shape ready after manual evidence lands. They are not current product cards and do not override the gate above.

### 1. Nutrition trend summaries (`Lernschleifen`)

Gate: `npm run audit:fueling-gate -- --today <YYYY-MM-DD>` reports at least 3/3 comparable complete `during` logs with activity/duration context, carbs and structured GI comfort.

Outcome: Data turns repeated long-session Fueling evidence into a conservative learning summary, while Home and Plan use it only when the existing learning calibration makes it relevant to today's action or an explicit weekly decision.

First package shape:

- Build a conservative Fueling trend classifier from complete long-session `during` logs: activity/duration context, carb range and GI response are usable; sodium, heat and sweat-rate stay gaps unless measured.
- Show the trend first in Data as learning evidence with compact evidence/gap rows.
- Keep Home and Plan quiet unless shared learning calibration classifies the signal as `today_action` or true weekly decision input.
- Cover stable trend, learning trend, GI issue trend and measured-only hydration gaps with fast contract tests before rendered smokes.
- Verify with `npm run verify:lernschleifen:pr` and add one focused Data/Fueling rendered smoke only if the package changes rendered behavior.

### 2. iPhone/PWA field reliability

Gate: current-commit real-device evidence in `docs/qa/2026-05-02-iphone-pwa-real-device.md` shows recurring iPhone/VPN/PWA friction or a required pass/fail gap after `npm run audit:iphone-pwa-gate -- --expected-commit <commit>`.

Outcome: Pulse fixes the observed iPhone/PWA reliability gap while preserving the local web/PWA-over-VPN model; native/wrapper planning remains evidence-gated.

First package shape:

- Start from the latest real-device `## Scope` / `## Results` record, not simulated WebKit or Chromium evidence.
- Patch only the observed PWA, certificate, offline, Push or Settings diagnostics gap.
- Do not introduce native/wrapper scope unless the field record proves unresolved recurring PWA/VPN failure.
- Verify with the relevant WebKit/PWA tests plus focused route/screenshot evidence, then leave the real iPhone rerun as the final manual proof.

## Supporting Build-Speed Work

These improvements are mandatory support for the three tracks, not a fourth product track:

- `npm run delivery:manifest` prints the compact PR/package manifest and changed-files-to-track-gate map.
- `Fast Lane` applies to one-track frontend/docs/support changes without backend, shared-contract, dependency, migration, workflow, deploy or LLM risk. Full Lane PRs keep explicit CI/review attention.
- Start known packages with `npm run delivery:intake -- --track <track> --outcome "..."`.
- Use contract-only gates while implementing: `npm run verify:tagesentscheidung:fast`, `npm run verify:trainingsanpassung:fast` and `npm run verify:lernschleifen:fast`.
- Run the manifest-selected `verify:<track>:pr` gate before Fast Lane PRs and the full `verify:<track>` gate for Full Lane or high-risk local UI proof.
- Covered track contract-test files do not add the full `npm run test:scripts` suite to Fast Lane manifests; uncovered script/tooling changes still do.
- Script-only support changes run through the CI `build` job and script guards, not the heavier backend service test job.
- Keep `docs/ai/current-focus.md` below roughly 80 short lines and link detailed status to this file, the canonical roadmap and decisions.
- Extract Daily Decision contract fixtures from Playwright into fast unit/golden tests when new packages need them.
- Introduce data-driven signal registry/priority tables when package work touches multiple signal contracts.
- Prefer package PRs with 3-5 related changes over repeated one-signal PRs when the evidence surface is shared.

## Evidence Gates

- Nutrition trend summaries stay gated until at least three comparable complete `during` logs exist with carbs, duration/activity context and GI comfort.
- Sodium, heat and sweat-rate claims remain explicit evidence gaps until measured.
- Real Garmin calendar/workout writes are only run for explicit sync repair/testing.
- Push activation and iPhone certificate trust remain manual per browser/device.
- Native iOS remains a future decision only after repeated real iPhone/PWA friction is recorded.
