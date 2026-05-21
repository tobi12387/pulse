# 2026-05-21 — Performance iPhone Command

## Context

`npm run audit:performance-gates` and `npm run audit:performance-next` already
rendered precise iPhone field packet commands with `--expected-commit` and
`PULSE_HOST` when configured. The primary iPhone/PWA `Command:` line still used
the generic `npm run audit:iphone-pwa-gate`, which was less safe once Fueling is
cleared and iPhone/PWA becomes the first manual unblock.

## Change

- `scripts/performance-gates-audit.mjs` now renders the iPhone/PWA gate command
  as `npm run audit:iphone-pwa-gate -- --expected-commit <commit>`.
- The command preserves `PULSE_HOST` when the combined audit was run with a
  configured server host.
- `scripts/performance-gates-audit.test.mjs` covers both the concise
  next-unblock command and the hosted packet command.

## Verification

```bash
node --test scripts/performance-gates-audit.test.mjs
PULSE_HOST=pulse-server npm run audit:performance-gates -- --today 2026-05-21 --packet
```
