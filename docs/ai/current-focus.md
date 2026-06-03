# Pulse Current Focus

Keep this file as a short session snapshot, not a PR archive. If a detail is only useful until merge, put it in the PR body. If a feature is already shipped, prefer `docs/decisions.md`, GitHub PRs or completed plans.

## Current State

- Source of truth: GitHub `main`.
- Server `/root/pulse` on `192.168.178.46` is a deploy mirror only.
- Verify live server state with `scripts/verify-server.sh` when the exact deployed commit matters.
- Query GitHub when open PR state matters; this file is not an open-PR register.
- Performance Operating System spec is merged and Tobi has granted autonomous follow-up execution.
- Home/Heute is the primary daily translator. It now combines readiness, load, recovery, mental boundary, data trust, Garmin execution, goal pressure/progress, adaptation, personal response, fueling, analysis, feedback, receipt trust duration, receipt renewal checks and continuity evidence into `Heute entscheidet`, `Seit letzter Entscheidung`, `Sicherste Option` and a routed CTA.
- Plan is the adaptation and execution surface: weekly review, change inbox, scenario preview/apply, Garmin execution chain, receipt trust duration, receipt renewal checks, goal/season evidence and explicit no-hidden-write contracts.
- Data is the evidence workbench: `Heute relevant`, `Trends`, `Datenqualitaet`, `Analyse`, recovery/mental evidence, personal response, goal projection/progress, decision quality, receipt renewal checks, fueling readiness, power/durability quality and the read-only training-risk contract.
- Settings is readiness/diagnostics: Garmin, Push/PWA, profile, support preferences and local ops state.
- Web Push VAPID is configured on the server; Push activation remains per browser/device.

## Active Direction

