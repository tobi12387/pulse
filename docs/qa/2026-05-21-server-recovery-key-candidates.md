# 2026-05-21 — Server Recovery Public-Key Candidates

## Scope

- `npm run verify:server -- --packet` now prints local `~/.ssh/*.pub`
  candidates as filenames only.
- The packet remains read-only: it does not open SSH, deploy, edit
  `authorized_keys`, or print public-key contents, private keys, `.env` values
  or certificate key files.

## Verification

```bash
bash -n scripts/verify-server.sh
PULSE_EXPECTED_COMMIT=ce366ae npm run verify:server -- --packet
node --test scripts/dev-services.test.mjs
git diff --check
```

## Gate State

The server mirror gate is still blocked until SSH auth is repaired outside the
repo and the standard deploy/verify commands can run against GitHub `main`.
