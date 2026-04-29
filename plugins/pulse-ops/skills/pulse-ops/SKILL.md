---
name: pulse-ops
description: Use when operating the Pulse project on its production-like home server: checking SSH status, syncing GitHub, deploying /root/pulse, running builds/tests, inspecting PM2/Nginx/logs, or validating https://192.168.178.46 healthchecks.
---

# Pulse Ops

## Project constants

- Repository: `tobi12387/pulse`
- Local workspace: `/Users/tobi/Documents/New project`
- Server SSH: `root@192.168.178.46`
- Server project path: `/root/pulse`
- PM2 app: `pulse`
- Public LAN URL: `https://192.168.178.46`
- Healthcheck: `/api/ping`
- Default branch: `main`

## Operating principles

Treat GitHub `main` as the source of truth. Local development should happen in the Mac workspace, then be committed and pushed. The server should normally deploy by fast-forwarding from GitHub, building, and reloading PM2.

Never overwrite server changes casually. Before deploy or sync operations, check:

```bash
git -C /root/pulse status --short --branch
git -C /root/pulse log --oneline --decorate -3
```

Only commit server-side changes when the user explicitly says the server is the newest source of truth. Do not commit `.env`, private keys, logs, `node_modules`, `dist`, `.claude`, `.superpowers`, or scratch files.

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
4. Run `npm ci` only when dependencies changed or `node_modules` is missing.
5. Run `npm run build`.
6. Run `npm test` unless the user explicitly requests a fast deploy.
7. Run `pm2 startOrReload pm2.config.js && pm2 save`.
8. Run `nginx -t`.
9. Check `https://127.0.0.1/api/ping` on the server and `https://192.168.178.46/api/ping` from the local machine.

## Nginx expectations

Only one enabled site should normally exist:

```text
/etc/nginx/sites-enabled/pulse -> /etc/nginx/sites-available/pulse
```

Expected behavior:

- Port `80` redirects to HTTPS.
- Port `443` proxies to `http://127.0.0.1:3000`.
- TLS uses the local certificates in `/root/pulse/frontend/certs`.

## PM2 expectations

Only the backend process should normally be running:

```text
pulse
```

The old `pulse-ui` preview process is not needed because Fastify serves `frontend/dist` and Nginx proxies to Fastify.

## Diagnostics

For a broken app, gather this order:

```bash
plugins/pulse-ops/scripts/pulse_ops.sh status
plugins/pulse-ops/scripts/pulse_ops.sh health
plugins/pulse-ops/scripts/pulse_ops.sh logs
plugins/pulse-ops/scripts/pulse_ops.sh nginx
```

If the healthcheck passes on `127.0.0.1` but fails on `192.168.178.46`, suspect LAN/firewall/TLS routing. If PM2 is online but `/api/ping` fails, inspect `pulse-error.log` first.
