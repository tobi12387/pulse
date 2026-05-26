# 2026-05-26 — Performance-OS Redesign Evidence

## Scope

Tobi reported that Pulse still feels too cluttered and weakly structured, and explicitly allowed breaking UI, route and card changes. This pass treats that as a fresh route-wide UI/UX package, not as gated autonomous backlog work.

## Before Evidence

- Command: `npm run qa:ux-evidence`
- Summary: `npm run qa:ux-summary -- test-results/route-evidence/2026-05-26-266cd8c`
- Result: 9 desktop screenshots and 17 mobile screenshots, 0 horizontal overflow.
- Relevant friction:
  - Desktop repeated route role in topbar, sidebar item copy and sidebar status card.
  - Sidebar used too much horizontal space for secondary labels and numeric keys.
  - Mobile Home turned Readiness into a long table below the decision instead of a compact evidence cluster.
  - Route-wide palette still read as mostly one green/teal family, making action, navigation and health state less distinct.

## Change

- Desktop app chrome is now a compact workspace rail: icon, route label and active state stay visible; secondary descriptions, numeric keys and duplicate route-status card are removed from the main chrome.
- The topbar keeps one concise active-mode chip and utility status instead of repeating the full sidebar context.
- The route vocabulary now names the learning workspace `Lernen` in primary navigation while preserving the stable `/insights` route.
- Base palette moves to neutral surfaces, blue product accent and separate green/amber/rose status tones.
- Card language is flatter with 8px radius, softer borders and less visual nesting.
- Mobile Home turns Readiness into a score/status pair plus a 2x2 evidence grid instead of a long row list.

## After Evidence

- Command: `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-redesign-after npm run qa:ux-evidence`
- Summary: `npm run qa:ux-summary -- test-results/route-evidence-redesign-after/2026-05-26-266cd8c`
- Result: 9 desktop screenshots and 17 mobile screenshots, 0 horizontal overflow.
- Manual screenshot review:
  - Desktop Home/Data have less chrome noise and more room for the actual working surface.
  - Mobile Home keeps the decision, CTA, core reason and Readiness evidence in a clearer first-flow stack.
  - Mobile bottom navigation still preserves the five stable primary workspaces.

## Residual Risk

- This is a route-wide visual/IA pass. It deliberately does not change product logic, Garmin writes, Fueling gates, Coach behavior or backend contracts.
- The old `/insights` URL remains stable even though the nav label now says `Lernen`.
