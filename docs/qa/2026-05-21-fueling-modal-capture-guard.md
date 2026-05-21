# 2026-05-21 — Fueling Modal Capture Guard

## Scope

- Activity Fueling new-log modal now carries the same evidence boundary as the Fueling gate handoff:
  - GI comfort must be the real stomach response, not inferred from notes, route, RPE, g/h or result.
  - Sodium, temperature and sweat-rate are measured-only fields.
- The modal is height-limited and scrollable so the added guard copy does not push `SPEICHERN` out of reach on smaller viewports.

## Verification

```bash
npm run delivery:manifest -- --files frontend/src/components/NutritionLogModal.tsx frontend/e2e/pulse-usability.spec.ts
npx playwright test frontend/e2e/pulse-usability.spec.ts -g "Activity fueling log captures 750ml bottles, powder, snacks and GI comfort" --project=desktop-chromium
git diff --check
npm run build -w frontend
npm run test:e2e:smoke
```

Result: all commands passed after adding the scroll constraint to the modal shell.

## Gate State

This does not complete Fueling learning by itself. Manual evidence capture is still required through the Activity Fueling UI, then `npm run audit:fueling-gate -- --today 2026-05-21` should be rerun.
