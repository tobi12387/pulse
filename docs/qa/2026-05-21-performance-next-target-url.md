# 2026-05-21 - Performance Next Target URL

## Trigger

The first Performance-OS unblock is a concrete Activity Fueling UI target. The
full `audit:performance-next` and packet outputs show the URL, and JSON exposes
`metadata.targetUrl`, but clipboard/automation use still had to scan Markdown or
parse JSON just to open the next action.

## Change

- `scripts/performance-gates-audit.mjs` now accepts `--target-url`.
- With `audit:performance-next`, it prints only the first open gate's
  `targetUrl`.
- If the first open gate has no target URL, the command exits non-zero instead
  of inventing a link from a non-URL gate.
- The Fueling evidence checklist now includes the target-URL-only command.

## Verification

```bash
node --test scripts/performance-gates-audit.test.mjs
npm run audit:performance-next -- --today 2026-05-21 --target-url
git diff --check
```

Expected current result: the target-URL command prints only the Activity Fueling
deep link for the 2026-05-09 Datteln Graveln log.
