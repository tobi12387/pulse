# 2026-05-21 - Performance iPhone Scaffold

## Trigger

The standalone iPhone/PWA audit can print paste-ready field-run Markdown with
`--scaffold`, but the combined Performance gate handoff still only showed the
full iPhone field packet command. Once Fueling is cleared, the combined packet
is the safest single surface for the next manual iPhone/PWA evidence run.

## Change

- `scripts/performance-gates-audit.mjs` now builds a host-aware
  `Field scaffold` command beside the existing `Field packet` command.
- The scaffold command is exposed in structured next-unblock metadata.
- The normal audit, next-unblock renderer and ordered handoff packet render the
  command only while the iPhone/PWA gate is still open.
- `scripts/performance-gates-audit.test.mjs` covers default, `PULSE_HOST` and
  pinned expected-commit variants.

## Verification

```bash
node --test scripts/performance-gates-audit.test.mjs
npm run audit:performance-gates -- --today 2026-05-21 --expected-commit 691734c --packet
git diff --check
```

Expected packet result: the iPhone/PWA ordered gate includes both
`Field packet: npm run audit:iphone-pwa-gate -- --expected-commit 691734c --packet`
and
`Field scaffold: npm run audit:iphone-pwa-gate -- --expected-commit 691734c --scaffold`.
