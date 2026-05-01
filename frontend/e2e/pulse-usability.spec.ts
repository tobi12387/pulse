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

test('Insights show evidence links for opened analysis cards', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/insights');
  await page.getByRole('button').filter({ hasText: 'Gesamt' }).click();

  await expect(page.getByText('Datenbasis')).toBeVisible();
  await expect(page.getByText('Trainingsdaten')).toBeVisible();
  await expect(page.getByText('4 Aktivitäten')).toBeVisible();
  await expect(page.getByText('30 Tage')).toBeVisible();
  await expect(page.getByText('OpenRouter')).toHaveCount(0);
});

test('Insights show a helpful state instead of raw server errors', async ({ page }) => {
  await mockPulseApi(page, { insightErrorKind: 'server' });

  await page.goto('/insights');
  await page.getByRole('button').filter({ hasText: 'Gesamt' }).click();

  await expect(page.getByText('Analyse konnte gerade nicht geladen werden.')).toBeVisible();
  await expect(page.getByText('Deine Daten bleiben sichtbar.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  await expect(page.getByText('Internal Server Error')).toHaveCount(0);
});

test('Insights classify provider errors with a retry action', async ({ page }) => {
  await mockPulseApi(page, { insightErrorKind: 'provider' });

  await page.goto('/insights');
  await page.getByRole('button').filter({ hasText: 'Gesamt' }).click();

  await expect(page.getByText('KI-Provider gerade nicht erreichbar.')).toBeVisible();
  await expect(page.getByText('Versuche es später erneut oder nutze den gecachten Stand.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  await expect(page.getByText('OpenRouter')).toHaveCount(0);
});

test('Insights classify missing data without offering a retry', async ({ page }) => {
  await mockPulseApi(page, { insightErrorKind: 'data_missing' });

  await page.goto('/insights');
  await page.getByRole('button').filter({ hasText: 'Mental' }).click();

  await expect(page.getByText('Noch nicht genug Daten.')).toBeVisible();
  await expect(page.getByText('Noch nicht genug Check-in-Daten für diesen Zeitraum.')).toBeVisible();
  await expect(page.getByText('Daten fehlen')).toBeVisible();
  await expect(page.getByText('Mental-Check-ins')).toBeVisible();
  await expect(page.getByText('Keine Check-ins im gewählten Zeitraum.')).toBeVisible();
  await expect(page.getByText('Trage im Coach einen Check-in ein oder wähle 90T.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toHaveCount(0);
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
  await expect(page.getByText('TAGESENTSCHEIDUNG')).toBeVisible();
  await expect(page.getByText('WARUM')).toBeVisible();
  await expect(page.getByText('ABSCHLUSS', { exact: true }).first()).toBeVisible();

  await page.getByRole('button').filter({ hasText: 'Check-in eintragen' }).click();
  await expect(page).toHaveURL('/coach');
  await expect(page.getByText('GUTE STARTFRAGEN')).toBeVisible();
});

test('Home closes a daily action and Coach shows the shared closed state', async ({ page }) => {
  const actions = [{
    id: 'checkin:/coach:0',
    decisionId: 'decision-1',
    source: 'checkin',
    priority: 'high',
    title: 'Check-in eintragen',
    reason: 'Heute fehlt dein subjektives Signal; Coach, Readiness und Briefing bleiben dadurch vorsichtiger.',
    cta: 'Zum Coach',
    targetPath: '/coach',
    openedAt: '2026-05-01',
    resolvedBy: 'Check-in für 2026-05-01 speichern.',
    evidence: ['Tages-Check-in fehlt'],
    status: 'open',
    resolvedAt: null,
    resolutionReason: null,
  }];
  let patched: { id: string; body: unknown } | null = null;

  await mockPulseApi(page, {
    actions,
    onActionPatch: (id, body) => {
      patched = { id, body };
      actions.length = 0;
    },
  });

  await page.goto('/');
  await expect(page.getByText('TAGESAKTION', { exact: true })).toBeVisible();
  await expect(page.getByText('Check-in eintragen')).toBeVisible();

  await page.getByRole('button', { name: 'Erledigt' }).click();
  await expect.poll(() => patched).toEqual({ id: 'decision-1', body: { status: 'completed', reason: 'In Home erledigt.' } });
  await expect(page.getByText('Check-in eintragen')).toHaveCount(0);

  await page.goto('/coach');
  await expect(page.getByText('TAGESAKTION', { exact: true })).toBeVisible();
  await expect(page.getByText('Keine offene Tagesaktion')).toBeVisible();
});

test('Home and Coach share one daily decision with boundary alternative and done criteria', async ({ page }) => {
  let coachSends = 0;
  await mockPulseApi(page, {
    home: {
      readiness: {
        date: '2026-05-01',
        score: 52,
        label: 'vorsichtig',
        shortLabel: 'vorsichtig',
        color: 'amber',
        cached: false,
        components: {
          sleep: 55,
          hrv: 50,
          tsb: 44,
          battery: 54,
          mental: 60,
          stress: 52,
        },
      },
      fitnessLoad: {
        date: '2026-05-01',
        ctl: 42.4,
        atl: 58.1,
        tsb: -15.7,
        cached: false,
      },
      nextWorkout: {
        id: 'workout-today',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 4,
        durationMin: 60,
        targetTss: 78,
        status: 'planned',
        description: 'Schwellenreiz mit klarer Pulsgrenze.',
      },
      nextBestActions: [
        {
          id: 'plan-today',
          source: 'plan',
          priority: 'high',
          title: 'Training heute defensiv entscheiden',
          reason: 'Readiness und TSB sprechen gegen einen ungeprüften harten Reiz.',
          cta: 'Coach fragen',
          targetPath: '/coach',
          resolvedBy: 'Entscheidung zur Einheit treffen und Plan bei Bedarf anpassen.',
        },
      ],
    },
    onRequest: (pathname, method) => {
      if (pathname === '/api/pulse/coach' && method === 'POST') coachSends += 1;
    },
  });

  await page.goto('/');
  await expect(page.getByText('TAGESENTSCHEIDUNG')).toBeVisible();
  await expect(page.getByText('Training heute defensiv entscheiden')).toBeVisible();
  await expect(page.getByText('GRENZE', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('ALTERNATIVE', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('ABSCHLUSS', { exact: true }).first()).toBeVisible();

  await page.getByRole('button').filter({ hasText: 'Training heute defensiv entscheiden' }).click();
  await expect(page).toHaveURL('/coach');
  await expect(page.getByText('Training heute defensiv entscheiden')).toBeVisible();
  await expect(page.getByText('Alternative', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Abschluss', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Gespräch damit starten' }).click();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Training heute defensiv entscheiden/);
  expect(coachSends).toBe(0);
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

test('Coach does not treat a future workout as today training', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      nextWorkout: {
        id: 'workout-future',
        plannedDate: '2026-05-04',
        activityType: 'bike',
        zone: 2,
        durationMin: 80,
        targetTss: 65,
        status: 'planned',
        description: 'Aerobe Grundlage.',
      },
    },
  });

  await page.goto('/coach');
  await expect(page.getByText('Heute ist kein Training geplant.', { exact: true })).toBeVisible();
  await expect(page.getByText('Heute ist kein Training geplant. Wie nutze ich den freien Tag sinnvoll?')).toBeVisible();
  await expect(page.getByText('Nächster Ausblick')).toHaveCount(0);
  await expect(page.getByText('2026-05-04')).toHaveCount(0);
  await expect(page.getByText('04.05.')).toHaveCount(0);
  await expect(page.getByText(/bis zum Training/)).toHaveCount(0);
  await expect(page.getByText(/Soll ich bike.*wie geplant machen/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Gespräch damit starten' }).click();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Tagesentscheidung: Heute ist kein Training geplant/);
});

test('Data mental check-in uses guided mental fitness questions', async ({ page }) => {
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
  });

  await page.goto('/data');
  await page.getByRole('button', { name: 'Mental' }).click();

  await expect(page.getByText('Geführter Daily Check-in')).toBeVisible();
  await expect(page.getByText('Wie ist dein Kopf gerade?')).toBeVisible();
  await expect(page.getByText('Was zieht gerade mentale Energie?')).toBeVisible();
  await expect(page.getByText('Was brauchst du mental, damit heute stabil bleibt?')).toBeVisible();
  await expect(page.getByText('Was wäre heute genug?')).toBeVisible();
  await page.getByRole('button', { name: 'Mental: angespannt' }).click();
  await page.getByRole('button', { name: 'Schutz: aktiv einplanen' }).click();
  await expect(page.getByPlaceholder(/Was ist mental gerade wichtig/)).toHaveValue(/Mental: angespannt/);
  await expect(page.getByPlaceholder(/Was ist mental gerade wichtig/)).toHaveValue(/Schutz: aktiv einplanen/);
});

test('Data shows Garmin recovery depth signals without exposing raw payloads', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data');
  await page.getByRole('button', { name: 'Metriken' }).click();

  await expect(page.getByText('Recovery Depth')).toBeVisible();
  await expect(page.getByText('Schlafbedarf')).toBeVisible();
  await expect(page.getByText('Body Battery Ladung')).toBeVisible();
  await expect(page.getByText('Stress hoch')).toBeVisible();
  await expect(page.getByText('SpO2')).toBeVisible();
  await expect(page.getByText('rawData')).toHaveCount(0);
});

test('Settings show profile value provenance for Garmin planning inputs', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/settings');

  await expect(page.getByText('Athletenprofil')).toBeVisible();
  await expect(page.getByText('LTHR')).toBeVisible();
  await expect(page.getByText('VO2max')).toBeVisible();
  await expect(page.getByText('Manuell').first()).toBeVisible();
  await expect(page.getByText('Aktivitaeten').first()).toBeVisible();
  await expect(page.getByText('Garmin').first()).toBeVisible();
});

test('Coach daily briefing guides the first conversation without auto-send', async ({ page }) => {
  let coachSends = 0;
  await mockPulseApi(page, {
    home: {
      nextWorkout: {
        id: 'workout-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 80,
        targetTss: 65,
        status: 'planned',
        description: 'Aerobe Grundlage, primär über Puls steuern.',
      },
      nextBestActions: [
        {
          id: 'plan-today',
          source: 'plan',
          priority: 'normal',
          title: 'Training bewusst prüfen',
          reason: 'Heute steht eine Einheit an; Readiness und Plan sollten zusammen betrachtet werden.',
          cta: 'Coach fragen',
          targetPath: '/coach',
          resolvedBy: 'Entscheidung zur heutigen Einheit treffen.',
        },
      ],
    },
    onRequest: (pathname, method) => {
      if (pathname === '/api/pulse/coach' && method === 'POST') coachSends += 1;
    },
  });

  await page.goto('/coach');
  await expect(page.getByText('TAGESBRIEFING')).toBeVisible();
  await expect(page.getByText('Tagesentscheidung')).toBeVisible();
  await expect(page.getByText('Grenze', { exact: true })).toBeVisible();
  await expect(page.getByText('Alternative', { exact: true })).toBeVisible();
  await expect(page.getByText('Abschluss', { exact: true })).toBeVisible();
  await expect(page.getByText('Heute entscheiden')).toBeVisible();
  await expect(page.getByText('Plan anpassen')).toBeVisible();
  await expect(page.getByText('Warum?')).toBeVisible();

  await page.getByRole('button', { name: 'Gespräch damit starten' }).click();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Tagesentscheidung: Training bewusst prüfen/);
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
  await expect(page.getByText('Lokal')).toBeVisible();
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

test('Plan shows Garmin execution states and match explanations', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-local',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 60,
        targetTss: 45,
        status: 'planned',
        description: 'Lokale Grundlage.',
        garminWorkoutId: null,
        garminScheduledId: null,
        executionStatus: 'local_planned',
        executionNotes: 'Workout ist nur lokal in Pulse geplant.',
      },
      {
        id: 'workout-garmin',
        plannedDate: '2026-05-02',
        activityType: 'run',
        zone: 2,
        durationMin: 45,
        targetTss: 35,
        status: 'planned',
        description: 'Garmin-Vorlage.',
        garminWorkoutId: 'gw-1',
        garminScheduledId: null,
        executionStatus: 'garmin_template',
        executionNotes: 'Workout-Vorlage ist auf Garmin, aber kein Kalendertermin ist bekannt.',
      },
      {
        id: 'workout-calendar',
        plannedDate: '2026-05-03',
        activityType: 'swim',
        zone: 2,
        durationMin: 40,
        targetTss: 25,
        status: 'planned',
        description: 'Kalendertermin.',
        garminWorkoutId: 'gw-2',
        garminScheduledId: 'sched-2',
        executionStatus: 'garmin_scheduled',
        executionNotes: 'Workout ist auf Garmin im Kalender geplant.',
      },
      {
        id: 'workout-done',
        plannedDate: '2026-05-04',
        activityType: 'bike',
        zone: 3,
        durationMin: 75,
        targetTss: 70,
        status: 'completed',
        description: 'Durchgeführt.',
        garminWorkoutId: 'gw-3',
        garminScheduledId: 'sched-3',
        completedActivityId: 'activity-1',
        executionStatus: 'completed_matched',
        executionNotes: 'Mit Garmin-Aktivität activity-1 abgeglichen.',
        executionMatchConfidence: 0.92,
        workoutFeedback: 'Sauber getroffen.',
        complianceScore: 0.92,
      },
      {
        id: 'workout-missed',
        plannedDate: '2026-04-30',
        activityType: 'run',
        zone: 2,
        durationMin: 45,
        targetTss: 35,
        status: 'planned',
        description: 'Nicht erledigt.',
        executionStatus: 'missed',
        executionNotes: 'Plantag ist vorbei und keine passende Garmin-Aktivität ist zugeordnet.',
      },
      {
        id: 'workout-replaced',
        plannedDate: '2026-05-05',
        activityType: 'swim',
        zone: 2,
        durationMin: 40,
        targetTss: 25,
        status: 'planned',
        description: 'Durch anderes Training ersetzt.',
        executionStatus: 'replaced_or_off_plan',
        executionNotes: 'Am Plantag wurde eine andere Aktivität (run) gefunden.',
      },
    ],
  });

  await page.goto('/plan');
  for (const label of ['Lokal', 'Garmin', 'Kalender', 'Erledigt', 'Verpasst', 'Ersetzt']) {
    await expect(page.getByText(label).first()).toBeVisible();
  }

  await page.getByText('Durchgeführt.').click();
  await expect(page.getByText('Erledigt').last()).toBeVisible();
  await expect(page.getByText('Mit Garmin-Aktivität activity-1 abgeglichen.')).toBeVisible();
});

