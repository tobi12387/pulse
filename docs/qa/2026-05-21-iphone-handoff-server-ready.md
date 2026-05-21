# 2026-05-21 - iPhone Handoff With Ready Server

## Trigger

After the server audit fallback, the combined Performance-OS gate packet can
prove the server mirror is already ready. The iPhone/PWA gate still repeated
`Verify the server mirror...` and rendered a server recovery packet, even though
the next real blocker is the manual iPhone field checklist.

## Change

- `scripts/performance-gates-audit.mjs` now refines only the combined iPhone/PWA
  gate when the server gate is ready in the same audit.
- The iPhone action becomes: rerun the real iPhone checklist and record the
  expected server commit.
- The combined iPhone/PWA gate keeps the server verify command but hides the
  server recovery packet when recovery is not needed.
- The standalone `npm run audit:iphone-pwa-gate` behavior remains conservative
  because it does not have the combined server gate context.

## Verification

```bash
node --test scripts/performance-gates-audit.test.mjs
git diff --check
npm run audit:performance-gates -- --today 2026-05-21 --packet
```

Pre-merge feature-branch result: focused tests pass. The live packet may still
show the server gate because the server mirror detects the feature branch before
merge; after merge, rerun the packet from `main` to verify that only Fueling and
iPhone/PWA remain open and the iPhone action is real-device focused.
