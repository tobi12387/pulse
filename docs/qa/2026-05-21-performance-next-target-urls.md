# 2026-05-21 - Performance Next Target URLs

## Trigger

The first Performance-OS blocker is Fueling learning, and it currently has two
existing Activity Fueling candidates that both need real GI comfort. The
combined packet shows both full URLs, but shortcut-style handoff still only had
`--target-url` for the first URL.

## Change

- `scripts/performance-gates-audit.mjs` now accepts `--target-urls`.
- The mode prints the first open gate's primary `targetUrl` plus any
  completion-candidate `targetUrl` values, deduplicated in order, one URL per
  line.
- The mode exits with failure when the first open gate has no URL candidates,
  matching the existing `--target-url` safety shape.
- `scripts/performance-gates-audit.test.mjs` covers Fueling multi-URL output
  metadata, iPhone no-URL behavior and CLI parsing.

## Verification

```bash
node --test scripts/performance-gates-audit.test.mjs
npm run audit:performance-next -- --today 2026-05-21 --target-urls
git diff --check
```

Expected current result: the command prints the two live Activity Fueling URLs
for the 2026-05-09 and 2026-05-04 completion candidates, one per line.
