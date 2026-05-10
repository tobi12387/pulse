# UI Accessibility Polish v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Archive status 2026-05-10:** Implemented as Fresh Benchmark UI Roadmap Phase 1 and moved to `completed/`. The checkbox list below is retained as the original execution plan and should not be treated as open backlog.

**Goal:** Close the concrete responsive/accessibility issues found in the 2026-05-10 route evidence before larger UI restructuring.

**Architecture:** This is a narrow frontend QA slice. It changes shared chrome/focus behavior and test fixtures without changing backend behavior, live Garmin sync, or primary navigation.

**Tech Stack:** React 19, Vite, Playwright, TypeScript, inline Pulse component styles plus `frontend/src/index.css`.

---

## Files

- Modify: `frontend/src/index.css` for shared focus/scroll/type/touch helpers.
- Modify: `frontend/src/components/Layout.tsx` for tablet/sidebar touch targets.
- Modify: `frontend/src/components/PulseChrome.tsx` for `tab`/`tabpanel` semantics support.
- Modify: `frontend/src/pages/Plan.tsx` for scenario scroll margin and form control height.
- Modify: `frontend/src/pages/Home.tsx` for keyboard-accessible metric tooltip trigger.
- Modify: `frontend/src/features/data/mental/mental-components.tsx` for textarea focus rings.
- Modify: `frontend/e2e/fixtures/pulse-api.ts` so generic mobile intent evidence no longer emits the 155-km sample.
- Modify: `frontend/e2e/route-evidence.spec.ts` to assert the Plan scenario heading is visible after mobile-intent navigation.
- Test: `frontend/e2e/pulse-usability.spec.ts`.

## Task 1: Fix Plan Scenario Deep-Link Clipping

- [ ] **Step 1: Write the failing route-evidence assertion**

In `frontend/e2e/route-evidence.spec.ts`, after the existing mobile-intent scenario assertion, add:

```ts
await expect(page.getByRole('heading', { name: /Training, Ziele|Szenario/i }).first()).toBeVisible();
await expect(page.getByTestId('plan-scenario-entry-context')).toBeVisible();
```

- [ ] **Step 2: Verify failure or screenshot clipping**

Run:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/ui-a11y-polish-red npm run qa:ux-evidence
```

Expected before the fix: mobile screenshot still lands with the scenario card top clipped, or the assertion fails on the heading/context visibility.

- [ ] **Step 3: Add scroll-margin behavior**

In `frontend/src/pages/Plan.tsx`, change the scenario preview section:

```tsx
<section id="plan-scenario-preview" tabIndex={-1} className="card evidence-section" data-testid="plan-scenario-preview-card" style={{ borderColor: 'rgba(94,230,207,0.2)' }}>
```

- [ ] **Step 4: Run route evidence**

Run:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/ui-a11y-polish-green npm run qa:ux-evidence
```

Expected: `2 passed`; mobile `plan-mobile-intent-scenario` starts at the scenario card heading/context.

## Task 2: Remove Generic 155-km Fixture Leakage

- [ ] **Step 1: Add a route-evidence guard**

In `frontend/e2e/route-evidence.spec.ts`, inside the mobile Plan scenario verify block, add:

```ts
await expect(page.getByTestId('plan-scenario-preview-card')).not.toContainText('155 km');
await expect(page.getByTestId('plan-scenario-preview-card')).not.toContainText('423 min');
```

- [ ] **Step 2: Patch the generic fixture**

In `frontend/e2e/fixtures/pulse-api.ts`, change the default `/api/pulse/plan/scenario/preview` fallback to match the generic 60-minute mobile intent:

```ts
changedDays: [{
  date: body.workout?.plannedDate ?? today,
  before: { sessions: 0, durationMin: 0, tss: 0 },
  after: { sessions: 1, durationMin: body.workout?.durationMin ?? 60, tss: 42 },
  label: `+1 Einheit, +${body.workout?.durationMin ?? 60} min`,
}],
loadImpact: { tssDelta: 42, durationDeltaMin: body.workout?.durationMin ?? 60, nextDayRecoveryDate: null },
reasons: [
  'Mobile Vorschau: erst Wochenlast, Recovery und Garmin-Auswirkung prüfen.',
  'Plan oder Garmin werden erst nach Apply verändert.',
],
warnings: [],
```

