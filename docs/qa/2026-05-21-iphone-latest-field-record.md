# 2026-05-21 - iPhone Latest Field Record Audit

## Trigger

The iPhone/PWA gate remains open until a real-device field run is recorded
against the current server commit. The workflow tells Tobi to record that run in
`docs/qa/2026-05-02-iphone-pwa-real-device.md`, which can contain older history
plus a new run. The audit must not mix an old `## Results` table with a newer
`Server commit under test`.

## Change

- `scripts/iphone-pwa-gate-audit.mjs` now evaluates the latest `## Scope` block
  and its matching `## Results` / `## Issues Found` tables as one field record.
- `docs/ai/checklists/iphone-pwa-qa.md` now tells operators to append a fresh
  run with its own `## Scope` and `## Results` sections.

## Verification

```bash
node --test scripts/iphone-pwa-gate-audit.test.mjs
```

Result: 7/7 tests passed, including a new case where an old stale iPhone field
record is followed by a fresh current-commit run.

## Product Conclusion

This does not close the iPhone/PWA field gate by itself; it makes the next real
iPhone run auditable without overwriting older evidence. The remaining closure
still requires real-device evidence for the current expected commit.
