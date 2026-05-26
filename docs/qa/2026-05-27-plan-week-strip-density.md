# 2026-05-27 - Plan Week Strip Density

## Scope

Focused UI/UX follow-up after the command-surface pass. The fresh route evidence showed that Home and Data were calmer, while mobile Plan still spent too much first-viewport space on the week selector before the weekly decision.

This pass changes only the responsive presentation of the Plan week strip. It does not change plan generation, workout selection, Garmin writes or weekly decision logic.

## Before Evidence

Baseline command on deployed `main`:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-plan-week-strip-baseline npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-plan-week-strip-baseline
```

Summary:

- desktop Chromium: 9 screenshots, 0 horizontal overflow
- mobile Chromium: 17 screenshots, 0 horizontal overflow
- commit under evidence: `b2101d1`

Manual finding:

- Mobile Plan still used a large week-navigation band plus seven mini day cards.
- The repeated `frei` labels added noise on empty weeks.
- The week strip consumed enough height that the weekly decision felt secondary, even though it is the actual Plan command surface.

## Change

- Make the mobile week navigation row borderless and smaller while preserving previous/next controls.
- Turn the seven mobile day tiles into a compact segmented strip with one shared surface.
- Keep empty-day information accessible via the existing aria label, but hide repeated visual `frei` labels.
- Preserve the highlighted current day and workout day affordances.

## After Evidence

Final command:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-plan-week-strip-density npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-plan-week-strip-density
```

Summary:

- desktop Chromium: 9 screenshots, 0 horizontal overflow
- mobile Chromium: 17 screenshots, 0 horizontal overflow
- commit under evidence before commit: `b2101d1`

Manual review:

- Mobile Plan week context is materially shorter and quieter.
- The weekly decision starts higher in the first viewport.
- Desktop Plan remains visually unchanged apart from the shared current CSS bundle.
- Mobile scenario preview remains unaffected; no hidden Plan or Garmin write path changed.

## Verification

```bash
git diff --check
npm run build -w frontend
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-plan-week-strip-density npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-plan-week-strip-density
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=mobile-chromium -g "Plan mobile week strip fits seven days without hidden horizontal scrolling|Plan mobile subnavigation keeps every section tab in the visible viewport"
```

Result:

- `git diff --check`: passed
- `npm run build -w frontend`: passed
- route evidence: 2 passed, 0 horizontal overflow
- focused mobile Plan smoke: 2 passed