- Product north star: Pulse is a personal resilience and performance coach that connects physical training, nutrition, recovery and mental wellbeing into one understandable daily next action.
- Canonical roadmap: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`.
- Next autonomous work should come from `docs/ai/next-product-packages.md` instead of re-deriving a tiny signal polish from this file.
- The shipped Performance-OS baseline already covers the three tracks: `Tagesentscheidung`, `Trainingsanpassung` and `Lernschleifen`. The current package order and gate-open seeds live in `docs/ai/next-product-packages.md`; shipped pass history lives in PRs, completed plans, decisions and QA records.
- Delivery-speed support is active in the workflow: use `npm run delivery:intake -- --track <track> --outcome "..."` to start known packages, `npm run verify:<track>:fast` during implementation, `npm run verify:<track>:pr` for Fast Lane PR readiness, and `npm run delivery:manifest` before PRs to choose lane, gates, CI attention, auto-merge and deploy from changed files.
- Current hard Performance-OS backlog order lives in `docs/ai/next-product-packages.md`. No ungated product package is queued after the shipped Home quiet-continuity, route-wide UI/UX redesign, control/readiness surface work and Tobi's explicit top-app shell redesign reprioritization.
- Remaining roadmap themes are manual gates, not unblocked product cards: Nutrition trend summaries need three comparable complete `during` logs with GI comfort, and iPhone/PWA reliability needs current real-device evidence.
- Latest route/UI evidence through 2026-06-03 has 0 horizontal overflow and shipped the mobile anchor/control/readiness passes, Fueling capture handoffs, Settings field-proof row, top-app shell/command surfaces, compact Plan/Activity/Data follow-ups, opaque mobile chrome and the desktop focus-surface pass that removed the redundant Workspace-Topbar. See `docs/qa/2026-06-03-mobile-chrome-solid.md`, `docs/qa/2026-06-03-desktop-focus-surface.md` and the earlier `docs/qa/2026-05-22*` through `docs/qa/2026-05-27*` records for details.
- No broader route/product package is unblocked by that evidence; next autonomous product work needs new route/user friction, completed nutrition logs, iPhone/PWA real-device evidence or Tobi's explicit direction.
- Future UI/UX work starts from fresh route evidence via `docs/qa/route-evidence-pack.md` and `npm run qa:ux-summary -- <evidence-root>` unless the user reports a concrete friction point.
- Focus navigation baseline is Heute (`/`), Data, Plan, Insights and Settings. Coach remains a compatibility/deep-link route and prepared-prompt mode unless a recurring flow proves it needs primary navigation again.
- Completed implementation plans live in `docs/superpowers/plans/completed/`; do not reopen them as backlog without a new regression or explicit reversal.

## Current Gates

- First command for manual handoff: `npm run audit:performance-session -- --today <YYYY-MM-DD> --all`. Use `npm run audit:performance-gates -- --today <YYYY-MM-DD>` for the full machine-readable gate state and rerun it from clean `main` before deploy-sensitive or field-evidence claims.
- Fueling remains the first unblock: currently `0/3` comparable complete logs, two existing GI-comfort completion targets and one future complete long-session log still needed. GI comfort must come from the real stomach response, not notes, route, RPE, g/h, result or pace. Use `npm run audit:fueling-gate -- --today <YYYY-MM-DD> --packet` or `--capture-checklist` for the focused capture flow.
- iPhone/PWA field evidence remains the second unblock: rerun the real iPhone checklist against the expected commit printed by the live audit, open `/settings?section=device`, record device, iOS, launch mode and observed Settings `App-Stand`, then append the field record to `docs/qa/2026-05-02-iphone-pwa-real-device.md`.
- Do not copy static commit hashes from old QA records into field evidence. Docs-only drift can be valid when the app-runtime commit matches, but the live audit or `npm run audit:iphone-pwa-gate -- --expected-commit <commit>` must be the authority for the field run.
- iPhone certificate trust is still manual if warning-free Safari/PWA behavior is required. Refresh the manual field gate with `npm run audit:iphone-pwa-gate`.
- Push registration and test-push activation are manual per target browser/device.
- PWA offline fallback has automated service-worker proof, but the real iPhone VPN/network disconnect check remains manual field evidence.
- Real Garmin calendar/workout writes should not run during generic QA unless the task explicitly requires sync repair/testing.
- Server deploy is reachable from this Codex workspace through the local SSH alias `pulse-server`. `npm run verify:server` keeps `root@192.168.178.46` as the primary default and, when `PULSE_HOST` is unset, falls back to `pulse-server` before marking the server gate blocked; set `PULSE_HOST=<target>` to force a specific SSH path. Use `ssh pulse-server "cd /root/pulse && bash scripts/deploy.sh"` for deploys when direct host auth fails; if Codex is already running on the Pulse server host, `cd /root/pulse && bash scripts/deploy.sh` is also valid after merge as a deploy operation, not as permission to edit the server mirror. If SSH works but the server is on the wrong branch, dirty, or at the wrong commit, `verify:server` now prints `docs/ai/checklists/server-mirror-recovery.md`; inspect dirty state before changing server state.
- If Codex is running on the Pulse server host, keep `/root/pulse` as the clean `main` deploy mirror and create implementation branches in isolated worktrees with `node scripts/codex-worktree.mjs <topic>`. Directly switching `/root/pulse` to `codex/<topic>` reopens the server mirror gate.
- Local no-services verification can use reachable direct Postgres/Redis endpoints without Docker Compose. If the default test DB has schema objects but a stale Drizzle ledger, export `DATABASE_URL_TEST` to a fresh empty test database; `scripts/verify-local.sh` preserves explicit DB/Redis env overrides and now prints that recovery hint on migration failure. Verified 2026-05-21 with a fresh throwaway test DB via `npm run verify:local -- --no-services`.
- Native iOS is evidence-gated; local web/PWA over VPN remains the current access model.
- New fueling/nutrition logic should stay conservative, educational and tied to workout/recovery evidence rather than medical prescription.
- Benchmark work may use public TrainerRoad/TrainingPeaks/JOIN/Runna/Intervals/WKO capability patterns, but must not copy proprietary plan or workout content.

## Working Notes For Agents

- Start every substantial coding session from `AGENTS.md`, this file, `docs/ai/non-negotiables.md`, `docs/ai/context-map.md` and the smallest relevant package/roadmap excerpt.
- Prefer fast contract/unit/golden tests for Daily Decision logic before Playwright. Use Playwright for 1-2 package-level rendered route/click-path smokes.
- Keep PRs package-shaped when possible: 3-5 tightly related changes are better than repeated one-signal PRs when they share the same evidence and verification surface.
- For faster delivery, start with `npm run delivery:intake`, iterate with `npm run verify:<track>:fast`, use the manifest-selected `npm run verify:<track>:pr` gate for Fast Lane PRs, then copy manifest PR-body fields instead of rediscovering scope, lane, checks, auto-merge and deploy manually.
- When a package touches multiple Home signals, move toward a data-driven signal registry/priority table instead of adding more one-off signal branches.
- Record non-trivial priority, architecture or workflow decisions in `docs/decisions.md`.
- Keep completed plan archives closed unless the user asks for history or regression comparison.

## Out Of Scope Unless Reversed

- Telegram integration.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
