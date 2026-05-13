# 2026-05-13 UI Density Evidence Loop

## Scope

- Route evidence root: `/tmp/pulse-ui-density-evidence/2026-05-13-b6e7ecc`
- Baseline commit: `b6e7ecc`
- Projects: `desktop-chromium`, `mobile-chromium`
- Routes captured: `/`, `/coach`, `/data`, `/data?tab=today#data-mental`, `/data?tab=analysis`, `/plan`, `/plan/activity/activity-detail`, `/insights`, `/settings` plus mobile daily-command scenarios.

## Baseline Summary

```text
desktop-chromium: 9 screenshots, 0 overflow
mobile-chromium: 15 screenshots, 0 overflow
```

No horizontal overflow was recorded. The remaining issue was visual and cognitive density rather than a containment bug.

## Finding

### Mobile `/data` repeats orientation before the work surface

- **Viewport:** mobile Chromium.
- **Before evidence:** `/tmp/pulse-ui-density-evidence/2026-05-13-b6e7ecc/mobile-chromium/03-data.png`
- **Problem:** Data already has the compact mobile page title `Data` and the active tab `Heute relevant`, then repeats `DATA · HEUTE RELEVANT`, `Heute relevant` and a summary paragraph before the primary `Daten-Aktion`.
- **Why it matters:** The route is supposed to start with one daily data task. Repeating route/tab context pushes the action lower and makes the first mobile viewport feel more like a dashboard intro than a task surface.
- **Smallest fix:** Keep the desktop intro for orientation, but hide the duplicate Data intro eyebrow and summary paragraph on mobile. Keep the `Heute relevant` heading, tab semantics, action card, data logic and deep links unchanged.

## After-State To Verify

- Mobile `/data` still shows the `Data` route title and active `Heute relevant` tab.
- Mobile `/data` no longer shows the duplicate intro eyebrow or summary paragraph before the primary action.
- Desktop `/data` keeps the explanatory intro.
- Route evidence remains free of horizontal overflow.

## After-State Evidence

- Route evidence root: `/tmp/pulse-ui-density-evidence-after/2026-05-13-b6e7ecc`
- Mobile `/data`: `/tmp/pulse-ui-density-evidence-after/2026-05-13-b6e7ecc/mobile-chromium/03-data.png`
- Desktop `/data`: `/tmp/pulse-ui-density-evidence-after/2026-05-13-b6e7ecc/desktop-chromium/03-data.png`

```text
desktop-chromium: 9 screenshots, 0 overflow
mobile-chromium: 15 screenshots, 0 overflow
```

Focused checks:

```text
npm run test:e2e -- frontend/e2e/ux-a11y-responsive.spec.ts frontend/e2e/ux-data-mental.spec.ts --project=desktop-chromium --project=mobile-chromium
27 passed, 5 skipped

npm run build -w frontend
passed

npm run test:e2e:smoke
48 passed, 8 skipped
```
