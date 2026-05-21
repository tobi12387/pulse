# 2026-05-21 - iPhone Field Server Verify Handoff

## Trigger

The iPhone/PWA field packet already rejected stale `Server commit under test`
evidence, but the manual field run still said to verify the server mirror only
in prose. The next real-device run needs the exact command before any new
iPhone evidence can count as current.

## Change

- `npm run audit:iphone-pwa-gate -- --packet` now prints
  `PULSE_EXPECTED_COMMIT=<commit> npm run verify:server`.
- The packet also points SSH-preflight failures to
  `docs/ai/checklists/deploy-auth-recovery.md`.
- The iPhone/PWA checklist now states that server mirror verification happens
  before recording new current field evidence.

## Verification

- `node --test scripts/iphone-pwa-gate-audit.test.mjs`
- `npm run audit:iphone-pwa-gate -- --packet`
- `npm run audit:iphone-pwa-gate -- --json`

## Product Conclusion

This keeps the iPhone/PWA gate strict: simulated WebKit evidence and stale
server commits still do not close the real-device field gate. The change only
makes the required current-server proof harder to skip.
