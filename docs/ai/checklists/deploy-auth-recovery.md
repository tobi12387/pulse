# Server Deploy Auth Recovery

Use this when deploys or `npm run verify:server` fail at the SSH preflight before any server Git, PM2 or health checks run.

Current symptom (`expected_commit` follows local `HEAD` or `PULSE_EXPECTED_COMMIT`):

```text
==> ssh access
root@192.168.178.46: Permission denied (publickey,password).
expected_commit=<short-commit>
recovery_runbook=docs/ai/checklists/deploy-auth-recovery.md
ERROR: SSH access to root@192.168.178.46 failed before server checks.
```

For a compact, read-only handoff that prints the current expected commit,
preflight command, local public-key candidate filenames, deploy boundary and
rerun commands without opening an SSH connection:

```bash
npm run verify:server -- --packet
```

## Boundaries

- GitHub `main` remains the only source of truth.
- The server at `/root/pulse` is a deploy mirror only.
- Do not edit, branch, commit or patch code directly on the server.
- Do not paste private keys, passwords, `.env` contents or `rootCA-key.pem` into chat, docs or Git.
- Only public keys may be copied into `authorized_keys`, and only by Tobi or an operator with legitimate server access.

## Restore Access

From the Mac or Codex workspace, confirm the failure is SSH auth, not Pulse runtime:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=8 root@192.168.178.46 "printf 'ssh=ok\n'"
```

If the workspace has an SSH config alias for the Pulse server, test that before
changing server keys. In this Codex environment the alias is `pulse-server` and
uses a configured local identity:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=8 pulse-server "printf 'ssh=ok\n'"
PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT="$(git rev-parse --short HEAD)" npm run verify:server
```

If that fails, repair the SSH credential outside the repo:

- confirm VPN/network access to `192.168.178.46`;
- confirm the intended local public key exists, for example `~/.ssh/id_ed25519.pub`;
  `npm run verify:server -- --packet` lists local `~/.ssh/*.pub` candidates by
  filename only, never key contents;
- using a trusted existing login path, add that public key to the server user's `~/.ssh/authorized_keys`;
- keep private keys on the local machine only;
- rerun the non-interactive SSH command above.

## Verify Server Mirror

After SSH works, verify the server mirror against the current local `main` commit:

```bash
git switch main
git pull --ff-only
PULSE_EXPECTED_COMMIT="$(git rev-parse --short HEAD)" npm run verify:server
```

If this reports a commit mismatch and there are merged runtime changes waiting, deploy from GitHub `main`.

## Deploy After Auth Repair

Run the standard deploy command only after the relevant PR is merged to `main`:

```bash
ssh root@192.168.178.46 "cd /root/pulse && bash scripts/deploy.sh"
```

If direct host auth fails but the verified local alias works, use the alias
without changing server files:

```bash
ssh pulse-server "cd /root/pulse && bash scripts/deploy.sh"
```

Then verify the deployed mirror:

```bash
PULSE_EXPECTED_COMMIT="$(git rev-parse --short HEAD)" npm run verify:server
```

If deploy fails after SSH is restored, treat the new failure as the next real blocker. Do not manually patch server files.
