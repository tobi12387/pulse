# 2026-05-27 - Clarity Redesign

## Scope

Tobi explicitly reprioritized UI/UX again because Pulse still felt unclear and weakly structured after prior top-app passes. This pass does not add another product card. It removes repeated chrome, shortens navigation, and makes route surfaces calmer.

## Change

- `frontend/src/components/Layout.tsx`
  - Removed the desktop sidebar focus card so the topbar is the single route mission surface.
  - Shortened desktop navigation to icon, area and role only; no numeric keys or intent chips.
  - Mobile topbar now shows the route status instead of repeated `Pulse` copy.
  - Operational route width is slightly narrower for more readable command surfaces.
- `frontend/src/index.css`
  - Reduced sidebar width and nav row height.
  - Flattened base card styling and nested card styling.
  - Tightened workspace topbar, Home hero and readiness side panel spacing.

## Evidence

Commands:

```bash
npm run build -w shared
npm run build -w frontend
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/2026-05-27-clarity-redesign npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/2026-05-27-clarity-redesign
```

Result:

- Frontend build passed after `shared` build.
- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Evidence root: `test-results/route-evidence/2026-05-27-clarity-redesign/2026-05-27-df42e69/`.

Manual review:

- Desktop Home/Data/Plan now have one mission line in the topbar and no second explanatory sidebar card.
- Desktop nav no longer truncates long intent copy or competes with the active route.
- Mobile keeps the stable top/bottom chrome and route tabs, with clearer status copy (`Jetzt`, `Capture first`, `No hidden write`, `Diagnose`).

## Gates

This is route-wide UI/UX structure only. It does not close Fueling learning, iPhone/PWA field evidence, Garmin, Push or deploy gates.
