import { expect, test, type Page } from '@playwright/test';
import { mockPulseApi } from './fixtures/pulse-api';

async function seedAuth(page: Page) {
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

test('/login renders the Pulse login form', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/login');

  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Pulse', exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('tobi@pulse.local')).toBeVisible();
});

test('logout navigates to the Pulse login form', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'logout control is currently a desktop sidebar action');

  await mockPulseApi(page);
  await seedAuth(page);

  await page.goto('/');
  await expect(page.getByText('READINESS', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'out' }).click();

  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Pulse', exact: true })).toBeVisible();
});

test('Settings keeps Garmin diagnostics honest when status is unknown', async ({ page }) => {
  await mockPulseApi(page, {
    failEndpoints: {
      'GET /api/garmin/status': {
        error: 'Garmin status unavailable',
        status: 503,
      },
    },
  });
  await seedAuth(page);

  await page.goto('/settings');

  await expect(page.getByTestId('settings-diagnostics-matrix')).toContainText('Unbekannt');
});

test('Settings Garmin sync uses the shared Pulse mutation path and refreshes Pulse coverage', async ({ page }) => {
  const requests: Array<{ pathname: string; method: string }> = [];
  await mockPulseApi(page, {
    onRequest: (pathname, method) => requests.push({ pathname, method }),
  });
  await seedAuth(page);

  await page.goto('/settings?section=garmin');
  await expect(page.getByText('Metriken 30T', { exact: true })).toBeVisible();
  await expect(page.getByText('Domainqualität', { exact: true })).toBeVisible();
  const coverageRequestsBeforeSync = requests.filter(
    request => request.method === 'GET' && request.pathname === '/api/pulse/data-coverage',
  ).length;

  await page.getByRole('button', { name: 'Jetzt syncen' }).click();

  await expect(page.getByText('Sync erfolgreich.')).toBeVisible();
  expect(requests).toContainEqual({ method: 'POST', pathname: '/api/pulse/garmin/sync' });
  await expect.poll(() => requests.filter(
    request => request.method === 'GET' && request.pathname === '/api/pulse/data-coverage',
  ).length).toBeGreaterThan(coverageRequestsBeforeSync);
});
