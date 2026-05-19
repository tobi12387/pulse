# Pulse AI Session Brief

Purpose: start AI sessions with the smallest useful context, then expand only when the task requires it.

## Default Read Order

1. `AGENTS.md`
2. `docs/ai/session-brief.md`
3. `docs/ai/current-focus.md`
4. `docs/ai/next-product-packages.md`
5. `docs/ai/non-negotiables.md`
6. `docs/ai/context-map.md` only far enough to pick the next files

Then stop and choose the smallest task-specific context. Read a concrete plan, checklist, roadmap or source file only when the request actually needs it.

Do not read `docs/superpowers/plans/completed/` unless the task is explicitly about historical reference or regression comparison.

## Workflow

- Start every coding session from a clean tree and a fresh `codex/<topic>` branch.
- Search before reading whole files. Prefer `rg` anchors and small excerpts.
- Keep PRs package-shaped by default: one Performance-OS backlog track, usually 3-5 related changes that share one outcome and verification surface. Use micro-slices for urgent fixes, regressions, CI/deploy repair, docs-only updates, or clearly separate ownership boundaries.
- Every product PR should name its track from `docs/ai/next-product-packages.md`: `Tagesentscheidung`, `Trainingsanpassung` or `Lernschleifen`.
- For Daily Decision contract logic, prefer fast unit/golden tests before Playwright; use Playwright for 1-2 rendered package smokes.
- When several Home signals change together, prefer a small data-driven signal registry/priority table over more one-off branches.
- GitHub PR CI is path-filtered: PRs run focused build/backend/browser jobs only for touched runtime areas; browser PR coverage is the smoke suite. Full Playwright regression runs on `main` and `workflow_dispatch`.
- When local checks are green and CI has no special review risk, prefer GitHub auto-merge over actively waiting in chat. Still inspect and fix failed checks.
- Update `docs/ai/current-focus.md` only when the durable work queue, manual gates or next recommendation changes. Do not append a long PR register.
- Add a `docs/decisions.md` entry for non-trivial architecture, scope, or priority decisions unless the user explicitly limited the edit scope to AI context docs.

## Token Discipline

- Use `docs/ai/non-negotiables.md` for active constraints and product-quality rules instead of re-reading the full decision log.
- Use `docs/ai/context-map.md` to find the smallest relevant code/document set.
- Use checklists in `docs/ai/checklists/` instead of re-deriving done criteria.
- Summarize long docs in PR descriptions instead of pasting large excerpts into chats.
- Prefer GitHub PRs and completed plan docs for history; keep `docs/ai/current-focus.md` short enough to read every session.
