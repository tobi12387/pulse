# QA — Recovery Mental Resilience

Date: 2026-05-12  
Branch: `codex/recovery-mental-resilience`

## Scope

- Added deterministic recovery/mental resilience guidance from existing Readiness, TSB, Recovery and Mental Check-in evidence.
- Added one compact Data > Mental card with `Grenze`, `Planwirkung` and `Signalqualität`.
- Kept the card out of the open Check-in first viewport when no scored Check-in exists, so `Heute speichern` remains immediately reachable on mobile.
- No backend endpoint, migration, LLM call, plan write, Garmin write or clinical diagnosis language.

## Verification

| Check | Result |
|---|---|
| `npm run test:frontend-logic` | Pass — 21 tests |
| `npm run build -w frontend` | Pass |
| `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Data Mental shows resilience guidance\|Data mental check-in keeps the primary save action" --workers=1` | Pass — 4 tests |
| `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-recovery-mental-resilience npm run qa:ux-evidence` | Pass — 2 tests |
| `git diff --check` | Pass |

## Route Evidence

Artifacts:

- `/tmp/pulse-recovery-mental-resilience/2026-05-12-d26b578/desktop-chromium/manifest.json`
- `/tmp/pulse-recovery-mental-resilience/2026-05-12-d26b578/mobile-chromium/manifest.json`

Manifest summary:

| Project | Screenshots | Horizontal overflow |
|---|---:|---:|
| Desktop Chromium | 9 | 0 |
| Mobile Chromium | 15 | 0 |

## Notes

- The focused UI test was first run red because `data-testid="resilience-guidance-card"` did not exist.
- Initial route evidence failed because the card pushed the open Check-in save action below the first mobile viewport. The final implementation renders the card only after a scored Check-in exists, preserving the mobile Check-in path.
