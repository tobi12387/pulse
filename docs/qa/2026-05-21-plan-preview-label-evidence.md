# 2026-05-21 Plan Preview Label Evidence

## Why

Fresh route evidence was run because `docs/ai/next-product-packages.md` has no ungated product package queued. The goal was to check whether current Home/Data/Plan/Settings screens reveal a real daily-flow friction point before starting new product work.

## Evidence

Initial route screenshot review found one concrete mobile Plan issue:

- Route: `/plan?tab=training&source=mobile-intent&scenario=workout...#plan-scenario-preview`
- Viewport: `mobile-chromium`, 412 x 839
- Finding: the scenario preview status chip rendered as English `Preview-only` and wrapped as `Preview-` / `only` in the first visible preview card.
- Impact: this weakens the Plan action contract on the mobile quick-decision path, where the UI must clearly say that nothing writes to Plan or Garmin before explicit apply.

## Fix

- Replaced user-facing Plan preview status labels with `Nur Vorschau`.
- Added `whiteSpace: 'nowrap'`/`flexShrink: 0` on the compact preview chips so the label does not split on mobile.
- Extended browser assertions so the mobile scenario evidence route and smoke test require `Nur Vorschau` and reject `Preview-only`.

## Verification

```bash
npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts -g "mobile Home availability intent opens a workout scenario preview" --project=mobile-chromium
npm run test:e2e -- frontend/e2e/pulse-usability.spec.ts -g "Data Plan Load triage hands off|Plan Review surfaces" --project=desktop-chromium
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/2026-05-21-preview-label-fix npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-05-21-preview-label-fix
```

Results:

- Mobile scenario smoke: 1 passed.
- Focused Plan usability checks: 2 passed.
- Route evidence pack: 2 passed.
- Route evidence summary: 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow.
- Manual screenshot check: `15-plan-mobile-intent-scenario.png` now shows one-line `Nur Vorschau`.

## Product Conclusion

This evidence unlocked a small `Trainingsanpassung` support fix, not a new package. After the label fix, no additional ungated UI/UX product slice is visible from the refreshed route evidence. Nutrition trends still need comparable complete logs, and iPhone/PWA field reliability still needs real-device evidence.
