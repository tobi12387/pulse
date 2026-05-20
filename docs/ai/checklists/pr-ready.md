# PR Ready Checklist

- Branch is based on current `origin/main`.
- Worktree is clean except intended changes.
- Scope matches one Performance-OS backlog track or one justified micro-slice.
- Product PRs name their track: `Tagesentscheidung`, `Trainingsanpassung` or `Lernschleifen`.
- Package PRs contain 3-5 related changes when the outcome and verification surface are shared; smaller slices explain why package scope was not appropriate.
- `npm run delivery:manifest` was used to choose track, local gates, auto-merge eligibility and deploy requirement.
- No direct server edits.
- No secrets or `.env` changes.
- Explicit files staged; never `git add .`.
- Relevant tests or build commands were run, or skipped with a clear reason.
- For Fast Lane product PRs, prefer the manifest-selected `npm run verify:<track>:pr` gate. For Full Lane, high-risk UI work or slices where rendered behavior is the proof, use the full `npm run verify:<track>` gate or state why local browser proof was intentionally left to CI.
- Daily Decision contract changes include fast unit/golden coverage before Playwright unless the PR explains why only rendered route proof is meaningful.
- PR body states whether auto-merge is appropriate and whether server deploy is required after merge.
- Non-trivial decisions are added to `docs/decisions.md`, or the PR explains an explicitly approved narrower docs-only scope.
- `docs/ai/current-focus.md` is updated only for durable queue/gate changes; no long PR history was appended.
- PR body includes summary, tests, and known follow-up work.
