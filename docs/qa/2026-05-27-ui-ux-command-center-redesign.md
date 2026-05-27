# 2026-05-27 UI/UX Command Center Redesign

## Scope

Tobi explicitly reprioritized a broad, potentially breaking UI/UX redesign because the app still felt too unclear and weakly structured. This pass keeps the stable route URLs, but treats the UI as a route-wide command center rather than polishing isolated cards.

## Before Evidence

Command:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/2026-05-27-ui-redesign-before npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-05-27-ui-redesign-before
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Root: `test-results/route-evidence/2026-05-27-ui-redesign-before/2026-05-27-74f8411/`.

Manual review found no overflow bug. The friction was structural:

- Desktop routes had a narrow light nav plus independent page headers, so global orientation and route mission were separated.
- Mobile tabs and first cards often competed for the first viewport's hierarchy.
- Heavy bordered cards made the next action, evidence and background context feel too similar.

## Implementation

- Added a route-aware desktop workspace topbar with current mission, safety/status chips, date and Coach command.
- Reworked the desktop sidebar into a darker workspace navigation with an active route mission card and clearer route intents.
- Renamed the visible Settings area from `Setup` to `Bereit` while keeping the stable `/settings` URL.
- Rebalanced the global card, page header and segmented-control styling toward flatter operational surfaces.
- Kept route URLs and write contracts stable; no Plan, Garmin, Coach, notification or data writes were added.

## After Evidence

Command:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/2026-05-27-ui-redesign-after-final npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-05-27-ui-redesign-after-final
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Root: `test-results/route-evidence/2026-05-27-ui-redesign-after-final/2026-05-27-74f8411/`.

Additional check:

```bash
npm run build -w frontend
npm run test:e2e:smoke
```

Result: passed.

Harness note:

- Route evidence now expects the visible Settings label `Bereit`, matching the new information architecture while keeping the `/settings` URL stable.

## Notes

An earlier screenshot run used temporary `node_modules` symlinks to the server mirror checkout and logged Vite font-serving allow-list warnings. The final route evidence and smoke gate ran after a local `npm ci` in this worktree and passed without the symlink font-serving issue.
