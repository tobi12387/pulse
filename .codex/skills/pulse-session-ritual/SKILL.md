---
name: pulse-session-ritual
description: Use for any substantial Pulse coding session before editing files, especially when starting a new feature, fixing a bug, or preparing work that must follow the repository branch and PR rules.
---

# Pulse Session Ritual

Use this skill before substantial Pulse work.

## Start

1. Read the compact working set first:
   - `AGENTS.md`
   - `docs/ai/session-brief.md`
   - `docs/ai/current-focus.md`
   - `docs/ai/non-negotiables.md`
   - `docs/ai/context-map.md`
2. Run:
   - `git fetch --all --prune`
   - `git status --short --branch`
3. If the tree is dirty, stop and inspect before editing. Do not stash, delete, or revert user/other-agent work.
4. Create a fresh feature branch from `origin/main`: `git switch -c codex/<topic> origin/main`. Codex branches use `codex/<topic>`. Never work directly on `main`.

## During Work

- Keep the PR narrow: one migration, route contract, frontend slice, or docs/tooling change.
- Prefer `rg` and small excerpts before reading large files.
- Do not edit server files directly. The server mirrors GitHub `main`.
- Never commit `.env` or secrets.
- Never use `git add .`; stage explicit paths only.

## End

Before finishing a substantial session:

1. Run focused verification for the touched area.
2. Update `docs/decisions.md` for non-trivial architecture, scope, priority, or workflow decisions.
3. Update `docs/ai/current-focus.md` only if the durable work queue, manual gates, or next recommended work changed. Put branch-specific PR detail in the PR body instead.
4. Check `git status --short --branch` and call out any unrelated dirty files.
