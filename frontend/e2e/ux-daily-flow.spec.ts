import { expect, test } from '@playwright/test';
import { mockPulseApi } from './fixtures/pulse-api';

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

test('Plan keeps the next training decision without duplicating the generic daily decision', async ({ page }) => {
  await page.goto('/plan');

  await expect(page.getByText('NÄCHSTE TRAININGSENTSCHEIDUNG')).toBeVisible();
  await expect(page.getByText('TAGESENTSCHEIDUNG')).toHaveCount(0);
});

test('Home renders exactly one main daily decision card', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('TAGESENTSCHEIDUNG')).toHaveCount(1);
});

test('Home no-training daily decision offers local closure before Coach support', async ({ page }) => {
  let actionPatches = 0;
  await mockPulseApi(page, {
    onActionPatch: () => { actionPatches += 1; },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  await expect(decision).toContainText('Heute ist kein Training geplant.');
  const localClosure = decision.getByRole('button', { name: /Erholungstag abschliessen|Heute abschliessen/i });
  await expect(localClosure).toBeVisible();
  await expect(decision.getByRole('button', { name: /Coach/i })).toHaveCount(1);

  await localClosure.click();
  await expect(page).toHaveURL('/');
  expect(actionPatches).toBe(0);
});

test('Home root-target daily decision does not patch synthetic action ids', async ({ page }) => {
  let actionPatches = 0;
  await mockPulseApi(page, {
    home: {
      nextBestActions: [
        {
          id: 'risk:/:0',
          source: 'risk',
          priority: 'critical',
          title: 'Risk-Signal pruefen',
          reason: 'Ruhepuls stark erhoeht; heute zuerst das Signal ansehen.',
          cta: 'Risk ansehen',
          targetPath: '/',
          resolvedBy: 'Risk-Signal snoozen oder aufloesen.',
          evidence: ['rhr_drift_7d', 'critical'],
        },
      ],
    },
    onActionPatch: () => { actionPatches += 1; },
  });

  await page.goto('/');
  await page.getByTestId('daily-decision-card').getByRole('button', { name: 'Risk ansehen' }).click();

  await expect(page).toHaveURL('/');
  expect(actionPatches).toBe(0);
});

test('Home coach-target daily decision uses one prepared-prompt action', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      nextBestActions: [
        {
          id: 'coach-daily-action',
          source: 'checkin',
          priority: 'normal',
          title: 'Heute ist kein Training geplant.',
          reason: 'Ein kurzer Check-in klaert, ob Erholung oder mentale Entlastung wichtiger ist.',
          cta: 'Coach fragen',
          targetPath: '/coach?focus=daily',
          resolvedBy: 'Coach-Kontext geoeffnet und Tagesanker gesetzt.',
          evidence: ['Kein Training geplant'],
        },
      ],
    },
  });
  await page.goto('/');

  await expect(page.getByRole('navigation').locator('a[href="/coach"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Coach fragen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gespräch damit starten' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Coach fragen' }).click();
  await expect(page).toHaveURL(/\/coach\?focus=daily&prompt=/);
  await expect(page.getByRole('navigation').locator('a[href="/coach"]')).toHaveCount(0);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Tagesentscheidung: Heute ist kein Training geplant/);
});
