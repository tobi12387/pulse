# Pulse Current Focus

Keep this file as a short session snapshot, not a PR archive. If a detail is only useful until merge, put it in the PR body. If a feature is already shipped, prefer `docs/decisions.md`, GitHub PRs or completed plans.

## Current State

- Source of truth: GitHub `main`.
- Server `/root/pulse` on `192.168.178.46` is a deploy mirror only.
- Verify live server state with `scripts/verify-server.sh` when the exact deployed commit matters.
- Query GitHub when open PR state matters; this file is not an open-PR register.
- Performance Operating System spec is merged and Tobi has granted autonomous follow-up execution.
- Home/Heute is the primary daily translator. It now combines readiness, load, recovery, mental boundary, data trust, Garmin execution, goal pressure, adaptation, personal response, fueling, analysis, feedback and continuity evidence into `Heute entscheidet`, `Seit letzter Entscheidung`, `Sicherste Option` and a routed CTA.
- Plan is the adaptation and execution surface: weekly review, change inbox, scenario preview/apply, Garmin execution chain, goal/season evidence and explicit no-hidden-write contracts.
- Data is the evidence workbench: `Heute relevant`, `Trends`, `Datenqualitaet`, `Analyse`, recovery/mental evidence, personal response, goal projection, decision quality, fueling readiness, power/durability quality and the read-only training-risk contract.
- Settings is readiness/diagnostics: Garmin, Push/PWA, profile, support preferences and local ops state.
- Web Push VAPID is configured on the server; Push activation remains per browser/device.

## Active Direction

- Product north star: Pulse is a personal resilience and performance coach that connects physical training, nutrition, recovery and mental wellbeing into one understandable daily next action.
- Canonical roadmap: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`.
- Next autonomous work should come from `docs/ai/next-product-packages.md` instead of re-deriving a tiny signal polish from this file.
- First-pass and second-pass Performance-OS baselines across `Tagesentscheidung`, `Trainingsanpassung` and `Lernschleifen` are shipped; Track 1 and Track 2 also have their third-pass learning-calibration packages.
- Current hard Performance-OS backlog order:
  1. **Build-Speed support:** add a PR delivery manifest and changed-files gate mapping before deriving another product slice.
  2. **Tagesentscheidung:** reopen only for regressions or a new explicit Home package.
  3. **Trainingsanpassung:** reopen only for regressions or a new explicit Plan package.
  4. **Lernschleifen:** reopen only for regressions or a new explicit Data package.
- Shipped baselines:
  - **Tagesentscheidung** delivered Home completed-day learning, Activity closure evidence, the local Daily Decision signal registry, the last-decision follow-up signal and gated Data learning calibration in Home; reopen only for regressions or a new explicit Track-1 package.
  - **Trainingsanpassung** delivered the shared Plan weekly decision contract, preview-only Accept/Adapt/Defer controls, Home/Data handoffs, local weekly decision receipts and gated learning calibration in explicit weekly decisions; reopen only for regressions or a new explicit Track-2 package.
  - **Lernschleifen** delivered Data action contracts, Fueling learning-loop copy, Home watch-context gating, the Data training-risk contract and the Data learning-calibration gate for Decision Quality, Personal Response and Fueling trends; reopen only for regressions or a new explicit Track-3 package.
- Future UI/UX work starts from fresh route evidence via `docs/qa/route-evidence-pack.md` and `npm run qa:ux-summary -- <evidence-root>` unless the user reports a concrete friction point.
- Focus navigation baseline is Heute (`/`), Data, Plan, Insights and Settings. Coach remains a compatibility/deep-link route and prepared-prompt mode unless a recurring flow proves it needs primary navigation again.
- Completed implementation plans live in `docs/superpowers/plans/completed/`; do not reopen them as backlog without a new regression or explicit reversal.

## Current Gates

- Nutrition trend summaries remain gated until at least three comparable complete `during` logs exist with carbs, duration/activity context and GI comfort. Sodium, heat and sweat-rate stay evidence gaps until measured.
- iPhone certificate trust is still manual if warning-free Safari/PWA behavior is required.
- Push registration and test-push activation are manual per target browser/device.
- Real Garmin calendar/workout writes should not run during generic QA unless the task explicitly requires sync repair/testing.
- Native iOS is evidence-gated; local web/PWA over VPN remains the current access model.
- New fueling/nutrition logic should stay conservative, educational and tied to workout/recovery evidence rather than medical prescription.
- Benchmark work may use public TrainerRoad/TrainingPeaks/JOIN/Runna/Intervals/WKO capability patterns, but must not copy proprietary plan or workout content.

## Working Notes For Agents

- Start every substantial coding session from `AGENTS.md`, this file, `docs/ai/non-negotiables.md`, `docs/ai/context-map.md` and the smallest relevant package/roadmap excerpt.
- Prefer fast contract/unit/golden tests for Daily Decision logic before Playwright. Use Playwright for 1-2 package-level rendered route/click-path smokes.
- Keep PRs package-shaped when possible: 3-5 tightly related changes are better than repeated one-signal PRs when they share the same evidence and verification surface.
- For faster delivery, prefer a small delivery manifest plus changed-files gate mapping over rediscovering PR scope and local checks each session.
- When a package touches multiple Home signals, move toward a data-driven signal registry/priority table instead of adding more one-off signal branches.
- Record non-trivial priority, architecture or workflow decisions in `docs/decisions.md`.
- Keep completed plan archives closed unless the user asks for history or regression comparison.

## Out Of Scope Unless Reversed

- Telegram integration.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
