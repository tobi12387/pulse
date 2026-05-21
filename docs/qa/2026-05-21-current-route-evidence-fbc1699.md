# 2026-05-21 — Current Route Evidence at fbc1699

## Scope

- Current `main` commit: `fbc1699`.
- Purpose: refresh UI/UX evidence while Performance-OS product packages are
  gated by manual Fueling and real iPhone/PWA field evidence.
- Evidence root:
  `test-results/route-evidence/2026-05-21-fbc1699`.

## Commands

```bash
npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-05-21-fbc1699
PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=fbc1699 npm run verify:server
PULSE_HOST=pulse-server npm run audit:performance-gates -- --today 2026-05-21 --packet
```

## Result

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Server mirror: clean `main` at `fbc1699`; `pulse` and `pulse-frontend`
  online; frontend and API health endpoints returned OK.

## Manual Review

- `mobile-chromium/15-data-fueling-action.png`: Data still promotes the
  Fueling evidence closure action as the primary data action.
- `mobile-chromium/16-activity-fueling-anchor.png`: Activity Fueling still
  focuses the GI comfort action group and keeps the no-inference copy visible.
- `mobile-chromium/17-plan-mobile-intent-scenario.png`: Plan scenario preview
  still says `Nur Vorschau` and does not imply hidden Plan or Garmin writes.
- `mobile-chromium/09-settings.png`: Settings status and diagnostics remain
  readable on mobile.

## Conclusion

No new UI/UX implementation slice is justified from this route pass. The open
Performance-OS gates remain manual:

- Fueling learning: add real GI comfort on the existing long carb logs; do not
  infer GI comfort from notes, route, RPE, carbs per hour or result.
- iPhone/PWA field: rerun the real-device checklist against current deployed
  `main` and record `Server commit under test: fbc1699`.
