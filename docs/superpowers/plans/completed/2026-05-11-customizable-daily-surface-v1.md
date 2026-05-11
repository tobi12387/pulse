# Customizable Daily Surface v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Tobi choose which Home focus cards appear first while Pulse keeps safe defaults for the daily decision, status warnings and Garmin-sensitive actions.

**Architecture:** This is a frontend-only preference layer for `/`. It stores a tiny versioned localStorage value per browser/device, reorders only existing Home focus cards, and does not mutate plan, Garmin, profile, check-in, daily decision or backend state. Daily decision, health/risk/data status, Garmin sync warnings and the compact metric summary stay fixed above the customizable focus area.

**Tech Stack:** React + Vite, TypeScript, localStorage, Playwright, existing Pulse API mocks.

---

## Scope

Build a v1 with four modes:

- `balanced`: default safe Pulse order.
- `training`: training/options first.
- `mental`: mental check-in/signal first.
- `review`: delta/history/learning first.

This plan does not add drag-and-drop, backend persistence, account sync, migrations or new card content.

## File Map

| Path | Change |
|---|---|
| `frontend/src/features/home/home-surface-preferences.tsx` | New focused preference hook, mode metadata and compact selector card. |
| `frontend/src/pages/Home.tsx` | Import preference layer, wrap existing focus cards in ordered render slots, add stable test ids. |
| `frontend/e2e/pulse-usability.spec.ts` | Add read-only tests for default mode, mental-first ordering and reset behavior. |
| `docs/decisions.md` | Record the frontend-only local preference decision. |
| `docs/ai/current-focus.md` | Update durable queue after implementation. |
| `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md` | Mark this slice implemented and leave remaining gated work explicit. |
| `docs/superpowers/plans/completed/README.md` | Add completed-plan index row after implementation. |
| `docs/superpowers/plans/completed/2026-05-11-customizable-daily-surface-v1.md` | Move this plan here after implementation. |

## Success Criteria

1. `/` shows a compact `Heute-Fokus` control below the metric summary and above the reordered focus cards.
2. `Standard`, `Training`, `Mental` and `Rueckblick` modes reorder only the focus cards.
3. Daily decision, status warnings, data warnings and Garmin sync controls remain above the customizable area.
4. Preference is local to the current browser/device and resettable to the safe default.
5. Playwright proves the selector does not call plan, Garmin, coach, check-in or generic write endpoints.
6. Desktop and mobile smoke checks pass without horizontal overflow.

---

## Task 1: Add Local Home Surface Preference Module

**Files:**

- Create: `frontend/src/features/home/home-surface-preferences.tsx`

- [ ] **Step 1: Add the mode contract**

Create the file with these exports:

```tsx
import { useCallback, useState } from 'react';

export type HomeSurfaceFocus = 'balanced' | 'training' | 'mental' | 'review';

export type HomeFocusSlot =
  | 'delta'
  | 'todayOptions'
  | 'adaptation'
  | 'mental'
  | 'action'
  | 'history'
  | 'learning'
  | 'followUps';

export const HOME_SURFACE_STORAGE_KEY = 'pulse.home.surface.focus.v1';

export const HOME_SURFACE_ORDER: Record<HomeSurfaceFocus, HomeFocusSlot[]> = {
  balanced: ['delta', 'todayOptions', 'adaptation', 'mental', 'action', 'history', 'learning', 'followUps'],
  training: ['todayOptions', 'adaptation', 'action', 'delta', 'learning', 'followUps', 'mental', 'history'],
  mental: ['mental', 'todayOptions', 'action', 'delta', 'adaptation', 'learning', 'history', 'followUps'],
  review: ['delta', 'learning', 'history', 'adaptation', 'todayOptions', 'mental', 'action', 'followUps'],
};
```

- [ ] **Step 2: Add safe localStorage parsing**

Use lazy state init and a small parser so broken localStorage values fall back to `balanced`:

```tsx
function parseFocus(value: string | null): HomeSurfaceFocus {
  if (value === 'training' || value === 'mental' || value === 'review') return value;
  return 'balanced';
}
```

- [ ] **Step 3: Add `useHomeSurfaceFocus`**

The hook should return `{ focus, order, setFocus, resetFocus }`. `setFocus` writes only the exact mode string. `resetFocus` removes the key and returns to `balanced`.

- [ ] **Step 4: Add `HomeSurfaceFocusCard`**

Render a compact card with `data-testid="home-surface-focus-card"`, buttons for all four modes, and copy that makes the scope clear: `Sortiert nur diese Home-Fokuskarten auf diesem Geraet.`

## Task 2: Reorder Existing Home Focus Cards

**Files:**

- Modify: `frontend/src/pages/Home.tsx`

- [ ] **Step 1: Import the preference module**

Import `HomeSurfaceFocusCard` and `useHomeSurfaceFocus`.

