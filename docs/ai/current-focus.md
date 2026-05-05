# Pulse Current Focus

Keep this file as a short snapshot, not a PR archive. If it grows past roughly 80 lines, replace old detail with links to PRs, completed plans or `docs/decisions.md`.

## Current State

- Source of truth: GitHub `main`.
- Server `/root/pulse` on `192.168.178.46` is a deploy mirror only.
- Latest recorded runtime deploy: `d16fd3a` / PR #188.
- Do not use this file as an open-PR registry; query GitHub when PR state matters.
- Web Push VAPID is configured on the server; Push activation remains per browser/device.
- UI/UX Foundation Flow, Nav/Mental/Garmin trust slice, Home Daily Decision Closure, Mental Signal Impact, Garmin Sync Confidence, Mobile Touch Targets, Mobile A11y Keyboard and Data Decision Evidence Trail are deployed through PR #188.

## Active Direction

- Use `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md` as the product orientation document.
- Future UI/UX work should first regenerate evidence via `docs/qa/route-evidence-pack.md`; the 2026-05-02 deep-friction roadmap is completed history.
- Current navigation direction is documented in `docs/superpowers/specs/2026-05-04-nav-ia-design.md`: the target top-level set is Home, Data, Plan and Settings. Insights is now inside Data; Coach is no longer a primary-nav destination while `/coach` remains a compatibility/deep-link route; Home/Plan can open Coach with prepared draft prompts.
- Mental Check-in Simplification and Mental Signal Impact: Home can complete the compact daily check-in; Data, Home, Plan and Coach now use one shared impact language. Next mental work should focus on evidence quality, not another input rebuild.
- Trust-closure wave is deployed through Data Decision Evidence Trail: Home/Plan evidence deep-links into Data instead of becoming another dashboard.
- Completed implementation plans, including the 2026-05-05 Mobile/A11y and Data Evidence Trail slices, live in `docs/superpowers/plans/completed/`; do not rebuild them.
- Broad structure work needs a fresh `rg --files` / file-count audit first; the 2026-05-02 structure audit and boundary plan are completed history.
- Next autonomous UI/UX work should start from fresh route evidence and only implement observed friction; Mobile Field Reliability remains primarily a real-iPhone evidence gate.
- Fueling & Recovery is useful but preference-gated; ask Tobi before implementing.
- Native iOS is evidence-gated; the current access model remains local web/PWA over VPN.

## Manual Gates

- iPhone certificate trust is still manual if warning-free Safari/PWA behavior is required.
- Push registration and test-push activation are manual per target browser/device.
- Real Garmin calendar/workout sync should not be triggered during generic QA unless the task explicitly requires it.
- New nutrition/fueling logic needs dietary, logging and recommendation-boundary preferences from Tobi.

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
- 2026-05-04: AI working context was condensed so sessions start from AGENTS plus `docs/ai/*` instead of long pasted prompts or PR archives.
- 2026-05-04: completed structure and UI/UX roadmap docs were moved out of the active plan surface to avoid reimplementation.
- PR #149-#150: ops/tooling cleanup and design handoff relocation.
- PR #136-#148: backend/frontend/shared structure extraction wave.
- Earlier feature history lives in GitHub PRs and `docs/superpowers/plans/completed/`.

## Working Notes For Agents

- Do not append every merged branch here.
- Record only durable queue changes, manual gates or next recommended work.
- If a branch-specific note is only useful until merge, put it in the PR body instead.
- Keep completed plan archives closed unless the user asks for history or regression comparison.

## Out Of Scope Unless Reversed

- Telegram integration.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
