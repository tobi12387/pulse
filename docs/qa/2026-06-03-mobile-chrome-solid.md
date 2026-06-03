# 2026-06-03 Mobile Chrome Solid Evidence

## Scope

- Branch: `codex/mobile-bottom-safe`
- Base commit: `c6b59cf`
- Surface: mobile route chrome only (`frontend/src/index.css`)
- Product gates: unchanged; Fueling and iPhone/PWA evidence remain gated.

## Before Evidence

Command from clean main:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/2026-06-03-current-main npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-06-03-current-main
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Evidence root: `test-results/route-evidence/2026-06-03-current-main/2026-06-03-c6b59cf/`

Manual review:

- Mobile Home, Data Fueling, Activity Fueling and Plan scenario were readable and overflow-free.
- The fixed mobile topbar/bottom navigation used translucent backgrounds, so route text was visibly ghosting below the chrome.
- This was a real daily-flow polish issue because the current Fueling and Plan handoffs sit on mobile surfaces that Tobi uses for manual evidence capture.

## Change

The mobile topbar and bottom navigation now use a solid route-surface color:

- `.pulse-mobile-topbar`
- `.pulse-mobile-bottom-nav`

No route, action contract, data write, Garmin write or product gate changed.

## After Evidence

Commands from the branch worktree:

```bash
npm run build -w shared && npm run build -w frontend
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/2026-06-03-mobile-chrome-solid npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-06-03-mobile-chrome-solid
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Evidence root: `test-results/route-evidence/2026-06-03-mobile-chrome-solid/2026-06-03-c6b59cf/`

Manual review:

- Data Fueling no longer shows underlying section text through the bottom navigation.
- Activity Fueling no longer shows the previous page/form text through the mobile topbar.
- Plan scenario preview no longer ghosts route text below the fixed bottom navigation.

## Notes

- An initial `npm run build -w frontend` failed before `shared` had been built in the fresh worktree; rerunning with `npm run build -w shared && npm run build -w frontend` passed.
- `npm ci` reported existing npm audit vulnerabilities from the lockfile; this UI slice does not modify dependencies.
