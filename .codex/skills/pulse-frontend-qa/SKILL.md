---
name: pulse-frontend-qa
description: Use when changing or testing the Pulse React/Vite frontend, especially Home, Coach, Data, Plan, Insights, Settings, responsive layout, visual states, or browser behavior.
---

# Pulse Frontend QA

Use this skill for frontend implementation or verification.

## Scope

Primary routes:

- `/`
- `/coach`
- `/data`
- `/plan`
- `/insights`
- `/settings`

Key files:

- `frontend/src/pages/`
- `frontend/src/components/`
- `frontend/src/pulse/api-client.ts`
- `frontend/src/pulse/hooks.ts`

## Implementation Guidance

- Match existing React, TanStack Query, Tailwind, and component patterns.
- Build the real workflow, not a landing page.
- Keep operational UI dense, quiet, and scannable.
- Use existing icons and components where available.
- Avoid nested cards, decorative blobs, oversized hero treatment, and one-note palettes.
- Design stable dimensions for dashboards, tiles, toolbars, and compact controls.
- Make empty, loading, error, and stale-data states usable.

## QA Flow

1. Run the focused frontend check used by the repo, or at minimum the frontend build/typecheck if available.
2. Start or reuse the Vite dev server when browser QA is useful.
3. Use the Browser plugin for local pages when available.
4. Check desktop and mobile widths for:
   - text overflow
   - overlapping panels
   - broken loading/error states
   - stale cache after mutations
   - empty data states
5. For API-backed pages, verify query invalidation after create/update/delete actions.

## Report

Mention which routes and viewport sizes were checked, plus any checks that could not be run.
