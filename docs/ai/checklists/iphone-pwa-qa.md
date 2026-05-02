# iPhone / VPN / PWA QA Checklist

Use this checklist for real-device checks. Do not trigger Garmin calendar sync during this QA unless the task explicitly requires repairing Garmin workouts.

Record the result in `docs/qa/2026-05-02-iphone-pwa-real-device.md` so the evidence survives beyond chat context.

## Network

- iPhone is connected to the VPN that routes the home network.
- Open `https://192.168.178.46:5175`.
- Confirm there is no unexpected certificate warning for the address in use.
- If an auth gate is shown, confirm login succeeds and navigation stays on the local server origin. The current local Pulse surface may not show a login step.

If Safari reports "Connection is not private", record it as certificate trust friction. Continue only when the certificate is for `192.168.178.46`; for a warning-free PWA flow, install and trust only the server's `frontend/certs/rootCA.pem` on the iPhone. Never move `rootCA-key.pem` or any `*-key.pem` file to the phone.

## PWA

- Open Settings and check the top diagnostics matrix first: Zugriff, PWA, Service Worker, Push, Garmin and Zertifikat.
- Use the diagnostics shortcuts to jump to Device, Push and Garmin sections.
- Check the iPhone/PWA readiness block.
- Add Pulse to the Home Screen from Safari.
- Launch Pulse from the Home Screen.
- Confirm standalone mode is shown in Settings.

## Automated WebKit Gate

- Optional command: `PULSE_E2E_WEBKIT=true npm run test:e2e -- --project=iphone-webkit --grep "PWA|service workers|Mobile navigation|Settings PWA diagnostics|renders"`.
- Optional screenshot pack: `npm run qa:ux-evidence:iphone`.
- If Playwright reports a missing WebKit executable, install it with `npx playwright install webkit` before treating this gate as a product failure.

## Layout

- Home: primary daily action is visible without horizontal overflow.
- Coach: message list and input remain visible before and after focusing the keyboard.
- Plan: bottom navigation does not overlap the final controls.
- Settings: buttons remain above the Home indicator.

## Push

- Check the Settings diagnostics matrix and Push section show separate server, service worker, browser permission and device-subscription states.
- Activate Push only when intentionally testing notifications.
- Send a test push only after the device is registered.

## Offline

- Temporarily disconnect VPN or network.
- Reopen Pulse from the Home Screen.
- Confirm the offline fallback explains that the local server or VPN is unavailable.

## Local Operations Reference

- GitHub `main` is the source of truth.
- `/root/pulse` on `192.168.178.46` is a deploy mirror only; do not edit or commit there.
- Frontend URL: `https://192.168.178.46:5175`.
- Backend health: `http://localhost:3000/api/pulse/health` on the server.
- PM2 processes: `pulse` and `pulse-frontend`.
- Mac-local Postgres/Redis tests require Docker Desktop and the dev services; when Docker is unavailable, call this out and rely on CI/server DB checks.

## Quick Verification Commands

Run these from the Mac workspace unless noted otherwise:

```bash
npm run pulse:status
npm run services:status
npm run typecheck
npm run test:e2e -- --grep "Mobile navigation|Coach|Settings|PWA"
```

Run these against the deployed server:

```bash
ssh root@192.168.178.46 "curl -s http://localhost:3000/api/pulse/health"
ssh root@192.168.178.46 "curl -skI https://localhost:5175"
ssh root@192.168.178.46 "pm2 status"
ssh root@192.168.178.46 "cd /root/pulse && git rev-parse --short HEAD"
```

`npm run pulse:status` intentionally reports local Mac services and the server deploy mirror as separate sections. If Docker Desktop is not running, the local section may fail while the server section still proves deployed Pulse is healthy.
