# 2026-05-21 — Performance Packet Rerun Host

## Context

`PULSE_HOST=pulse-server npm run audit:performance-gates -- --today 2026-05-21
--packet` preserved the server host in iPhone field-packet and server-verify
commands, but the final rerun instruction dropped `PULSE_HOST=pulse-server`.
Copying that final command could make the next packet report a local SSH/server
gate even though the server mirror was reachable through the configured alias.

## Change

- `scripts/performance-gates-audit.mjs` now prefixes the packet's final rerun
  command with the active `PULSE_HOST` value.
- `scripts/performance-gates-audit.test.mjs` covers the hosted packet rerun
  line.

## Verification

```bash
node --test scripts/performance-gates-audit.test.mjs
PULSE_HOST=pulse-server npm run audit:performance-gates -- --today 2026-05-21 --packet
```

The packet now ends with:

```text
Rerun after any manual save or deploy: PULSE_HOST=pulse-server npm run audit:performance-gates -- --today 2026-05-21
```
