# Pulse Current Focus

Keep this file as a short snapshot, not a PR archive. If it grows past roughly 80 lines, replace old detail with links to PRs, completed plans or `docs/decisions.md`.

## Current State

- Source of truth: GitHub `main`.
- Server `/root/pulse` on `192.168.178.46` is a deploy mirror only.
- Do not rely on this file as a deploy register. Verify the exact live server commit with `scripts/verify-server.sh` when it matters.
- Do not use this file as an open-PR registry; query GitHub when PR state matters.
- Performance Operating System spec is merged and Tobi has granted autonomous follow-up execution. Daily Intelligent Action Contract v2 enriches Home's decision details with top signals, goal impact, Garmin execution state and safest option; Daily Decision Continuity v1 adds why the recommendation still holds or what changed from today's Plan-vs-Garmin delta. Daily Fueling Signal v1 lets open Today-Options Fueling/GI debt influence Home's decision contract without unlocking trend summaries. Daily Goal Pressure Signal v1 lets the existing Goal Projection add top-goal probability/evidence status and next intervention to Home's decision details. Daily Mental Boundary v1 lets a saved non-stable Mental Check-in add the day's protective/sensitive boundary to Home's decision contract. Daily Data Confidence v1 lets non-ready Garmin/profile data add a `Daten` trust signal to Home's decision contract. Daily Signal Saturation/Priority/Leading-Factor Guard v1 prevents the optional decision details from hard-capping active data, fueling, mental, goal and training signals, orders them by decision relevance before baseline values, names the first factor as `Heute entscheidet` and surfaces both that factor and `Sicherste Option` on the main Daily Decision before expansion. Everyday Adaptation Inbox v1 gives Plan one no-write entry point for less time, not-ready, done-differently and skip decisions. Analysis Translation v1 makes Data > Analyse name the currently actionable deep signal and the interesting-but-not-actionable evidence gap. Performance OS Route Evidence Pass on `775c46a` found no immediate first-viewport restructuring need; Nutrition Learning Readiness v1 keeps trend summaries gated but makes the evidence count and missing structured fields visible.
- Web Push VAPID is configured on the server; Push activation remains per browser/device.
- UI/UX Foundation Flow, Nav/Mental/Garmin trust slice, Home Daily Decision Closure, Mental Signal Impact, Garmin Sync Confidence, Mobile Touch Targets, Mobile A11y Keyboard and Data Decision Evidence Trail are deployed through PR #188.

## Active Direction

