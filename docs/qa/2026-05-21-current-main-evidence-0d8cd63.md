# 2026-05-21 - Current Main Evidence 0d8cd63

## Trigger

PRs #555, #556 and #557 refreshed the Fueling gate audit, aligned route fixtures
with the real 0/3 trend gate and added in-app Activity Fueling action paths.
This pass refreshes the current `main` evidence so future sessions can decide
whether a new product package is unlocked from current state rather than from
older screenshots or chat memory.

## Route Evidence

- Branch: `codex/current-main-evidence-0d8cd63`
- Commit: `0d8cd63`
- Command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-main-0d8cd63-route-evidence npm run qa:ux-evidence`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-2026-05-21-main-0d8cd63-route-evidence`
- Evidence root: `/tmp/pulse-2026-05-21-main-0d8cd63-route-evidence/2026-05-21-0d8cd63/`

Result:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Route pack passed for Home, Coach compatibility route, Data, Plan, Activity Detail, Insights and Settings.
- Mobile Daily Command scenarios passed for planned workout, free trainable day, completed Garmin activity, recovery-protect day, Data Mental first viewport, Data Fueling action, Activity Fueling anchor and Plan mobile scenario preview.

Reviewed screenshots:

- Home first decision: `/tmp/pulse-2026-05-21-main-0d8cd63-route-evidence/2026-05-21-0d8cd63/mobile-chromium/01-home.png`
- Data Fueling primary action: `/tmp/pulse-2026-05-21-main-0d8cd63-route-evidence/2026-05-21-0d8cd63/mobile-chromium/15-data-fueling-action.png`
- Activity Fueling anchor: `/tmp/pulse-2026-05-21-main-0d8cd63-route-evidence/2026-05-21-0d8cd63/mobile-chromium/16-activity-fueling-anchor.png`
- Plan mobile intent scenario: `/tmp/pulse-2026-05-21-main-0d8cd63-route-evidence/2026-05-21-0d8cd63/mobile-chromium/17-plan-mobile-intent-scenario.png`
- Settings first viewport: `/tmp/pulse-2026-05-21-main-0d8cd63-route-evidence/2026-05-21-0d8cd63/mobile-chromium/09-settings.png`

Findings:

- Home keeps `Lernschleife` and `Muster pruefen` in the primary daily contract.
- Data keeps `Fueling-Evidenz schliessen` as an immediate primary action with `Trend-Evidenz 0/3`.
- Activity Detail opens the Fueling closure area with the GI comfort choices visible and focused.
- Plan mobile scenario preview keeps `Nur Vorschau`, no-hidden-write copy and conscious apply/cancel controls visible.
- Settings shows no new first-viewport blocker.
- No horizontal overflow or concrete route friction was found in this current-main pass.

## Fueling Gate Evidence

Command:

```bash
npm run audit:fueling-gate -- --today 2026-05-21
```

Result:

- Window: `2026-01-21..2026-05-21`
- During logs: 4
- Comparable long logs: 2
- Comparable complete logs: 0/3
- Existing logs completable now: 2
- New complete long-session logs still needed after completion candidates: 1
- Next action path: `/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`
- Second completion path: `/plan/activity/4f4b873d-bb64-4410-8e63-a382e9729863#activity-fueling-log`

## Ops Evidence

Commands:

```bash
npm run pulse:status
scripts/verify-server.sh
```

Result:

- Local direct endpoints from `.env.test.example` are reachable: Postgres on `localhost:5433/coaching_os_v2_test` and Redis on `localhost:6380`.
- Docker Compose services are not running, so local verification should use `npm run verify:local -- --no-services` in this setup.
- Server mirror verification still fails at SSH preflight with `Permission denied (publickey,password)`.
- Follow `docs/ai/checklists/deploy-auth-recovery.md` before retrying deploy or server verification.

## Product Conclusion

Do not open a new UI/UX implementation slice from this evidence alone. The
autonomous Performance-OS backlog remains gated until comparable complete
nutrition logs, real iPhone/PWA evidence, a new route/user friction point or
Tobi's explicit direction creates a stronger product signal.
