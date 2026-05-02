# Pulse Frontend

Pulse uses React 19, Vite, TanStack Query and Tailwind CSS v4.

## Structure

- `src/pages/` contains route-level screens: Home, Coach, Data, Plan, Insights, Settings and Activity Detail.
- `src/components/` contains reusable UI and domain cards that are shared across routes.
- `src/components/ui/` contains small primitive components and variant helpers.
- `src/pulse/` contains Pulse API wrappers, query keys and TanStack Query hooks.
- `src/lib/` contains browser-side utilities such as push, service-worker and threshold helpers.
- `e2e/` contains Playwright smoke and usability tests with API fixtures.
- `public/` contains PWA assets: manifest, service worker and icons.

## Local Commands

Run frontend commands through the workspace root unless you only need this package:

```bash
npm run dev:frontend
npm run build -w frontend
npm run test:e2e
```

The production server serves the built frontend from `frontend/dist`; that directory is generated and ignored.

## Local HTTPS Certificates

Local certificate material under `frontend/certs/` is intentionally ignored and must not be committed. The server and each Mac checkout should provision its own certificate/key pair for the LAN hostname or IP.

Expected local paths for HTTPS dev/preview:

- `frontend/certs/192.168.178.46+2-key.pem`
- `frontend/certs/192.168.178.46+2.pem`

If those files are missing, Vite falls back to HTTP for local dev/build compatibility. The deployed iPhone/PWA flow still expects the server to provide HTTPS on `https://192.168.178.46:5175`.

## Refactor Notes

Keep route pages usable during refactors. When a route grows, extract feature components under `src/features/<domain>/` or a focused shared component under `src/components/`, then keep `src/pages/<Route>.tsx` as orchestration only.
