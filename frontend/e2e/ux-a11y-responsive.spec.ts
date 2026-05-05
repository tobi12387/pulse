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

test('mobile Data tabs stay compact without document-level horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile tab containment check');

  await page.goto('/data');
  await expect(page.getByRole('tab', { name: 'Abdeckung' })).toBeVisible();

  const tabControl = await page.getByRole('tab', { name: 'Abdeckung' }).evaluate((element) => {
    const parent = element.parentElement as HTMLElement;
    const rect = parent.getBoundingClientRect();
    return {
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      scrollWidth: parent.scrollWidth,
      clientWidth: parent.clientWidth,
      overflowX: window.getComputedStyle(parent).overflowX,
    };
  });

  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(tabControl.height).toBeLessThanOrEqual(58);
  expect(tabControl.left).toBeGreaterThanOrEqual(0);
  expect(tabControl.right).toBeLessThanOrEqual(viewportWidth);
  expect(tabControl.scrollWidth).toBeGreaterThan(tabControl.clientWidth);
  expect(['auto', 'scroll']).toContain(tabControl.overflowX);
  expect(await documentOverflow(page)).toEqual({ bodyOverflow: 0, documentOverflow: 0 });
});

test('Data segmented tabs support arrow-key navigation', async ({ page }) => {
  await page.goto('/data');

  const tablist = page.getByRole('tablist', { name: 'Data Bereiche' });
  await expect(tablist).toBeVisible();

  await page.getByRole('tab', { name: 'Überblick' }).focus();
  await page.keyboard.press('ArrowRight');

  const coverageTab = page.getByRole('tab', { name: 'Abdeckung' });
  await expect(coverageTab).toBeFocused();
  await expect(coverageTab).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL('/data?tab=coverage');
});

test('desktop operational routes use a wider shell than Home', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop shell width check');

  await page.goto('/');
  await expect(page.getByText('READINESS', { exact: true }).first()).toBeVisible();
  const homeWidth = await page.locator('.pulse-page-shell').evaluate((element) => Math.round(element.getBoundingClientRect().width));

  await page.goto('/data');
  await expect(page.getByText('Schlaf, Metriken, Mental & Analysen')).toBeVisible();
  const dataWidth = await page.locator('.pulse-page-shell').evaluate((element) => Math.round(element.getBoundingClientRect().width));

  expect(homeWidth).toBeLessThanOrEqual(820);
  expect(dataWidth).toBeGreaterThanOrEqual(960);
  expect(dataWidth).toBeGreaterThan(homeWidth);
});
