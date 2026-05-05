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

test('Mental check-in can be saved from mental-health and mental-fitness state cards without numbers', async ({ page }) => {
  let submitted: unknown = null;
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
    onCheckinSubmit: body => {
      submitted = body;
    },
  });

  await page.goto('/data?tab=mental');

  await expect(page.getByText(/Mental Health/).first()).toBeVisible();
  await expect(page.getByText(/Mental Fitness/).first()).toBeVisible();
  await expect(page.getByTestId('mental-derived-summary')).toContainText('Keine Zahl nötig');

  const stateTop = await page.getByRole('radio', { name: 'Mentale Lage: Schutzmodus' }).evaluate(element =>
    element.getBoundingClientRect().top,
  );
  const detailTop = await page.getByRole('textbox', { name: 'Kurz beschreiben' }).evaluate(element =>
    element.getBoundingClientRect().top,
  );
  expect(stateTop).toBeLessThan(detailTop);

  await page.getByRole('radio', { name: 'Mentale Lage: Schutzmodus' }).click();
  await expect(page.getByTestId('mental-derived-summary')).toContainText('Mental Health: schützen');
  await expect(page.getByTestId('mental-derived-summary')).toContainText('Mental Fitness: schonen');

  await page.getByRole('button', { name: 'Check-in senden' }).click();
  await expect(page.getByText('CHECK-IN HEUTE ERLEDIGT')).toBeVisible();
  expect(submitted).toMatchObject({
    mood: 3,
    energy: 2,
    stress: 8,
    motivation: 3,
  });
  expect(String((submitted as { notes?: string }).notes)).toContain('Mental Health: schützen');
  expect(String((submitted as { notes?: string }).notes)).toContain('Mental Fitness: schonen');
});

test('Mental check-in auto labels follow extracted scores and stay within the notes limit', async ({ page }) => {
  let submitted: unknown = null;
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
    onCheckinSubmit: body => {
      submitted = body;
    },
  });

  await page.goto('/data?tab=mental');

  await page.getByRole('textbox', { name: 'Kurz beschreiben' }).fill('Kopf voll, Energie begrenzt, Druck spuerbar.');
  await page.getByRole('button', { name: 'Text auswerten' }).click();
  await expect(page.getByText('Stimmung 5/10')).toBeVisible();
  await page.getByRole('button', { name: 'Ergebnis speichern' }).click();

  await expect(page.getByText('CHECK-IN HEUTE ERLEDIGT')).toBeVisible();
  expect(submitted).toMatchObject({
    mood: 5,
    energy: 4,
    stress: 7,
    motivation: 6,
  });
  const notes = String((submitted as { notes?: string }).notes);
  expect(notes.length).toBeLessThanOrEqual(500);
  expect(notes).toContain('Mental Health: schützen');
  expect(notes).toContain('Mental Fitness: schonen');
  expect(notes).not.toContain('Mental Health: stabil');
  expect(notes).not.toContain('Mental Fitness: bereit');
});

test('Mental check-in hidden auto labels cannot push notes past the backend limit', async ({ page }) => {
  let submitted: unknown = null;
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
    onCheckinSubmit: body => {
      submitted = body;
    },
  });

  await page.goto('/data?tab=mental');

  await page.getByRole('radio', { name: 'Mentale Lage: Schutzmodus' }).click();
  await page.getByRole('textbox', { name: 'Mentale Notizen' }).fill('x'.repeat(495));
  await page.getByRole('button', { name: 'Check-in senden' }).click();

  await expect(page.getByText('CHECK-IN HEUTE ERLEDIGT')).toBeVisible();
  const notes = String((submitted as { notes?: string }).notes);
  expect(notes.length).toBeLessThanOrEqual(500);
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
