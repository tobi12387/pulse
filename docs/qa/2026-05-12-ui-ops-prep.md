# UI/UX And Ops Prep

## Scope

Preparation for the next two open workstreams:

1. UI/UX slices should only start from fresh evidence and a concrete daily-flow friction.
2. Server verification should distinguish fresh log signals from stale PM2 log history.

No product UI is changed in this prep slice.

## UI/UX Prep

- Added `scripts/route-evidence-summary.mjs`.
- Added `npm run qa:ux-summary -- <evidence-root>`.
- Updated `docs/qa/route-evidence-pack.md` with a next-slice intake checklist.

Expected next UI/UX flow:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-next-ui npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-next-ui
```

Then open the screenshots and write a short QA note before changing UI. A new UI PR should name the affected route, viewport, screenshot, smallest proposed change and after-check.

## Ops Prep

- Added `scripts/server-log-attention.mjs`.
- `scripts/verify-server.sh` now reports timestamp-aware attention counts:
  - `recent_attention`: timestamped attention inside the configured window;
  - `stale_attention`: timestamped attention older than the window;
  - `undated_attention`: matching log lines without parseable timestamps.
- Default window: `PULSE_SERVER_LOG_WINDOW_MINUTES=60`.
- Override: `PULSE_SERVER_LOG_SINCE=<ISO timestamp>`.

This keeps old Garmin/Cloudflare/proxy lines from looking like fresh deploy problems while still making undated PM2/Vite log lines visible.

## Verification Plan

- Red/green helper tests for server log attention and route evidence summary.
- `npm run test:scripts`.
- `PULSE_SERVER_LOG_WINDOW_MINUTES=120 PULSE_EXPECTED_COMMIT=<live> bash scripts/verify-server.sh`.
- `npm run qa:ux-summary -- <latest-evidence-root>`.

## Verification Result

- `node --test scripts/server-log-attention.test.mjs`: red before helper existed, green after implementation.
- `node --test scripts/route-evidence-summary.test.mjs`: red before helper existed, green after implementation.
- `npm run test:scripts`: pass, 13 `.mjs` script tests and 21 frontend-logic tests.
- `bash -n scripts/verify-server.sh`: pass.
- `npm run qa:ux-summary -- /tmp/pulse-settings-push-status`: pass; 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow.
- `PLAYWRIGHT_BASE_URL=https://192.168.178.46:5175 PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-ui-ops-prep-live npm run qa:ux-evidence`: pass, 2 tests.
- `npm run qa:ux-summary -- /tmp/pulse-ui-ops-prep-live`: pass; live server evidence on `b622e72`, 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow.
- `PULSE_EXPECTED_COMMIT=b622e72 PULSE_SERVER_LOG_WINDOW_MINUTES=120 bash scripts/verify-server.sh`: pass; server clean on `b622e72`, PM2 online, frontend/API health ok, `recent_attention=0` for backend and frontend logs, old/undated lines separated.
