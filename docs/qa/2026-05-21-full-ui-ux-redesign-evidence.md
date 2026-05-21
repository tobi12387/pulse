# Full UI/UX Redesign Evidence — 2026-05-21

Branch: `codex/full-ui-ux-redesign`
Evidence manifest commit marker before this branch commit: `90c5fb7`

## User Request

Tobi requested a complete UI/UX redesign because Pulse still felt unclear and poorly structured. The redesign was explicitly allowed to touch all routes and to be breaking where useful.

## Direction

- Move Pulse from technical cockpit language toward a route-wide product surface.
- Keep the main information architecture focused:
  - `Heute` decides.
  - `Plan` controls the training week.
  - `Daten` proves what changed.
  - `Analyse` learns patterns.
  - `Setup` keeps devices and readiness stable.
- Treat cards as prioritization surfaces, not equal boxes. Primary cards keep stronger hierarchy; secondary evidence stays subordinate.
- Reduce terminal-style labels by making the shared `label-mono` visual language more readable while preserving mono treatment for actual metrics.
- Keep mobile headers compact enough that the first real task appears earlier.

## Implementation Scope

- `frontend/src/components/Layout.tsx`
  - Reordered primary navigation to `Heute`, `Plan`, `Daten`, `Analyse`, `Setup`.
  - Updated desktop and mobile labels, route descriptions, hotkey help and sidebar intent.
- `frontend/src/hooks/useHotkeys.ts`
  - Matched keyboard shortcuts to the new route order.
- `frontend/src/components/PulseChrome.tsx`
  - Rebuilt `PageHeader`, `SegmentedControl` and `RangeControl` as shared class-based product primitives.
  - Removed hidden desktop/mobile duplicate title text; the component now renders only the visible title for the current viewport.
- `frontend/src/index.css`
  - Reworked global product tokens, card density, label language, page headers, shared segmented controls, mobile route density, Coach header, Activity header and KPI grid.
  - Tightened mobile route headers and segmented tabs so Data/Plan/Settings start their work surfaces earlier without removing the visible H1 route title.
- `frontend/src/components/ui/focus.tsx` and `frontend/src/features/today/DecisionHero.tsx`
  - Redefined the Home focus card shell, stage strip, recovery panel, pills and training snapshot away from terminal-like inline styling.
- `frontend/src/pages/Home.tsx`
  - Added a compact daily context layer above the decision without replacing the primary decision card.
  - Removed the duplicate KPI card row after the Hero; on mobile, the repeated context pills and training-window chip are hidden so the decision and CTA start earlier.
- `frontend/src/pages/Data.tsx`
  - Reframed Data as the route that shows the next relevant evidence task first.
  - Aligned the visible route identity and tablist accessibility label to `Daten`.
  - Added the concrete Fueling target log to the primary Data action so the current manual unblock names the existing long log before the GI-comfort click.
- `frontend/src/pages/Plan.tsx`
  - Reframed Plan around conscious weekly control and explicit no-hidden-write behavior.
- `frontend/src/features/plan/training/training-components.tsx`
  - Rebuilt the Plan week strip as a compact week controller with icon navigation, stable seven-day pills, week load summary and responsive mobile density.
- `frontend/src/features/plan/PlanWeeklyDecisionContractPanel.tsx`
  - Reordered the weekly decision card so explicit options and the active preview appear before evidence detail lanes; mobile detail copy is visually clamped so the card starts as a decision surface, not a report.
- `frontend/src/pages/Insights.tsx`
  - Reframed Insights as pattern synthesis first, deeper analysis second.
  - Aligned the route header to the primary navigation label `Analyse`.
- `frontend/src/pages/Settings.tsx`
  - Reframed Settings as setup/readiness for the daily decision.
  - Aligned the compact route header and diagnostics summary label to `Setup`.
- `frontend/src/pages/Coach.tsx`
  - Added a clear route header that positions Coach as clarification, not the primary daily surface.
- `frontend/src/pages/ActivityDetail.tsx`
  - Added a clearer activity header and more responsive KPI grid.
  - Added an inline Fueling save confirmation after GI/detail evidence updates so the manual unblock explicitly ends with Plan/Garmin unchanged.

## Verification

