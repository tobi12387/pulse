# 2026-05-21 UI/UX Redesign Evidence

Branch: `codex/ui-ux-redesign`
Base commit under test: `05cd46a`

## User Friction

Tobi reported that the current Pulse UI/UX is still too unclear and poorly
structured, and explicitly allowed a broad redesign guided by leading
performance apps.

## Design Direction

- Make the shell explain the product structure at a glance: Heute, Data, Plan,
  Insights and Settings each get an icon and a short purpose.
- Keep Heute as the first surface, but make the primary action visually stronger
  and reduce technical cockpit labels in the global chrome.
- Use a calmer dark system with clearer contrast, softer cards, stronger
  headings and readable action controls.
- Preserve existing routes, action contracts and evidence gates; this PR changes
  presentation and structure, not nutrition/iPhone gate behavior.

## Implementation Scope

- `frontend/src/components/Layout.tsx`
- `frontend/src/components/PulseChrome.tsx`
- `frontend/src/components/ui/focus.tsx`
- `frontend/src/components/DailyDecisionCard.tsx`
- `frontend/src/features/today/DecisionHero.tsx`
- `frontend/src/pages/Home.tsx`
- `frontend/src/index.css`

## Verification

```bash
npm --prefix frontend run build
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence-redesign npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence-redesign
npm run test:e2e:smoke
npm run verify:tagesentscheidung:pr
```

Summary:

- Desktop Chromium: 9 screenshots, 0 horizontal overflow.
- Mobile Chromium: 17 screenshots, 0 horizontal overflow.
- Evidence root: `test-results/route-evidence-redesign/2026-05-21-05cd46a/`
- Smoke suite: 105 passed, 13 skipped.
- `verify:tagesentscheidung:pr`: passed.

Manual screenshot review:

- Desktop Home now has a wider purpose-based sidebar, clearer brand/status
  header, stronger Tagesentscheidung CTA and less cockpit chrome.
- Desktop Data and Plan keep the real workflows while making tabs and route
  purpose easier to scan.
- Mobile Home/Data/Plan now use icon bottom navigation and a simpler top bar.
- No horizontal overflow was recorded by the route evidence manifest.