- [ ] **Step 2: Add stable wrappers**

Use a local `renderFocusSlot(slot)` function in `Home` that wraps each existing focus card in a `div` with test ids:

```tsx
<div data-testid="home-focus-item-delta">...</div>
<div data-testid="home-focus-item-todayOptions">...</div>
<div data-testid="home-focus-item-adaptation">...</div>
<div data-testid="home-focus-item-mental">...</div>
<div data-testid="home-focus-item-action">...</div>
<div data-testid="home-focus-item-history">...</div>
<div data-testid="home-focus-item-learning">...</div>
<div data-testid="home-focus-item-followUps">...</div>
```

The wrapper can render `null` internally when the underlying card has no data.

- [ ] **Step 3: Preserve fixed top-of-page safety order**

Keep this order unchanged:

1. greeting
2. `HealthStateBanner`
3. `RiskWatchBanner`
4. local readiness/load errors
5. data status and Garmin sync errors
6. `DailyDecisionCard`
7. `home-command-summary`
8. `HomeSurfaceFocusCard`

- [ ] **Step 4: Render ordered focus slots**

Replace the current hardcoded focus-card sequence between `home-command-summary` and `RaceCard` with:

```tsx
{homeSurface.order.map(slot => (
  <div key={slot}>{renderFocusSlot(slot)}</div>
))}
```

Do not move `RaceCard`, `RecoveryStrip`, readiness hero, current workout, fitness/load, briefing or AI analysis in this v1.

## Task 3: Add Playwright Coverage

**Files:**

- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [ ] **Step 1: Add read-only request guard helper inside the test**

For the new tests, collect methods/URLs and fail if choosing a focus mode calls writes:

```ts
const writes: string[] = [];
page.on('request', request => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) {
    writes.push(`${request.method()} ${request.url()}`);
  }
});
```

- [ ] **Step 2: Test default and mode control**

Mock Pulse API, open `/`, assert `home-surface-focus-card` is visible, `Standard` is selected, `daily-delta-card` and `today-options-card` remain visible, and `writes` stays empty after selecting another focus mode.

- [ ] **Step 3: Test mental-first ordering**

Mock a missing check-in action so `HomeMentalCheckinCard` is visible. Click `Mental zuerst`, assert `localStorage.getItem('pulse.home.surface.focus.v1') === 'mental'`, compare bounding boxes and prove `home-focus-item-mental` is above `home-focus-item-todayOptions`.

- [ ] **Step 4: Test reset**

After switching away from default, click `Standard` and assert localStorage is removed or the UI returns to `balanced` order.

## Task 4: Verify

**Files:** no direct edits.

- [ ] **Step 1: Build frontend**

Run:

```bash
npm run build -w frontend
```

Expected: exit 0.

- [ ] **Step 2: Run focused Playwright tests**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Daily Surface|Home"
```

Expected: exit 0.

- [ ] **Step 3: Regenerate route evidence**

Run:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/customizable-daily-surface-v1 npm run qa:ux-evidence
```

Expected: exit 0 with desktop and mobile screenshots.

## Task 5: Documentation And Completion

**Files:**

- Modify: `docs/decisions.md`
- Modify: `docs/ai/current-focus.md`
- Modify: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`
- Modify: `docs/superpowers/plans/completed/README.md`
- Move: `docs/superpowers/plans/2026-05-11-customizable-daily-surface-v1.md` to `docs/superpowers/plans/completed/2026-05-11-customizable-daily-surface-v1.md`

- [ ] **Step 1: Record decision**

Add newest-first decision:

```markdown
## 2026-05-11 — Customizable Daily Surface v1 bleibt lokal und read-only

- **Decision:** Home-Fokusreihenfolge wird als lokale Browser-/Geraetepraeferenz umgesetzt. Sie sortiert nur vorhandene Fokusflaechen; Tagesentscheidung, Statuswarnungen, Garmin-Sync und Backend-/Plan-/Check-in-Zustaende bleiben unveraendert.
- **Why:** Tobi soll die taegliche Oberflaeche ruhiger priorisieren koennen, ohne dass Pulse versteckte Produktlogik, Garmin-Writes oder accountweite Einstellungen einfuehrt. Safe Defaults bleiben fuer neue Geraete erhalten.
- **Alternatives:** Drag-and-drop mit Backend-Persistenz (zu gross fuer v1); neue Tabs fuer jeden Fokus (mehr IA statt weniger Dichte); automatische Personalisierung (zu versteckt ohne Evidenz).
- **Decided by:** Codex.
- **Status:** active.
```

- [ ] **Step 2: Update active focus and roadmap**

Mark Customizable Daily Surface implemented. Leave Nutrition Trend Summaries, iPhone/PWA Field Reliability and optional copy echoes as gated items.

- [ ] **Step 3: Complete plan archive**

Move this plan into `completed/`, add one README row, then commit with explicit staging.
