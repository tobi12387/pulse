# 2026-05-21 - Server Runbook Gate Render

## Trigger

The server deploy mirror gate already exposed
`docs/ai/checklists/deploy-auth-recovery.md` in JSON and in the first-unblock
view when the server gate was first. In the full Performance-OS gate audit,
Fueling and iPhone/PWA had explicit checklist lines, but the server runbook was
only embedded inside the next-action sentence.

## Change

- Made `npm run audit:performance-gates` render
  `Recovery runbook: docs/ai/checklists/deploy-auth-recovery.md` in the server
  gate section.
- Kept server verification read-only and SSH-backed.
- Did not change deploy behavior, server state, SSH credentials or runtime code.

## Verification

- `node --test scripts/performance-gates-audit.test.mjs`
- `npm run audit:performance-gates -- --today 2026-05-21`

Live audit result remains gated:

- Fueling learning is still the first unblock.
- iPhone/PWA field evidence remains open.
- Server mirror verification still fails before server checks because SSH auth
  to `root@192.168.178.46` is unavailable.

## Product Conclusion

This is deploy-readiness support for the Performance-OS loop. It makes the
server recovery path as visible as the Fueling and iPhone evidence paths without
claiming deploy readiness.
