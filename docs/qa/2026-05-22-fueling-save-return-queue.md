# Fueling Save Return Queue - 2026-05-22

Branch: `codex/fueling-capture-followup`
Track: Lernschleifen evidence support

## Trigger

The first open Performance-OS gate is still manual Fueling evidence: choose the
real GI comfort value for the existing long carb log, then close the next
candidate and finally capture one new complete long-session log. The Activity
Fueling UI already focuses the GI options, but after saving a value it left the
user on the activity without an explicit next step.

## Change

- After a successful GI-comfort save, the success notice now offers
  `Nächste Fueling-Lücke prüfen`.
- The button returns to `/data?tab=today`, where the Data evidence queue can
  recompute the next relevant Fueling or daily data action.
- The mutation still writes only the selected `giComfort` value. Plan and
  Garmin remain unchanged, and Pulse still does not infer stomach response from
  notes, route, RPE, g/h or workout result.

## Verification

```bash
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Data today promotes actionable fueling learning gaps"
```

Result:

- Desktop Chromium: passed.
- Mobile Chromium: passed.
- Asserted patch body: `{ giComfort: 'ok' }`.
- Asserted success copy keeps `Plan und Garmin bleiben unverändert`.
- Asserted the new follow-up action navigates to `/data?tab=today`.

## Conclusion

This does not open the Nutrition trend gate by itself; real GI-comfort evidence
is still required. It removes one handoff gap in the manual capture loop so the
app behaves more like a guided Performance OS after the user supplies the real
stomach-response input.
