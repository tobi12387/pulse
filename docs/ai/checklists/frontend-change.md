# Frontend Change Checklist

- Existing page responsibility is respected.
- API access goes through `frontend/src/pulse/api-client.ts`.
- Server state goes through TanStack Query hooks in `frontend/src/pulse/hooks.ts`.
- No duplicate business thresholds in UI code.
- Loading, empty, and error states are handled.
- Text fits compact mobile and desktop layouts.
- Build or focused frontend verification was run when UI behavior changed.

