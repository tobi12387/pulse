# iPhone WebKit QA Contract - 2026-05-27

## Scope

Refresh the simulated iPhone WebKit QA contract after the top-app shell redesign. The app runtime did not need a product-code fix; the stale checks still expected the old mobile stage strip and counted every `Tagesentscheidung` label on Home instead of the single main decision card.

## Changes

- The mobile shell readability check now verifies the current compact Home hero, visible daily-decision labels, the hidden mobile stage strip, bottom navigation labels and Data tab bounds.
- The Home daily-decision uniqueness check now scopes to `focus-decision-hero` and `daily-decision-card`, so the page heading no longer counts as a duplicate decision card.

## Verification

- `npm run build -w shared`
- `git diff --check`
- `npm run build -w frontend`
- `PULSE_E2E_WEBKIT=true npm run test:e2e -- --project=iphone-webkit --grep "Mobile shell keeps core labels readable|Home renders exactly one main daily decision card"`: 2 passed.
- `PULSE_E2E_WEBKIT=true npm run test:e2e -- --project=iphone-webkit --grep "PWA|service workers|Mobile shell keeps core labels readable|Settings PWA diagnostics|renders|Home renders exactly one main daily decision card"`: 15 passed.
- `npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium --shard=1/8` through `--shard=8/8`: all shards passed, 108 passed and 14 project-specific skips across the full smoke file.

## Gate Note

This is simulated iPhone WebKit coverage only. It does not close the real iPhone/VPN/PWA field gate: certificate trust, Home Screen launch, Push activation, offline fallback and Settings `App-Stand` still need current real-device evidence from the manual checklist.
