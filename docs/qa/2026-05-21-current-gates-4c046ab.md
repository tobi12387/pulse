# 2026-05-21 - Current Gates 4c046ab

## Trigger

`main` now includes PR #589, which makes the iPhone/PWA field gate compare the
manual `Server commit under test` with the expected current commit. This record
refreshes the current Performance-OS blockers at `4c046ab`.

## Commands

```bash
npm run audit:performance-next -- --today 2026-05-21
npm run audit:performance-gates -- --today 2026-05-21
npm run audit:iphone-pwa-gate
PULSE_EXPECTED_COMMIT=4c046ab npm run verify:server
```

## Result

- Overall gate: `gated`, with 3 open gates.
- Expected server commit: `4c046ab`.
- Next unblock: Fueling learning.
- Fueling: 0/3 comparable complete logs; 2 existing logs completable now; 1 new
  complete long-session log still needed after candidates.
- First Fueling target: 2026-05-09 Datteln Graveln,
  `/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`,
  missing GI comfort.
- Second Fueling candidate: 2026-05-04 Datteln - Radfahren - Z2 · 80min,
  `/plan/activity/4f4b873d-bb64-4410-8e63-a382e9729863#activity-fueling-log`,
  missing GI comfort.
- iPhone/PWA: 5 open gaps: stale current-main field evidence, certificate
  trust, Push activation/test push, real iPhone VPN/network offline fallback and
  device/iOS metadata.
- iPhone field record under test: `9e05189`; expected current commit:
  `4c046ab`; field commit status: `stale`.
- Server mirror: SSH preflight still fails with `Permission denied
  (publickey,password)` before Git/PM2/health checks.

## Conclusion

No ungated product package opens from this refresh. The next real Performance-OS
movement is still manual Fueling GI comfort capture, followed by current-commit
iPhone/PWA field evidence and restored server SSH/deploy verification.
