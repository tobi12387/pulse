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

test('Home daily action explains the next step and opens Coach', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      nextBestActions: [
        {
          id: 'checkin-today',
          source: 'checkin',
          priority: 'high',
          title: 'Check-in eintragen',
          reason: 'Heute fehlt dein subjektives Signal; Coach, Readiness und Briefing bleiben dadurch vorsichtiger.',
          cta: 'Zum Coach',
          targetPath: '/coach',
          resolvedBy: 'Check-in für 2026-05-01 speichern.',
        },
      ],
    },
  });

  await page.goto('/');
  await expect(page.getByText('HEUTE TUN')).toBeVisible();
  await expect(page.getByText('WARUM')).toBeVisible();
  await expect(page.getByText('FERTIG WENN')).toBeVisible();

  await page.getByRole('button').filter({ hasText: 'Check-in eintragen' }).click();
  await expect(page).toHaveURL('/coach');
  await expect(page.getByText('GUTE STARTFRAGEN')).toBeVisible();
});

test('Coach quick prompts prepare a question without sending it', async ({ page }) => {
  let coachSends = 0;
  await mockPulseApi(page, {
    onRequest: (pathname, method) => {
      if (pathname === '/api/pulse/coach' && method === 'POST') coachSends += 1;
    },
  });

  await page.goto('/coach');
  await expect(page.getByText('GUTE STARTFRAGEN')).toBeVisible();
  await page.getByRole('button', { name: 'Warum ist meine Readiness heute so bewertet?' }).click();

  await expect(page.getByPlaceholder('Frage…')).toHaveValue('Warum ist meine Readiness heute so bewertet?');
  expect(coachSends).toBe(0);
});

test('Plan prioritizes the next training decision before tools', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-1',
        plannedDate: '2026-05-04',
        activityType: 'bike',
        zone: 2,
        durationMin: 80,
        targetTss: 65,
        status: 'planned',
        description: 'Aerobe Grundlage, primär über Puls steuern.',
      },
    ],
  });

  await page.goto('/plan');
  await expect(page.getByText('NÄCHSTE TRAININGSENTSCHEIDUNG')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sportart ändern' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'wechseln' })).toHaveCount(0);

  const decisionBox = await page.getByText('NÄCHSTE TRAININGSENTSCHEIDUNG').boundingBox();
  const strengthBox = await page.getByText('Kraft-Logger').boundingBox();
  expect(decisionBox).not.toBeNull();
  expect(strengthBox).not.toBeNull();
  expect(decisionBox!.y).toBeLessThan(strengthBox!.y);

  await page.getByRole('button', { name: '+ Plan generieren' }).click();
  await expect(page.getByText('Verfügbarkeit: Mo/Mi/Fr/Sa')).toBeVisible();
  await expect(page.getByText('Umfang: 8 h')).toBeVisible();
});

test('Data coverage explains status, cause and action before backfill', async ({ page }) => {
  await mockPulseApi(page, {
    coverage: {
      range: { from: '2026-05-01', to: '2026-05-01', days: 1, year: null },
      summary: {
        dailyMetricsDays: 0,
        sleepDays: 1,
        activityDays: 0,
        activities: 0,
        weatherActivities: 0,
        weightDays: 1,
        completeDays: 0,
      },
      profile: {
        updatedAt: null,
        ftpWatts: null,
        maxHrBpm: 185,
        lthrBpm: 172,
        vo2max: 52,
        missing: ['ftpWatts'],
      },
      issues: [],
      days: [
        {
          date: '2026-05-01',
          dailyMetrics: {
            status: 'missing',
            reason: 'not_synced',
            syncedAt: null,
            missingFields: ['hrvRmssd'],
          },
          sleep: { status: 'present', reason: 'present', durationH: 7.4, hasStages: true, missingFields: [] },
          activities: { status: 'missing', reason: 'not_recorded', count: 0, weatherCount: 0, missingWeatherCount: 0, missingFields: [] },
          weight: { status: 'present', reason: 'present', hasBodyComposition: true, missingFields: [] },
        },
      ],
    },
  });

  await page.goto('/data');
  await page.getByRole('button', { name: 'Abdeckung' }).click();

  await expect(page.getByText('Coverage Diagnose')).toBeVisible();
  await expect(page.getByText('Status', { exact: true })).toBeVisible();
  await expect(page.getByText('Ursache', { exact: true })).toBeVisible();
  await expect(page.getByText('Aktion', { exact: true })).toBeVisible();
  await expect(page.getByText('Profil unvollständig')).toBeVisible();
  await expect(page.getByText('Backfill möglich.').first()).toBeVisible();
  await expect(page.getByText('Vorschau verändert nichts; Nachladen schreibt Garmin-Daten für den gewählten Monat in Pulse.')).toBeVisible();
});

test('Settings separates push server, browser and device state', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.Notification, 'permission', { get: () => 'denied' });
  });

  await mockPulseApi(page, {
    pushSettings: {
      configured: true,
      publicKey: 'test-vapid-key',
      topics: {
        briefing: true,
        checkin_reminder: true,
        risk_critical: true,
      },
      quietHours: { start: '21:00', end: '07:00' },
      subscriptions: [
        {
          id: 'sub-1',
          endpoint: 'https://push.example.test/very/long/secret/device/token',
          deviceLabel: 'MacBook',
          enabled: true,
          lastSuccessAt: null,
          lastErrorAt: null,
          consecutiveFailures: 0,
          createdAt: '2026-05-01T08:00:00.000Z',
          updatedAt: '2026-05-01T08:00:00.000Z',
        },
      ],
    },
  });

  await page.goto('/settings');

  await expect(page.getByText('BROWSER BLOCKIERT')).toBeVisible();
  await expect(page.getByText('Server ist bereit, aber dieser Browser erlaubt keine neuen Push-Abos.')).toBeVisible();
  await expect(page.getByText('bereit').first()).toBeVisible();
  await expect(page.getByText('denied')).toBeVisible();
  await expect(page.getByText('1 aktiv')).toBeVisible();
  await expect(page.getByText('Test sendet an alle aktiven registrierten Geräte.')).toHaveCount(0);
  await expect(page.getByText('push.example.test · Endpunkt gespeichert')).toBeVisible();
  await expect(page.getByText('very/long/secret')).toHaveCount(0);
});
