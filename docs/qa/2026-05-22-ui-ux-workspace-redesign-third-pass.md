# 2026-05-22 UI/UX Workspace Redesign Third Pass

## Scope

Tobi explicitly reprioritized route-wide UI/UX clarity and allowed breaking UI, route and card changes. This pass keeps the stable primary routes for now, but redesigns the shared app chrome and visual system around clearer workspaces:

- `Heute`: decide
- `Plan`: steer
- `Daten`: capture evidence
- `Analyse`: learn
- `Setup`: keep the system ready

## Before Evidence

Command:

```bash
npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence
```

Evidence root:

```text
test-results/route-evidence/2026-05-22-731bb4c/
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.

Observed friction:

- The UI was technically stable, but still read as a collection of equally important cards.
- Desktop repeated orientation through topbar, sidebar workflow card and route headers.
- Mobile Data and Plan duplicated the active route name in the fixed topbar and the page header.
- The dominant blue accent made decision, navigation, secondary evidence and active states compete visually.

## Implementation

- Reframed the desktop sidebar as a compact workspace rail.
- Replaced the duplicated sidebar workflow card with a small active-workspace handoff.
- Moved the mobile topbar from generic `Pulse` branding to the current workspace name and intent.
- Aligned CSS variables and React theme variables to one calmer palette.
- Reduced card shadow and nested-card weight route-wide.
- Hid the heavy Home stage strip on mobile so the first screen starts with the actual decision.
- Treated mobile tabbed page headers as toolbar surfaces: topbar names the workspace, tabs lead the content.
- Updated route evidence's Data analysis anchor from the old plural title to the new toolbar label.

## After Evidence

Command:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-redesign npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence-redesign
```

Evidence root:

```text
test-results/route-evidence-redesign/2026-05-22-731bb4c/
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Focused route and anchor checks remained green, including Activity Fueling and mobile Plan scenario evidence.

## Conclusion

The pass improves orientation and reduces visual competition without breaking the established primary route URLs. Further route renaming can stay available for a later package, but this slice first makes the current daily workflow feel more like one coherent app surface.
