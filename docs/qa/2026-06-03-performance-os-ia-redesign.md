# 2026-06-03 Performance-OS IA Redesign

## Scope

- Branch: `codex/ui-ux-top-app-redesign-20260603`
- Track: `Tagesentscheidung`
- Goal: reduce route-wide UI/UX clutter after Tobi explicitly allowed a breaking, top-app-oriented redesign across routes and cards.
- Primary surfaces: global shell, Home/Heute, Data/Evidenz, Plan/Woche, Insights/Muster, Settings/System.

## Baseline Evidence

Command:

```bash
npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence
```

Baseline summary at branch start:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Evidence root: `test-results/route-evidence/2026-06-03-d5acd62/`

Manual screenshot findings:

- Home was technically safe but visually split between dark sidebar, date/header, context pills, stage strip, decision card and readiness rail before the user reached one calm answer.
- Data and Plan used correct actions, but each route had its own wording model and long tab labels, so the app felt like separate tools rather than one Performance OS.
- Mobile Plan/Data remained readable, but tab/header density made the first viewport feel louder than the primary action.

## Redesign Decisions

- Replaced the dark command-center shell with a light operational workspace.
- Renamed visible primary navigation to `Heute`, `Woche`, `Evidenz`, `Muster`, `System`.
- Kept stable URLs and deep links while allowing visible IA labels to break old wording.
- Flattened the shared card shell and nested-card surface treatment.
- Made Home's top context a compact signal bar instead of another free-floating header layer.
- Shortened Plan/Data tabs and route headers.
- Replaced the nested Data analysis route header with an embedded section header.

## Final Evidence

Commands:

```bash
npm run build -w frontend
git diff --check
npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence
npm run delivery:manifest
npm run verify:lernschleifen
npm run verify:trainingsanpassung
npm run verify:tagesentscheidung
npm run test:e2e:smoke
```

Final summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Evidence root: `test-results/route-evidence/2026-06-03-d5acd62/`
- Delivery manifest: Full Lane, mixed `lernschleifen` + `trainingsanpassung`, deploy required after merge.
- `verify:lernschleifen`: 55 contracts, frontend build, 12 rendered Data analysis smokes passed.
- `verify:trainingsanpassung`: 33 contracts, frontend build, 12 rendered Plan/Data smokes passed.
- `verify:tagesentscheidung`: 39 contracts, frontend build, Home smoke set passed with 14 passed and 2 desktop-only mobile tests skipped as expected.
- `test:e2e:smoke`: 108 passed, 14 expected viewport-affordance skips.

Manual screenshots inspected after the final run:

- `desktop-chromium/01-home.png`
- `desktop-chromium/03-data.png`
- `mobile-chromium/03-data.png`
- `mobile-chromium/06-plan.png`

Conclusion: the redesign keeps the route set overflow-safe while making the product IA more coherent: Home starts as the daily decision, Plan is weekly training control, Data is evidence capture, Insights is pattern learning and Settings is system readiness.
