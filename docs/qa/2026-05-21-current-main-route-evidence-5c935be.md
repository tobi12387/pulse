# 2026-05-21 - Current Main Route Evidence 5c935be

## Trigger

`main` now includes PR #617, the Home daily-decision browser-CI repair. This
record preserves the route-evidence and gate-packet state for commit `5c935be`
before opening any further Performance-OS product work.

## Route Evidence

- Branch: `codex/current-main-evidence-record`
- Commit: `5c935be`
- Command: `npm run qa:ux-evidence`
- Summary command: `npm run qa:ux-summary -- test-results/route-evidence`
- Evidence root: `test-results/route-evidence/2026-05-21-5c935be/`

Result:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Route pack passed for Home, Coach compatibility route, Data, Plan, Activity
  Detail, Insights and Settings.
- Mobile Daily Command scenarios passed for planned workout, free trainable day,
  completed Garmin activity, recovery-protect day, Data Mental first viewport,
  Data Fueling action, Activity Fueling anchor and Plan mobile intent scenario.

Artifacts:

- Desktop manifest:
  `test-results/route-evidence/2026-05-21-5c935be/desktop-chromium/manifest.json`
- Mobile manifest:
  `test-results/route-evidence/2026-05-21-5c935be/mobile-chromium/manifest.json`
- Mobile Home first viewport:
  `test-results/route-evidence/2026-05-21-5c935be/mobile-chromium/01-home.png`
- Mobile Data Fueling action:
  `test-results/route-evidence/2026-05-21-5c935be/mobile-chromium/15-data-fueling-action.png`
- Mobile Activity Fueling anchor:
  `test-results/route-evidence/2026-05-21-5c935be/mobile-chromium/16-activity-fueling-anchor.png`
- Mobile Plan intent scenario:
  `test-results/route-evidence/2026-05-21-5c935be/mobile-chromium/17-plan-mobile-intent-scenario.png`

## Gate Packets

Commands:

```bash
npm run audit:performance-gates -- --today 2026-05-21 --packet
npm run audit:fueling-gate -- --today 2026-05-21 --packet
npm run audit:iphone-pwa-gate -- --expected-commit 5c935be --packet
PULSE_EXPECTED_COMMIT=5c935be npm run verify:server -- --packet
```

Result:

- Overall Performance-OS gate: `gated`, with 3 open gates.
- Expected server commit: `5c935be`.
- Next unblock: Fueling learning.
- Fueling: 0/3 comparable complete logs; 2 existing logs completable now; 1 new
  complete long-session log still needed after those candidates.
- First Fueling target: 2026-05-09 Datteln Graveln,
  `/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`,
  missing GI comfort.
- Second Fueling candidate: 2026-05-04 Datteln - Radfahren - Z2 - 80min,
  `/plan/activity/4f4b873d-bb64-4410-8e63-a382e9729863#activity-fueling-log`,
  missing GI comfort.
- Fueling packet confirms GI comfort must be the real stomach response and must
  not be inferred from notes, route, RPE, carbs per hour or workout result.
- iPhone/PWA: 5 open gaps remain. The field record still tests server commit
  `9e05189`, so current-commit evidence is stale for expected commit `5c935be`.
- iPhone/PWA still needs warning-free certificate trust follow-up, Push
  activation/test push, real iPhone VPN/network offline fallback and device/iOS
  metadata.
- Server mirror: SSH preflight is still blocked before Git, PM2 or health checks
  with `Permission denied (publickey,password)`.
- Server recovery remains the read-only runbook path:
  `docs/ai/checklists/deploy-auth-recovery.md`.

## Product Conclusion

No ungated UI/UX or product implementation slice opens from this refresh. The
automated route pack is overflow-free on current `main`, but the durable
Performance-OS backlog is still gated by manual Fueling GI-comfort capture,
current-commit iPhone/PWA real-device proof and restored server SSH/deploy
verification.
