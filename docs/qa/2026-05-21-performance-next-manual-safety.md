# 2026-05-21 — Performance Next Manual Safety

## Context

`npm run audit:performance-next` is the shortest Performance-OS handoff and is
the command most likely to be copied for the first manual unblock. It named the
Fueling target, GI options and evidence packet, but the manual safety constraints
only appeared in the full packet.

For the current Fueling gate, that safety reminder matters: GI comfort must be
recorded from the real stomach response through the Activity Fueling UI, not
inferred from notes or edited directly in the database.

## Change

- `scripts/performance-gates-audit.mjs` now renders a `Manual safety` block in
  the concise next-unblock output for Fueling, iPhone/PWA field and server
  mirror gates.
- `scripts/performance-gates-audit.test.mjs` covers the Fueling and iPhone/PWA
  next-unblock safety text.

## Verification

```bash
node --test scripts/performance-gates-audit.test.mjs
PULSE_HOST=pulse-server npm run audit:performance-next -- --today 2026-05-21
```
