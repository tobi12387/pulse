# Performance Gate Server Runtime Drift - 2026-05-22

Branch: `codex/server-runtime-drift-gate`
Track: platform reliability support

## Trigger

After the deployed UI/control-surface work, docs-only `main` commits advanced the
server mirror beyond the last expected runtime handoff commit. A strict
`PULSE_EXPECTED_COMMIT=0704856 npm run verify:server` mismatch made the combined
Performance-OS gate audit show a noisy server blocker even though the latest app
runtime commit was unchanged.

## Change

- `scripts/performance-gates-audit.mjs` now keeps `verify:server` strict, but
  when the failed server check reports a clean `main` commit mismatch, the
  combined audit resolves both commits to the latest app-runtime commit across:
  - `frontend`
  - `backend`
  - `shared`
  - `package.json`
  - `package-lock.json`
- If those runtime commits match, the combined server gate is `ready` with
  `commitStatus: current_runtime`, and the iPhone/PWA handoff no longer repeats
  server recovery before the real-device checklist.
- Wrong branch and dirty server states still remain gated.

## Verification

```bash
node --test scripts/performance-gates-audit.test.mjs
```

The focused test suite covers:

- the existing SSH and mirror-state failure paths;
- an explicit clean `main` commit mismatch where both commits resolve to the
  same app-runtime commit;
- removal of the redundant server-recovery packet from the iPhone/PWA handoff
  when the server gate is runtime-ready.

## Result

The next clean-`main` Performance-OS handoff should keep the real manual
blockers first: Fueling GI-comfort evidence and real iPhone/PWA field evidence.
Docs/tooling-only commit movement no longer creates another current-focus commit
churn loop.
