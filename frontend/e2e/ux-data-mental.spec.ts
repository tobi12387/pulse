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

test('/data opens a user-facing overview by default', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data');

  await expect(page.getByRole('button', { name: 'Überblick' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Datenüberblick', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analysen öffnen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abdeckung' })).toHaveAttribute('aria-pressed', 'false');
});

test('/data?tab=coverage still opens the coverage tab', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data?tab=coverage');

  await expect(page.getByRole('button', { name: 'Abdeckung' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Analysen' })).toHaveAttribute('aria-pressed', 'false');
});

test('Mental check-in presents quick choices before optional detail entry', async ({ page }) => {
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
  });

  await page.goto('/data?tab=mental');

  await expect(page.getByText('Quick Check-in')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Kopf: klar' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Kopf: gemischt' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Kopf: schwer' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Energie: bereit' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Druck: ruhig' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Tagesbedarf: Struktur' })).toBeVisible();

  const quickChoiceTop = await page.getByRole('radio', { name: 'Kopf: klar' }).evaluate(element =>
    element.getBoundingClientRect().top,
  );
  const detailTop = await page.getByRole('textbox', { name: 'Kurz beschreiben' }).evaluate(element =>
    element.getBoundingClientRect().top,
  );
  expect(quickChoiceTop).toBeLessThan(detailTop);
});

test('failed Mental check-in save shows inline recovery and keeps inputs available', async ({ page }) => {
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
    failEndpoints: {
      'POST /api/pulse/checkin': {
        error: 'Check-in konnte nicht gespeichert werden.',
        status: 500,
        action: 'Verbindung prüfen und erneut speichern.',
      },
    },
  });

  await page.goto('/data?tab=mental');
  await page.getByRole('radio', { name: 'Kopf: schwer' }).click();
  await page.getByRole('radio', { name: 'Energie: leer' }).click();
  await page.getByRole('button', { name: 'Check-in senden' }).click();

  await expect(page.getByRole('alert')).toContainText('Check-in konnte nicht gespeichert werden.');
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Kopf: schwer' })).toBeEnabled();
  await expect(page.getByRole('radio', { name: 'Kopf: schwer' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Check-in senden' })).toBeEnabled();
});
