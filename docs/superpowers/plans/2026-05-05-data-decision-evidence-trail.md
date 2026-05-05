# Data Decision Evidence Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home and Plan evidence chips should deep-link to the exact Data evidence that explains the recommendation.

**Architecture:** Keep Data as the evidence route. Add lightweight anchor ids and target paths to existing evidence chips instead of creating new dashboards.

**Tech Stack:** React/Vite, React Router, Playwright.

---

## Context

Data now starts with a useful overview and contains Mental, Schlaf, Metriken, Abdeckung and Analysen. The remaining UX gap is continuity: evidence appears in Home and Plan, but the user must often infer where to inspect it.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/pages/Data.tsx` | Add stable section anchors and overview decision-provenance summary |
| Modify | `frontend/src/pages/Home.tsx` | Link daily evidence chips to Data tabs/anchors |
| Modify | `frontend/src/pages/Plan.tsx` | Link plan evidence chips to Data tabs/anchors |
| Modify | `frontend/src/pulse/daily-decision.ts` | Return structured evidence target metadata if needed |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | E2E evidence trail coverage |

## Task 1: Add Stable Data Anchors

- [x] **Step 1: Add anchors in Data tab sections**

In `frontend/src/pages/Data.tsx`, add ids:

```tsx
<section id="data-recovery">...</section>
<section id="data-mental">...</section>
<section id="data-garmin-quality">...</section>
<section id="data-plan-trace">...</section>
```

Use existing wrapper elements where possible. Do not add nested cards.

- [x] **Step 2: Add scroll-on-load behavior**

When `location.hash` is present, scroll the matching id into view after tab render:

```ts
requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }));
```

## Task 2: Structure Evidence Targets

- [x] **Step 1: Extend daily-decision evidence type only if needed**

In `frontend/src/pulse/daily-decision.ts`, replace bare evidence strings with a compatible shape:

```ts
export type DailyDecisionEvidence = string | { label: string; targetPath: string };
```

Keep rendering compatible with existing string evidence.

- [x] **Step 2: Map common evidence**

Use these target paths:

```ts
{ label: `Readiness ${score}/100`, targetPath: '/data#data-recovery' }
{ label: `TSB ${tsb.toFixed(1)}`, targetPath: '/data?tab=analysen#data-plan-trace' }
{ label: 'Mental Check-in', targetPath: '/data?tab=mental#data-mental' }
{ label: 'Garmin Abdeckung', targetPath: '/data?tab=coverage#data-garmin-quality' }
```

## Task 3: Link Chips From Home And Plan

- [x] **Step 1: Update Home evidence rendering**

In `frontend/src/pages/Home.tsx`, render evidence objects as links:

```tsx
<button type="button" onClick={() => navigate(evidence.targetPath)}>
  {evidence.label}
</button>
```

Keep string evidence as non-clickable chips.

- [x] **Step 2: Update Plan evidence rendering**

In `frontend/src/pages/Plan.tsx`, use the same link/chip pattern for plan trace and next decision evidence.

## Task 4: Add Data Overview Provenance

- [x] **Step 1: Add a compact provenance row**

In `DataOverviewTab`, show the current decision evidence groups:

```tsx
<button onClick={() => setTab('mental')}>Mental Check-in pruefen</button>
<button onClick={() => setTab('coverage')}>Garmin Abdeckung pruefen</button>
<button onClick={() => setTab('analysen')}>Plan-/Load-Analyse pruefen</button>
```

## Task 5: Verify

- [x] **Step 1: Add E2E**

In `frontend/e2e/pulse-usability.spec.ts`:

```ts
test('Home evidence chips deep-link to Data evidence sections', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Readiness/i }).click();
  await expect(page).toHaveURL(/\/data/);
  await expect(page.locator('#data-recovery')).toBeVisible();
});
```

- [x] **Step 2: Run focused and full checks**

```bash
npm run test:e2e -- --grep "evidence"
npm run build -w frontend
```

Expected: PASS.

## Acceptance

- Home and Plan evidence can open the exact Data evidence area.
- Data overview summarizes where to inspect today's provenance.
- No new top-level route is introduced.
- Existing `/data?tab=...` URL state remains stable.
