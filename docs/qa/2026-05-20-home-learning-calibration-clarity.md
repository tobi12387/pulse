# 2026-05-20 Home Learning Calibration Clarity

## Evidence

- Branch: `codex/route-evidence-next-intake`
- Baseline commit: `673c522`
- Before command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-19-next-intake npm run qa:ux-evidence`
- Before screenshot: `/tmp/pulse-2026-05-19-next-intake/2026-05-19-673c522/mobile-chromium/01-home.png`
- After command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-19-home-learning-short-final npm run qa:ux-evidence`
- After screenshot: `/tmp/pulse-2026-05-19-home-learning-short-final/2026-05-20-673c522/mobile-chromium/01-home.png`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-2026-05-19-home-learning-short-final`
- Result: 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow.

## Finding

The fresh mobile Home screenshot had no horizontal overflow, but the `Heute entscheidet` and `Sicherste Option` sections repeated a long technical learning-calibration sentence. The copy started with `Empfehlung darf lernen`, listed Decision Quality and watch-context details inline, and made the primary daily decision feel like analysis text rather than one calm next action.

This is a `Tagesentscheidung` friction: Home should translate Data learning into the decision language, while Data remains the place for detailed calibration evidence.

## Scope

- Keep learning calibration eligible to lead Home when its gates make it a true daily action.
- Shorten Home's learning-calibration leading factor to the actual decision pattern.
- Convert the safest option into a compact safety rule instead of repeating the full evidence sentence.
- Keep Data and Plan learning-calibration detail unchanged.

## Verification

- `./node_modules/.bin/tsx --test scripts/daily-decision-golden.test.ts scripts/daily-decision-signal-registry.test.ts`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-19-home-learning-short-final npm run qa:ux-evidence`
- `npm run qa:ux-summary -- /tmp/pulse-2026-05-19-home-learning-short-final`
- `npm run verify:tagesentscheidung`
- `npm run test:scripts`
