# QA — Settings Profile Mobile Density

Date: 2026-05-13  
Branch: `codex/settings-profile-mobile-density`  
Scope: `/settings` Athletenprofil, especially manual Garmin profile fields on mobile.

## Intent

The profile card must keep provenance visible (`Manuell`, `Garmin`, `Aktivitäten`) while making the manual-to-automatic action easier to scan on iPhone/PWA. The slice only changes profile-card presentation; it does not change Garmin sync semantics or profile persistence.

## Red / Green

- Red: `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium -g "Settings keeps manual profile unlock actions compact on mobile" --workers=1`
  - Expected failure before implementation: profile card height `678.5625px`, limit `560px`.
- Green: same command after implementation.
  - Result: `1 passed`.

## Regression Checks

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Settings show profile value provenance|Settings keeps manual profile unlock actions compact|Settings can unlock a manual profile value|Settings edits Fueling|Settings groups actions|Mobile routes avoid unintended horizontal overflow|Mobile repeated controls" --workers=1`
  - Result: `11 passed`, `3 skipped` (desktop skips for mobile-only checks).
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-settings-profile-density-evidence-final npm run qa:ux-evidence`
  - Result: desktop and mobile route evidence passed.
- `node scripts/route-evidence-summary.mjs /tmp/pulse-settings-profile-density-evidence-final`
  - Result: desktop `9` screenshots, mobile `15` screenshots, `0` horizontal overflow.

## Evidence

- Evidence root: `/tmp/pulse-settings-profile-density-evidence-final`
- Mobile Settings screenshot: `<evidence-root>/<date>-<commit>/mobile-chromium/09-settings.png`
- Desktop Settings screenshot: `<evidence-root>/<date>-<commit>/desktop-chromium/09-settings.png`
- Manifest: `<evidence-root>/<date>-<commit>/mobile-chromium/manifest.json`

## Notes

The Browser plugin's direct Node REPL automation tool was not exposed in this session, so rendered validation used the repository's Playwright route-evidence workflow.