- Product north star: Pulse is a personal resilience and performance coach that connects physical training, nutrition, recovery and mental wellbeing. It should support earlier awareness of overload, low-mood patterns and routine breakdowns, while staying safety-bounded: no clinical diagnosis, no hidden sensitive labels and no alarmist wording.
- Use `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md` as the canonical product roadmap. It now includes the 2026-05-10 UI/UX benchmark translation, UX Task Contract, navigation-as-product-tool rule and short/medium/long roadmap order.
- Future UI/UX work should first regenerate evidence via `docs/qa/route-evidence-pack.md`; the 2026-05-02 deep-friction roadmap is completed history.
- Focus navigation baseline is Heute (`/`), Data, Plan, Insights and Settings. Coach is not a primary tab; keep `/coach` as a compatibility/deep-link route and prefer `⌘K`/prepared prompts for Coach entry. Future tabs, areas or modes remain allowed when they make a recurring flow clearer or calmer; validate with route evidence before changing primary navigation.
- Mental Check-in Simplification and Mental Signal Impact: Home can complete the compact daily check-in; Data, Home, Plan and Coach now use one shared impact language. Next mental work should focus on evidence quality, not another input rebuild.
- Trust-closure wave is deployed through Data Decision Evidence Trail: Home/Plan evidence deep-links into Data instead of becoming another dashboard.
- Completed implementation plans, including the 2026-05-05 Mobile/A11y and Data Evidence Trail slices, live in `docs/superpowers/plans/completed/`; do not rebuild them.
- Broad structure work needs a fresh `rg --files` / file-count audit first; the 2026-05-02 structure audit and boundary plan are completed history.
- Next autonomous UI/UX work should start from fresh route evidence and only implement observed friction; Mobile Field Reliability remains primarily a real-iPhone evidence gate.
- Fueling & Recovery preference capture, the pure backend guidance engine, read-only Plan modal guidance, Garmin workout-description handoff, generic portion equivalents, confirmed MNSTRY product calibration and practical Activity Fueling Logs are implemented: no dietary restrictions, `POWER CARB Sour Cherry 1:0.8` is the primary during anchor, Tobi-specific MNSTRY guidance uses 750 ml bottles plus approximate powder grams, `PORRIDGE BAR Sour Cherry` and `PROTEIN BAR 8 Peanut & Cranberry` support pre/post guidance, and `BICARB GEL 40 Lemon 1:0.8` stays race-/intensity-specific. Fueling logs now capture 750-ml bottles, powder grams, selected products/snacks and GI comfort.
- Training-plan intelligence now has the benchmark foundations: capability levels, workout library/archetype fit, TrainNow options, scenario preview/apply, season load modeling, Garmin sync contracts, execution ledger/readback, goal limiter evidence, Plan Refresh Preview, Today Options signal labels, Fueling Debt Closure, Limiter-To-Workout Mapping and no-Garmin-write QA. Do not rebuild these completed plans.
- Data IA Compression v1 has compressed Data into four evidence-oriented areas (`Heute relevant`, `Trends`, `Datenqualität`, `Analyse`) while legacy Data query/hash links remain compatible.
- Settings Status First v1 is implemented: `/settings` now answers `Alles bereit` or `Problem beheben` before showing technical diagnostics.
- Settings Push Status Polish is implemented: blocked or inactive Push remains visible as an optional device action, but no longer makes Settings report a core `Problem beheben` state when access, Service Worker and Garmin are ready.
- Workout Alternatives UX v2 is implemented: full Plan alternatives now explain purpose, why-now, click result and safest choice; scenario previews distinguish preview-loading from apply-running.
- Personal Response Model v1 is implemented: `GET /api/pulse/personal-response` returns deterministic read-only response evidence, and Data > Analyse shows it as a compact evidence block without hidden plan/Garmin/LLM writes.
- Predictive Goal Engine v1 is implemented: `GET /api/pulse/goal-projection` returns deterministic read-only goal probability, limiter risk and next-intervention evidence, and Data > Analyse shows it as a compact evidence block without hidden plan/Garmin/LLM writes.
- Adaptive Season Builder v1 is implemented: Plan > Ziele now shows a read-only `Saisonvertrag` that combines Season Strategy and Goal Projection evidence without hidden plan/Garmin writes. Plan > Training stays focused on week, execution, changes and the plan list.
- Contextual Coach Mode v1 is implemented: `/coach` now shows a read-only Coach context card from Personal Response, Goal Projection and Season Strategy evidence and only prepares a prompt after an explicit click.
- Customizable Daily Surface v1 is implemented: `/` now lets Tobi choose a local per-device focus-card order (`Standard`, `Training`, `Mental`, `Rueckblick`) while keeping the main daily decision, warnings and Garmin-sensitive controls fixed.
- Focus Shell + Heute Slice introduces tokens, global shell, top-level Insights, `⌘K` Coach entry and Home as `Single Decision + Diary`; see `docs/qa/2026-05-11-focus-shell-today.md` for route evidence.
- Desktop Plan Daily Focus is implemented: `/plan` now leads with the current action and week strip before compact season evidence; see `docs/qa/2026-05-11-desktop-plan-daily-focus.md`.
- Insights Synthesis Focus is implemented: `/insights` now starts with a synthesis layer and defers deep domain analysis; `Data > Analyse` remains the evidence workbench.
- Data Daily Action Focus is implemented: `/data` now starts with one daily data action and keeps triage/secondary evidence behind `Weitere Datenbereiche anzeigen`; see `docs/qa/2026-05-11-data-daily-action-focus.md`.
- Data Backfill Touch Polish is implemented: `Vorschau` and `Nachladen` in Data > Datenqualität meet the 44px mobile/PWA touch-target baseline.
- Fresh 2026-05-12 benchmark ordering is captured in the canonical roadmap. Plan Change Inbox v1, Today Change Flow v1 and Workout Progression Clarity v3 are merged/deployed.
- Garmin Execution Chain UI is implemented/deployed: `/plan?tab=execution` shows template, calendar, readback, repeats and execution as one compact chain plus one next action, without automatic Garmin writes on load.
- Weekly Coach Review is implemented in the current roadmap slice: `/plan?tab=review` starts with what Pulse learned, which plan change needs attention and the next explicit decision action, reusing existing evidence without automatic LLM, plan or Garmin writes.
- Recovery & Mental Resilience is implemented in the current roadmap slice: Data > Mental shows a compact boundary-guidance card after a real check-in, translating recovery/readiness/load/mental evidence into `Grenze`, `Planwirkung` and `Signalqualität` without clinical labels or hidden writes. Without a scored check-in, the Check-in remains the primary mobile-first task.
- Support Activation v1 is implemented in the current resilience slice: Settings > Coach stores explicit support warning signs, stabilizing actions, support contact note and activation preference; Coach context treats them only as user-provided support preferences, with no automatic contact, no clinical labels and no hidden escalation.
- Resilience Radar v1 is implemented in the current resilience slice: Data > Mental now has a read-only multi-day radar for low-mood, energy, stress, load/recovery and routine-gap signals, and can open a user-configured support-plan Coach prompt without LLM, push/contact, plan or Garmin writes.
- UI/UX and Ops prep is prepared: next UI work should run route evidence plus `npm run qa:ux-summary -- <evidence-root>` and write a short QA intake before implementation; server verification now distinguishes timestamped recent/stale/undated log attention instead of treating old PM2 log history as fresh.
- No next broad runtime UI/UX slice is selected from current route evidence. The Home decision contract now carries continuity from today's `daily-delta`, open Fueling/GI debt from Today Options, top-goal pressure from Goal Projection, non-stable Mental Check-in boundaries and stale/partial/empty data-confidence warnings without hard-capping the optional signal list; the main Daily Decision surfaces `Heute entscheidet` and `Sicherste Option` before expansion, while optional details keep the full prioritized signal list. Nutrition Trend Summaries remain data-gated with visible `Trend-Evidenz x/3` readiness in Fueling baselines, and Mobile Field Reliability remains a real-iPhone gate.
- Nutrition Trend Summaries gate checked on 2026-05-15 live server data: 5 nutrition logs total, 4 `during`, 0 comparable complete `during` logs because structured GI comfort is missing on the long log and the shorter logs are incomplete. Keep trend summaries gated until there are at least three comparable, complete `during` logs with carbs, duration/activity context and GI comfort; sodium/heat/sweat-rate should remain explicit evidence gaps until measured.
- Route evidence on `7c087da` found no overflow and no current proof that optional Daily Delta Plan/Data echoes or additional Garmin modal copy are needed; see `docs/qa/2026-05-10-next-options-route-evidence.md`.
- Native iOS is evidence-gated; the current access model remains local web/PWA over VPN.

