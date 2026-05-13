import { expect, test, type Page } from '@playwright/test';
import { mockPulseApi } from './fixtures/pulse-api';

async function signIn(page: Page) {
  await mockPulseApi(page);
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'coaching-os-auth',
      JSON.stringify({
        state: {
          token: 'test-token',
          user: { id: 'user-1', name: 'Tobi', email: 'tobi@example.test' },
        },
        version: 0,
      }),
    );
  });
}

async function documentOverflow(page: Page) {
  return page.evaluate(() => ({
    bodyOverflow: document.body.scrollWidth - document.documentElement.clientWidth,
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
}

function expectStrongFocusIndicator(focus: { outlineColor: string; outlineStyle: string; outlineWidth: number }) {
  expect(focus.outlineStyle).toBe('solid');
  expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(focus.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('keyboard tabbing exposes a strong focus indicator on Home navigation and action controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop keyboard focus check');

  await page.goto('/');
  await expect(page.getByText('READINESS', { exact: true }).first()).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.locator('a[href="/"]').filter({ visible: true }).first()).toBeFocused();

  const navFocus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const style = window.getComputedStyle(element);
    return {
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      boxShadow: style.boxShadow,
    };
  });

  expectStrongFocusIndicator(navFocus);

  const action = page.getByRole('button').filter({ visible: true }).first();
  for (let i = 0; i < 20; i += 1) {
    if (await action.evaluate((element) => element === document.activeElement).catch(() => false)) break;
    await page.keyboard.press('Tab');
  }
  await expect(action).toBeFocused();

  const actionFocus = await action.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });

  expectStrongFocusIndicator(actionFocus);
});

test('mobile Data tabs wrap without document-level horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile tab containment check');

  await page.goto('/data');
  await expect(page.getByRole('tab', { name: 'Datenqualität' })).toBeVisible();

  const tabState = await page.getByRole('tab', { name: 'Datenqualität' }).evaluate((element) => {
    const parent = element.parentElement as HTMLElement;
    const rect = parent.getBoundingClientRect();
    const tabs = Array.from(parent.querySelectorAll<HTMLElement>('[role="tab"]'))
      .map(tab => {
        const tabRect = tab.getBoundingClientRect();
        return {
          label: tab.textContent?.trim() ?? '',
          left: Math.round(tabRect.left),
          right: Math.round(tabRect.right),
          top: Math.round(tabRect.top),
        };
      });
    return {
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      scrollWidth: parent.scrollWidth,
      clientWidth: parent.clientWidth,
      overflowX: window.getComputedStyle(parent).overflowX,
      rows: new Set(tabs.map(tab => tab.top)).size,
      clippedTabs: tabs.filter(tab => tab.left < -1 || tab.right > document.documentElement.clientWidth + 1),
    };
  });

  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(tabState.height).toBeLessThanOrEqual(104);
  expect(tabState.left).toBeGreaterThanOrEqual(0);
  expect(tabState.right).toBeLessThanOrEqual(viewportWidth);
  expect(tabState.scrollWidth).toBeLessThanOrEqual(tabState.clientWidth + 1);
  expect(['auto', 'visible']).toContain(tabState.overflowX);
  expect(tabState.rows).toBeLessThanOrEqual(2);
  expect(tabState.clippedTabs).toEqual([]);
  expect(await documentOverflow(page)).toEqual({ bodyOverflow: 0, documentOverflow: 0 });
});

test('mobile top-level headers use compact route titles before the work surface', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile header density check');

  const routes = [
    { path: '/data', title: 'Data' },
    { path: '/plan', title: 'Plan' },
    { path: '/settings', title: 'Settings' },
  ] as const;

  for (const route of routes) {
    await page.goto(route.path);
    const title = page.locator('main h1').first();
    await expect(title).toBeVisible();
    await expect.poll(async () => title.evaluate((element) => (element as HTMLElement).innerText.trim()))
      .toBe(route.title);
  }
});

test('Data segmented tabs support arrow-key navigation', async ({ page }) => {
  await page.goto('/data');

  const tablist = page.getByRole('tablist', { name: 'Data Bereiche' });
  await expect(tablist).toBeVisible();

  await page.getByRole('tab', { name: 'Heute relevant' }).focus();
  await page.keyboard.press('ArrowRight');

  const trendsTab = page.getByRole('tab', { name: 'Trends' });
  await expect(trendsTab).toBeFocused();
  await expect(trendsTab).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL('/data?tab=trends');
});

test('desktop Focus operational routes share the wide shell', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop shell width check');

  await page.goto('/');
  await expect(page.getByText('READINESS', { exact: true }).first()).toBeVisible();
  const homeWidth = await page.locator('.pulse-page-shell').evaluate((element) => Math.round(element.getBoundingClientRect().width));

  await page.goto('/data');
  await expect(page.getByText('Heute, Trends, Qualität & Analyse')).toBeVisible();
  const dataWidth = await page.locator('.pulse-page-shell').evaluate((element) => Math.round(element.getBoundingClientRect().width));

  expect(homeWidth).toBeGreaterThanOrEqual(960);
  expect(homeWidth).toBeLessThanOrEqual(1120);
  expect(dataWidth).toBeGreaterThanOrEqual(960);
  expect(dataWidth).toBeLessThanOrEqual(1120);
  expect(Math.abs(dataWidth - homeWidth)).toBeLessThanOrEqual(4);
});
