# 2026-05-21 - Fueling Candidate URLs

## Trigger

The first Performance-OS unblock is still Fueling evidence capture. The focused
Fueling packet lists both existing completion candidates, but opening both logs
still required scanning packet text after the first target URL.

## Change

- `scripts/fueling-gate-audit.mjs` now accepts `--candidate-urls`.
- The command prints one URL per existing completion candidate.
- If there are no URL-addressable completion candidates, it exits non-zero
  instead of implying a manual UI target exists.
- The Fueling evidence checklist and current gate notes name the command.

## Verification

```bash
node --test scripts/fueling-gate-audit.test.mjs
npm run audit:fueling-gate -- --today 2026-05-21 --candidate-urls
git diff --check
```

Expected current result: the candidate-URL command prints the two Activity
Fueling deep links that still need explicit GI comfort.
