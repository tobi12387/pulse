# iPhone / VPN / PWA QA Checklist

Use this checklist for real-device checks. Do not trigger Garmin calendar sync during this QA unless the task explicitly requires repairing Garmin workouts.

Record the result in `docs/qa/2026-05-02-iphone-pwa-real-device.md` so the evidence survives beyond chat context.
Append a fresh field run with its own `## Scope` and `## Results` sections; the audit reads the latest run as one record, so older stale evidence can remain as history.

Before treating the field record as current, run `npm run audit:iphone-pwa-gate`
from the repo. The audit compares `Server commit under test` with the expected
current commit, resolves both commits to their latest app-runtime commit, and
keeps the gate closed when the field evidence is stale. Docs-only server drift
can remain current when the app-runtime commit is unchanged; frontend, backend,
shared or package changes still require fresh real-device evidence.
For a live packet of the current field gaps and recording steps, run
`npm run audit:iphone-pwa-gate -- --packet`.
For the shortest first-gap field prompt to use in a manual capture/chat
handoff, run `npm run audit:iphone-pwa-gate -- --next-prompt`.
For paste-ready Markdown for a new field run, including the server preflight and
the current open gap targets before the `## Scope` record, run
`npm run audit:iphone-pwa-gate -- --scaffold`.
When the scaffold prints an expected app-runtime commit, replace the
`App runtime commit under test` placeholder with the observed Settings
`App-Stand`. This lets docs/tooling-only server commits stay auditable without
pretending an old app runtime was newly tested.
The packet prints the exact `PULSE_EXPECTED_COMMIT=<commit> npm run verify:server`
command to run before recording new current real-device evidence, including
`PULSE_HOST=<ssh-host>` when the workspace is using an SSH alias such as
`pulse-server`. It also prints the read-only
`PULSE_EXPECTED_COMMIT=<commit> npm run verify:server -- --packet` handoff for
SSH preflight failures; if SSH is still blocked, follow
`docs/ai/checklists/deploy-auth-recovery.md` before continuing the iPhone field
run.

For a combined Performance-OS handoff, run
`npm run audit:performance-gates -- --today <YYYY-MM-DD> --packet`. It defaults
to local `HEAD`; add `--expected-commit <short>` only when the field run is
intentionally pinned to a known deployed/runtime commit.
Use `npm run audit:performance-checklist -- --today <YYYY-MM-DD>` when the
manual run needs a shorter checkbox checklist instead of the full handoff
packet.

From feature branches, packet/checklist/next-target handoff modes auto-apply
local-planning behavior so a local branch does not create a phantom server
mirror gate. Add `--local-planning` manually only for non-handoff planning
summaries that need the same deferred server behavior. Local planning defaults
the expected commit to `origin/main`. Do not use that deferred server result as
current iPhone field evidence; rerun the normal audit or
`PULSE_EXPECTED_COMMIT=<commit> npm run verify:server` from clean `main` before
recording a real-device run.

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
- Optional field-gate audit: `npm run audit:iphone-pwa-gate` reads the repo evidence record and lists remaining real-device gaps.
- If Playwright reports a missing WebKit executable, install it with `npx playwright install webkit` before treating this gate as a product failure.
- If Playwright reports missing WebKit shared libraries, install host dependencies with `npx playwright install-deps webkit` before treating this gate as a product failure.
- Latest local evidence: `docs/qa/2026-05-21-iphone-webkit-stage-strip.md`.

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
- Optional automated fallback proof: `npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts -g "PWA manifest|service worker navigation fallback|app starts when service workers" --project=desktop-chromium --project=mobile-chromium`.
- Optional iPhone WebKit fallback proof: `PULSE_E2E_WEBKIT=true npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts -g "PWA manifest|service worker navigation fallback|app starts when service workers" --project=iphone-webkit`.

## Local Operations Reference

- GitHub `main` is the source of truth.
- `/root/pulse` on `192.168.178.46` is a deploy mirror only; do not edit or commit there.
- Frontend URL: `https://192.168.178.46:5175`.
- Backend health: `http://localhost:3000/api/pulse/health` on the server.
- PM2 processes: `pulse` and `pulse-frontend`.
- The field record must name the server commit that was actually tested; stale
  commit evidence does not prove current iPhone/PWA readiness.
- If Settings shows an `App-Stand` commit, also record it as `App runtime commit
  under test`; the audit can then distinguish docs/tooling-only server drift
  from frontend/backend/shared/package runtime changes.
- Mac-local Postgres/Redis tests normally use Docker Desktop and the dev services. If Docker Compose is down but `npm run pulse:status` reports the configured DB/Redis endpoints as reachable, use `npm run verify:local -- --no-services`; if migrations fail because the test DB is ahead of its Drizzle ledger, point `DATABASE_URL_TEST` at a fresh empty test DB and rerun no-services verification. Otherwise call out the local DB gate and rely on CI/server DB checks.

## Quick Verification Commands

Run these from the Mac workspace unless noted otherwise:

```bash
npm run pulse:status
npm run services:status
npm run typecheck
npm run test:e2e -- --grep "Mobile navigation|Coach|Settings|PWA"
```

Before a current real-device field run, verify the deployed mirror through the
server preflight wrapper from a clean local `main`:

```bash
git switch main
git pull --ff-only
PULSE_EXPECTED_COMMIT="$(git rev-parse --short HEAD)" npm run verify:server
```

If direct `root@192.168.178.46` auth fails but the local SSH alias works, keep
the alias in the command so the field packet and server verifier use the same
host:

```bash
PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT="$(git rev-parse --short HEAD)" npm run verify:server
```

If this fails at SSH auth before server Git/PM2/health checks, do not continue
the iPhone field run as current evidence yet. Use the read-only handoff first:

```bash
PULSE_EXPECTED_COMMIT="$(git rev-parse --short HEAD)" npm run verify:server -- --packet
```

After SSH auth is restored, raw server checks are optional diagnostics behind the
same boundary:

```bash
ssh root@192.168.178.46 "curl -s http://localhost:3000/api/pulse/health"
ssh root@192.168.178.46 "curl -skI https://localhost:5175"
ssh root@192.168.178.46 "pm2 status"
ssh root@192.168.178.46 "cd /root/pulse && git rev-parse --short HEAD"
```

`npm run pulse:status` intentionally reports local Mac services and the server deploy mirror as separate sections. If Docker Compose is down, it also probes the configured DB/Redis endpoints from `.env.test` or `.env.test.example`; `local_status=0` means the direct no-services verification path is available even though `npm run services:status` remains strict.
