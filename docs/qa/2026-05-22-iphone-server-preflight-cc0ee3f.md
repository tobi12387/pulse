# iPhone Server Preflight - 2026-05-22

Branch: `codex/iphone-server-preflight-2026-05-22`
Runtime target commit: `cc0ee3f`
Mode: clean `main` server preflight before the next real-device iPhone/PWA field run.
Current handoff: after docs-only PR #674 advanced `main`, `docs/qa/2026-05-22-iphone-field-handoff-snapshot-638902f.md` records a later clean-main snapshot. For the actual field run, use the expected commit printed by the live `npm run audit:performance-checklist -- --today <YYYY-MM-DD>` output from clean `main`.

## Purpose

Turn the iPhone/PWA gate's server verification step into durable evidence so the next manual field run can focus on the real iPhone checks instead of rediscovering server state.

This is a gate/evidence slice, not a product feature slice. It does not close the iPhone/PWA gate because the latest real-device field record still tested `9e05189`.

## Guardrails

- Server mirror checks must run from clean `main`, not from a feature branch.
- The field run must record the server commit actually tested.
- Simulated WebKit or Chromium evidence does not replace the real iPhone/VPN/PWA record.
- Append the next field result to `docs/qa/2026-05-02-iphone-pwa-real-device.md`.

## Preflight Notes

Two stale or context-specific checks were intentionally rejected before the clean pass:

- `PULSE_EXPECTED_COMMIT=b9de0fe npm run verify:server` failed because the server was already on current `main` at `cc0ee3f`.
- `PULSE_EXPECTED_COMMIT=cc0ee3f npm run verify:server` from `codex/iphone-server-preflight-2026-05-22` failed because the verifier correctly expects the local/server mirror context to be clean `main`.

## Successful Server Verification

Command from clean `main`:

```bash
PULSE_EXPECTED_COMMIT=cc0ee3f npm run verify:server
```

Result:

- SSH target resolved as `pulse-server`.
- Server Git state: `branch=main`, `commit=cc0ee3f`, `dirty=0`.
- PM2: `pulse` online.
- PM2: `pulse-frontend` online.
- Recent log attention: `pulse-error.log recent_attention=0`; `pulse-frontend-error.log recent_attention=0`.
- Public frontend: `https://192.168.178.46:5175 -> 200`.
- API ping: `{"status":"ok","version":"2.0.0"}`.
- Pulse health: `{"status":"ok","namespace":"pulse"}`.
- Verification completed for `cc0ee3f`.

## Gate Snapshot After Preflight

Commands:

```bash
npm run audit:performance-gates -- --today 2026-05-22 --json
npm run audit:performance-checklist -- --today 2026-05-22
npm run audit:iphone-pwa-gate -- --expected-commit cc0ee3f --next-prompt
```

Result:

- Performance gates remain `gated`.
- Open gates: `2`.
- Deferred gates: `0`.
- Server mirror gate: ready for `cc0ee3f`.
- Next unblock: Fueling learning.
- Fueling comparable complete logs: `0/3`.
- Existing Fueling completion candidates: `2`.
- Future complete long-session logs still needed after existing candidates: `1`.
- iPhone/PWA expected commit for the next field run: `cc0ee3f`.
- Latest iPhone/PWA field record server commit: `9e05189`.
- First iPhone/PWA open gap: current-main field evidence is stale.

## Next Manual Action

Run the real iPhone/PWA checklist against the verified server target:

```bash
npm run audit:iphone-pwa-gate -- --expected-commit cc0ee3f --scaffold
```

Then append the generated field record to `docs/qa/2026-05-02-iphone-pwa-real-device.md` with:

- Device.
- iOS version.
- Server commit under test: `cc0ee3f`.
- Safari/VPN/certificate result.
- Home Screen PWA result.
- Settings diagnostics result.
- Push state if intentionally tested.
- Offline fallback result.

After recording the field run, rerun:

```bash
npm run audit:iphone-pwa-gate -- --expected-commit cc0ee3f
npm run audit:performance-gates -- --today 2026-05-22
```
