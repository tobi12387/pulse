# 2026-05-21 - Current Main Evidence ae3285d

## Trigger

`main` now includes the iPhone/PWA field-gate audit from PR #563. This pass
refreshes current-main route, gate and ops evidence before opening more
Performance-OS product work, while PR #560 and PR #564 remain clean,
green and review-held.

## Route Evidence

- Branch: `codex/current-gates-evidence`
- Commit: `ae3285d`
- Command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-main-ae3285d-route-evidence npm run qa:ux-evidence`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-2026-05-21-main-ae3285d-route-evidence`
- Evidence root: `/tmp/pulse-2026-05-21-main-ae3285d-route-evidence/2026-05-21-ae3285d/`

Result:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Route pack passed for Home, Coach compatibility route, Data, Plan, Activity Detail, Insights and Settings.
- Mobile Daily Command scenarios passed for planned workout, free trainable day, completed Garmin activity, recovery-protect day, Data Mental first viewport, Data Fueling action, Activity Fueling anchor and Plan mobile scenario preview.

Reviewed screenshots:

- Home first decision: `/tmp/pulse-2026-05-21-main-ae3285d-route-evidence/2026-05-21-ae3285d/mobile-chromium/01-home.png`
- Data Fueling primary action: `/tmp/pulse-2026-05-21-main-ae3285d-route-evidence/2026-05-21-ae3285d/mobile-chromium/15-data-fueling-action.png`
- Activity Fueling anchor: `/tmp/pulse-2026-05-21-main-ae3285d-route-evidence/2026-05-21-ae3285d/mobile-chromium/16-activity-fueling-anchor.png`
- Plan mobile intent scenario: `/tmp/pulse-2026-05-21-main-ae3285d-route-evidence/2026-05-21-ae3285d/mobile-chromium/17-plan-mobile-intent-scenario.png`
- Settings first viewport: `/tmp/pulse-2026-05-21-main-ae3285d-route-evidence/2026-05-21-ae3285d/mobile-chromium/09-settings.png`

Findings:

- Home keeps the daily answer action-first and readable on mobile, with `Lernschleife` and `Muster pruefen` still translated into user-facing action language.
- Data keeps `Fueling-Evidenz schliessen` as the primary action and still labels the Fueling trend gate as `0/3`.
- Activity Detail opens the Fueling closure area with the GI comfort options visible and focused.
- Plan mobile scenario preview keeps `Nur Vorschau`, no-hidden-write copy and conscious apply/cancel controls visible.
- Settings first viewport remains readable and does not show a new mobile layout blocker.
- No horizontal overflow or concrete route friction was found in this current-main pass.

## Fueling Gate Evidence

Command:

```bash
npm run audit:fueling-gate -- --today 2026-05-21
```

Result:

- Gate: `gated`
- Window: `2026-01-21..2026-05-21`
- During logs: 4
- Comparable long logs: 2
- Comparable complete logs: 0/3
- Existing logs completable now: 2
- New complete long-session logs still needed after completion candidates: 1
- Next action: add structured GI comfort to the 2026-05-09 long carb log.
- Next action path: `/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`
- Second completion path: `/plan/activity/4f4b873d-bb64-4410-8e63-a382e9729863#activity-fueling-log`
- Accepted GI comfort values remain `ok`, `mild_issue` and `issue`.

## iPhone/PWA Field Gate Evidence

Command:

```bash
node scripts/iphone-pwa-gate-audit.mjs
```

Result:

- Gate: `gated`
- Evidence file: `docs/qa/2026-05-02-iphone-pwa-real-device.md`
- Server commit under test in the old field record: `9e05189`
- Device metadata: missing device and iOS version
- Open gaps: warning-free certificate trust, Push activation and test push, real iPhone VPN/network offline fallback, device and iOS metadata.
- Next action: install and trust only `frontend/certs/rootCA.pem` on the iPhone, then record a warning-free Safari/PWA launch.

Note: PR #564 exposes the same audit as `npm run audit:iphone-pwa-gate`, but that npm alias is not part of current `main` at commit `ae3285d`.

## Ops Evidence

Commands:

```bash
npm run pulse:status
PULSE_EXPECTED_COMMIT="$(git rev-parse --short HEAD)" npm run verify:server
```

Result:

- Local direct endpoints from `.env.test.example` are reachable: Postgres on `localhost:5433/coaching_os_v2_test` and Redis on `localhost:6380`.
- Docker Compose services are not running, so local verification should use `npm run verify:local -- --no-services` in this setup.
- Server mirror verification still fails at SSH preflight with `Permission denied (publickey,password)`.
- Current `main` stops at the raw SSH-auth error; PR #560 remains the open clean/green support PR that prints the expected commit and recovery runbook during this failure path.
- Follow `docs/ai/checklists/deploy-auth-recovery.md` before retrying deploy or server verification.

## Open PR State During This Pass

- PR #560 `chore: expose pending deploy commit on ssh failure`: open, clean, green, review-held because it touches deploy/server ops scripts.
- PR #564 `chore: expose iphone pwa gate audit script`: open, clean, green, review-held because it touches the root package manifest.

## Product Conclusion

Do not open a new UI/UX, Fueling, iPhone/PWA or deploy product slice from this
evidence alone. The autonomous Performance-OS backlog remains gated until
comparable complete nutrition logs, real iPhone/PWA field evidence, restored
server SSH/deploy access, a new route/user friction point or Tobi's explicit
direction creates a stronger product signal.
