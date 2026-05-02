# Pulse iPhone / VPN / PWA Real-Device QA — 2026-05-02

> Evidence record for the manual iPhone gate. Fill this on the actual iPhone connected through VPN to the local Pulse server.

## Scope

- Device:
- iOS version:
- Browser / launch mode: Safari, then Home Screen PWA launch
- VPN profile: Active; exact profile not recorded
- Pulse URL: `https://192.168.178.46:5175`
- Server commit under test: `9e05189`

To capture the deployed commit before the manual run:

```bash
ssh root@192.168.178.46 "cd /root/pulse && git rev-parse --short HEAD"
```

## Preconditions

- [x] iPhone routes the home network through VPN.
- [x] Pulse server health is green: `GET /api/pulse/health`.
- [x] Frontend returns `HTTP/2 200`.
- [x] Do not trigger Garmin calendar sync during this QA unless explicitly repairing workouts.

Server precheck commands:

```bash
ssh root@192.168.178.46 "curl -s http://localhost:3000/api/pulse/health"
ssh root@192.168.178.46 "curl -skI https://localhost:5175"
ssh root@192.168.178.46 "pm2 status"
```

## Results

| Area | Expected | Result | Notes |
|---|---|---|---|
| Network | URL opens via VPN on local origin | Pass | Tobi reached `https://192.168.178.46:5175` from iPhone over VPN. |
| Certificate | No unexpected warning for the address in use | Needs follow-up | Safari first showed "Connection is not private"; user could continue to the app. Root CA trust is the remaining operational friction. |
| Login | Auth succeeds and stays on local origin | Not applicable | Current local Pulse surface shows no login gate. Checklist updated to test auth only if an auth gate appears. |
| Settings readiness | iPhone/PWA block shows secure context, service worker and push capability truthfully | Pass | Settings shows "iPhone und PWA Geraetezugriff bereit"; user reported the block looks good. |
| Add to Home Screen | Pulse launches from Home Screen | Pass | Add-to-Home-Screen succeeded. |
| Standalone mode | Settings shows standalone after Home Screen launch | Pass | Home Screen launch succeeded and Settings readiness still looked good. |
| Home | Daily action fits without horizontal overflow | Pass | User reported Home as ok. |
| Coach | Input remains usable before/after keyboard focus | Pass | User reported Coach ok and received a response after entering a message. |
| Plan | Bottom nav does not overlap final controls | Pass | User reported Plan as ok. |
| Insights | Evidence/missing-data states remain readable | Pass | User reported Insights as ok. |
| Push support | Settings reports support/permission state; no test push unless intentionally triggered | Partial | Readiness block reports iPhone/PWA device access ready. Push permission activation/test push was not intentionally triggered. |
| Offline fallback | Disconnecting VPN/network shows local server/VPN unavailable fallback | Pending | |

## Issues Found

| Severity | Route | Finding | Evidence | Follow-up |
|---|---|---|---|---|
| P2 | Safari / PWA entry | iPhone does not yet trust the local Pulse certificate chain. | Safari showed "Connection is not private" before allowing the user to continue. | Install only `/root/pulse/frontend/certs/rootCA.pem` on the iPhone and enable full trust in iOS certificate trust settings; never transfer `rootCA-key.pem` or any `*-key.pem`. |
| P3 | QA checklist | Checklist expected a login step, but the current local Pulse surface has no login gate. | Tobi reported "Login gibt es nicht." | Checklist now says to verify auth only if a login/auth gate appears. |

## Sign-off

- Tested by: Tobi, guided by Codex
- Date/time: 2026-05-02 evening Europe/Berlin
- Result: Pass with certificate-trust follow-up; no mobile layout or Coach keyboard blocker found.
- Follow-up PRs: This evidence branch.
