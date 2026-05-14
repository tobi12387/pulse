# Settings Section Scroll Repair

## Goal

1. Repair the red main Playwright regression for `/settings?section=push`.
2. Keep the desktop Settings layout from the previous slice.
3. Preserve URL-backed diagnostics actions so they land on the relevant Settings section after async cards load.

## Root Cause

The Settings desktop layout now places status/profile above a two-column secondary grid. The old anchor effect ran only once on the first animation frame. At that moment async profile, Garmin and diagnostics cards had not fully expanded, so the target looked near enough and the scroll became a no-op. Once the cards loaded, `Benachrichtigungen` moved below the first viewport and the URL-backed state test failed at y ~845.

## Implementation

- Keep `/settings` as a wide operational route.
- Add a small Settings-only anchor scroll helper.
- For an active `section` query, scroll immediately and then observe the Settings layout root for short-lived resize changes, with a final scroll after the initial async layout window.
- Do not change Settings order, labels or section IDs.

## Acceptance

- Red: `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Data, Plan and Settings preserve URL-backed UI state" --project=desktop-chromium` failed on `origin/main` with `Received: 844.859375`.
- Green: the same focused test passes after the fix.
- Focused Settings desktop/mobile route checks: 8 passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Local route evidence: 2 manifests, 24 screenshots, 0 horizontal overflow.
- Server deploy verification is required after PR merge.
