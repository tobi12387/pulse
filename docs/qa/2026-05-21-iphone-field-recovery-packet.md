# 2026-05-21 - iPhone Field Recovery Packet

## Trigger

After PR #594, the server mirror gate has a read-only recovery packet command.
The iPhone/PWA field packet still named only the server verify command and the
runbook, even though stale iPhone evidence cannot be refreshed safely until the
server mirror commit is verified or the SSH blocker is handed off.

## Change

- `npm run audit:iphone-pwa-gate -- --packet` now prints the matching
  `PULSE_EXPECTED_COMMIT=<commit> npm run verify:server -- --packet` command.
- The manual field run section tells Tobi to run that read-only recovery packet
  first when SSH fails before Git/PM2/health checks, then continue through the
  deploy-auth recovery runbook.
- The iPhone/PWA checklist now documents that the field packet includes both the
  server verify command and the server recovery packet handoff.

## Verification

- `node --test scripts/iphone-pwa-gate-audit.test.mjs`
- `npm run audit:iphone-pwa-gate -- --packet`
- `git diff --check`

## Product Conclusion

This does not close the iPhone/PWA field gate and does not claim server
readiness. It reduces the manual handoff friction between the stale iPhone field
record and the server SSH/auth recovery path.
