# Insights Into Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the current Insights capability into Data as an `Analysen` tab, remove Insights from primary navigation, and keep `/insights` as a compatibility redirect.

**Architecture:** Keep backend contracts unchanged. Extract the reusable Insights surface from `frontend/src/pages/Insights.tsx` into a Data feature component, render it from `frontend/src/pages/Data.tsx`, and replace the old `/insights` route with a redirect to `/data?tab=analysen`. Navigation and hotkeys should expose five primary destinations after this PR: Home, Coach, Data, Plan and Settings.

**Tech Stack:** React, React Router, TanStack Query, TypeScript, Vite, Playwright, existing Pulse hooks/components.

---

## File Structure

- Modify `frontend/src/pages/Insights.tsx`: export the reusable analysis surface and make the default route component redirect to Data.
- Modify `frontend/src/pages/Data.tsx`: add the `analysen` tab and render the reusable analysis surface.
- Modify `frontend/src/components/Layout.tsx`: remove the Insights nav item and renumber Settings to key `5`.
- Modify `frontend/src/hooks/useHotkeys.ts`: map `5` to `/settings` and remove `6`.
- Modify `frontend/src/pages/Home.tsx`: point the KI-Analyse CTA to `/data?tab=analysen`.
- Modify `frontend/e2e/pulse-smoke.spec.ts`: update primary route smoke coverage and add `/insights` redirect coverage.
- Modify `frontend/e2e/pulse-usability.spec.ts`: move Insights behavior expectations to `/data?tab=analysen`, update mobile nav and touch-target checks.
- Modify `frontend/e2e/route-evidence.spec.ts`: capture the primary five routes plus the Data analysis tab instead of a standalone Insights page.
- Modify `docs/superpowers/specs/2026-05-04-nav-ia-design.md`: mark PR 1 as planned/active if implementation proceeds in the same branch.
- Create `docs/qa/2026-05-04-insights-into-data.md`: record test commands, route evidence path and mobile/desktop findings.
- Modify `docs/decisions.md`: add an implementation decision once the behavior is complete.

## Task 1: Write Failing Navigation And Redirect Tests

**Files:**
- Modify: `frontend/e2e/pulse-smoke.spec.ts`
- Modify: `frontend/e2e/pulse-usability.spec.ts`
- Modify: `frontend/e2e/route-evidence.spec.ts`

- [ ] **Step 1: Update the smoke route list**

In `frontend/e2e/pulse-smoke.spec.ts`, replace the `routes` constant with:

```ts
const routes = [
  { path: '/', label: 'Dashboard', navHref: '/', visibleText: 'READINESS' },
  { path: '/coach', label: 'Coach', navHref: '/coach', visibleText: 'TAGESBRIEFING' },
  { path: '/data', label: 'Data', navHref: '/data', visibleText: 'Schlaf, Metriken & Mental' },
  { path: '/plan', label: 'Plan', navHref: '/plan', visibleText: 'Training, Ziele & Statistik' },
  { path: '/settings', label: 'Settings', navHref: '/settings', visibleText: 'Settings' },
] as const;
```

- [ ] **Step 2: Add redirect and analysis-tab smoke tests**

In `frontend/e2e/pulse-smoke.spec.ts`, after `primary navigation reaches every Pulse page`, add:

```ts
test('/insights redirects to the Data analysis tab', async ({ page }) => {
  await page.goto('/insights');
  await expect(page).toHaveURL('/data?tab=analysen');
  await expect(page.getByRole('button', { name: 'Analysen' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Analysen' })).toBeVisible();
});

test('primary navigation omits Insights after it moves into Data', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href="/insights"]')).toHaveCount(0);
  await expect(page.locator('a[href="/settings"]').filter({ visible: true })).toContainText('Settings');
});
```

