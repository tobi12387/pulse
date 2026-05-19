# PR Ready Checklist

- Branch is based on current `origin/main`.
- Worktree is clean except intended changes.
- Scope matches one Performance-OS backlog track or one justified micro-slice.
- Product PRs name their track: `Tagesentscheidung`, `Trainingsanpassung` or `Lernschleifen`.
- Package PRs contain 3-5 related changes when the outcome and verification surface are shared; smaller slices explain why package scope was not appropriate.
- No direct server edits.
- No secrets or `.env` changes.
- Explicit files staged; never `git add .`.
- Relevant tests or build commands were run, or skipped with a clear reason.
- For product package PRs, prefer the matching track gate: `npm run verify:tagesentscheidung`, `npm run verify:trainingsanpassung` or `npm run verify:lernschleifen`.
- Daily Decision contract changes include fast unit/golden coverage before Playwright unless the PR explains why only rendered route proof is meaningful.
- PR body states whether auto-merge is appropriate and whether server deploy is required after merge.
- Non-trivial decisions are added to `docs/decisions.md`, or the PR explains an explicitly approved narrower docs-only scope.
- `docs/ai/current-focus.md` is updated only for durable queue/gate changes; no long PR history was appended.
- PR body includes summary, tests, and known follow-up work.
