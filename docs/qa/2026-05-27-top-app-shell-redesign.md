# 2026-05-27 - Top-App Shell Redesign

## Scope

Tobi explicitly reprioritized UI/UX because Pulse still felt unclear and unstructured. The package focuses on the shared app shell and route-wide visual language instead of adding more route cards:

- desktop navigation becomes a full workspace sidebar with labels, route roles and shortcut numbers;
- the duplicate desktop topbar is removed so each route starts closer to the actual work;
- product accent and semantic state are separated: blue is the product action/accent, green stays positive health/readiness semantics;
- mobile shell and cards are slightly denser while keeping the stable bottom navigation and route URLs.

## Before Evidence

Command:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-redesign-baseline npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-redesign-baseline
```

Summary:

- 9 desktop screenshots, 17 mobile screenshots.
- 0 horizontal-overflow findings.
- Manual review: no technical layout break, but the desktop shell still split structure across a narrow icon rail plus a topbar mode chip. Mobile and desktop also used the same teal accent for product actions and positive health semantics, making the app feel flatter than the actual decision hierarchy.

Reference screenshots:

- `/tmp/pulse-2026-05-27-redesign-baseline/2026-05-26-d313e70/desktop-chromium/01-home.png`
- `/tmp/pulse-2026-05-27-redesign-baseline/2026-05-26-d313e70/desktop-chromium/03-data.png`
- `/tmp/pulse-2026-05-27-redesign-baseline/2026-05-26-d313e70/mobile-chromium/01-home.png`
- `/tmp/pulse-2026-05-27-redesign-baseline/2026-05-26-d313e70/mobile-chromium/03-data.png`

## Change

- `frontend/src/components/Layout.tsx`
  - Removed the desktop topbar.
  - Expanded the desktop sidebar into a readable workspace rail.
  - Moved brand, sync status, user/date and Coach entry into one stable sidebar.
  - Kept the stable route set: Heute, Plan, Daten, Lernen and Setup.
- `frontend/src/lib/theme.ts`
  - Switched the product accent from teal to blue.
  - Kept teal available and kept green for positive semantic states.
- `frontend/src/index.css`
  - Reworked desktop sidebar sizing, nav rows, active state, Coach entry and user/status strip.
  - Tightened mobile shell/card density without changing the bottom navigation contract.

## After Evidence

Commands:

```bash
git diff --check
npm run build -w shared
npm run build -w frontend
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-top-app-shell-redesign-v2 npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-top-app-shell-redesign-v2
npm run test:e2e:smoke
```

Summary:

- Build passed.
- 9 desktop screenshots, 17 mobile screenshots.
- 0 horizontal-overflow findings.
- Smoke passed: 108 passed, 14 skipped.
- Manual review: desktop Home/Data/Plan now read as one app frame with clear route roles in the sidebar; route content starts at the top without the duplicated mode chip. Mobile Home/Data/Plan/Settings keep the first action visible and use blue for product action emphasis while health/fueling state still uses semantic green/amber.

Reference screenshots:

- `/tmp/pulse-2026-05-27-top-app-shell-redesign-v2/2026-05-26-d313e70/desktop-chromium/01-home.png`
- `/tmp/pulse-2026-05-27-top-app-shell-redesign-v2/2026-05-26-d313e70/desktop-chromium/03-data.png`
- `/tmp/pulse-2026-05-27-top-app-shell-redesign-v2/2026-05-26-d313e70/desktop-chromium/06-plan.png`
- `/tmp/pulse-2026-05-27-top-app-shell-redesign-v2/2026-05-26-d313e70/mobile-chromium/01-home.png`
- `/tmp/pulse-2026-05-27-top-app-shell-redesign-v2/2026-05-26-d313e70/mobile-chromium/03-data.png`
- `/tmp/pulse-2026-05-27-top-app-shell-redesign-v2/2026-05-26-d313e70/mobile-chromium/06-plan.png`
- `/tmp/pulse-2026-05-27-top-app-shell-redesign-v2/2026-05-26-d313e70/mobile-chromium/09-settings.png`

## Remaining Gates

This is UI/UX structure work only. It does not close:

- Fueling learning gate: structured GI comfort is still required for existing long-carb logs.
- iPhone/PWA field gate: current real-device evidence is still required for the deployed commit.
