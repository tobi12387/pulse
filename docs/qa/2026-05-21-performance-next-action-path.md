# 2026-05-21 - Performance Next Action Path

## Trigger

After the Fueling next-action copy was clarified, `npm run audit:performance-next`
still rendered the same Activity Fueling deep link twice in immediate sequence:
once appended to `Action` and again as `Target path`.

## Change

- `scripts/performance-gates-audit.mjs` now strips the Fueling `Path:` suffix
  from the compact next-unblock action when `metadata.targetPath` already carries
  that same path.
- The full gate section still keeps its `Next` line with the path, and the
  compact output still renders `Target path` plus completion candidates.

## Verification

```bash
node --test scripts/performance-gates-audit.test.mjs
npm run audit:performance-next -- --today 2026-05-21
npm run audit:performance-gates -- --today 2026-05-21
git diff --check
```

## Result

`npm run audit:performance-next -- --today 2026-05-21` now renders the Fueling
action as the GI-comfort instruction only, followed by a separate `Target path`
line for the Activity Fueling deep link.
