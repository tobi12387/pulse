# Mobile Accessibility Controls Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulse controls should meet reliable iPhone touch sizing and keyboard semantics on the daily-use routes.

**Architecture:** Prefer small shared primitives and existing components over route-specific patches. Improve touch target minimums, segmented-control semantics and Mental radio behavior without changing the four-tab IA or rebuilding screens.

**Tech Stack:** React/Vite, CSS variables, Playwright desktop/mobile Chromium, optional WebKit.

---

## Context

Fresh route evidence for `35e5263` reports no document horizontal overflow. Remaining friction is control-level: some actions are below 44px and custom `button role="radio"` groups lack arrow-key behavior.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/components/PulseChrome.tsx` | Segmented control semantics, active-tab scroll behavior, 44px minimum |
| Modify | `frontend/src/pages/Coach.tsx` | Coach mic/send 44px touch targets |
| Modify | `frontend/src/features/data/mental/mental-components.tsx` | Mental card radios/fine-tune controls 44px and keyboard behavior |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Mobile touch-target regression coverage |
| Modify | `frontend/e2e/ux-a11y-responsive.spec.ts` | Keyboard semantics for tabs/radios |

## Task 1: Raise Daily Mobile Hit Areas To 44px

- [x] **Step 1: Add failing mobile tests**

Implemented in the first PR-sized slice by tightening the existing mobile repeated-controls test to assert both width and height >= 44px and by adding Coach mic/send plus Mental text/fine-tune controls. The same stricter helper also exposed existing 40px Plan and Settings controls that were fixed in this slice.

In `frontend/e2e/pulse-usability.spec.ts`, extend the mobile touch-target test to include:

```ts
for (const selector of [
  'button[aria-label="Sprachaufnahme starten"]',
  'button[aria-label="Nachricht senden"]',
  'button:has-text("Text auswerten")',
  'button:has-text("Feinjustieren")',
]) {
  const box = await page.locator(selector).first().boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
}
```

- [x] **Step 2: Run red**

```bash
npm run test:e2e -- --project=mobile-chromium --grep "touch targets"
```

Expected: FAIL for Coach mic/send or Mental actions currently under 44px.

Actual red evidence: the focused mobile test failed first on existing 40px/under-44px controls (`Vorherige Woche`, then `Sportart ändern`, `Verlauf löschen`, Settings `Bearbeiten`/`Abdeckung`/`ERLEDIGT`/`Push aktivieren`) after the stricter 44px assertion was added.

- [x] **Step 3: Patch Coach buttons**

In `frontend/src/pages/Coach.tsx`, change mic and send buttons:

```tsx
width: 44,
height: 44,
minWidth: 44,
minHeight: 44,
```

- [x] **Step 4: Patch Mental action buttons**

In `frontend/src/features/data/mental/mental-components.tsx`, set `minHeight: 44` for text action buttons and fine-tune toggle.

Also raised shared segmented/range/mini controls and the Plan/Settings controls covered by the same mobile daily-use regression test. Tab semantics and Mental radio keyboard behavior remain open in Tasks 2 and 3.

## Task 2: Improve Segmented Control Semantics

- [x] **Step 1: Add keyboard test**

Implemented in the keyboard-semantics slice by adding desktop/mobile coverage for the Data segmented control as a real `tablist` with `tab` children and ArrowRight navigation from `Überblick` to `Abdeckung`.

In `frontend/e2e/ux-a11y-responsive.spec.ts`:

```ts
test('Data segmented tabs support arrow-key navigation', async ({ page }) => {
  await page.goto('/data');
  const tablist = page.getByRole('tablist', { name: 'Data Bereiche' });
  await expect(tablist).toBeVisible();
  await page.getByRole('tab', { name: 'Ueberblick' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Abdeckung' })).toBeFocused();
});
```

Use the exact label text present in the component; prefer accessible role/name queries over brittle text-only selectors.

- [x] **Step 2: Implement `tablist`/`tab` roles**

In `frontend/src/components/PulseChrome.tsx`, set:

```tsx
role="tablist"
aria-label="Data Bereiche"
```

For each item:

```tsx
role="tab"
aria-selected={active === item.id}
tabIndex={active === item.id ? 0 : -1}
```

- [x] **Step 3: Add ArrowLeft/ArrowRight handling**

In the button `onKeyDown`, move to previous/next item and call `onChange(next.id)`.

- [x] **Step 4: Auto-scroll active tab into view**

Use a ref per active button and:

```ts
activeButtonRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
```

## Task 3: Make Mental Radios Keyboard-Complete

- [x] **Step 1: Add keyboard test for Mental state cards**

Implemented in the keyboard-semantics slice by covering state cards, quick-choice radios and fine-tune score radios in `frontend/e2e/ux-data-mental.spec.ts`.

In `frontend/e2e/ux-data-mental.spec.ts`:

```ts
test('Mental state cards support arrow-key selection', async ({ page }) => {
  await mockPulseApi(page, { checkinToday: { checkin: null } });
  await page.goto('/data?tab=mental');
  await page.getByRole('radio', { name: 'Mentale Lage: Stabil starten' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Mentale Lage: Dosiert bleiben' })).toHaveAttribute('aria-checked', 'true');
});
```

- [x] **Step 2: Implement roving focus helper inside `mental-components.tsx`**

Add a small helper for the existing button-radio groups:

```ts
function nextIndex(current: number, direction: 1 | -1, length: number): number {
  return (current + direction + length) % length;
}
```

Use `onKeyDown` on radio buttons for `ArrowRight`, `ArrowDown`, `ArrowLeft`, and `ArrowUp`.

## Task 4: Verify

- [x] **Step 1: Focused E2E**

```bash
npm run test:e2e -- frontend/e2e/ux-a11y-responsive.spec.ts frontend/e2e/ux-data-mental.spec.ts --project=desktop-chromium --project=mobile-chromium
```

Expected: PASS.

Actual: PASS with 25 tests and 3 expected project skips after the keyboard-semantics slice.

- [x] **Step 2: Full E2E and evidence**

Full verification passed: frontend build, script guards, focused A11y/Mental E2E, broader Smoke/Usability E2E, full E2E and route evidence.

```bash
npm run test:e2e
npm run qa:ux-evidence
```

Expected: PASS, route evidence manifests show `horizontalOverflow=0`.

## Acceptance

- Daily-use controls have at least 44px touch targets on mobile.
- Segmented controls expose tab semantics and arrow navigation.
- Mental card/fine-tune groups can be operated by keyboard.
- The four-tab IA remains unchanged.
