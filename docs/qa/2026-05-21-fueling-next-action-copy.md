# 2026-05-21 - Fueling Next Action Copy

## Trigger

The first Performance-OS unblock is still Fueling learning. `npm run
audit:performance-next` showed the next action as a mixed German/English string
and left the "do not infer GI comfort" rule one hop away in the packet.

## Change

- `scripts/fueling-gate-audit.mjs` now describes the GI-comfort step as choosing
  the real stomach response on the existing long carb log.
- `scripts/performance-gates-audit.mjs` now labels the option line as
  `GI-Komfort-Optionen` instead of the generic `Options`.
- The next-action copy says not to infer GI comfort from notes, route, RPE, g/h
  or workout result.

## Verification

```bash
node --test scripts/fueling-gate-audit.test.mjs scripts/performance-gates-audit.test.mjs
npm run audit:performance-next -- --today 2026-05-21
npm run audit:fueling-gate -- --today 2026-05-21
npm run audit:fueling-gate -- --today 2026-05-21 --packet
git diff --check
```

## Result

`npm run audit:performance-next -- --today 2026-05-21` now renders:

- Action: `GI-Komfort ergaenzen - Waehle die echte Magenreaktion am vorhandenen
  langen Carb-Log; nichts aus Notizen, Route, RPE, g/h oder Ergebnis ableiten.`
- Option line: `GI-Komfort-Optionen: ok=Magen ok, mild_issue=Magen leicht
  unruhig, issue=Magenprobleme`

The gate remains closed until Tobi records real GI comfort through the Activity
Fueling UI.