- [ ] **Step 3: Keep long-tour coverage explicit**

Leave existing long-tour tests in `frontend/e2e/pulse-usability.spec.ts` intact if they explicitly fill `155` or assert long-tour recovery behavior.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test:e2e -- --project=mobile-chromium --grep "Mobile Quick Decision|custom workout does not expose|custom tour"
```

Expected: relevant mobile quick decision and custom tour tests pass.

## Task 3: Accessibility Control Baseline

- [ ] **Step 1: Add failing checks for tablet/sidebar targets and tabpanel wiring**

In `frontend/e2e/pulse-usability.spec.ts`, add a desktop/tablet-width test that sets viewport `834x1112`, navigates through primary nav, and asserts nav link bounding boxes are at least `44px` tall.

Also assert Data segmented tabs expose `aria-controls` and target panels expose `role="tabpanel"`.

- [ ] **Step 2: Patch Layout touch targets**

In `frontend/src/components/Layout.tsx`, add `minHeight: 44` to desktop `NavLink` rows and the logout button:

```tsx
className={({ isActive }) =>
  `flex min-h-11 items-center justify-between rounded px-3 py-2 text-[13px] transition-colors ${...}`
}
```

For logout, add `minHeight: 44`, `minWidth: 44`, and `display: inline-flex`.

- [ ] **Step 3: Patch tab semantics**

Extend `SegmentedControl` in `frontend/src/components/PulseChrome.tsx` to accept `idPrefix?: string`. Set each tab id to `${idPrefix}-${item.id}-tab` and `aria-controls` to `${idPrefix}-${item.id}-panel`.

Wrap Data and Plan active content in:

```tsx
<section role="tabpanel" id="data-mental-panel" aria-labelledby="data-mental-tab">
  ...
</section>
```

Use `idPrefix="data"` in `Data.tsx` and `idPrefix="plan"` in `Plan.tsx`.

- [ ] **Step 4: Patch form/focus baseline**

In `frontend/src/pages/Plan.tsx`, add `minHeight: 44` to `fieldStyle`.

Remove inline `outline: 'none'` from Mental textareas in `frontend/src/features/data/mental/mental-components.tsx`; rely on global `focus-visible`.

- [ ] **Step 5: Run checks**

Run:

```bash
npm run test:e2e -- --project=mobile-chromium --project=desktop-chromium --grep "touch|tab|keyboard|Plan|Mental"
npm run build -w frontend
```

Expected: Playwright focus/touch tests pass and frontend build succeeds.

## Task 4: Contrast and Keyboard Row Cleanup

- [ ] **Step 1: Raise helper contrast**

In `frontend/src/index.css`, adjust:

```css
--text-3: #8A93A1;
```

Keep `--text-2` unchanged unless visual QA shows insufficient hierarchy.

- [ ] **Step 2: Convert clickable metric tooltip trigger**

In `frontend/src/pages/Home.tsx`, replace span-like clickable tooltip triggers with `<button type="button">`, add `aria-expanded`, `aria-describedby`, and Escape handling.

- [ ] **Step 3: Convert clickable table rows**

In `frontend/src/pages/Plan.tsx`, replace clickable `<tr onClick>` activity rows with a focusable button/link inside the first cell or add `tabIndex={0}`, `role="button"`, and Enter/Space handlers.

- [ ] **Step 4: Verify keyboard path**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium --grep "keyboard|Plan|Home"
npm run qa:ux-evidence
```

Expected: keyboard tests pass; fresh route evidence has no horizontal overflow.

## Non-Goals

- No new top-level navigation item.
- No backend or DB migration.
- No live Garmin sync.
- No visual redesign beyond accessibility/responsive fixes.
