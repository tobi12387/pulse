# Performance OS Route Evidence Pass

Date: 2026-05-15
Commit: `775c46a`
Branch: `codex/performance-os-route-evidence`

## Why

After Daily Intelligent Action Contract v2, Everyday Adaptation Inbox v1 and Analysis Translation v1, the Performance-OS spec calls for fresh route evidence before opening another broad UI/UX runtime slice. The question was whether Home, Plan, Data, Insights, Coach or Settings now need first-viewport responsibility changes.

## Commands

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-performance-os-route-evidence npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-performance-os-route-evidence
```

## Evidence Root

`/tmp/pulse-performance-os-route-evidence/2026-05-15-775c46a/`

Desktop Chromium:

- `desktop-chromium/01-home.png`
- `desktop-chromium/05-data-analysis.png`
- `desktop-chromium/06-plan.png`
- `desktop-chromium/08-insights.png`

Mobile Chromium:

- `mobile-chromium/01-home.png`
- `mobile-chromium/05-data-analysis.png`
- `mobile-chromium/06-plan.png`
- `mobile-chromium/08-insights.png`
- `mobile-chromium/15-plan-mobile-intent-scenario.png`

## Summary Output

- Manifests: 2
- Desktop screenshots: 9
- Mobile screenshots: 15
- Horizontal overflow: 0
- Base URL: `http://127.0.0.1:5173`

## Findings

- Home still owns the daily decision. Desktop and mobile first viewports show one primary action with details behind disclosure; no immediate Home restructure is justified by this pack.
- Data > Analyse now starts with `Analyse -> Tageswirkung`, which translates deep evidence into the actionable Fueling/goal signal and the not-yet-trend-ready fueling evidence gap. It does not require opening AI deep-insight cards.
- Plan Training starts with the week and primary plan action, then exposes `Heute anders?` as the adaptation path. On mobile this is below the primary action, which matches Plan's week/execution job; no hidden write path is visible.
- Insights starts with one synthesis focus and keeps deeper checks behind explicit actions. The route now agrees with Data > Analyse rather than competing with it.
- No screenshot shows horizontal overflow, clipped primary controls, incoherent overlap or a first-viewport role conflict severe enough for an immediate UI restructuring PR.

## Next-Slice Intake

- **Route and viewport with friction:** none proven by this evidence pack.
- **Real daily-flow problem or aesthetic preference:** no new daily-flow blocker; further changes would currently be polish without stronger evidence.
- **Smallest useful next change:** do not open a broad UI rebuild. Keep Nutrition Learning Loop gated until comparable logs exist, or use future real-data/real-device evidence to select a narrower slice.
- **Before-state proof:** screenshots listed above plus 0-overflow manifest summary.
- **After-state proof needed for future runtime work:** rerun `npm run qa:ux-evidence` and a focused smoke for the touched route.
