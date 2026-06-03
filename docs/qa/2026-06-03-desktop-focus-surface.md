# 2026-06-03 Desktop Focus Surface Evidence

## Scope

- Branch: `codex/desktop-focus-surface`
- Base commit: `4b3e11f`
- Surface: global desktop app shell (`frontend/src/components/Layout.tsx`, `frontend/src/index.css`)
- Product gates: unchanged; Fueling learning and iPhone/PWA field evidence remain gated.

## Before Evidence

Commands from clean main:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/2026-06-03-redesign-current-main npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-06-03-redesign-current-main
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Evidence root: `test-results/route-evidence/2026-06-03-redesign-current-main/2026-06-03-4b3e11f/`

Manual review:

- Desktop Home, Data and Plan were overflow-free but started with Sidebar, Workspace-Topbar and PageHeader all explaining the current route before the primary working card.
- Data and Plan used the PageHeader for route-local tabs, so the removable layer was the route-wide Workspace-Topbar, not the route header.
- Mobile Home, Data Fueling and Plan scenario remained readable after the prior opaque mobile chrome fix; no new mobile shell slice was justified.

## Change

Desktop now starts directly with the route working surface:

- Removed the desktop Workspace-Topbar from `Layout`.
- Kept desktop Coach, sync status, user/date and logout in the Sidebar.
- Kept the mobile Topbar and Bottom Navigation unchanged.
- Updated the shortcut help label from `Setup` to `Bereit` to match the current navigation.

No route, action contract, data write, Garmin write or product gate changed.

## After Evidence

Commands from the branch worktree:

```bash
npm run build -w shared && npm run build -w frontend
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/2026-06-03-desktop-focus-surface npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-06-03-desktop-focus-surface
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Evidence root: `test-results/route-evidence/2026-06-03-desktop-focus-surface/2026-06-03-4b3e11f/`

Manual review:

- Desktop Home now starts with `Tagesentscheidung` and the daily decision card, without the extra `Eine klare Antwort` workspace row.
- Desktop Data now starts with `Evidenz-Queue`, the tab control and the next data gap, without duplicating `Luecke vor Trend` above it.
- Desktop Plan now starts with `Wochensteuerung`, tabs and the week strip, so the weekly decision card enters the first viewport sooner.
- Mobile Home, Data Fueling and Plan scenario screenshots remained structurally unchanged and overflow-free.

## Notes

- `npm ci` was required in the fresh isolated worktree because `node_modules` is not shared with `/root/pulse`; it reported existing lockfile audit findings and did not change dependency files.
- `docs/ai/current-focus.md` was not changed because the durable queue and manual gate state did not change.
