# Fueling Save Data Anchor - 2026-05-22

Branch: `codex/fueling-handoff-status`
Track: Lernschleifen evidence support

## Trigger

The previous Fueling save follow-up returned to `/data?tab=today` with a
Fueling-specific label. That was correct while Fueling is the current unblock,
but Data can legitimately prioritize mental, Garmin or other data-quality work
before the next Fueling candidate.

## Change

- The successful GI-comfort save follow-up is now labeled
  `Nächste Datenlücke prüfen`.
- The button opens `/data?tab=today#data-primary-action` so the user lands on
  the currently prioritized Data action.
- The primary Data action section is focusable and has a scroll margin for
  stable mobile and desktop anchor navigation.
- The mutation still writes only the selected `giComfort` value. Plan and
  Garmin remain unchanged, and Pulse still does not infer stomach response from
  notes, route, RPE, g/h or workout result.

## Verification

```bash
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Data today promotes actionable fueling learning gaps"
npm run delivery:manifest -- --files frontend/src/pages/ActivityDetail.tsx frontend/src/pages/Data.tsx frontend/e2e/pulse-smoke.spec.ts docs/qa/2026-05-22-fueling-save-data-anchor.md docs/decisions.md docs/ai/current-focus.md
npm run verify:tagesentscheidung
npm run verify:lernschleifen
```

Result:

- Desktop Chromium: passed.
- Mobile Chromium: passed.
- Delivery manifest: Full Lane, mixed `tagesentscheidung` / `lernschleifen`,
  deploy required after merge.
- `verify:tagesentscheidung`: passed.
- `verify:lernschleifen`: passed.
- Asserted patch body: `{ giComfort: 'ok' }`.
- Asserted success copy keeps `Plan und Garmin bleiben unverändert`.
- Asserted the follow-up action navigates to
  `/data?tab=today#data-primary-action`.
- Asserted the primary Data action is in the viewport after the handoff.

## Conclusion

This keeps the manual Fueling evidence loop guided while respecting Data's
queue ownership. The app now returns to the next most important data task,
without overpromising that the next action is always another Fueling gap.
