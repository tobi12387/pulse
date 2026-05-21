# iPhone Current Commit Handoff - 2026-05-22

Branch: `codex/iphone-field-commit-handoff`
Expected field commit: `638902f`
Mode: clean `main` handoff after a docs-only main advance.

## Purpose

Keep the next real iPhone/PWA field run aligned with the live Performance gate output.

The earlier server preflight at `cc0ee3f` remains useful runtime evidence, but `main` later advanced to `638902f` through docs-only PR #674. The current manual checklist now expects `638902f`, so the next real-device evidence record should use the live audit's expected commit rather than the older preflight hash.

## Main Diff Since Runtime Preflight

`cc0ee3f..638902f` changed only:

- `docs/ai/current-focus.md`
- `docs/qa/2026-05-22-iphone-server-preflight-cc0ee3f.md`

No frontend, backend, PWA, service worker or package files changed in that range.

## Current Server Verification

Command from clean `main` before creating this branch:

```bash
PULSE_EXPECTED_COMMIT=638902f npm run verify:server
```

Result:

- SSH target resolved as `pulse-server`.
- Server Git state: `branch=main`, `commit=638902f`, `dirty=0`.
- PM2: `pulse` online.
- PM2: `pulse-frontend` online.
- Recent log attention: `pulse-error.log recent_attention=0`; `pulse-frontend-error.log recent_attention=0`.
- Public frontend: `https://192.168.178.46:5175 -> 200`.
- API ping: `{"status":"ok","version":"2.0.0"}`.
- Pulse health: `{"status":"ok","namespace":"pulse"}`.
- Verification completed for `638902f`.

## Live Gate Handoff

Commands:

```bash
npm run audit:performance-next -- --today 2026-05-22
npm run audit:performance-checklist -- --today 2026-05-22
npm run audit:iphone-pwa-gate -- --expected-commit 638902f --next-prompt
```

Result:

- Performance gates remain `gated`.
- Open gates: `2`.
- Next unblock: Fueling learning.
- Fueling comparable complete logs: `0/3`.
- Existing Fueling completion candidates: `2`.
- Future complete long-session logs still needed after existing candidates: `1`.
- iPhone/PWA expected commit for the next field run: `638902f`.
- Latest iPhone/PWA field record server commit: `9e05189`.
- First iPhone/PWA open gap: current-main field evidence is stale.

## Next Manual Action

For the next real iPhone/PWA field run, use the current checklist target:

```bash
npm run audit:performance-checklist -- --today 2026-05-22
npm run audit:iphone-pwa-gate -- --expected-commit 638902f --scaffold
```

Run the final pre-field checklist from clean `main`; feature-branch reruns intentionally enter local-planning mode and defer server mirror verification.

Append the generated field record to `docs/qa/2026-05-02-iphone-pwa-real-device.md` with:

- Device.
- iOS version.
- Server commit under test: `638902f`.
- Safari/VPN/certificate result.
- Home Screen PWA result.
- Settings diagnostics result.
- Push state if intentionally tested.
- Offline fallback result.

After recording the field run, rerun:

```bash
npm run audit:iphone-pwa-gate -- --expected-commit 638902f
npm run audit:performance-gates -- --today 2026-05-22
```
