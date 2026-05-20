# 2026-05-21 PWA Offline Fallback

## Evidence

- Branch: `codex/pwa-offline-fallback-proof`
- Baseline commit: `c26497a`
- Command: `npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts -g "PWA manifest|service worker navigation fallback|app starts when service workers" --project=desktop-chromium --project=mobile-chromium`
- Result: 6 passed.
- iPhone WebKit command: `PULSE_E2E_WEBKIT=true npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts -g "PWA manifest|service worker navigation fallback|app starts when service workers" --project=iphone-webkit`
- iPhone WebKit result: 3 passed.

## Finding

The service worker fallback is now tested as executable behavior, not only as source text. The smoke test executes the actual `frontend/public/sw.js` fetch handler, forces navigation fetch failure and verifies that Pulse returns the local-server/VPN outage fallback.

The offline fallback now tells the user that the installed app is available but the local server or VPN is not reachable, asks them to check VPN/WLAN or restart the local Pulse server and provides a reload action.

## Scope

This is automated PWA fallback coverage. It does not replace the manual real-device offline check on Tobi's iPhone, where disconnecting VPN/network still needs field evidence.
