# 2026-05-21 — Fueling Gate Audit Command

## Trigger

Nutrition trend summaries are still the clearest open Performance-OS gate. The
previous local audit lived as a one-off `psql` query in QA notes, which made it
too easy for future sessions to re-derive the gate state or miss which existing
logs can be completed.

## Change

- Added `npm run audit:fueling-gate`.
- The command reads the configured local Postgres database, audits the current
  120-day Fueling evidence window and prints:
  - comparable complete `during` logs vs the required 3-log floor,
  - existing long logs that can count after missing fields are added,
  - new complete long-session logs still needed after those candidates,
  - the next smallest evidence action.
- Added focused script tests for the date window, the current two-long-log GI
  comfort gap and the ready state after three comparable complete logs.

## Current Local Evidence

Command:

```bash
npm run audit:fueling-gate -- --today 2026-05-21
```

Result:

- Window: `2026-01-21..2026-05-21`
- During logs: 4
- Comparable long logs: 2
- Comparable complete logs: 0/3
- Existing logs completable now: 2
- New complete long-session logs still needed after completion candidates: 1
- Next action: `GI-Komfort ergaenzen`

Completion candidates:

| Date | Activity | Duration | Carbs | GI comfort | Status |
|---|---:|---:|---:|---|---|
| 2026-05-09 | Datteln Graveln | 398 min | 356 g | missing | can count after GI comfort |
| 2026-05-04 | Datteln - Radfahren Z2 | 80 min | 30 g | missing | can count after GI comfort |

## Verification

- `node --test scripts/fueling-gate-audit.test.mjs`
- `npm run audit:fueling-gate -- --today 2026-05-21`

## Product Conclusion

The Nutrition trend gate remains closed. The next real unlock is still
structured GI comfort for the two existing long carb logs, then one additional
complete long-session Fueling log with duration, carbs and GI comfort.