```bash
git diff --check
npm --prefix frontend run build
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-full-redesign npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence-full-redesign
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-home-hero-refine npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence-home-hero-refine
npx playwright test frontend/e2e/ux-a11y-responsive.spec.ts frontend/e2e/pulse-smoke.spec.ts --grep "mobile top-level headers use compact route titles before the work surface|mobile Data tabs wrap without document-level horizontal overflow|Data mobile subnavigation keeps every section tab in the visible viewport|Data mobile deep links do not clip the tab row|Plan mobile week strip fits seven days without hidden horizontal scrolling|Plan mobile workout rows wrap status chips without horizontal overflow|Plan desktop starts the planning surface with the week before the next decision" --project=desktop-chromium --project=mobile-chromium
npx playwright test frontend/e2e/pulse-smoke.spec.ts frontend/e2e/pulse-usability.spec.ts --grep "Plan starts with the current action contract|Plan weekly decision surfaces repeated tradeoffs without applying plan or Garmin|Plan exposes open change signals in one inbox before detailed evidence|Data Plan Load triage hands off to the shared Plan weekly decision|Plan Review keeps" --project=desktop-chromium --project=mobile-chromium
npx playwright test frontend/e2e/ux-a11y-responsive.spec.ts frontend/e2e/pulse-smoke.spec.ts frontend/e2e/pulse-usability.spec.ts --grep "mobile top-level headers use compact route titles before the work surface|Data segmented tabs support arrow-key navigation|/insights renders as a top-level evidence route|Data mobile subnavigation keeps every section tab in the visible viewport|Data mobile deep links do not clip the tab row|top-level hotkeys follow the Focus navigation order|Mobile navigation and tabs keep core labels readable" --project=desktop-chromium --project=mobile-chromium
npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "Data today promotes actionable fueling learning gaps" --project=desktop-chromium --project=mobile-chromium
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-next-ui-pass npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence-next-ui-pass
npx playwright test frontend/e2e/ux-a11y-responsive.spec.ts frontend/e2e/ux-daily-flow.spec.ts --grep "Focus shell exposes handoff keyboard help|keyboard tabbing exposes|mobile top-level headers|desktop Focus operational routes" --project=desktop-chromium --project=mobile-chromium
npm run test:e2e:smoke
npm run delivery:manifest
npm run verify:tagesentscheidung
npm run verify:lernschleifen
npm run verify:trainingsanpassung
```

Route evidence summary:

- Full redesign pack: Desktop Chromium 9 screenshots and Mobile Chromium 17 screenshots, 0 horizontal overflow.
- Home Hero refinement pack: Desktop Chromium 9 screenshots and Mobile Chromium 17 screenshots, 0 horizontal overflow.
- Plan/header compactness pack: Desktop Chromium 9 screenshots and Mobile Chromium 17 screenshots, 0 horizontal overflow.
- Route IA language consistency pack: Desktop Chromium 9 screenshots and Mobile Chromium 17 screenshots, 0 horizontal overflow.
- Fueling target-log pass: Desktop Chromium 9 screenshots and Mobile Chromium 17 screenshots, 0 horizontal overflow.

Smoke and track gates:

- `npm run test:e2e:smoke`: 105 passed, 13 skipped.
- Focused responsive/A11y route smoke: 5 passed, 3 skipped.
- Focused Plan/Data mobile compactness smoke: 7 passed, 7 skipped.
- Focused weekly decision order/handoff smoke: 10 passed.
- Focused route IA language smoke: 9 passed, 5 skipped.
- Focused Data Fueling action smoke: 2 passed.
- `npm run delivery:manifest`: Full Lane, mixed track `tagesentscheidung`, `lernschleifen`, `trainingsanpassung`; deploy required after merge; hold for review.
- `npm run verify:tagesentscheidung`: passed.
- `npm run verify:lernschleifen`: passed.
- `npm run verify:trainingsanpassung`: passed.

Manual screenshot review covered:

- Desktop: Home, Coach, Data, Plan, Insights, Settings.
- Mobile: Home, Data, Data Fueling action, Plan, Activity Detail, Insights.

Follow-up observation:

- This PR intentionally changes route labels and the keyboard navigation order. Any brittle UI copy tests should follow the new IA rather than preserving the old `Data` before `Plan` ordering.
