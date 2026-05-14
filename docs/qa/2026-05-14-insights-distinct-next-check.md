# Insights Distinct Next Check QA

## Scope

Fresh route evidence after the Settings scroll repair showed `/insights` still rendering a separate card whose only job was to say the most important check was already in the current focus. This slice keeps the Insights hero as the owner of the primary action and makes the next-check card show the next distinct read-only check instead.

## Evidence

- Before route evidence:
  - `/tmp/pulse-settings-section-scroll-repair-live/2026-05-14-8832ef5/desktop-chromium/08-insights.png`
  - `/tmp/pulse-settings-section-scroll-repair-live/2026-05-14-8832ef5/mobile-chromium/08-insights.png`
- Finding:
  - `Aktueller Fokus` already showed `Fueling-Praxis absichern`.
  - `Nächste sinnvolle Prüfung` showed only `Die wichtigste Prüfung steckt bereits im aktuellen Fokus.`
- Change:
  - Insights now builds next-check candidates, filters the current focus duplicate and renders the first distinct check by default.
  - Secondary checks remain behind `Weitere Prüfungen anzeigen`.
  - No backend, LLM, Garmin or plan writes were added.

## Verification

- Red:
  - `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Insights does not repeat the current focus" --project=mobile-chromium`
  - Result before implementation: failed because the no-op confirmation sentence was still visible.
- Green:
  - Same command after implementation: 1 passed.
- Focused Insights suite:
  - `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Insights" --project=desktop-chromium --project=mobile-chromium`
  - Result: 6 passed.
- Build:
  - `npm run build`
  - Result: passed.
- Static diff:
  - `git diff --check`
  - Result: passed.
- Route evidence:
  - `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-insights-distinct-next-check-final npm run qa:ux-evidence`
  - Result: 2 passed.
  - `npm run qa:ux-summary -- /tmp/pulse-insights-distinct-next-check-final`
  - Result: 2 manifests, 24 screenshots, 0 horizontal overflow.

## Screenshots

- After desktop: `/tmp/pulse-insights-distinct-next-check-final/2026-05-14-8832ef5/desktop-chromium/08-insights.png`
- After mobile: `/tmp/pulse-insights-distinct-next-check-final/2026-05-14-8832ef5/mobile-chromium/08-insights.png`
