# iPhone Runtime Commit Gate - 2026-05-22

Branch: `codex/iphone-runtime-commit-gate`
Track: platform reliability support

## Purpose

Keep the iPhone/PWA field gate strict about real app changes without making docs-only PRs invalidate otherwise current field evidence.

The server mirror still verifies the latest GitHub `main` commit. The iPhone/PWA field audit now also resolves both the expected server commit and the recorded `Server commit under test` to their latest app-runtime commit across:

- `frontend`
- `backend`
- `shared`
- `package.json`
- `package-lock.json`

If the server commits differ but those runtime commits match, the field commit status becomes `current_runtime` instead of `stale`.

## Result

- Old field evidence at `9e05189` remains stale for current `main` because its app runtime commit differs from the current runtime.
- Future docs-only PRs no longer force a new real iPhone run when the already-recorded server commit and latest `main` have the same app runtime.
- Real frontend/backend/PWA/package changes still require fresh real-device evidence for the new runtime.

## Verification

```bash
node --test scripts/iphone-pwa-gate-audit.test.mjs
npm run audit:iphone-pwa-gate -- --expected-commit 7f66e30 --next-prompt
```

The focused test suite covers the new docs-only drift case and the existing stale-evidence case.
