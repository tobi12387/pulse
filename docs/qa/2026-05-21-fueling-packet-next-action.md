# 2026-05-21 - Fueling Packet Next Action

## Trigger

The combined Performance-OS packet showed the first Fueling unblock as an
explicit action, but the focused `npm run audit:fueling-gate -- --packet`
started with the target log and path. The focused packet should be self-contained
because it is the manual capture packet for the first open gate.

## Change

- `scripts/fueling-gate-audit.mjs` now renders `Next action` before the target
  log and target path in the focused Fueling evidence packet.
- The action uses the existing next-action label/detail, including the rule that
  GI comfort must be the real stomach response and must not be inferred from
  notes, route, RPE, carbs per hour or workout result.
- Target path, existing candidates, GI-comfort options, manual capture rules and
  rerun command remain unchanged.

## Verification

```bash
node --test scripts/fueling-gate-audit.test.mjs
npm run audit:fueling-gate -- --today 2026-05-21 --packet
```

## Result

The focused Fueling packet now begins the gated user section with:

`Next action: GI-Komfort ergaenzen - Waehle die echte Magenreaktion am vorhandenen langen Carb-Log; nichts aus Notizen, Route, RPE, g/h oder Ergebnis ableiten.`

The Performance-OS gate remains `gated`; this only makes the first manual
Fueling evidence-capture handoff harder to misread.
