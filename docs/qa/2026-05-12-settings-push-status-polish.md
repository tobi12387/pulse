# Settings Push Status Polish QA

## Scope

- Route: `/settings`
- Commit under test before implementation: `0e7210c`
- Evidence pack: `/tmp/pulse-main-live-evidence/2026-05-12-0e7210c/`

## Finding

Live route evidence showed no horizontal overflow on desktop or mobile, but Settings could still feel heavier than necessary: when only browser Push permission was blocked, the first Settings card reported `Problem beheben`. This overstated the severity because Pulse remains usable through local VPN/PWA, Garmin and manual app flows without Push.

## Expected Behavior

- Core blockers remain `Problem beheben`: insecure access, missing Service Worker, unavailable Garmin.
- Push states remain visible and actionable through `Push öffnen`.
- A blocked or inactive Push state is an optional device action when the core app is otherwise ready.

## Verification

- Red test added: `Settings treats blocked push as optional when core access is ready`.
- Existing mixed-state regression updated so blocked Garmin remains the actual readiness blocker while Push stays visible in expanded diagnostics.
- Focused Settings regression: desktop and mobile Chromium.
- Frontend production build.
- Route evidence pack after the UI change: `/tmp/pulse-settings-push-status/2026-05-12-0e7210c/` with 9 desktop screenshots, 15 mobile screenshots and 0 horizontal overflow findings.
