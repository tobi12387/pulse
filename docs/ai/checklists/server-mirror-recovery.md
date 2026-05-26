# Server Mirror Recovery

Use this when `npm run verify:server` reaches the server but fails after SSH because `/root/pulse` is not a clean GitHub `main` mirror.

## Boundaries

- GitHub `main` is the source of truth.
- The server is a deploy mirror only.
- Do not edit, commit, branch for product work, stash, delete or patch files directly on the server.
- Do not move secrets, `.env`, private keys, `rootCA-key.pem` or any `*-key.pem` through chat, docs or Git.
- Do not force the server to a feature branch. Merge first, then deploy from `main`.

## Current Symptoms

Wrong branch:

```text
==> server git status
branch=codex/example commit=abc1234 dirty=0
mirror_recovery_runbook=docs/ai/checklists/server-mirror-recovery.md
ERROR: server branch is 'codex/example', expected main
```

Dirty mirror:

```text
==> server git status
branch=main commit=abc1234 dirty=1
mirror_recovery_runbook=docs/ai/checklists/server-mirror-recovery.md
ERROR: server worktree is dirty
```

Commit mismatch:

```text
==> server git status
branch=main commit=old1234 dirty=0
mirror_recovery_runbook=docs/ai/checklists/server-mirror-recovery.md
ERROR: server commit old1234 != expected abc1234
```

The standalone `npm run verify:server` command is intentionally exact about
`PULSE_EXPECTED_COMMIT`. The combined `npm run audit:performance-gates` command
may still mark the server gate ready when that exact mismatch is only a clean
`main` docs/tooling commit and both commits resolve to the same app-runtime
commit across `frontend`, `backend`, `shared`, `package.json` and
`package-lock.json`. Wrong branch and dirty mirror states are never accepted as
runtime-equivalent.

## Recover A Clean Mirror

Only use this when `dirty=0`.

```bash
ssh pulse-server "cd /root/pulse && git fetch --prune origin && git switch main && git pull --ff-only origin main"
ssh pulse-server "cd /root/pulse && bash scripts/deploy.sh"
PULSE_EXPECTED_COMMIT="$(git rev-parse --short HEAD)" npm run verify:server
```

Use `root@192.168.178.46` instead of `pulse-server` only when that direct SSH target is the verified working path.

## Prevent Recurrence

On the Pulse server host, `/root/pulse` is the deploy mirror. Do not create or
switch Codex feature branches there. Keep it on clean `main` and create an
isolated worktree for implementation work instead:

```bash
cd /root/pulse
git fetch --all --prune
git status --short --branch
node scripts/codex-worktree.mjs <topic>
cd /tmp/pulse-codex-<topic>
```

When work is complete, merge through GitHub, then return to `/root/pulse` only
for mirror verification or deploy from `main`.

## If The Server Is Dirty

Stop and inspect before changing branch or running deploy:

```bash
ssh pulse-server "cd /root/pulse && git status --short --branch"
```

Do not blindly run `git stash`, `rm`, `git reset --hard` or manual patches on the server. The dirty state is a mirror violation; decide whether it is generated output, a failed deploy artifact or manual work before taking action.

## Verify The Field Gate

After recovery, run the normal Performance-OS gate from clean local `main`:

```bash
npm run audit:performance-gates -- --today <YYYY-MM-DD>
```

When the server gate is ready, iPhone/PWA field evidence can focus on the real device checklist instead of server mirror recovery.
