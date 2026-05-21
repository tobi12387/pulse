# 2026-05-21 - Server Audit Host Fallback

## Trigger

The default Performance-OS gate audit calls `npm run verify:server` without
`PULSE_HOST`. In this workspace, direct `root@192.168.178.46` auth can fail even
when the configured `pulse-server` alias verifies the read-only server mirror.
That made the combined gate list show a noisy server blocker beside the real
Fueling and iPhone/PWA manual gates.

## Change

- `scripts/verify-server.sh` keeps `root@192.168.178.46` as the primary default.
- When `PULSE_HOST` is unset, it also tries `PULSE_HOST_FALLBACKS`, defaulting
  to `pulse-server`, before failing the SSH preflight.
- Explicit `PULSE_HOST=<target>` still forces that target and does not add
  fallbacks.
- The combined Performance gate audit now treats server mirror state failures
  separately from SSH-auth failures, so a branch/dirty/commit mismatch no
  longer points at the deploy-auth recovery runbook.
- The recovery packet and current docs now mention the fallback behavior.

## Verification

```bash
bash -n scripts/verify-server.sh
node --test scripts/dev-services.test.mjs
node --test scripts/performance-gates-audit.test.mjs
npm run test:scripts
npm run verify:server
npm run audit:performance-gates -- --today 2026-05-21 --packet
```

Pre-merge feature-branch result: `npm run verify:server` should print
`ssh_target=pulse-server`, proving the fallback moved past SSH, and then may
stop at the expected server branch/worktree mirror check until the PR is merged
back to `main`. The packet should describe that as a mirror-state problem, not
an SSH-auth recovery problem.

Expected result after merge: the default combined gate audit should keep the
server mirror ready when the alias works, leaving Fueling first and iPhone/PWA
second as the current real Performance-OS blockers.
