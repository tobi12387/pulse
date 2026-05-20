# 2026-05-21 iPhone WebKit Gate

## Evidence

- Branch: `codex/record-iphone-webkit-gate`
- Baseline commit: `b68fa7c`
- Browser install command: `npm run test:e2e:install:webkit`
- Host dependency command: `npx playwright install-deps webkit`
- Gate command: `PULSE_E2E_WEBKIT=true npm run test:e2e -- --project=iphone-webkit --grep "PWA|service workers|Mobile navigation|Settings PWA diagnostics|renders"`
- Result: 14 passed in 25.5s.

## Finding

The optional iPhone WebKit gate now runs locally on the Linux Codex host after installing both the Playwright WebKit browser and WebKit host libraries.

The first run failed before app code executed because WebKit shared libraries were missing. After `npx playwright install-deps webkit`, the same bounded gate passed across route render smokes, PWA/service-worker checks, Settings standalone iPhone diagnostics, mobile navigation readability, login rendering and the daily decision render checks.

## Scope

This is simulated iPhone WebKit coverage, not replacement evidence for the real iPhone/VPN/PWA field gate. The manual certificate-trust, push activation and offline fallback checks remain separate real-device gates.
