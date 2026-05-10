---
name: pulse-ops
description: Use when operating the Pulse project on its production-like home server: checking SSH status, syncing GitHub, deploying /root/pulse, running builds/tests, inspecting PM2/Nginx/logs, or validating https://192.168.178.46:5175 healthchecks.
---

# Pulse Ops

## Project constants

- Repository: `tobi12387/pulse`
- Local workspace: `/Users/tobi/Documents/Pulse`
- Server SSH: `root@192.168.178.46`
- Server project path: `/root/pulse`
- PM2 apps: `pulse` (backend) and `pulse-frontend` (Vite preview on `:5175`)
- Public LAN URL: `https://192.168.178.46:5175`
- Healthcheck: `/api/pulse/health`
- Default branch: `main`

## Operating principles

Treat GitHub `main` as the source of truth. Local development should happen in the Mac workspace, then be committed and pushed. The server should normally deploy by fast-forwarding from GitHub, building, and reloading PM2.

Never overwrite server changes casually. Before deploy or sync operations, check:

```bash
git -C /root/pulse status --short --branch
git -C /root/pulse log --oneline --decorate -3
```

Only commit server-side changes when the user explicitly says the server is the newest source of truth. Do not commit `.env`, private keys, logs, `node_modules`, `dist`, legacy AI-tool directories, `.superpowers`, or scratch files.

## Preferred script

Use the bundled script from the plugin root when possible:

```bash
plugins/pulse-ops/scripts/pulse_ops.sh status
plugins/pulse-ops/scripts/pulse_ops.sh health
plugins/pulse-ops/scripts/pulse_ops.sh deploy
plugins/pulse-ops/scripts/pulse_ops.sh logs
plugins/pulse-ops/scripts/pulse_ops.sh test
```

The script accepts overrides:

```bash
PULSE_HOST=root@192.168.178.46 PULSE_PATH=/root/pulse plugins/pulse-ops/scripts/pulse_ops.sh status
```

## Safe deploy workflow

1. Check local and server status.
2. Confirm the server has no uncommitted tracked changes.
3. On the server: `git fetch origin main && git pull --ff-only origin main`.
4. Prefer the canonical deploy script: `bash scripts/deploy.sh`.
5. The script runs `npm ci`, shared/backend/frontend builds, migrations, and PM2 start/reload for both processes.
6. Run `nginx -t` only when Nginx config changed.
7. Check `http://127.0.0.1:3000/api/pulse/health` on the server and `https://192.168.178.46:5175/api/pulse/health` from the local machine.

## Nginx expectations

Only one enabled site should normally exist:

```text
/etc/nginx/sites-enabled/pulse -> /etc/nginx/sites-available/pulse
```

Expected behavior:

- Port `80` redirects to HTTPS.
- Port `443` may proxy backend traffic for legacy checks.
- The active local web/PWA surface is Vite preview on `https://192.168.178.46:5175`.
- TLS uses the local certificates in `/root/pulse/frontend/certs`.

## PM2 expectations

Both Pulse processes should normally be running:

```text
pulse
pulse-frontend
```

The old `pulse-ui` preview process is not needed. `pulse-frontend` serves the built frontend through Vite preview and proxies `/api` to the backend.

## Diagnostics

For a broken app, gather this order:

```bash
plugins/pulse-ops/scripts/pulse_ops.sh status
plugins/pulse-ops/scripts/pulse_ops.sh health
plugins/pulse-ops/scripts/pulse_ops.sh logs
plugins/pulse-ops/scripts/pulse_ops.sh nginx
```

If the backend healthcheck passes on `127.0.0.1:3000` but fails on `192.168.178.46:5175`, suspect Vite preview, LAN/firewall, VPN or TLS routing. If PM2 is online but `/api/pulse/health` fails, inspect `pulse-error.log` and `pulse-frontend-error.log` first.