- [ ] **Step 3: Run smoke tests and verify they fail**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium --grep "Insights redirects|primary navigation omits"
```

Expected before implementation:

```text
FAIL /insights redirects to the Data analysis tab
FAIL primary navigation omits Insights after it moves into Data
```

- [ ] **Step 4: Update usability tests to target Data Analysen**

In `frontend/e2e/pulse-usability.spec.ts`, change these `page.goto('/insights')` calls to `page.goto('/data?tab=analysen')`:

- `Insights load analyses only after the user opens a card`
- `Insights show evidence links for opened analysis cards`
- `Insights show a helpful state instead of raw server errors`
- `Insights classify provider errors with a retry action`
- `Insights classify missing data without offering a retry`
- `Home, Coach and Insights show the daily decision quality signal`
- `Mobile repeated controls have reliable touch targets`

Also update the quality test name to:

```ts
test('Home, Coach and Data analyses show the daily decision quality signal', async ({ page }) => {
```

And inside that test replace:

```ts
await expect(page.getByTestId('insights-decision-quality-card')).toContainText('Entscheidungsqualität');
await expect(page.getByTestId('insights-decision-quality-card')).toContainText('Mobilität 10 Minuten');
```

with:

```ts
await expect(page.getByTestId('data-analysis-decision-quality-card')).toContainText('Entscheidungsqualität');
await expect(page.getByTestId('data-analysis-decision-quality-card')).toContainText('Mobilität 10 Minuten');
```

- [ ] **Step 5: Update mobile nav and overflow route expectations**

In `frontend/e2e/pulse-usability.spec.ts`, replace:

```ts
await expect(bottomNav.locator('a[href="/insights"]')).toContainText('Insights');
await expect(bottomNav.locator('a[href="/settings"]')).toContainText('Settings');
```

with:

```ts
await expect(bottomNav.locator('a[href="/insights"]')).toHaveCount(0);
await expect(bottomNav.locator('a[href="/settings"]')).toContainText('Settings');
```

Replace the mobile overflow route list:

```ts
for (const route of ['/', '/coach', '/data', '/plan', '/insights', '/settings']) {
```

with:

```ts
for (const route of ['/', '/coach', '/data', '/data?tab=analysen', '/plan', '/settings']) {
```

- [ ] **Step 6: Update the route evidence route list**

In `frontend/e2e/route-evidence.spec.ts`, replace the `routes` constant with:

```ts
const routes = [
  { path: '/', label: 'home', visibleText: 'READINESS' },
  { path: '/coach', label: 'coach', visibleText: 'TAGESBRIEFING' },
  { path: '/data', label: 'data', visibleText: 'Schlaf, Metriken & Mental' },
  { path: '/data?tab=analysen', label: 'data-analysen', visibleText: 'Analysen' },
  { path: '/plan', label: 'plan', visibleText: 'Training, Ziele & Statistik' },
  { path: '/settings', label: 'settings', visibleText: 'Settings' },
] as const;
```

- [ ] **Step 7: Run the focused usability tests and verify they fail**

Run:

```bash
npm run test:e2e -- --project=mobile-chromium --grep "Insights load|Insights show|Insights classify|Data analyses|Mobile navigation|Mobile routes|Mobile repeated"
```

Expected before implementation:

```text
FAIL because Data has no Analysen tab yet
FAIL because Insights still exists in mobile nav
```

## Task 2: Move Insights Surface Into Data

**Files:**
- Modify: `frontend/src/pages/Insights.tsx`
- Modify: `frontend/src/pages/Data.tsx`

- [ ] **Step 1: Export the reusable Insights surface**

In `frontend/src/pages/Insights.tsx`, change the import line:

```ts
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
```

and change the component export at the bottom from:

```ts
export default function Insights() {
```

to:

```ts
export function DataAnalysenTab() {
```

Inside that component, update the `PageHeader` props and test id:

```tsx
<PageHeader
  eyebrow="DATA · ANALYSEN"
  title="Analysen"
  description="Öffne eine Karte, um die Analyse gezielt zu laden."
  action={<RangeControl value={days} onChange={setDays} options={RANGE_OPTIONS} />}
/>

<MentalLoadOverlay />
<DecisionQualityEvidenceCard quality={decisionQuality} testId="data-analysis-decision-quality-card" />
```

Then add the compatibility route component at the bottom:

```tsx
export default function InsightsRedirect() {
  return <Navigate to="/data?tab=analysen" replace />;
}
```

- [ ] **Step 2: Make the decision quality card test id configurable**

In `frontend/src/pages/Insights.tsx`, replace:

```ts
function DecisionQualityEvidenceCard({ quality }: { quality: PulseDailyDecisionQualityResponse | null | undefined }) {
```

with:

```ts
function DecisionQualityEvidenceCard({
  quality,
  testId = 'insights-decision-quality-card',
}: {
  quality: PulseDailyDecisionQualityResponse | null | undefined;
  testId?: string;
}) {
```

Then replace:

```tsx
data-testid="insights-decision-quality-card"
```

with:

```tsx
data-testid={testId}
```

- [ ] **Step 3: Add the Data analysis tab type and mapping**

In `frontend/src/pages/Data.tsx`, add the import:

```ts
import { DataAnalysenTab } from '@/pages/Insights';
```

Replace:

```ts
type Tab = 'abdeckung' | 'schlaf' | 'metriken' | 'gewicht' | 'mental';
```

with:

```ts
type Tab = 'abdeckung' | 'schlaf' | 'metriken' | 'gewicht' | 'mental' | 'analysen';
```

Add the tab:

```ts
const TABS = [
  { id: 'abdeckung', label: 'Abdeckung' },
  { id: 'schlaf', label: 'Schlaf' },
  { id: 'metriken', label: 'Metriken' },
  { id: 'gewicht', label: 'Gewicht' },
  { id: 'mental', label: 'Mental' },
  { id: 'analysen', label: 'Analysen' },
];
```

Add mapping entries:

```ts
const TAB_QUERY: Record<Tab, string> = {
  abdeckung: 'coverage',
  schlaf: 'sleep',
  metriken: 'metrics',
  gewicht: 'weight',
  mental: 'mental',
  analysen: 'analysen',
};

const QUERY_TAB: Record<string, Tab> = {
  coverage: 'abdeckung',
  abdeckung: 'abdeckung',
  sleep: 'schlaf',
  schlaf: 'schlaf',
  metrics: 'metriken',
  metriken: 'metriken',
  weight: 'gewicht',
  gewicht: 'gewicht',
  mental: 'mental',
  analysen: 'analysen',
  analysis: 'analysen',
  insights: 'analysen',
};
```

- [ ] **Step 4: Render the Data analysis tab**

In `frontend/src/pages/Data.tsx`, update the header:

```tsx
<PageHeader eyebrow="DATA" title="Schlaf, Metriken & Mental" />
```

to:

```tsx
<PageHeader eyebrow="DATA" title="Schlaf, Metriken, Mental & Analysen" />
```

Then add the tab body:

```tsx
{tab === 'analysen' && <DataAnalysenTab />}
```

- [ ] **Step 5: Run focused tests and verify the Data tab passes**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium --grep "Insights load|Insights show evidence|Insights show a helpful|Insights classify"
```

Expected after Task 2:

```text
PASS Insights load analyses only after the user opens a card
PASS Insights show evidence links for opened analysis cards
PASS Insights show a helpful state instead of raw server errors
PASS Insights classify provider errors with a retry action
PASS Insights classify missing data without offering a retry
```

## Task 3: Remove Insights From Primary Navigation

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/hooks/useHotkeys.ts`
- Modify: `frontend/src/pages/Home.tsx`

- [ ] **Step 1: Update top-level nav items**

In `frontend/src/components/Layout.tsx`, replace `NAV_ITEMS` with:

```ts
const NAV_ITEMS = [
  { to: '/',          label: 'Dashboard', mobileLabel: 'Home',     key: '1', end: true  },
  { to: '/coach',     label: 'Coach',     mobileLabel: 'Coach',    key: '2', end: false },
  { to: '/data',      label: 'Data',      mobileLabel: 'Data',     key: '3', end: false },
  { to: '/plan',      label: 'Plan',      mobileLabel: 'Plan',     key: '4', end: false },
  { to: '/settings',  label: 'Settings',  mobileLabel: 'Settings', key: '5', end: false },
];
```

- [ ] **Step 2: Update nav hotkeys**

In `frontend/src/hooks/useHotkeys.ts`, replace `KEY_MAP` with:

```ts
const KEY_MAP: Record<string, string> = {
  '1': '/',
  '2': '/coach',
  '3': '/data',
  '4': '/plan',
  '5': '/settings',
};
```

- [ ] **Step 3: Point Home KI-Analyse to Data Analysen**

In `frontend/src/pages/Home.tsx`, replace:

```tsx
onClick={() => navigate('/insights')}
```

with:

```tsx
onClick={() => navigate('/data?tab=analysen')}
```

- [ ] **Step 4: Run focused nav tests**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium --grep "primary navigation|/insights redirects"
```

Expected:

```text
PASS primary navigation reaches every Pulse page
PASS /insights redirects to the Data analysis tab
PASS primary navigation omits Insights after it moves into Data
```

## Task 4: Full Verification And Docs

**Files:**
- Create: `docs/qa/2026-05-04-insights-into-data.md`
- Modify: `docs/superpowers/specs/2026-05-04-nav-ia-design.md`
- Modify: `docs/decisions.md`

- [ ] **Step 1: Run focused mobile checks**

Run:

```bash
npm run test:e2e -- --project=mobile-chromium --grep "Insights load|Insights show|Insights classify|Data analyses|Mobile navigation|Mobile routes|Mobile repeated"
```

Expected:

```text
PASS all selected mobile Chromium tests
```

- [ ] **Step 2: Run frontend build**

Run:

```bash
npm run build -w frontend
```

Expected:

```text
✓ built in
```

- [ ] **Step 3: Run full e2e suite**

Run:

```bash
npm run test:e2e
```

Expected:

```text
passed
skipped
```

The exact passed count may change because the route list changes from standalone Insights to Data Analysen.

- [ ] **Step 4: Regenerate route evidence**

Run:

```bash
PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/insights-into-data npm run qa:ux-evidence
```

Expected:

```text
2 passed
```

If Vite cannot bind to `127.0.0.1:5173` in the sandbox, rerun the same command outside the sandbox with escalation and record both the sandbox failure and successful rerun in the QA doc.

- [ ] **Step 5: Create QA doc**

Create `docs/qa/2026-05-04-insights-into-data.md`:

```md
# Insights Into Data QA

## Scope

This PR moves Insights into Data as the `Analysen` tab, removes Insights from primary navigation, and keeps `/insights` as a redirect to `/data?tab=analysen`.

## Evidence

- Route evidence command: `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/insights-into-data npm run qa:ux-evidence`
- Result: passed after rerun outside the sandbox if local Vite binding required escalation.
- Path: `test-results/route-evidence/insights-into-data/<date>-<commit>/`
- Viewports:
  - Desktop Chromium: `1280x720`
  - Mobile Chromium: `412x839`
- Manifest result: no horizontal overflow on `/`, `/coach`, `/data`, `/data?tab=analysen`, `/plan`, or `/settings`.

## Verification

- `npm run build -w frontend`: passed.
- `npm run test:e2e -- --project=desktop-chromium --grep "primary navigation|/insights redirects"`: passed.
- `npm run test:e2e -- --project=mobile-chromium --grep "Insights load|Insights show|Insights classify|Data analyses|Mobile navigation|Mobile routes|Mobile repeated"`: passed.
- `npm run test:e2e`: passed.

## Route Notes

- `/data?tab=analysen`: renders the migrated analysis surface and lazy-loads analysis only after a card opens.
- `/insights`: redirects to `/data?tab=analysen`.
- Mobile bottom nav: no longer shows Insights; Settings remains visible and readable.
- Home KI-Analyse CTA: opens Data Analysen.
```

- [ ] **Step 6: Update spec and decision log**

In `docs/superpowers/specs/2026-05-04-nav-ia-design.md`, change:

```md
### PR 1: Move Insights Into Data

This is the recommended first implementation PR.
```

to:

```md
### PR 1: Move Insights Into Data

This is the active implementation PR.
```

Add a newest-first entry to `docs/decisions.md`:

```md
## 2026-05-04 — Insights wandert als Analysen nach Data

- **Decision:** Insights wird aus der Hauptnavigation entfernt und als `Analysen`-Tab in Data gerendert; `/insights` bleibt vorerst ein Redirect auf `/data?tab=analysen`.
- **Why:** Insights ist ein Evidenz- und Analysemodus, dessen Domains zu Data passen. Der Schritt reduziert die mobile und Desktop-Hauptnavigation sofort, ohne Coach Voice, History oder Chat-State anzufassen.
- **Alternatives:** Insights als Haupttab behalten (keine Entlastung); Insights komplett loeschen (verliert Analysefaehigkeit); Coach zuerst entfernen (hoeheres Risiko durch Eingabe-, Voice- und History-Flows).
- **Decided by:** Tobi + Codex.
- **Status:** active.
```

- [ ] **Step 7: Final status check**

Run:

```bash
git status --short --branch
```

Expected:

```text
## codex/nav-ia-spec...origin/codex/nav-ia-spec
 M docs/decisions.md
 M docs/qa/2026-05-04-insights-into-data.md
 M docs/superpowers/specs/2026-05-04-nav-ia-design.md
 M frontend/e2e/pulse-smoke.spec.ts
 M frontend/e2e/pulse-usability.spec.ts
 M frontend/e2e/route-evidence.spec.ts
 M frontend/src/components/Layout.tsx
 M frontend/src/hooks/useHotkeys.ts
 M frontend/src/pages/Data.tsx
 M frontend/src/pages/Home.tsx
 M frontend/src/pages/Insights.tsx
```

## Self-Review

- Spec coverage: PR 1 scope is covered by Tasks 1-4: Data analysis tab, `/insights` redirect, primary nav removal, hotkey remap, Home CTA update, QA evidence and decision log update.
- Placeholder scan: no unresolved placeholder markers are included; the QA doc template uses an explicit `<date>-<commit>` path marker because that value is generated by the evidence command.
- Type consistency: `analysen` is the canonical Data tab id and query value; legacy aliases `analysis` and `insights` are accepted for resilience.
- Scope check: Coach relocation is intentionally excluded from this plan and remains PR 2 in the IA spec.