test('Plan alternatives adapt the next workout with semantic choices', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  const updates: unknown[] = [];
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 4,
        durationMin: 90,
        targetTss: 92,
        status: 'planned',
        description: 'Schwellenintervalle, nur wenn die Tagesform passt.',
      },
    ],
    planTrace: {
      weekStart: '2026-04-27',
      inputSnapshot: {
        load: { ctl: 42.4, atl: 58.2, tsb: -15.8 },
        phase: 'build',
        weeklyHoursTarget: 8,
        goals: [{ title: '70.3 Vorbereitung' }],
        riskSignals: [{ title: 'TSB niedrig' }],
        healthStates: [],
        recentRpe: [],
        dataWarnings: [],
        recentSportMix: { bike: 2 },
        learningSnapshot: null,
      },
      sportMix: { bike: 2 },
      generatedSummary: [],
      hardDays: [],
      planDecision: null,
    },
    onPlanWorkoutUpdate: (_id, body) => updates.push(body),
  });

  await page.goto('/plan');

  await expect(page.getByText('ALTERNATIVEN')).toBeVisible();
  await expect(page.getByText('Einbezogen: TSB -15.8')).toBeVisible();
  await expect(page.getByText('Ziele 1 aktiv')).toBeVisible();
  await expect(page.getByRole('button', { name: /Kürzer/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Leichter/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Verschieben/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Frei lassen/ })).toBeVisible();

  await page.getByRole('button', { name: /Leichter/ }).click();
  await expect.poll(() => updates).toHaveLength(1);
  expect(updates[0]).toMatchObject({
    zone: 2,
    durationMin: 75,
    status: 'planned',
  });
});

