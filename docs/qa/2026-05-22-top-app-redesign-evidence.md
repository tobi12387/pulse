# 2026-05-22 — Top-App UI/UX Redesign Evidence

## Scope

Tobi requested a broad UI/UX redesign with freedom to redefine routes, cards and breaking details. This pass keeps the established primary routes for deep-link stability, but changes the app language toward a calmer top-app structure:

- shell navigation is organized as working surfaces with a visible Performance Loop;
- mobile chrome shows the current route context without duplicating heavy brand chrome;
- global cards move from heavy dashboard tiles toward flatter operational panels;
- Home, Data and Plan first viewports keep one primary action first;
- Data Fueling evidence now shows directly closable existing logs as a compact queue before trend release.

## Evidence Commands

```bash
npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-05-22-819ed57
```

Summary:

```text
desktop-chromium: 9 screenshots, overflow 0
mobile-chromium: 17 screenshots, overflow 0
```

Additional focused checks:

```bash
git diff --check
npm run build -w frontend
npm run verify:lernschleifen
npm run verify:trainingsanpassung
npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts -g "Data today promotes actionable fueling learning gaps" --project=desktop-chromium --project=mobile-chromium
```

## Manual Review Notes

- Mobile Home no longer starts with a large brand-only topbar; the top chrome now says `Pulse` plus the active route context.
- Desktop Data and Plan feel more like product work surfaces: the left rail is lighter, the topbar names the active focus and the card shadows are reduced.
- Mobile Data still keeps the primary task visible first, while the tab rail and bottom nav stay inside the viewport without horizontal overflow.
- Fueling evidence remains gated: candidate logs only route to real activity logs, and GI comfort is still a manual structured choice.
