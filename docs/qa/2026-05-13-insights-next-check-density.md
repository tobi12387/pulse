# 2026-05-13 Insights Next Check Density

## Scope

- Branch: `codex/data-insights-density-loop`
- Route: `/insights`
- Viewports: desktop Chromium first viewport, mobile regression check
- Goal: Reduce Insights card density without changing data loading, deep analysis, Plan navigation or Evidence navigation.

## Finding

Fresh route evidence on `9450c71` showed no horizontal overflow, but the `/insights` first viewport was still visually heavy: synthesis hero, three synthesis cards, three secondary check blocks and a Deep-Dive card all competed in the same scroll segment.

Before evidence:

- `/tmp/pulse-data-insights-density-evidence/2026-05-13-9450c71/desktop-chromium/08-insights.png`
- `/tmp/pulse-data-insights-density-evidence/2026-05-13-9450c71/mobile-chromium/08-insights.png`

## What Changed

- `Nächste sinnvolle Prüfung` now renders Intervention, Datenqualität and Capability as compact rows instead of secondary block tiles.
- The same content and evidence labels remain visible.
- Mobile stacks each row vertically so meta labels do not squeeze the content.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "Insights keeps next checks compact" --workers=1`
  - RED before implementation: failed because no `insights-next-check-item` rows existed.
  - GREEN after implementation: passed.
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Insights starts as synthesis|Insights keeps next checks compact" --workers=1`
  - Passed: 4 passed.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-data-insights-density-evidence-after npm run qa:ux-evidence`
  - Passed: desktop and mobile route packs captured.
- `npm run qa:ux-summary -- /tmp/pulse-data-insights-density-evidence-after`
  - Passed: 9 desktop screenshots, 15 mobile screenshots, 0 overflow.
- `npm run build -w frontend`
  - Passed.
- `npm run test:e2e:smoke`
  - Passed: 48 passed, 8 skipped.

## Evidence Artifacts

- `/tmp/pulse-data-insights-density-evidence-after/2026-05-13-9450c71/desktop-chromium/08-insights.png`
- `/tmp/pulse-data-insights-density-evidence-after/2026-05-13-9450c71/mobile-chromium/08-insights.png`

Artifacts remain outside the repo and are not committed.
