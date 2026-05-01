# Pulse iPhone / VPN / PWA Real-Device QA — 2026-05-02

> Evidence record for the manual iPhone gate. Fill this on the actual iPhone connected through VPN to the local Pulse server.

## Scope

- Device:
- iOS version:
- Browser / launch mode:
- VPN profile:
- Pulse URL: `https://192.168.178.46:5175`
- Server commit under test:

## Preconditions

- [ ] iPhone routes the home network through VPN.
- [ ] Pulse server health is green: `GET /api/pulse/health`.
- [ ] Frontend returns `HTTP/2 200`.
- [ ] Do not trigger Garmin calendar sync during this QA unless explicitly repairing workouts.

## Results

| Area | Expected | Result | Notes |
|---|---|---|---|
| Network | URL opens via VPN on local origin | Pending | |
| Certificate | No unexpected warning for the address in use | Pending | |
| Login | Auth succeeds and stays on local origin | Pending | |
| Settings readiness | iPhone/PWA block shows secure context, service worker and push capability truthfully | Pending | |
| Add to Home Screen | Pulse launches from Home Screen | Pending | |
| Standalone mode | Settings shows standalone after Home Screen launch | Pending | |
| Home | Daily action fits without horizontal overflow | Pending | |
| Coach | Input remains usable before/after keyboard focus | Pending | |
| Plan | Bottom nav does not overlap final controls | Pending | |
| Insights | Evidence/missing-data states remain readable | Pending | |
| Push support | Settings reports support/permission state; no test push unless intentionally triggered | Pending | |
| Offline fallback | Disconnecting VPN/network shows local server/VPN unavailable fallback | Pending | |

## Issues Found

| Severity | Route | Finding | Evidence | Follow-up |
|---|---|---|---|---|
| - | - | None recorded yet | - | - |

## Sign-off

- Tested by:
- Date/time:
- Result: Pending
- Follow-up PRs:
