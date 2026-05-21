# 2026-05-21 - iPhone Field Packet

## Trigger

The iPhone/PWA field gate still needs current real-device evidence, certificate
trust, Push activation/test push, offline fallback and device metadata. The
audit listed those gaps, but the real-device run did not have a live packet like
the Fueling evidence gate.

## Change

- Added `--packet` to `npm run audit:iphone-pwa-gate`.
- The packet renders the current expected commit, stale field commit status,
  open gaps, exact next actions, no-simulation boundary and evidence recording
  steps.
- Added the field packet command to `npm run audit:performance-gates` and to
  iPhone/PWA `nextUnblock.metadata.fieldPacketCommand` for JSON consumers.
- Kept the gate manual: simulated WebKit/Chromium evidence still cannot replace
  the real iPhone/VPN/PWA field record.

## Verification

- `node --test scripts/iphone-pwa-gate-audit.test.mjs scripts/performance-gates-audit.test.mjs`
- `npm run audit:iphone-pwa-gate -- --packet`
- `npm run audit:iphone-pwa-gate -- --json`
- `npm run audit:performance-gates -- --today 2026-05-21`

Live audit result remains gated:

- Field record tested `9e05189`; expected current commit is the local `main`.
- Warning-free certificate trust still needs follow-up.
- Push activation/test push is still partial.
- Real iPhone VPN/network offline fallback is pending.
- Device and iOS metadata are missing.

## Product Conclusion

This is evidence-capture support for the device-near PWA gate. It makes the
next real iPhone run executable without claiming field readiness or weakening
the current-commit requirement.
