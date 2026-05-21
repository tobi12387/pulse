# 2026-05-21 - iPhone Field Checklist Audit

## Trigger

The iPhone/PWA field gate already had a real-device checklist, but the audit
handoff did not print that checklist path beside the open certificate, Push,
offline and device-metadata gaps.

## Change

- Made `npm run audit:iphone-pwa-gate` print
  `docs/ai/checklists/iphone-pwa-qa.md` as the field checklist.
- Made `npm run audit:performance-gates` include the same checklist in the
  iPhone/PWA gate section.
- Made iPhone/PWA next-unblock JSON include `metadata.evidenceChecklist` when
  that gate becomes the first open blocker.
- Kept the gate manual: simulated WebKit evidence still does not replace
  warning-free certificate trust, Push activation, real iPhone offline fallback
  or device/iOS metadata.

## Verification

- `node --test scripts/iphone-pwa-gate-audit.test.mjs scripts/performance-gates-audit.test.mjs`
- `npm run audit:iphone-pwa-gate`
- `npm run audit:performance-gates -- --today 2026-05-21`

Live audit result remains gated:

- Warning-free certificate trust: needs follow-up.
- Push activation and test push: partial.
- Real iPhone VPN/network offline fallback: pending.
- Device and iOS metadata: missing.

## Product Conclusion

This is tooling support for the Garmin-adjacent, device-near PWA usage path. It
does not claim real iPhone readiness; it makes the next field evidence capture
harder to lose between sessions.
