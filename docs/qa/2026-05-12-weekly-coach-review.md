# QA — Weekly Coach Review

Date: 2026-05-12  
Branch: `codex/weekly-coach-review`

## Scope

- Added a deterministic `buildWeeklyCoachReview()` model for Plan > Review.
- Added a compact `/plan?tab=review` card with `Gelernt`, `Planänderung`, `Entscheidung` and exactly one primary next action.
- Routed open plan-change decisions to `/plan?tab=training&source=weekly-review#plan-change-inbox`.
- Kept the slice read-only on load: no automatic review generation, plan mutation, LLM call or Garmin write.

## Verification

| Check | Result |
|---|---|
| `npm run test:frontend-logic` | Pass — 17 tests |
| `npm run build -w frontend` | Pass |
| `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan Review surfaces the weekly coach review" --workers=1` | Pass — 2 tests |
| `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-weekly-coach-review npm run qa:ux-evidence` | Pass — 2 tests |
| `git diff --check` | Pass |

## Route Evidence

Artifacts:

- `/tmp/pulse-weekly-coach-review/2026-05-12-a217989/desktop-chromium/manifest.json`
- `/tmp/pulse-weekly-coach-review/2026-05-12-a217989/mobile-chromium/manifest.json`

Manifest summary:

| Project | Screenshots | Horizontal overflow |
|---|---:|---:|
| Desktop Chromium | 9 | 0 |
| Mobile Chromium | 15 | 0 |

## Notes

- The focused E2E was first run red and failed because `data-testid="weekly-coach-review"` did not exist.
- A second E2E run exposed a fixture shape mismatch around Season Strategy; the model now tolerates a missing `currentBlock` defensively, and the E2E fixture uses the existing mock contract.
- A direct exploratory `npx tsc -p frontend/tsconfig.app.json --noEmit` is not part of the repo verification path and failed on the existing `ignoreDeprecations` config value. The canonical frontend build (`tsc -b && vite build`) passed.
