# 2026-05-12 — Garmin Execution Chain UI QA

## Scope

- `/plan?tab=execution` now shows one compact Garmin execution chain for the existing readback window:
  - `Vorlage`
  - `Kalender`
  - `Readback`
  - `Repeats`
  - `Ausführung`
- The panel derives exactly one next action from the existing execution-diff rows and keeps the same repair endpoints behind explicit clicks.
- The recommended repair action is not duplicated in the row details, keeping the UI calmer.
- No backend endpoint, DB migration, LLM call, automatic plan mutation or automatic Garmin write was introduced.

## Verification

- `npm run test:frontend-logic` — passed (`14` tests).
- `npm run build -w frontend` — passed.
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan Ausführung shows Garmin execution trust|Plan Ausführung repair actions" --workers=1` — passed (`4` tests).
- `npm run qa:plan:no-garmin-write` — passed (`4` tests).
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-garmin-execution-chain npm run qa:ux-evidence` — passed (`2` tests).

## Route Evidence

- Desktop screenshots: `/tmp/pulse-garmin-execution-chain/2026-05-12-8ad4a3b/desktop-chromium/`
- Mobile screenshots: `/tmp/pulse-garmin-execution-chain/2026-05-12-8ad4a3b/mobile-chromium/`
- Horizontal overflow: `0` overflowing screenshots on desktop (`9` screenshots) and mobile (`15` screenshots).

## Notes

- The first UI run exposed duplicated `Vorlage hochladen` buttons: one in the new next-action row and one in the detail row. The detail row now suppresses only the primary recommended action, while other row-specific repair actions remain available.
