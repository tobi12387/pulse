# 2026-05-21 — iPhone Field Rerun Host

## Context

`PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit
6a859cb --packet` preserved the server host in the server verify and recovery
commands, but the final `Rerun after recording` command dropped the host.

That made the packet easy to repeat without the configured SSH alias, which
could make follow-up field packets lose the read-only server mirror command
that works from this Codex workspace.

## Change

- `scripts/iphone-pwa-gate-audit.mjs` now prefixes the final iPhone/PWA rerun
  command with the active `PULSE_HOST` value.
- `scripts/iphone-pwa-gate-audit.test.mjs` covers the hosted rerun command.

## Verification

```bash
node --test scripts/iphone-pwa-gate-audit.test.mjs
PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit 6a859cb --packet
```

The packet now ends the manual field run with:

```text
Rerun after recording: PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit 6a859cb
```
