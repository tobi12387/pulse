# Settings Profile Preferences Disclosure QA

## Scope

- Route: `/settings` and `/settings?section=profile`.
- Change: the read-only `Athletenprofil` card keeps Garmin-relevant metrics and manual unlock actions visible, while detailed Fueling & Recovery preference rows are hidden behind `Fueling & Recovery anzeigen`.
- Non-goal: no backend, Garmin, profile-sync or edit-form contract changes.

## Verification

| Check | Result |
|---|---|
| `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Settings keeps Fueling and Recovery preferences collapsed in profile read mode" --project=mobile-chromium` | Pass after red/green; initial red failed because `Produkte` rendered by default. |
| `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Settings edits Fueling and Recovery preferences" --project=desktop-chromium --project=mobile-chromium` | Pass; edit flow still works after opening the disclosure. |
| `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Settings" --project=desktop-chromium --project=mobile-chromium` | Pass: 26 passed, 4 skipped. |
| `npm run build` | Pass. |
| `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-settings-profile-preferences-disclosure-final npm run qa:ux-evidence` | Pass: 2 route-evidence projects. |
| `npm run qa:ux-summary -- /tmp/pulse-settings-profile-preferences-disclosure-final` | Pass: 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow. |

## Evidence

- Desktop manifest: `/tmp/pulse-settings-profile-preferences-disclosure-final/2026-05-13-ab52039/desktop-chromium/manifest.json`
- Mobile manifest: `/tmp/pulse-settings-profile-preferences-disclosure-final/2026-05-13-ab52039/mobile-chromium/manifest.json`
- Mobile Settings screenshot: `/tmp/pulse-settings-profile-preferences-disclosure-final/2026-05-13-ab52039/mobile-chromium/09-settings.png`
