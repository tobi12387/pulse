# 2026-05-06 Autonomous Field QA

## Scope

Autonomous checks after CI-flow cleanup and recent Home/Profile runtime PRs.

## Server Mirror

- Local `origin/main`: `15bbfe6`.
- Server `/root/pulse`: `ff44071` on `main`.
- Server is behind `main` only by CI/docs commits `#195`-`#197`; no runtime deploy was triggered.
- Frontend: `https://192.168.178.46:5175/` returned `HTTP 200`.
- Backend health through frontend proxy: `/api/pulse/health` returned `{"status":"ok","namespace":"pulse"}`.
- PM2 processes `pulse` and `pulse-frontend` were online.

## Server Log Notes

- Backend out logs show current Garmin sync success for 2026-05-06, including profile provenance checks and weight sync.
- Backend error logs still contain historical Garmin SSO Cloudflare `429`/`1015` rate-limit output from 2026-04-30 and one Garmin authorization exception. No current health failure was observed during this QA pass.
- Frontend logs contain historical Vite proxy errors for `/api/garmin/status`, consistent with backend restarts or temporary connection resets.
- PM2 restart counters are high (`pulse`: 294, `pulse-frontend`: 164), but both processes report `unstable restarts: 0` and have been online since 2026-05-05 19:25 UTC.

## Route Evidence

Command:

```bash
npm run qa:ux-evidence
```

Result:

- Passed: 2/2 route-evidence projects.
- Generated evidence path: `test-results/route-evidence/2026-05-06-15bbfe6/`.
- Captured desktop Chromium and mobile Chromium for `/`, `/coach`, `/data`, `/data?tab=mental`, `/data?tab=analysen`, `/plan` and `/settings`.
- Manifest summaries reported no document-level horizontal overflow on any captured route.

Visual notes:

- Home is cleaner than the earlier complaint state, with the no-training day now framed as a closeable recovery decision instead of a confusing dead end.
- Data and Plan remain dense but usable on mobile.
- Data's many tabs require horizontal scrolling on mobile. This is expected and currently covered by tests, but the partial off-edge labels can still feel visually abrupt on iPhone.
- Settings diagnostics now expose access, PWA mode, service worker and push readiness distinctly.

## Browser Smoke

Command:

```bash
npm run test:e2e:smoke
```

Result:

- Passed: 21.
- Skipped: 1 expected mobile hotkey test.
- Duration: 7.3s.

## Open Manual Gates

These need Tobi's real device or product preferences:

1. Real iPhone Safari/PWA state: exact iPhone model, iOS version, VPN route, certificate trust state and whether Pulse is launched from Safari or Home Screen.
2. Push activation: current permission state on the iPhone/PWA and whether a real test push arrives.
3. Fueling & Recovery preferences: dietary constraints, preferred products, whether grams/hour carbohydrate and sodium ranges are acceptable, and whether body-weight-based guidance may be shown.
4. Native iOS decision gate: only relevant if the iPhone PWA field run exposes recurring friction that cannot be solved in the web layer.

## Recommended Next Autonomous PRs

1. Add an ops follow-up that summarizes PM2 restart counters and recent Garmin rate-limit/auth exceptions in `npm run pulse:status` or server verification output, so agents do not have to inspect PM2 logs manually.
2. If the mobile Data tab strip feels irritating on the real iPhone, make a narrow UI PR to improve scroll affordance or active-tab positioning without adding another navigation layer.
