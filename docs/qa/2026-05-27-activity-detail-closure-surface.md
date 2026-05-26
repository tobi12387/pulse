# Activity Detail Closure Surface Evidence

## Scope

Focused UI/UX follow-up after the route-wide top-app redesign, command-surface pass and compact Plan week strip. Fresh deployed-main route evidence showed no horizontal overflow, but the mobile Activity Detail first viewport still read like a metrics dump: large back button, separate RPE card, then a loose KPI grid before the closure workflow felt coherent.

This route matters because Home/Data/Plan send completed-day learning, RPE and Fueling evidence capture into Activity Detail. The route should feel like a calm closure surface, not a raw activity report.

## Baseline

Command on deployed `main`:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-current-main-a30d662 npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-current-main-a30d662
```

Summary:

- desktop Chromium: 9 screenshots, 0 horizontal overflow
- mobile Chromium: 17 screenshots, 0 horizontal overflow
- commit: `a30d662`

Manual finding:

- `mobile-chromium/07-activity-detail.png` spent the first mobile viewport on title/back/RPE/metrics without naming the closure workflow.
- The route was technically correct, but the primary use case was weaker than Home/Data/Plan: close subjective load, keep Fueling inspectable and preserve the no-hidden-write contract.
- `mobile-chromium/16-activity-fueling-anchor.png` already kept the deep-linked GI-comfort action in focus and should stay functionally unchanged.

## Change

- Replace the separate top RPE card plus loose KPI grid with one `Aktivitätsabschluss` surface.
- Keep the existing `#activity-feedback` anchor and `activity-feedback-card` test id so Home's completed-day feedback handoff still lands on the closure surface.
- Add explicit `RPE bearbeiten/eintragen` and `Fueling prüfen` actions above the detailed sections.
- Keep the no-hidden-write contract visible as `Plan/Garmin unverändert`.
- Make the mobile back control icon-first while keeping accessible `Zurück` labeling.
- Leave Activity Detail data, Fueling evidence logic, nutrition writes and Plan/Garmin behavior unchanged.

## After

Command:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-activity-detail-closure-surface npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-activity-detail-closure-surface
```

Summary:

- desktop Chromium: 9 screenshots, 0 horizontal overflow
- mobile Chromium: 17 screenshots, 0 horizontal overflow
- worktree base commit: `a30d662`

Manual review:

- `mobile-chromium/07-activity-detail.png` now opens with `Aktivitätsabschluss`, current RPE, all key metrics in one stable grid, `RPE bearbeiten` and `Fueling prüfen`.
- The first viewport explains that Plan and Garmin remain unchanged.
- `mobile-chromium/16-activity-fueling-anchor.png` still lands on the GI-comfort action area.
- Desktop Activity Detail keeps the same content hierarchy but gains the closure surface.

## Verification

```bash
git diff --check
npm run build -w shared
npm run build -w frontend
npx playwright test frontend/e2e/ux-daily-flow.spec.ts --project=mobile-chromium -g "Activity detail is available under the Plan route namespace|Home daily decision uses missing post-workout feedback"
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-activity-detail-closure-surface npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-activity-detail-closure-surface
```

Result:

- all listed checks passed
- route evidence: 2 passed, 0 horizontal overflow
