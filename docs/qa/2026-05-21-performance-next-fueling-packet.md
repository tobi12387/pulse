# 2026-05-21 - Performance Next Fueling Packet

## Trigger

`npm run audit:fueling-gate -- --packet` now renders the live manual Fueling
capture packet, but the canonical first-action command,
`npm run audit:performance-next`, still pointed only at the table audit command.

## Change

- Added the Fueling packet command to the Performance-OS gate summary when
  Fueling is gated.
- Added `capturePacketCommand` to Fueling `nextUnblock.metadata` for JSON
  consumers.
- Kept all gate thresholds unchanged: Fueling remains gated until 3/3 comparable
  complete `during` logs exist.

## Verification

- `node --test scripts/performance-gates-audit.test.mjs`
- `npm run audit:performance-next -- --today 2026-05-21`
- `npm run audit:performance-next -- --today 2026-05-21 --json`

Live audit result remains gated:

- 0/3 comparable complete Fueling logs.
- 2 existing long carb logs can count after structured GI comfort.
- 1 new complete long-session log is still needed after those candidates.

## Product Conclusion

This keeps the first Performance-OS unblock executable from the shortest gate
handoff command. It is evidence-capture support only; it does not invent GI
comfort or unlock nutrition trends.
