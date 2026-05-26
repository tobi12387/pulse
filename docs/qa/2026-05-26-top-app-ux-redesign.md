# 2026-05-26 — Top-App UI/UX Redesign Evidence

## Scope

- Route-wide UI/UX pass for the main operational surfaces: Heute, Plan, Daten, Analyse and Setup.
- Ausgangspunkt war frische Route-Evidence auf `eeaaa87`.
- Ziel: weniger Chrome-Rauschen, klarere Arbeitsbereiche, leichtere mobile Surface-Wechsel und eine ruhigere Kartenhierarchie ohne neue Produktlogik.

## Before Evidence

Command:

```bash
npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Evidence root: `test-results/route-evidence/2026-05-26-eeaaa87/`.

Observed friction:

- Desktop chrome repeated the active workspace as both topbar mode, sidebar navigation and explanatory sidebar card.
- Data and Plan used repeated page-mode chips and route copy before the actual work surface.
- Mobile route tabs rendered as a heavy pill block that visually competed with the first action.
- Home's secondary stack still read as another card column instead of a compact open-work list.

## Redesign Changes

- Removed the repeated `Arbeitsfläche` page-mode chip from route headers.
- Replaced the long sidebar explanation card with a compact active-workspace status chip.
- Renamed navigation surface language to clearer command roles: Entscheidung, Steuerung, Evidenz, Lernen, System.
- Made mobile segmented controls a light tab rail with active underline instead of a large rounded pill surface.
- Flattened the desktop Home secondary rail so open work reads as a list, not a second card wall.
- Tightened the Plan mobile week strip and refreshed route titles/copy for Data and Plan.
- Shifted the global palette slightly away from one-note green into a cooler neutral/teal system while keeping existing semantic colors.

## After Evidence

Command:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-redesign-final npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence-redesign-final
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Evidence root: `test-results/route-evidence-redesign-final/2026-05-26-eeaaa87/`.

Conclusion:

- The redesign keeps the stable route set and all existing product contracts.
- The first viewport is calmer on Data and Plan because the route switcher is lighter and explanatory chrome is reduced.
- No horizontal overflow was recorded in the final desktop/mobile evidence pack.
