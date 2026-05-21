# 2026-05-21 - Server Recovery Packet

## Trigger

Fueling and iPhone/PWA gates now have packet commands that turn their manual
blockers into compact executable handoffs. The server deploy mirror gate still
linked the SSH recovery runbook, but it did not expose the same packet-style
view with the expected commit and rerun commands.

## Change

- Added `npm run verify:server -- --packet`.
- The packet is read-only and exits before any SSH, deploy or server-health
  check runs.
- `npm run audit:performance-gates` now renders the packet command in the
  server gate section.
- `npm run audit:performance-next` includes the packet command when the server
  mirror is the first open gate.

## Verification

- `bash scripts/verify-server.sh --packet`
- `PULSE_EXPECTED_COMMIT="$(git rev-parse --short HEAD)" npm run verify:server -- --packet`
- `node --test scripts/dev-services.test.mjs scripts/performance-gates-audit.test.mjs`
- `npm run audit:performance-gates -- --today 2026-05-21`

## Product Conclusion

This does not claim server readiness and does not repair SSH auth. It only makes
the current safe recovery path as easy to hand off as the Fueling and iPhone/PWA
manual evidence packets.
