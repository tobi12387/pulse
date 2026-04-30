# Pulse AI Session Brief

Purpose: start AI sessions with the smallest useful context, then expand only when the task requires it.

## Read Order

1. `AGENTS.md`
2. `docs/ai/current-focus.md`
3. `docs/ai/non-negotiables.md`
4. `docs/ai/context-map.md`
5. `docs/superpowers/plans/2026-04-28-roadmap.md`
6. The concrete active plan doc for the task
7. `docs/decisions.md` only for recent or disputed architectural context

Do not read `docs/superpowers/plans/completed/` unless the task is explicitly about historical reference.

## Workflow

- Start every coding session from a clean tree and a fresh `codex/<topic>` branch.
- Search before reading whole files. Prefer `rg` anchors and small excerpts.
- Keep PRs narrow: one backend contract, frontend slice, migration, UI consolidation, or docs change.
- Update `docs/ai/current-focus.md` when the active branch, open PR, or next recommended task changes.
- Add a `docs/decisions.md` entry for non-trivial architecture, scope, or priority decisions.

## Token Discipline

- Use `docs/ai/non-negotiables.md` for hard rules instead of re-reading the full decision log.
- Use `docs/ai/context-map.md` to find the smallest relevant code/document set.
- Use checklists in `docs/ai/checklists/` instead of re-deriving done criteria.
- Summarize long docs in PR descriptions instead of pasting large excerpts into chats.
