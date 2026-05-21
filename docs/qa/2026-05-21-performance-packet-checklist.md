# 2026-05-21 - Performance Packet Checklist

## Trigger

The combined Performance-OS handoff packet already exposed the Fueling evidence
checklist in `Ordered Open Gates`, while the `First Unblock` section showed the
target path and packet command without the checklist. That made the first
manual action slightly less self-contained than `npm run audit:performance-next`.

## Change

- `scripts/performance-gates-audit.mjs` now renders `Evidence checklist` in
  `First Unblock` whenever the first gate metadata includes one.
- The existing packet, field-packet and recovery-packet command lines remain
  unchanged.
- The ordered open-gates section still repeats the checklist for each gate.

## Verification

```bash
node --test scripts/performance-gates-audit.test.mjs
npm run audit:performance-gates -- --today 2026-05-21 --packet
```

## Result

The first Fueling unblock now keeps the manual capture checklist next to the
GI-comfort action, target Activity link, evidence packet and completion
candidates. The Performance-OS gate remains `gated`; this is handoff support,
not evidence capture.
