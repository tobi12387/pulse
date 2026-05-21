# 2026-05-21 - Performance Gates Fueling Action

## Trigger

The live Performance-OS gate audit on current `main` showed a split handoff:
the promoted `nextUnblock.action` was clean, but the Fueling gate object's
`nextAction` still appended the Activity deep link as `Path:` even though the
same path was already present in structured metadata and completion candidates.

## Change

- `scripts/performance-gates-audit.mjs` now builds the Fueling gate
  `nextAction` from the action label and evidence boundary only.
- The target Activity deep link remains available as structured
  `users[].nextAction.targetPath`, `nextUnblock.metadata.targetPath`, packet
  `Target path` and completion-candidate output.
- The legacy `nextUnblockAction` path-stripper stays in place for compatibility
  with older-shaped gate objects.

## Verification

```bash
node --test scripts/performance-gates-audit.test.mjs
npm run audit:performance-gates -- --today 2026-05-21 --json
npm run audit:performance-gates -- --today 2026-05-21 --packet
```

## Result

- Unit coverage confirms the raw Fueling gate `nextAction` no longer contains
  `Path: /plan/activity/...`.
- JSON output keeps `gates[0].nextAction` focused on the GI-comfort instruction
  while `users[0].nextAction.targetPath` and completion candidates retain the
  exact Activity Fueling links.
- Packet output shows the action once, followed by separate `Target`,
  `Target path`, evidence packet, GI-comfort options and completion candidates.

## Product Conclusion

This does not close a Performance-OS gate. It makes the first manual Fueling
unblock quieter and harder to misread, so the next real user action remains the
subjective GI-comfort choice rather than another duplicated link handoff.
