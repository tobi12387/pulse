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

## Addendum — Light Action-First Pass

Tobi explicitly allowed cards and routes to be redefined further, including breaking UI/UX changes. The follow-up pass keeps the IA from the first redesign, but changes the product feel more decisively:

- Replaced the dark cockpit theme with a light, calm performance-app surface across CSS tokens and the shared `focusCssVars` override.
- Added an explicit `--accent-contrast` token and moved primary action foregrounds off `--bg`, so accent buttons stay readable in the new light shell.
- Moved Home's primary daily action above the secondary decision-detail block, making the first screen action-first instead of explanation-first.
- On mobile Home, the action-first daily card now hides secondary continuity/safest-option rows from the first viewport while keeping the decision data in the card contract.
- On mobile Plan, the weekly decision options now behave like a compact three-choice selector; detailed impact/result copy stays in the active preview instead of making the first viewport read like a report.
- Tightened mobile shell spacing and segmented controls so Data and Plan tabs fit in one row without hidden horizontal overflow.
- Fixed the mobile Coach route title so the compatibility route no longer appears as `Heute` in the top bar.
- Updated PWA manifest, theme color and offline fallback colors to match the new UI shell.

Additional verification:

```bash
npm --prefix frontend run build
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-redesign-final-light-action npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence-redesign-final-light-action
npx playwright test frontend/e2e/ux-a11y-responsive.spec.ts frontend/e2e/pulse-smoke.spec.ts frontend/e2e/pulse-usability.spec.ts --grep "mobile top-level headers use compact route titles before the work surface|Data segmented tabs support arrow-key navigation|mobile Data overview skips duplicate intro copy before the daily action|Mobile navigation and tabs keep core labels readable|Data mobile subnavigation keeps every section tab in the visible viewport|Data mobile deep links do not clip the tab row|Plan mobile week strip fits seven days without hidden horizontal scrolling|PWA manifest and service worker endpoints are available|primary navigation exposes Focus routes without Coach tab|/insights renders as a top-level evidence route" --project=desktop-chromium --project=mobile-chromium
npm run test:e2e:smoke
npm run delivery:manifest
npm run verify:lernschleifen
npm run verify:trainingsanpassung
npm run verify:tagesentscheidung
```

Result:

- Final light-action route evidence: Desktop Chromium 9 screenshots and Mobile Chromium 17 screenshots, 0 horizontal overflow.
- Focused responsive/PWA/IA checks: 14 passed, 6 skipped.
- Full smoke: 105 passed, 13 skipped.
- Track gates passed: `verify:lernschleifen`, `verify:trainingsanpassung`, `verify:tagesentscheidung`.
- Mobile daily-card compaction recheck: `verify:tagesentscheidung` passed with 39 contract/golden tests, frontend build and 14 rendered Home smokes.
- Mobile Plan selector recheck: frontend build, four focused mobile Plan/navigation smokes, route evidence and `verify:trainingsanpassung` passed.
- Frontend build passed.

## Addendum — Mobile Home True Action-First Polish

After the main-sync review, the mobile Home screenshot still showed one remaining clarity issue: the primary daily CTA was visible earlier than before, but the card repeated the same action again as `Nächster Schritt` before the user reached Readiness.

The polish keeps the same Daily Decision contract and details drawer, but changes mobile action order:

- The primary CTA now sits immediately below the daily decision title.
- The `Warum jetzt` copy and leading factor remain visible as evidence after the action.
- The duplicate mobile `Nächster Schritt` summary is hidden for action-first Home cards.
- The `Details & Evidenz anzeigen` control stays visible, so contract, signals, safest option and evidence remain reachable without crowding the first viewport.

Additional verification:

```bash
git diff --check
npm --prefix frontend run build
npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Home mobile puts the daily action before evidence copy|Data mobile keeps the missing-check-in action before optional detail copy" --project=mobile-chromium
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-redesign-action-first npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence-redesign-action-first
```

Result:

- Focused mobile action-first checks: 2 passed.
- Route evidence at `054ccaa`: Desktop Chromium 9 screenshots and Mobile Chromium 17 screenshots, 0 horizontal overflow.

## Addendum — Command Stack and Neutral Palette Pass

Tobi clarified that cards may be completely redefined and breaking route/UI changes are acceptable if they make Pulse feel like a top app. This pass keeps the shipped route IA, but removes one remaining source of daily-surface complexity:

- Removed the local Home surface focus selector and its localStorage preference path.
- Replaced configurable card sorting with a fixed Home command stack: mental check-in, primary action, today options, adaptation, delta, learning, history and follow-ups.
- Added a compact sidebar Command Flow so desktop navigation reads as `Heute -> Plan -> Daten -> Analyse`.
- Moved Data's section control into the route header action area so the work surface starts cleaner.
- Shifted the visual system from teal/green dominance to a neutral light shell with blue accent and separate green/amber/rose states.
- Updated PWA manifest, service-worker offline shell and theme color to match the new palette.

Additional verification:

```bash
git diff --check
npm --prefix frontend run build
npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Daily command stack" --project=desktop-chromium --project=mobile-chromium
npx playwright test frontend/e2e/ux-a11y-responsive.spec.ts frontend/e2e/pulse-smoke.spec.ts frontend/e2e/pulse-usability.spec.ts --grep "mobile top-level headers|Data segmented tabs support arrow-key navigation|Mobile navigation and tabs keep core labels readable|primary navigation exposes Focus routes without Coach tab|PWA manifest and service worker endpoints are available|Daily command stack|Data today promotes actionable fueling learning gaps|Data mobile subnavigation keeps every section tab in the visible viewport|Data mobile deep links do not clip the tab row" --project=desktop-chromium --project=mobile-chromium
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-redesign-command-stack npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence-redesign-command-stack
npm run verify:lernschleifen
npm run verify:trainingsanpassung
npm run verify:tagesentscheidung
npm run test:e2e:smoke
```

Result:

- Command-stack focused checks: 4 passed.
- Focused responsive/PWA/navigation/Data checks: 16 passed, 4 viewport-specific skipped.
- Route evidence: Desktop Chromium 9 screenshots and Mobile Chromium 17 screenshots, 0 horizontal overflow.
- Track gates passed: `verify:lernschleifen`, `verify:trainingsanpassung`, `verify:tagesentscheidung`.
- Full smoke: 105 passed, 13 skipped.

## Addendum — Data Fueling Action Options

The local planning gate showed that Fueling learning remains blocked by comparable long-session logs and GI comfort values. The Data primary action already linked to the correct target log; this pass makes the allowed GI-comfort choices visible before the user opens the activity:

- The Data daily action now shows the target log and the exact GI comfort options: `Magen ok`, `Magen leicht unruhig`, `Magenprobleme`.
- The hint stays inside the primary action card so the next manual input is clear without adding a second explanatory surface.
- The focused Data smoke now verifies that all three structured options are visible for the actionable Fueling gap.

Additional verification:

```bash
git diff --check
npm --prefix frontend run build
npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "Data today promotes actionable fueling learning gaps" --project=desktop-chromium --project=mobile-chromium
npm run verify:lernschleifen:pr
```

Result:

- Focused Data Fueling smoke: 2 passed.
- `verify:lernschleifen:pr` passed with 55 contract/golden tests and frontend build.

## Addendum — Activity Fueling GI Options

Fresh route evidence on the resumed Redesign branch stayed overflow-free, but the Activity Fueling anchor still had one manual-gate UX issue: the three GI-comfort choices looked muted/disabled even though they are the decisive action for the current Fueling unblock.

This pass keeps the same evidence contract and write behavior, but makes the choice UI read as a real decision:

- The Activity Fueling GI-comfort group now renders the three choices as stable, color-coded option buttons: green `Magen ok`, amber `Magen leicht unruhig`, rose `Magenprobleme`.
- The options are in a responsive grid with explicit viewport coverage in route evidence and focused smoke coverage.
- The action still saves only the selected structured GI comfort value; Plan and Garmin remain unchanged.

Additional verification:

```bash
git diff --check
npm --prefix frontend run build
npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "Data today promotes actionable fueling learning gaps" --project=desktop-chromium --project=mobile-chromium
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-redesign-gi-options-full-2026-05-22 npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence-redesign-gi-options-full-2026-05-22
npm run verify:lernschleifen:pr
```

Result:

- Focused Data-to-Activity Fueling smoke: 2 passed.
- Route evidence: Desktop Chromium 9 screenshots and Mobile Chromium 17 screenshots, 0 horizontal overflow.
- `verify:lernschleifen:pr` passed with 55 contract/golden tests and frontend build.

## Addendum — Mobile Topbar Command Polish

Fresh route evidence on the resumed redesign branch showed no overflow, but mobile top-level pages still repeated route identity before the actual work surface: the topbar route title, PageHeader eyebrow and H1 all said the same thing on Data/Plan/Setup-style routes.

This pass keeps the primary navigation order and visible page H1s, but makes the mobile chrome more task-first:

- The mobile topbar now uses the right side for a compact Coach command button instead of repeating the current route title.
- Mobile PageHeader eyebrows are hidden, so Data/Plan/Setup start with one clear route title and then the tabs or work surface.
- Route-evidence capture now anchors on visible text only, so hidden responsive labels do not create false screenshot failures.

Additional verification:

```bash
git diff --check
npm --prefix frontend run build
npx playwright test frontend/e2e/ux-a11y-responsive.spec.ts --grep "mobile top-level headers|Mobile navigation and tabs keep core labels readable|primary navigation exposes Focus routes without Coach tab" --project=mobile-chromium --project=desktop-chromium
npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Mobile navigation and tabs keep core labels readable" --project=mobile-chromium
npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "primary navigation exposes Focus routes without Coach tab|PWA manifest and service worker endpoints are available" --project=desktop-chromium --project=mobile-chromium
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-redesign-mobile-command-2026-05-22 npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence-redesign-mobile-command-2026-05-22
npm run test:e2e:smoke
npm run verify:lernschleifen
npm run verify:trainingsanpassung
npm run verify:tagesentscheidung
```

Result:

- Frontend build passed.
- Mobile top-level header smoke: 1 passed, 1 desktop skip.
- Mobile navigation readability smoke: 1 passed.
- Primary navigation/PWA smoke: 4 passed.
- Route evidence: Desktop Chromium 9 screenshots and Mobile Chromium 17 screenshots, 0 horizontal overflow.
- Full smoke passed after updating shared visible-text route anchors: 105 passed, 13 skipped.
- Full track gates passed: `verify:lernschleifen`, `verify:trainingsanpassung`, `verify:tagesentscheidung`.
