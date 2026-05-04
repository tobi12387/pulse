# Pulse Current Focus

Keep this file as a short snapshot, not a PR archive. If it grows past roughly 80 lines, replace old detail with links to PRs, completed plans or `docs/decisions.md`.

## Current State

- Source of truth: GitHub `main`.
- Server `/root/pulse` on `192.168.178.46` is a deploy mirror only.
- Latest recorded runtime deploy before docs-only AI-context cleanup: `ef061a9` / PR #160.
- Docs-only workflow/context updates after that do not require server deploy.
- Do not use this file as an open-PR registry; query GitHub when PR state matters.
- Web Push VAPID is configured on the server; Push activation remains per browser/device.
- UI/UX Deep Friction Closure is complete through PR #160.

## Active Direction

- Use `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md` as the product orientation document.
- Future UI/UX work should first regenerate evidence via `docs/qa/route-evidence-pack.md`; the 2026-05-02 deep-friction roadmap is completed history.
- Broad structure work needs a fresh `rg --files` / file-count audit first; the 2026-05-02 structure audit and boundary plan are completed history.
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
- Habit tracker.
- Data export.
- Rebuilding anything under `docs/superpowers/plans/completed/`.
