# Local HTTPS Certificates

This directory is for machine-local development and server certificate material.

Do not commit certificate files or private keys. Pulse expects these filenames when HTTPS is enabled locally:

- `192.168.178.46+2-key.pem`
- `192.168.178.46+2.pem`

If they are absent, `frontend/vite.config.ts` falls back to HTTP so builds and non-PWA local checks still work.

For iPhone/PWA testing through VPN, provision a trusted certificate on the server before relying on `https://192.168.178.46:5175`.