test('Plan alternatives avoid stale trace context for next-week workouts', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-1',
        plannedDate: '2026-05-04',
        activityType: 'bike',
        zone: 4,
        durationMin: 90,
        targetTss: 92,
        status: 'planned',
        description: 'Schwellenintervalle, nur wenn die Tagesform passt.',
      },
    ],
    planTrace: {
      weekStart: '2026-04-27',
      inputSnapshot: {
        load: { ctl: 42.4, atl: 58.2, tsb: -15.8 },
        phase: 'build',
        weeklyHoursTarget: 8,
        goals: [{ title: '70.3 Vorbereitung' }],
        riskSignals: [{ title: 'TSB niedrig' }],
        healthStates: [],
        recentRpe: [],
        dataWarnings: [],
        recentSportMix: { bike: 2 },
        learningSnapshot: null,
      },
      sportMix: { bike: 2 },
      generatedSummary: [],
      hardDays: [],
      planDecision: null,
    },
  });

  await page.goto('/plan');

  await expect(page.getByText('Einbezogen: TSB -15.8')).toHaveCount(0);
  await expect(page.getByText('Einbezogen: aktueller Plan')).toBeVisible();
  await expect(page.getByText('Verfügbarkeit offen')).toBeVisible();
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

test('Data backfill shows preview, last run and failed days first', async ({ page }) => {
  const coverage = {
    range: { from: '2026-05-01', to: '2026-05-02', days: 2, year: null },
    summary: {
      dailyMetricsDays: 0,
      sleepDays: 2,
      activityDays: 0,
      activities: 0,
      weatherActivities: 0,
      weightDays: 2,
      completeDays: 0,
    },
    profile: {
      updatedAt: '2026-05-01T05:00:00.000Z',
      ftpWatts: 250,
      maxHrBpm: 185,
      lthrBpm: 172,
      vo2max: 52,
      missing: [],
    },
    issues: [],
    days: ['2026-05-02', '2026-05-01'].map(date => ({
      date,
      dailyMetrics: { status: 'missing', reason: 'not_synced', syncedAt: null, missingFields: ['hrvRmssd'] },
      sleep: { status: 'present', reason: 'present', durationH: 7.4, hasStages: true, missingFields: [] },
      activities: { status: 'missing', reason: 'not_recorded', count: 0, weatherCount: 0, missingWeatherCount: 0, missingFields: [] },
      weight: { status: 'present', reason: 'present', hasBodyComposition: true, missingFields: [] },
    })),
  };

  await mockPulseApi(page, {
    coverage,
    backfillResult: body => {
      const dryRun = Boolean((body as { dryRun?: boolean }).dryRun);
      return {
        dryRun,
        range: { from: '2026-05-01', to: '2026-05-02', days: 2 },
        domains: ['dailyMetrics', 'sleep', 'activities', 'weather', 'weight'],
        limitDays: 31,
        summary: dryRun
          ? { planned: 2, synced: 0, skipped: 0, failed: 0, activities: 0, weightDays: 0 }
          : { planned: 2, synced: 1, skipped: 0, failed: 1, activities: 0, weightDays: 0 },
        days: dryRun
          ? [
              { date: '2026-05-01', status: 'planned', dailyMetrics: false, activities: 0, weight: false, reason: 'dailyMetrics:not_synced', error: null },
              { date: '2026-05-02', status: 'planned', dailyMetrics: false, activities: 0, weight: false, reason: 'dailyMetrics:not_synced', error: null },
            ]
          : [
              { date: '2026-05-02', status: 'synced', dailyMetrics: true, activities: 0, weight: false, reason: null, error: null },
              { date: '2026-05-01', status: 'failed', dailyMetrics: false, activities: 0, weight: false, reason: 'dailyMetrics:not_synced', error: 'Garmin-Fehler: dailyMetrics:quota' },
            ],
      };
    },
  });

  await page.goto('/data');
  await page.getByRole('button', { name: 'Abdeckung' }).click();
  await page.getByRole('button', { name: 'Vorschau' }).click();

  await expect(page.getByText('Nächste Aktion')).toBeVisible();
  await expect(page.getByText('Nachladen starten.')).toBeVisible();

  await page.getByRole('button', { name: 'Nachladen' }).click();

  await expect(page.getByText('Letzter Backfill')).toBeVisible();
  await expect(page.getByText('Fehlerhafte Tage zuerst prüfen.')).toBeVisible();
  await expect(page.getByTestId('backfill-priority-days').locator('li').first()).toContainText('2026-05-01');
  await expect(page.getByTestId('backfill-priority-days').locator('li').first()).toContainText('Fehler');
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

test('Settings groups actions by risk and daily maintenance area', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/settings');

  await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Verbindung' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Datenpflege' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Benachrichtigungen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'iPhone & PWA' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Health-State' })).toBeVisible();
  await expect(page.getByText('Kalender-Sync und Backfill sind getrennt von Profil- und Push-Aktionen.')).toBeVisible();
  await expect(page.getByText('Lokaler Zugriff, HTTPS und Browser-Fähigkeiten für iPhone/VPN bleiben sichtbar.')).toBeVisible();
  await expect(page.getByText('Gerätezugriff')).toBeVisible();
  await expect(page.getByText('Health-State setzt harte Trainingsgrenzen und ist bewusst separat.')).toBeVisible();
});

test('Mobile navigation and tabs keep core labels readable', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 600, 'mobile density check');

  await mockPulseApi(page);

  await page.goto('/');
  const bottomNav = page.locator('nav').filter({ has: page.locator('a[href="/settings"]') }).last();
  await expect(bottomNav.locator('a[href="/insights"]')).toContainText('Insights');
  await expect(bottomNav.locator('a[href="/settings"]')).toContainText('Settings');
  const bottomNavBox = await bottomNav.boundingBox();
  expect(bottomNavBox).not.toBeNull();
  expect(bottomNavBox!.y + bottomNavBox!.height).toBeLessThanOrEqual(viewport.height);

  await page.goto('/data');
  const mentalTab = page.getByRole('button', { name: 'Mental' });
  await expect(mentalTab).toBeVisible();
  const box = await mentalTab.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);

  await page.goto('/plan');
  await expect(page.getByRole('button', { name: 'Statistik' })).toBeVisible();

  await page.goto('/coach');
  const coachInput = page.getByPlaceholder('Frage…');
  await expect(coachInput).toBeVisible();
  const inputBox = await coachInput.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(viewport.height);
});
