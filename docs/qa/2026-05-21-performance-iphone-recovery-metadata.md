# 2026-05-21 - Performance iPhone Recovery Metadata

## Trigger

`npm run audit:iphone-pwa-gate -- --packet` now includes the read-only server
recovery packet. The combined Performance gate still exposed only the iPhone
field packet, so once Fueling opens and iPhone/PWA becomes the first blocker,
`npm run audit:performance-next` would require one extra hop to see the SSH
recovery handoff.

## Change

- The iPhone/PWA gate JSON now includes `serverVerifyCommand` and
  `serverRecoveryPacketCommand`.
- `npm run audit:performance-gates` renders the iPhone server recovery packet
  beside the field packet while the iPhone gate is open.
- `npm run audit:performance-next` renders the same server recovery packet when
  iPhone/PWA is the first open unblock.

## Verification

- `node --test scripts/iphone-pwa-gate-audit.test.mjs scripts/performance-gates-audit.test.mjs`
- `npm run audit:performance-gates -- --today 2026-05-21`
- `npm run audit:performance-gates -- --today 2026-05-21 --json`
- `git diff --check`

## Product Conclusion

This does not close the iPhone/PWA or server gates. It keeps the manual
Performance-OS unblock path executable after Fueling evidence opens.
