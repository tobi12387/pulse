# 2026-05-22 — Top-App UI Second-Pass Evidence

## Scope

Tobi reported that Pulse still feels too unclear and poorly structured after the first route-wide redesign. This second pass keeps deep-link URLs stable for now, but changes the visible structure:

- navigation becomes a `Command Center` with route intent and a short daily logic rail;
- desktop topbar names the active working surface, what it changes and why it is open;
- shared route headers use one consistent workspace pattern instead of each page feeling separate;
- Home becomes a daily work surface with a primary decision lane and an optional open-items rail;
- global cards move toward flatter action panels with fewer competing dashboard shadows;
- Data keeps the Fueling evidence queue, including existing closable logs and the future long-session checklist.

## Evidence Commands

Before-state evidence:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/pre-top-app-redesign npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/pre-top-app-redesign
```

After-state evidence:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/top-app-redesign-final npm run qa:ux-evidence
npm run qa:ux-summary -- test-results/route-evidence/top-app-redesign-final
```

Summary:

```text
desktop-chromium: 9 screenshots, overflow 0
mobile-chromium: 17 screenshots, overflow 0
```

Focused checks:

```bash
git diff --check
npm run build -w frontend
npm run test:e2e -- frontend/e2e/pulse-smoke.spec.ts -g "primary navigation|Data mobile subnavigation|Data mobile deep links|Plan mobile subnavigation|Plan mobile week strip|Data today promotes actionable fueling learning gaps" --project=desktop-chromium --project=mobile-chromium
```

## Manual Review Notes

- Desktop Home keeps the decision first; the optional open-items rail only appears when real content exists, avoiding an empty side column.
- Desktop Data and Plan now read more like working surfaces: active route intent appears in the shell, and the primary action/week decision sits inside a clearer action panel.
- Mobile Data/Plan keep all section tabs inside the visible viewport with 0 horizontal overflow.
- Fueling remains evidence-gated: GI comfort is still a real manual choice, sodium/heat/sweat remain measured-only, and no Nutrition trend is released before 3/3 comparable complete logs.
