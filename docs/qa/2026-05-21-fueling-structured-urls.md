# 2026-05-21 - Fueling Structured URLs

## Trigger

The Performance-OS gate packet already printed clickable Fueling target URLs for
the first manual unblock, but the machine-readable Fueling and Performance gate
JSON only exposed `targetPath`. Agents or small tools consuming JSON had to
rebuild or scrape URLs before opening the exact Activity Fueling UI.

## Change

- `scripts/fueling-gate-audit.mjs` now includes `targetUrl` on the next action,
  target log and completion candidates.
- `scripts/performance-gates-audit.mjs` preserves those URLs in gate summaries
  and `nextUnblock.metadata`, including a fallback URL when older Fueling JSON
  only has a path.

## Verification

```bash
git diff --check
npm run delivery:manifest
node --test scripts/fueling-gate-audit.test.mjs scripts/performance-gates-audit.test.mjs
npm run test:scripts
PULSE_HOST=pulse-server npm run audit:performance-gates -- --today 2026-05-21 --json
```

Result: focused tests and the full script suite passed, and the live JSON audit
exposed `targetUrl` for the first Fueling target plus both completion
candidates. The feature-branch live audit still showed the known server mirror
warning because the server checkout was on `codex/fueling-structured-urls`;
rerun from merged `main` for final server status.

## Product Conclusion

This does not infer or close GI comfort. It makes the current first manual
Fueling unblock easier to execute safely from structured audit output.
