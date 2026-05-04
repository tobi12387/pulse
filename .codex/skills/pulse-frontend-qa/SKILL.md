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
2. For repeatable smoke coverage, run `npm run test:e2e`. Use `npm run test:e2e:install` once on machines without the Playwright Chromium cache.
3. Start or reuse the Vite dev server when ad-hoc browser QA is useful.
4. Use the Browser plugin for local pages when interactive inspection or screenshots are needed.
5. For broad UI/UX work, start from `docs/qa/route-evidence-pack.md` and regenerate route evidence with `npm run qa:ux-evidence` before making claims about current friction.
6. Check desktop and mobile widths for:
   - text overflow
   - overlapping panels
   - broken loading/error states
   - stale cache after mutations
   - empty data states
7. For daily-use flows, verify the route explains why Garmin, recovery, plan, or mental signals changed the recommendation when relevant.
8. For API-backed pages, verify query invalidation after create/update/delete actions.

## Playwright Smoke Suite

- Config: `playwright.config.ts`.
- Tests: `frontend/e2e/`.
- API mocks: `frontend/e2e/fixtures/pulse-api.ts`.
- Scope: fast route/render/navigation checks for `/`, `/coach`, `/data`, `/plan`, `/insights`, and `/settings` in desktop and mobile Chromium.
- Keep this suite deterministic. Mock API data unless the task explicitly needs a real backend/browser flow.

## Report

Mention which routes and viewport sizes were checked, plus any checks that could not be run.
