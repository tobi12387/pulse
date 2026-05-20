# 2026-05-20 Home Quiet Goal Continuity

## Evidence

- Branch: `codex/replenish-performance-os-backlog`
- Baseline commit: `b9399d1`
- Before command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-20-goal-continuation npm run qa:ux-evidence`
- Before screenshot: `/tmp/pulse-2026-05-20-goal-continuation/2026-05-20-b9399d1/mobile-chromium/01-home.png`
- After command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-20-quiet-continuity-after npm run qa:ux-evidence`
- After screenshot: `/tmp/pulse-2026-05-20-quiet-continuity-after/2026-05-20-b9399d1/mobile-chromium/01-home.png`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-2026-05-20-quiet-continuity-after`
- Result: 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow.

## Finding

The fresh mobile Home screenshot had no horizontal overflow, but the quiet goal-progress continuity text repeated Data-level detail inside the primary decision card. The `Seit letzter Entscheidung` paragraph included the full watched goal summary plus limiter explanation, which pushed the action area lower and made a quiet evidence signal feel analytical again.

This is a `Tagesentscheidung` friction because stable/watch goal progress should reassure Home without making the daily decision read like Data analysis.

## Scope

- Keep stable/watch goal progress out of `Heute entscheidet`, CTA and `Sicherste Option`.
- Keep the Data handoff evidence link for goal detail.
- Shorten Home continuity to one compact Data-evidence sentence.
- Preserve at-risk or blocked goal limiter action paths.

## Verification

- `./node_modules/.bin/tsx --test scripts/daily-decision-golden.test.ts`
- `npm run verify:tagesentscheidung:fast`
- `npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts -g "Home daily decision keeps on-track goal progress as quiet motivation" --project=mobile-chromium --project=desktop-chromium`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-20-quiet-continuity-after npm run qa:ux-evidence`
- `npm run qa:ux-summary -- /tmp/pulse-2026-05-20-quiet-continuity-after`
