# 2026-05-27 - Performance Gates 5585653

## Trigger

After PR #734 repaired the Full Browser UI harness and deployed runtime CSS on
`main`, the Performance-OS gates needed a current clean-main refresh so the next
autonomous package is not chosen from stale blocker evidence.

## Commands

```bash
npm run audit:performance-gates -- --today 2026-05-27
npm run audit:performance-next -- --today 2026-05-27
npm run audit:fueling-gate -- --today 2026-05-27 --capture-checklist
npm run audit:iphone-pwa-gate -- --scaffold
PULSE_EXPECTED_COMMIT=5585653 npm run verify:server
```

## Result

- Overall gate: `gated`, with 2 open gates.
- Expected server commit: `5585653`.
- Server deploy mirror: ready; `verify:server` confirms clean `main` at
  `5585653`, `pulse` and `pulse-frontend` online, public frontend `200`, API
  ping ok and Pulse health ok.
- Next unblock: Fueling learning.
- Next action: add structured GI comfort from the real stomach response for the
  existing long carb log; do not infer GI comfort from notes, route, RPE, grams
  per hour, result or pace.
- First Fueling target: 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g
  carbs (54 g/h).
- First target URL:
  `https://192.168.178.46:5175/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`.
- Allowed GI comfort options: `ok=Magen ok`, `mild_issue=Magen leicht unruhig`,
  `issue=Magenprobleme`.
- Fueling learning remains gated at 0/3 comparable complete logs.
- Two existing logs are completable now:
  - 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h),
    missing GI comfort.
  - 2026-05-04 - Datteln - Radfahren - Z2 - 80 min - bike - 80 min - 30 g
    carbs (23 g/h), missing GI comfort.
- One new complete long-session log is still needed after those two completion
  candidates.
- iPhone/PWA field evidence remains gated with 5 open gaps: stale current-main
  field evidence, warning-free certificate trust, Push activation/test push,
  real iPhone VPN/network offline fallback and device/iOS metadata.
- iPhone/PWA field scaffold now expects server/app runtime commit `5585653` and
  starts at `https://192.168.178.46:5175/settings?section=device`.

## Conclusion

No ungated product package opens from this refresh. The next product-unblocking
movement is manual Fueling evidence capture on the 2026-05-09 target, then the
2026-05-04 GI comfort candidate, then one future complete long-session log.
Current-commit iPhone/PWA real-device evidence remains the second open gate.
