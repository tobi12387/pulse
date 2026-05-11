# Insights Synthesis Focus QA — 2026-05-11

## Scope

Differentiate `/insights` from `Data > Analyse`.

- `/insights` now starts with a synthesis hero, three synthesis cards and a compact next-check section.
- Deep domain analysis stays available behind `Tiefe Analyse anzeigen`.
- `Data > Analyse` keeps the full evidence workbench unchanged.
- No backend, Garmin, plan generation or write behavior changed.

## Evidence

Fresh route evidence after the change:

- Desktop: `test-results/route-evidence/insights-synthesis-after/2026-05-11-<commit>/desktop-chromium/`
- Mobile: `test-results/route-evidence/insights-synthesis-after/2026-05-11-<commit>/mobile-chromium/`

Key screenshots:

- Desktop `/insights`: `test-results/route-evidence/insights-synthesis-after/2026-05-11-<commit>/desktop-chromium/07-insights.png`
- Mobile `/insights`: `test-results/route-evidence/insights-synthesis-after/2026-05-11-<commit>/mobile-chromium/07-insights.png`
- Data analysis remains available: `test-results/route-evidence/insights-synthesis-after/2026-05-11-<commit>/desktop-chromium/05-data-analysis.png`

Manifest overflow check:

- Desktop core routes: no horizontal overflow.
- Mobile core and daily-flow routes: no horizontal overflow.

## Verification Commands

```bash
npm run lint -w frontend
npm run build -w frontend
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Insights|Data analysis"
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "Insights|Data analyses"
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/insights-synthesis-after npm run qa:ux-evidence
```

All commands passed.

## Notes

- The new usability test verifies that `/insights` makes no `/api/pulse/insights` request on first load.
- Opening `Tiefe Analyse anzeigen` only reveals collapsed domain cards; the deep AI request starts only after a domain card such as `Gesamt` is opened.
- A mobile route-evidence pass found cramped hero text on the first implementation. The hero now wraps via flex so buttons stack below text on narrow screens.
