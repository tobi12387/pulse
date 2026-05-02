# iPhone / VPN / PWA QA Checklist

Use this checklist for real-device checks. Do not trigger Garmin calendar sync during this QA unless the task explicitly requires repairing Garmin workouts.

Record the result in `docs/qa/2026-05-02-iphone-pwa-real-device.md` so the evidence survives beyond chat context.

## Network

- iPhone is connected to the VPN that routes the home network.
- Open `https://192.168.178.46:5175`.
- Confirm there is no unexpected certificate warning for the address in use.
- Confirm login succeeds and navigation stays on the local server origin.

## PWA

- Open Settings and check the iPhone/PWA readiness block.
- Add Pulse to the Home Screen from Safari.
- Launch Pulse from the Home Screen.
- Confirm standalone mode is shown in Settings.

## Automated WebKit Gate

- Optional command: `PULSE_E2E_WEBKIT=true npm run test:e2e -- --project=iphone-webkit --grep "PWA|service workers|Mobile navigation|renders"`.
- If Playwright reports a missing WebKit executable, install it with `npx playwright install webkit` before treating this gate as a product failure.

## Layout

- Home: primary daily action is visible without horizontal overflow.
- Coach: message list and input remain visible before and after focusing the keyboard.
- Plan: bottom navigation does not overlap the final controls.
- Settings: buttons remain above the Home indicator.

## Push

- Check Settings shows whether Web Push is supported on this browser/device.
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
