import { expect, test } from '@playwright/test';
import { mockPulseApi } from './fixtures/pulse-api';

test.beforeEach(async ({ page }) => {
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

test('Insights load analyses only after the user opens a card', async ({ page }) => {
  let insightRequests = 0;
  await mockPulseApi(page, {
    onRequest: (pathname) => {
      if (pathname === '/api/pulse/insights') insightRequests += 1;
    },
  });

  await page.goto('/insights');
  await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
  await expect(page.getByText('Öffne eine Karte, um die Analyse gezielt zu laden.')).toBeVisible();
  expect(insightRequests).toBe(0);

  await page.getByRole('button').filter({ hasText: 'Gesamt' }).click();
  await expect(page.getByText('Keine Auffälligkeiten im Smoke-Test-Datensatz.')).toBeVisible();
  expect(insightRequests).toBe(1);
});

test('Insights show a helpful state instead of raw server errors', async ({ page }) => {
  await mockPulseApi(page, { insightError: true });

  await page.goto('/insights');
  await page.getByRole('button').filter({ hasText: 'Gesamt' }).click();

  await expect(page.getByText('Analyse konnte gerade nicht geladen werden.')).toBeVisible();
  await expect(page.getByText('Deine Daten bleiben sichtbar.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  await expect(page.getByText('Internal Server Error')).toHaveCount(0);
});
