# 2026-05-21 - iPhone Field Commit Freshness

## Trigger

The iPhone/PWA field gate still used the old manual evidence record from
`2026-05-02`, whose `Server commit under test` is `9e05189`. Current `main`
has moved since then, so a fully green field checklist on that old record would
not prove current iPhone/PWA readiness.

## Change

- `npm run audit:iphone-pwa-gate` now compares `Server commit under test` with
  the expected current commit.
- The expected commit defaults to `PULSE_EXPECTED_COMMIT` or local `git rev-parse
  --short HEAD`; callers can pass `--expected-commit <short>`.
- `npm run audit:performance-gates` passes its resolved expected commit into
  the iPhone audit so the combined gate snapshot uses one current-main target.
- Stale or missing commit evidence becomes a first-class iPhone/PWA gap instead
  of letting old field proof appear current.

## Verification

Commands:

```bash
node --test scripts/iphone-pwa-gate-audit.test.mjs scripts/performance-gates-audit.test.mjs
npm run audit:iphone-pwa-gate
npm run audit:performance-gates -- --today 2026-05-21 --skip-server
```

Result:

- Focused unit tests passed.
- The iPhone audit now reports `Field commit status: stale` for the existing
  `9e05189` field record against current `38036a0` evidence.
- The iPhone/PWA gate reports 5 open gaps: stale current-main field evidence,
  certificate trust, Push activation/test push, real iPhone offline fallback and
  device/iOS metadata.
- The combined Performance-OS audit keeps Fueling as the first unblock, then
  names the iPhone stale-commit field run before certificate/push/offline work.

## Conclusion

This does not replace real-device iPhone evidence. It makes the manual gate
stricter: future iPhone/PWA field readiness must prove the current deployed
server commit, not only an older local-server session.