## Manual Gates

- iPhone certificate trust is still manual if warning-free Safari/PWA behavior is required.
- Push registration and test-push activation are manual per target browser/device.
- Real Garmin calendar/workout sync should not be triggered during generic QA unless the task explicitly requires it.
- New nutrition/fueling logic can proceed, but should stay conservative, educational and tied to workout/recovery evidence rather than medical prescription.
- Benchmark work may use public TrainerRoad/TrainingPeaks/JOIN/Intervals/WKO capability patterns, but must not copy proprietary plan or workout content.

## Recent Landmarks

- PR #154: dependency security refresh; runtime audit clean except documented dev-only tooling advisory.
- PR #155-#160: UI/UX friction closure, Settings diagnostics, route evidence and status closeout.
- PR #175: UI/UX Foundation Flow deployed; Login, Daily Flow, Data overview, Mental quick path, responsive/A11y base and Settings Garmin diagnostics are live.
- PR #176: Coach-nav regression coverage, qualitative Mental Check-in state cards, and Garmin 0-repeat repair detection are live.
- PR #178: Home Daily Decision Closure deployed; no-training days close locally on Home while Coach remains a support action.
- PR #180: Mental Signal Impact deployed; saved check-ins visibly influence Home, Plan and Coach wording through a shared frontend classifier.
- PR #182: Garmin Sync Confidence deployed; Plan rows and workout detail modal now explain local-only, Garmin-template, calendar-ready, completed, missed and replaced planned workouts without live Garmin calls.
- PR #184: Mobile Touch Targets deployed; daily-use controls in Home/Data/Plan/Coach/Settings now meet the 44px iPhone/PWA target-size baseline.
- PR #186: Mobile A11y Keyboard deployed; Data/Plan segmented controls use tab semantics and Mental radio groups support arrow-key selection.
- PR #188: Data Decision Evidence Trail deployed; Home/Plan evidence chips now deep-link to Data anchors with hash-driven tab selection and visible focus.
- PR #225-#227: Training Benchmark Gap closure deployed; season load modeling, Garmin sync contracts and goal limiter evidence now feed plan decisions, trace evidence and Garmin confidence.
- 2026-05-04: AI working context was condensed so sessions start from AGENTS plus `docs/ai/*` instead of long pasted prompts or PR archives.
- 2026-05-04: completed structure and UI/UX roadmap docs were moved out of the active plan surface to avoid reimplementation.
- PR #149-#150: ops/tooling cleanup and design handoff relocation.
- PR #136-#148: backend/frontend/shared structure extraction wave.
- Earlier feature history lives in GitHub PRs and `docs/superpowers/plans/completed/`.

## Working Notes For Agents

- Do not append every merged branch here.
- Record only durable queue changes, manual gates or next recommended work.
- If a branch-specific note is only useful until merge, put it in the PR body instead.
- CI is optimized for small PRs: docs-only PRs should skip runtime jobs, runtime PR jobs are path-filtered, PR browser coverage is smoke-only, and full E2E remains on `main`/manual dispatch.
- For authorized autonomous work, use `gh pr merge --auto --squash --delete-branch` when appropriate instead of blocking the session on green checks; inspect failures and keep runtime deploys after merged `main`.
- Keep completed plan archives closed unless the user asks for history or regression comparison.
- Benchmark evidence that must inform product ordering lives in `docs/superpowers/plans/completed/2026-05-09-training-benchmark-gap-plan.md`, `docs/qa/2026-05-10-fresh-benchmark-ui-review.md`, `docs/qa/2026-05-10-post-progression-benchmark-ui-review.md`, `docs/superpowers/plans/completed/2026-05-10-fresh-benchmark-ui-roadmap.md` and `docs/superpowers/plans/completed/2026-05-10-post-progression-next-roadmap.md`. Active ordering lives in the canonical roadmap.

## Out Of Scope Unless Reversed

- Telegram integration.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
