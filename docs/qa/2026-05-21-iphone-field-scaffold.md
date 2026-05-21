# 2026-05-21 - iPhone Field Scaffold

## Trigger

The iPhone/PWA field gate still needs a real-device run against the current
server commit. The existing packet already includes a Markdown evidence scaffold,
but copying it requires scanning the full gap packet.

## Change

- `scripts/iphone-pwa-gate-audit.mjs` now accepts `--scaffold`.
- The mode prints only paste-ready Markdown for a new field run.
- The scaffold still uses the expected commit resolver, so
  `Server commit under test` is prefilled with the commit the audit expects.
- The full packet keeps its fenced scaffold for human-readable handoff context.

## Verification

```bash
node --test scripts/iphone-pwa-gate-audit.test.mjs
npm run audit:iphone-pwa-gate -- --expected-commit 74498c3 --scaffold
git diff --check
```

Expected current result: the scaffold starts with `## Scope`, includes
`Server commit under test: 74498c3`, and contains the real-device result rows
for Push support and Offline fallback.
