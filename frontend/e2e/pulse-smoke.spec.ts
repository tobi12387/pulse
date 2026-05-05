import { expect, test, type Page } from '@playwright/test';
import { mockPulseApi } from './fixtures/pulse-api';

const routes = [
  { path: '/', label: 'Home', navHref: '/', visibleText: 'READINESS' },
  { path: '/coach', label: 'Coach', navHref: '/coach', visibleText: 'TAGESBRIEFING' },
  { path: '/data', label: 'Data', navHref: '/data', visibleText: 'Schlaf, Metriken, Mental & Analysen' },
  { path: '/plan', label: 'Plan', navHref: '/plan', visibleText: 'Training, Ziele & Statistik' },
  { path: '/settings', label: 'Settings', navHref: '/settings', visibleText: 'Settings' },
] as const;

const primaryNavRoutes = [
  { path: '/', label: 'Home', navHref: '/', visibleText: 'READINESS' },
  { path: '/data', label: 'Data', navHref: '/data', visibleText: 'Schlaf, Metriken, Mental & Analysen' },
  { path: '/plan', label: 'Plan', navHref: '/plan', visibleText: 'Training, Ziele & Statistik' },
  { path: '/settings', label: 'Settings', navHref: '/settings', visibleText: 'Settings' },
] as const;

async function expectHealthyPage(page: Page, visibleText: string) {
  await expect(page.getByText('RUNTIME ERROR')).toHaveCount(0);
  await expect(page.locator('main').getByText(visibleText).first()).toBeVisible();
}

async function expectPrimaryNavigationWithoutCoach(page: Page) {
  const primaryNav = page.getByRole('navigation');
  await expect(primaryNav).toHaveCount(1);
  await expect(primaryNav.locator('a')).toHaveCount(primaryNavRoutes.length);
  await expect(primaryNav.locator('a[href="/"]')).toContainText('Home');
  await expect(primaryNav.locator('a[href="/data"]')).toContainText('Data');
  await expect(primaryNav.locator('a[href="/plan"]')).toContainText('Plan');
  await expect(primaryNav.locator('a[href="/settings"]')).toContainText('Settings');
  await expect(primaryNav.locator('a[href="/coach"]')).toHaveCount(0);
  await expect(primaryNav.locator('a[href="/insights"]')).toHaveCount(0);
  await expect(primaryNav.getByText('Coach', { exact: true })).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
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
});

for (const route of routes) {
  test(`${route.label} renders without runtime errors`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.goto(route.path);
    await expectHealthyPage(page, route.visibleText);
    expect(consoleErrors).toEqual([]);
  });
}

test('primary navigation reaches every Pulse page', async ({ page }) => {
  await page.goto('/');
  await expectHealthyPage(page, 'READINESS');

  for (const route of primaryNavRoutes.slice(1)) {
    await page.locator(`a[href="${route.navHref}"]`).filter({ visible: true }).click();
    await expect(page).toHaveURL(route.path);
    await expectHealthyPage(page, route.visibleText);
  }
});

test('/insights redirects to the Data analysis tab', async ({ page }) => {
  await page.goto('/insights');
  await expect(page).toHaveURL('/data?tab=analysen');
  await expect(page.getByRole('tab', { name: 'Analysen' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Analysen', exact: true })).toBeVisible();
});

test('primary navigation exposes only Home, Data, Plan and Settings', async ({ page }) => {
  await page.goto('/');
  await expectPrimaryNavigationWithoutCoach(page);

  await page.goto('/coach');
  await expectHealthyPage(page, 'TAGESBRIEFING');
  await expectPrimaryNavigationWithoutCoach(page);
});

test('top-level hotkeys follow the four-tab navigation order', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'top-level numeric hotkeys are a desktop navigation affordance');

  await page.goto('/');
  await expectHealthyPage(page, 'READINESS');

  await page.keyboard.press('2');
  await expect(page).toHaveURL('/data');
  await expectHealthyPage(page, 'Schlaf, Metriken, Mental & Analysen');

  await page.keyboard.press('3');
  await expect(page).toHaveURL('/plan');
  await expectHealthyPage(page, 'Training, Ziele & Statistik');

  await page.keyboard.press('4');
  await expect(page).toHaveURL('/settings');
  await expectHealthyPage(page, 'Settings');
});

test('PWA manifest and service worker endpoints are available', async ({ request }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  const manifestJson = await manifest.json() as {
    id?: string;
    scope?: string;
    display?: string;
    start_url?: string;
    theme_color?: string;
  };

  expect(manifestJson).toMatchObject({
    id: '/',
    scope: '/',
    display: 'standalone',
    start_url: '/',
    theme_color: '#0a0b0d',
  });

  const serviceWorker = await request.get('/sw.js');
  expect(serviceWorker.ok()).toBeTruthy();
  expect(await serviceWorker.text()).toContain('Pulse ist offline');
});

test('app starts when service workers are unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'serviceWorker', {
      configurable: true,
      get: () => undefined,
    });
  });

  await page.goto('/');
  await expectHealthyPage(page, 'READINESS');
});
