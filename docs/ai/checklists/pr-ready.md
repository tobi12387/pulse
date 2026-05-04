# PR Ready Checklist

- Branch is based on current `origin/main`.
- Worktree is clean except intended changes.
- Scope matches one logical unit.
- No direct server edits.
- No secrets or `.env` changes.
- Explicit files staged; never `git add .`.
- Relevant tests or build commands were run, or skipped with a clear reason.
- Non-trivial decisions are added to `docs/decisions.md`, or the PR explains an explicitly approved narrower docs-only scope.
- `docs/ai/current-focus.md` is updated only for durable queue/gate changes; no long PR history was appended.
- PR body includes summary, tests, and known follow-up work.
