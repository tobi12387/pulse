# 2026-05-20 Plan Mobile Weekly Decision Clarity

## Evidence

- Branch: `codex/plan-mobile-weekly-clarity`
- Baseline commit: `f1ccbaf`
- Before command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-20-plan-mobile-intake npm run qa:ux-evidence`
- Before screenshot: `/tmp/pulse-2026-05-20-plan-mobile-intake/2026-05-20-f1ccbaf/mobile-chromium/06-plan.png`
- After command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-20-plan-mobile-after npm run qa:ux-evidence`
- After screenshot: `/tmp/pulse-2026-05-20-plan-mobile-after/2026-05-20-f1ccbaf/mobile-chromium/06-plan.png`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-2026-05-20-plan-mobile-after`
- Result: 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow.

## Finding

The fresh mobile Plan screenshot had no horizontal overflow, but the weekly decision evidence sections rendered as two narrow columns. The `Gelernt` lane wrapped the learning-calibration contract into short broken lines, making the weekly decision feel slower to scan on the iPhone path.

This is a `Trainingsanpassung` friction because Plan should make the week decision explicit and quickly confirmable before any Plan or Garmin write.

## Scope

- Stack weekly decision evidence sections on narrow mobile viewports.
- Keep the desktop layout dense and multi-column.
- Keep weekly options, receipts, preview-only behavior and Plan/Garmin no-write boundaries unchanged.
- Add a mobile smoke assertion that `Geaendert` appears below `Gelernt` instead of beside it.

## Verification

- `npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts -g "Plan weekly decision surfaces learning calibration without applying plan or Garmin" --project=mobile-chromium --project=desktop-chromium`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-20-plan-mobile-after npm run qa:ux-evidence`
- `npm run qa:ux-summary -- /tmp/pulse-2026-05-20-plan-mobile-after`
- `npm run verify:trainingsanpassung`
