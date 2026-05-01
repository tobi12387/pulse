import { expect, test, type Page } from '@playwright/test';
import { mockPulseApi } from './fixtures/pulse-api';

const routes = [
  { path: '/', label: 'Dashboard', visibleText: 'READINESS' },
  { path: '/coach', label: 'Coach', visibleText: 'TAGESBRIEFING' },
  { path: '/data', label: 'Data', visibleText: 'Schlaf, Metriken & Mental' },
  { path: '/plan', label: 'Plan', visibleText: 'Training, Ziele & Statistik' },
  { path: '/insights', label: 'Insights', visibleText: 'Insights' },
  { path: '/settings', label: 'Settings', visibleText: 'Settings' },
] as const;

async function expectHealthyPage(page: Page, visibleText: string) {
  await expect(page.getByText('RUNTIME ERROR')).toHaveCount(0);
  await expect(page.locator('main').getByText(visibleText).first()).toBeVisible();
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

  for (const route of routes.slice(1)) {
    await page.locator(`a[href="${route.path}"]`).filter({ visible: true }).click();
    await expect(page).toHaveURL(route.path);
    await expectHealthyPage(page, route.visibleText);
  }
});
