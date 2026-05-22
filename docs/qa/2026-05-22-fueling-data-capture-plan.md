# Fueling Data Capture Plan - 2026-05-22

Branch: `codex/fueling-next-candidate`
Track: Lernschleifen evidence support

## Trigger

The first open Performance-OS gate is still Fueling learning. The audit names
two existing long carb logs that can become comparable complete logs after a
real structured GI-comfort choice, then one future complete long-session log is
still needed. Data already routed to the first Activity, but the primary action
did not show the full capture sequence.

## Change

- Data's primary Fueling action now includes a compact `Capture-Plan`.
- The plan shows complete logs versus the required floor, how many existing
  logs are directly closable, and whether new long-session logs remain after
  the current candidates.
- The copy explicitly keeps GI comfort as a real manual choice.
- No Nutrition trend summary is unlocked and no GI response is inferred from
  notes, route, RPE, g/h or workout result.

## Verification

```bash
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Data today promotes actionable fueling learning gaps"
npm run delivery:manifest -- --files frontend/src/pulse/fueling-learning.ts frontend/src/pages/Data.tsx frontend/e2e/pulse-smoke.spec.ts docs/qa/2026-05-22-fueling-data-capture-plan.md docs/decisions.md docs/ai/current-focus.md
npm run verify:lernschleifen:pr
```

Result:

- Desktop Chromium: passed.
- Mobile Chromium: passed.
- Delivery manifest: Fast Lane `Lernschleifen`, deploy required after merge.
- `verify:lernschleifen:pr`: passed.
- Asserted Data shows `0/3 komplett`, `2 vorhandene Logs direkt schließbar`,
  `danach 1 neuer Long-Session-Log` and `GI-Komfort bleibt echte Auswahl`.
- Asserted the existing Data -> Activity -> GI save -> Data primary-action
  handoff still works and still patches only `{ giComfort: 'ok' }`.

## Conclusion

This makes the MacroFactor-style Fueling learning loop more legible while the
gate is still closed. The real unblock remains manual: choose the true
GI-comfort values for the existing candidate logs, then capture one new
complete long-session log.
