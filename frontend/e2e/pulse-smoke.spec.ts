import { expect, test, type Page } from '@playwright/test';
import { mockPulseApi } from './fixtures/pulse-api';

const routes = [
  { path: '/', label: 'Heute', navHref: '/', visibleText: 'TAGESENTSCHEIDUNG' },
  { path: '/coach', label: 'Coach', navHref: '/coach', visibleText: 'TAGESBRIEFING' },
  { path: '/data', label: 'Data', navHref: '/data', visibleText: 'DATA' },
  { path: '/plan', label: 'Plan', navHref: '/plan', visibleText: 'PLAN' },
  { path: '/insights', label: 'Insights', navHref: '/insights', visibleText: 'Insights' },
  { path: '/settings', label: 'Settings', navHref: '/settings', visibleText: 'Settings' },
] as const;

const primaryNavRoutes = [
  { path: '/', label: 'Heute', navHref: '/', visibleText: 'TAGESENTSCHEIDUNG' },
  { path: '/data', label: 'Data', navHref: '/data', visibleText: 'DATA' },
  { path: '/plan', label: 'Plan', navHref: '/plan', visibleText: 'PLAN' },
  { path: '/insights', label: 'Insights', navHref: '/insights', visibleText: 'Insights' },
  { path: '/settings', label: 'Settings', navHref: '/settings', visibleText: 'Settings' },
] as const;

const routeReadyTimeoutMs = 15_000;

async function expectHealthyPage(page: Page, visibleText: string) {
  await expect(page.getByText('RUNTIME ERROR')).toHaveCount(0);
  await expect(page.locator('main').getByText(visibleText).first()).toBeVisible({ timeout: routeReadyTimeoutMs });
}

async function expectPrimaryNavigationWithoutCoach(page: Page) {
  const primaryNav = page.getByRole('navigation');
  await expect(primaryNav).toHaveCount(1);
  await expect(primaryNav.locator('a')).toHaveCount(primaryNavRoutes.length);
  await expect(primaryNav.locator('a[href="/"]')).toContainText('Heute');
  await expect(primaryNav.locator('a[href="/data"]')).toContainText('Data');
  await expect(primaryNav.locator('a[href="/plan"]')).toContainText('Plan');
  await expect(primaryNav.locator('a[href="/insights"]')).toContainText('Insights');
  await expect(primaryNav.locator('a[href="/settings"]')).toContainText('Settings');
  await expect(primaryNav.locator('a[href="/coach"]')).toHaveCount(0);
  await expect(primaryNav.getByText('Coach', { exact: true })).toHaveCount(0);
}

function localIsoDate(daysFromToday = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
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

test('Data analysis shows power data provenance', async ({ page }) => {
  await page.goto('/data?tab=analysis');
  const qualityCard = page.getByTestId('power-data-quality');
  await expect(qualityCard).toBeVisible();
  await expect(qualityCard).toContainText('Power-Daten');
  await expect(qualityCard).toContainText('Nur Lap-Approximation');
  await expect(qualityCard).toContainText('Keine 1Hz-Power-Streams');
  await expect(page.getByTestId('power-duration-summary')).toContainText('20 min 215 W');
  await expect(page.getByTestId('power-duration-summary')).toContainText('Durability limited');
});

test('Data analysis translates deep evidence into daily impact without AI cards', async ({ page }) => {
  let insightRequests = 0;
  await mockPulseApi(page, {
    onRequest: (pathname) => {
      if (pathname === '/api/pulse/insights') insightRequests += 1;
    },
  });

  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  await expect(card).toBeVisible();
  await expect(card).toContainText('Analyse -> Tageswirkung');
  await expect(card).toContainText('Handlungsrelevant');
  await expect(card).toContainText('Fueling-Praxis absichern');
  await expect(card).toContainText('70.3 Kraichgau');
  await expect(card).toContainText('Nach dem Klick');
  await expect(card.getByRole('button', { name: 'Plan pruefen' })).toBeVisible();
  await expect(card).toContainText('Interessant, aber noch nicht entscheidend');
  await expect(card).toContainText('Wiederholte stabile Fueling');
  await expect(card).toContainText('Read-only');
  await card.getByRole('button', { name: 'Plan pruefen' }).click();
  await expect(page).toHaveURL('/plan?tab=training');
  expect(insightRequests).toBe(0);
});

test('Data analysis action contract follows non-plan goal interventions', async ({ page }) => {
  await mockPulseApi(page, {
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion wartet auf Datenqualität.',
      projections: [{
        goalId: 'goal-data',
        title: 'Datenvertrauen',
        category: 'race',
        targetDate: null,
        daysUntil: null,
        probabilityPct: null,
        status: 'insufficient_evidence',
        confidence: 'low',
        summary: 'Noch nicht belastbar, weil Garmin-Evidenz fehlt.',
        limiterRisk: {
          status: 'unknown',
          label: 'Datenqualität',
          summary: 'Garmin-Abdeckung fehlt für die Projektion.',
          evidence: ['Garmin-Daten unvollständig'],
        },
        nextBestIntervention: {
          kind: 'data_quality',
          title: 'Evidenz vervollständigen',
          summary: 'Garmin-Abdeckung prüfen, bevor Pulse die Zielwirkung schärfer bewertet.',
          actionLabel: 'Daten prüfen',
          targetPath: '/data?tab=quality#data-garmin-quality',
          evidence: ['Garmin-Daten unvollständig'],
        },
        evidence: ['Keine vollständige Garmin-Abdeckung'],
        missingEvidence: ['Garmin-Daten unvollständig'],
      }],
      missingEvidence: ['Garmin-Daten unvollständig'],
    },
  });

  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  await expect(card).toContainText('Evidenz vervollständigen');
  await expect(card).toContainText('Nach dem Klick');
  await expect(card).toContainText('Öffnet die passende Datenevidenz');
  await card.getByRole('button', { name: 'Daten prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=quality#data-garmin-quality');
});

test('Plan season lane shows compact ATP guardrails', async ({ page }) => {
  await page.goto('/plan?tab=goals');
  const seasonLine = page.getByTestId('plan-season-strategy-card');
  await expect(seasonLine.getByText('Saisonlinie', { exact: true })).toBeVisible();
  await seasonLine.getByRole('button', { name: 'Saisonlinie anzeigen' }).click();
  await expect(page.getByTestId('season-atp-row')).toContainText('Jahresziel');
  await expect(page.getByTestId('season-atp-row')).toContainText('384 h / 18432 TSS');
  await expect(page.getByTestId('season-atp-row')).toContainText('Ramp-Cap');
});

test('Plan starts with the current action contract', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [{
      id: 'plan-action-contract',
      plannedDate: localIsoDate(1),
      activityType: 'bike',
      zone: 2,
      durationMin: 75,
      targetTss: 64,
      status: 'planned',
      archetypeId: 'endurance_steady',
      difficultyLevel: 3.8,
      difficultyEnergySystem: 'endurance',
      capabilityFit: 'productive',
      description: 'Ruhige Ausdauer mit sauberem Garmin-Handoff.',
    }],
    todayOptionsState: 'unplanned_trainable',
  });
  await page.goto('/plan');
  const action = page.getByTestId('plan-primary-action');

  await expect(action).toBeVisible();
  await expect(action).toContainText('Plan-Aktion');
  await expect(action).toContainText('Nach dem Klick');
  await expect(action.getByRole('button', { name: /Einheit öffnen/i })).toBeVisible();

  const progression = page.getByTestId('plan-workout-progression');
  await expect(progression).toBeVisible();
  await expect(progression).toContainText('Progression');
  await expect(progression).toContainText('Rolle');
  await expect(progression).toContainText('Kalibrierung');
  await expect(progression).toContainText('Wiederholung');
  await expect(progression).toContainText('Ändern wenn');
});

test('Plan desktop keeps daily reasoning behind an explicit disclosure', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-specific density contract');
  await mockPulseApi(page, {
    planWorkouts: [{
      id: 'plan-action-contract',
      plannedDate: localIsoDate(1),
      activityType: 'bike',
      zone: 2,
      durationMin: 75,
      targetTss: 64,
      status: 'planned',
      archetypeId: 'endurance_steady',
      difficultyLevel: 3.8,
      difficultyEnergySystem: 'endurance',
      capabilityFit: 'productive',
      description: 'Ruhige Ausdauer mit sauberem Garmin-Handoff.',
    }],
    todayOptionsState: 'unplanned_trainable',
  });

  await page.goto('/plan?tab=training');

  const action = page.getByTestId('plan-primary-action');
  await expect(action).toBeVisible();
  await expect(action.getByText(/Warum jetzt:/i)).toBeHidden();
  await expect(action.getByText(/Nach dem Klick:/i)).toBeHidden();

  await action.getByText(/Warum diese Einheit/i).click();
  await expect(action.getByText(/Warum jetzt:/i)).toBeVisible();
  await expect(action.getByText(/Nach dem Klick:/i)).toBeVisible();
});

test('Plan desktop keeps progression evidence collapsed by default', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-specific progression density');
  await mockPulseApi(page, {
    planWorkouts: [{
      id: 'plan-progression-density',
      plannedDate: localIsoDate(1),
      activityType: 'bike',
      zone: 2,
      durationMin: 75,
      targetTss: 64,
      status: 'planned',
      archetypeId: 'endurance_steady',
      difficultyLevel: 3.8,
      difficultyEnergySystem: 'endurance',
      capabilityFit: 'productive',
      description: 'Ruhige Ausdauer mit sauberem Garmin-Handoff.',
    }],
    todayOptionsState: 'unplanned_trainable',
  });

  await page.goto('/plan?tab=training');

  const progression = page.getByTestId('plan-workout-progression');
  await expect(progression).toContainText('Progression');
  await expect(progression.getByText(/Rolle:/i)).toBeVisible();
  await expect(progression.getByText(/Kalibrierung:/i)).toBeHidden();

  await progression.getByText(/Progression prüfen/i).click();
  await expect(progression.getByText(/Kalibrierung:/i)).toBeVisible();
  await expect(progression.getByText(/Wiederholung:/i)).toBeVisible();
  await expect(progression.getByText(/Ändern wenn:/i)).toBeVisible();
});

test('Plan desktop starts the planning surface with the week before the next decision', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-specific week-first contract');
  await mockPulseApi(page, {
    planWorkouts: [{
      id: 'plan-week-first',
      plannedDate: localIsoDate(1),
      activityType: 'bike',
      zone: 2,
      durationMin: 75,
      targetTss: 64,
      status: 'planned',
      archetypeId: 'endurance_steady',
      difficultyLevel: 3.8,
      difficultyEnergySystem: 'endurance',
      capabilityFit: 'productive',
      description: 'Ruhige Ausdauer mit sauberem Garmin-Handoff.',
    }],
    todayOptionsState: 'unplanned_trainable',
  });

  await page.goto('/plan?tab=training');

  const weekStrip = page.getByTestId('plan-week-strip-scroller');
  const decision = page.getByTestId('next-training-decision');
  await expect(weekStrip).toBeVisible();
  await expect(decision).toBeVisible();

  const weekBox = await weekStrip.boundingBox();
  const decisionBox = await decision.boundingBox();
  expect(weekBox, 'Missing week strip bounds').not.toBeNull();
  expect(decisionBox, 'Missing next decision bounds').not.toBeNull();
  expect(weekBox!.y, 'Desktop Plan should show the week before the next-training decision').toBeLessThan(decisionBox!.y);
});

test('Plan exposes season evidence in the goals area', async ({ page }) => {
  await page.goto('/plan');

  const weekStrip = page.getByTestId('plan-week-strip-scroller');

  await expect(weekStrip).toBeVisible();
  await expect(weekStrip).toBeInViewport({ ratio: 0.45 });
  await expect(page.getByTestId('plan-adaptive-season-contract')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Ziele' }).click();
  await expect(page.getByTestId('plan-adaptive-season-contract')).toBeVisible();
  await expect(page.getByTestId('plan-season-strategy-card')).toBeVisible();
});

test('Plan desktop keeps season strategy out of the default training surface', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-specific route information architecture');

  await page.goto('/plan?tab=training');
  await expect(page.getByTestId('plan-week-strip-scroller')).toBeVisible();
  await expect(page.getByTestId('plan-adaptive-season-contract')).toHaveCount(0);
  await expect(page.getByTestId('plan-season-strategy-card')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Ziele' }).click();
  await expect(page.getByTestId('plan-adaptive-season-contract')).toBeVisible();
  await expect(page.getByTestId('plan-season-strategy-card')).toBeVisible();
});

test('Plan desktop keeps manual scenario tools collapsed until requested', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-specific tool density contract');

  await page.goto('/plan?tab=training');
  const scenarioCard = page.getByTestId('plan-scenario-preview-card');

  await expect(scenarioCard).toBeVisible();
  await expect(scenarioCard.getByTestId('plan-scenario-editor')).toHaveCount(0);
  await expect(scenarioCard.getByRole('button', { name: 'Szenario-Vorschau öffnen' })).toBeVisible();

  await scenarioCard.getByRole('button', { name: 'Szenario-Vorschau öffnen' }).click();
  await expect(scenarioCard.getByTestId('plan-scenario-editor')).toBeVisible();
});

test('Plan exposes open change signals in one inbox before detailed evidence', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'change-inbox-local',
        plannedDate: localIsoDate(1),
        activityType: 'bike',
        zone: 2,
        durationMin: 75,
        targetTss: 60,
        status: 'planned',
        description: 'Noch nicht auf Garmin.',
        executionStatus: 'local_planned',
      },
      {
        id: 'change-inbox-template',
        plannedDate: localIsoDate(2),
        activityType: 'run',
        zone: 2,
        durationMin: 45,
        targetTss: 35,
        status: 'planned',
        description: 'Garmin Vorlage ohne Kalendertermin.',
        executionStatus: 'garmin_template',
        garminWorkoutId: 'garmin-template-only',
      },
    ],
    adaptationEvents: {
      events: [
        {
          id: 'change-inbox-recovery',
          userId: 'user-1',
          eventDate: '2026-05-01',
          kind: 'activity_completed',
          sourceId: 'activity-long',
          severity: 'action',
          recommendation: 'protect_recovery',
          summary: 'Lange reale Einheit erkannt; Folgetage müssen Belastung absorbieren.',
          evidence: ['bike 430 min', 'TSS 310'],
          resolvedAt: null,
          createdAt: '2026-05-01T06:00:00.000Z',
        },
      ],
    },
    planRefreshPreview: {
      preview: {
        weekStart: localIsoDate(),
        generatedAt: '2026-05-01T08:00:00.000Z',
        stale: true,
        summary: 'Neue Garmin- und Recovery-Daten würden den Wochenplan verändern.',
        triggers: [{ kind: 'missed_or_replaced', label: 'Ausführung anders', detail: 'Eine echte Einheit weicht vom Plan ab.', severity: 'action', evidence: ['Garmin'] }],
        comparisons: [],
        loadImpact: { tssDelta: -40, durationDeltaMin: -20 },
        garminImpact: { creates: 0, updates: 1, deletes: 0, unchanged: 1, summary: 'Garmin würde eine Einheit aktualisieren.' },
        applySupported: true,
        mutationBoundary: 'Die Vorschau schreibt nichts in Plan oder Garmin.',
      },
    },
  });

  await page.goto('/plan');

  const inbox = page.getByTestId('plan-change-inbox');
  await expect(inbox).toBeVisible();
  await expect(inbox).toContainText('Plan-Änderungen');
  await expect(inbox).toContainText('Wochenplan prüfen');
  await expect(inbox).toContainText('Planabweichung bewerten');
  await expect(inbox).toContainText('Garmin absichern');

  await inbox.getByRole('button', { name: 'Vorschau prüfen' }).click();
  await expect(page.getByTestId('plan-refresh-preview-card')).toBeInViewport();
});

test('Plan keeps the action contract when only Today Options has the planned workout', async ({ page }) => {
  await page.goto('/plan');
  const action = page.getByTestId('plan-primary-action');

  await expect(action).toBeVisible();
  await expect(action).toContainText('Plan-Aktion');
  await expect(action).toContainText('Warum jetzt');
  await expect(action).toContainText('Nach dem Klick');
  await expect(action.getByRole('button', { name: /Workout öffnen/i })).toBeVisible();
});

test('Plan everyday adaptation inbox opens preview without plan writes', async ({ page }) => {
  let previewBody: unknown = null;
  const requests: string[] = [];

  await mockPulseApi(page, {
    onRequest: (pathname, method) => requests.push(`${method} ${pathname}`),
    onPlanScenarioPreview: body => { previewBody = body; },
    planScenarioPreview: () => ({
      preview: {
        type: 'reduce_volume',
        summary: 'Alltag geaendert: Pulse prueft defensivere offene Planlast.',
        projectedWorkouts: [],
        changedDays: [{
          date: '2026-05-03',
          before: { sessions: 1, durationMin: 90, tss: 68 },
          after: { sessions: 1, durationMin: 65, tss: 48 },
          label: '-25 min',
        }],
        loadImpact: { tssDelta: -20, durationDeltaMin: -25, nextDayRecoveryDate: null },
        reasons: ['Alltagsanpassung bleibt Preview-only bis zur expliziten Anwendung.'],
        warnings: [],
        applySupported: true,
      },
    }),
  });

  await page.goto('/plan');
  const inbox = page.getByTestId('everyday-adaptation-inbox');
  await expect(inbox).toBeVisible();
  await expect(inbox).toContainText('Heute anders?');
  await expect(inbox).toContainText('Weniger Zeit');
  await expect(inbox).toContainText('Nicht bereit');
  await expect(inbox).toContainText('Anders erledigt');
  await expect(inbox).toContainText('Heute skippen');

  await inbox.getByRole('button', { name: 'Defensiv prüfen' }).click();
  await expect(page).toHaveURL(/source=everyday-adaptation/);
  const scenarioCard = page.getByTestId('plan-scenario-preview-card');
  await expect(scenarioCard).toBeVisible();
  await expect(page.getByTestId('plan-scenario-entry-context')).toContainText('Alltagsanpassung');
  await expect(page.getByTestId('plan-scenario-preview-result')).toBeVisible();
  await expect(page.getByTestId('scenario-result-contract')).toContainText('Nach Apply');
  await expect(page.getByTestId('scenario-garmin-impact')).toBeVisible();
  expect(previewBody).toMatchObject({ type: 'reduce_volume', factor: 0.7 });
  expect(requests).not.toContain('POST /api/pulse/plan/workout');
});

test('Plan alternatives explain purpose result and safest choice', async ({ page }) => {
  await mockPulseApi(page, {
    todayOptions: {
      todayOptions: {
        date: '2026-05-01',
        state: 'planned_workout',
        summary: 'Heute ist Training geplant; Pulse zeigt den Plan plus sinnvolle Ausweichoptionen.',
        signature: 'planned-with-alternatives-contract',
        options: [
          {
            id: 'planned-primary-contract',
            kind: 'workout',
            priority: 'primary',
            title: 'Plan ausführen: Rad',
            detail: '75 min Z2. Passt heute, solange Check-in und Warm-up unauffällig bleiben.',
            cta: 'Workout öffnen',
            targetPath: '/plan?tab=training',
            evidence: ['Readiness 82/100', 'TSB 3.0'],
            activityType: 'bike',
            zone: 2,
            durationMin: 75,
            archetypeId: 'endurance_steady',
            capabilityFit: 'productive',
            signalLabels: [{ kind: 'productive', label: 'Produktiv', detail: 'Capability erlaubt kleinen Fortschritt', tone: 'accent' }],
          },
          {
            id: 'planned-easier-contract',
            kind: 'workout',
            priority: 'secondary',
            title: 'Leichtere Alternative',
            detail: '55 min Z1, falls Warm-up oder Kopf nicht passen.',
            cta: 'Plan anpassen',
            targetPath: '/plan?tab=training&source=today-options&scenario=workout&activityType=bike&zone=1&durationMin=55&description=55%20min%20Z1#plan-scenario-preview',
            evidence: ['Readiness 82/100', 'TSB 3.0'],
            activityType: 'bike',
            zone: 1,
            durationMin: 55,
            archetypeId: 'recovery_spin',
            capabilityFit: 'maintenance',
            signalLabels: [{ kind: 'fit_maintenance', label: 'Machbar', detail: 'Erhaltung statt Progression', tone: 'green' }],
          },
          {
            id: 'planned-rest-contract',
            kind: 'rest',
            priority: 'support',
            title: 'Bewusst frei lassen',
            detail: 'Wenn Training nur aus Gewohnheit entsteht, ist ein sauber geschlossener Ruhetag wertvoller.',
            cta: 'Tagesentscheidung prüfen',
            targetPath: '/',
            evidence: ['Readiness 82/100', 'TSB 3.0'],
            signalLabels: [{ kind: 'recovery', label: 'Recovery', detail: 'Erholung bleibt geschützt', tone: 'green' }],
          },
        ],
      },
    },
  });

  await page.goto('/plan');
  const options = page.getByTestId('today-options-card-full');
  await expect(options).toContainText('Ausweichoptionen');
  await expect(options).toContainText('Sicherste Option');
  await expect(options).toContainText('Bewusst frei lassen');
  await expect(options).toContainText('Leichtere Alternative');
  await expect(options).toContainText('Zweck');
  await expect(options).toContainText('Warum jetzt');
  await expect(options).toContainText('Nach dem Klick');
  await expect(options).toContainText('Sicher wenn');
  await expect(options).toContainText('Plan-Szenario öffnen');
});

test('Plan detail shows strength support blocks without misleading Garmin interval copy', async ({ page }) => {
  const strengthWorkout = {
    id: 'strength-support-smoke',
    userId: 'user-1',
    plannedDate: '2026-05-11',
    activityType: 'strength',
    zone: 1,
    durationMin: 30,
    distanceKm: null,
    targetTss: 12,
    archetypeId: 'strength_prehab',
    difficultyLevel: 1.8,
    difficultyEnergySystem: 'strength',
    capabilityFit: 'maintenance',
    description: 'Mobility, Core und Prehab als Support-Einheit.',
    steps: [
      { type: 'steady', durationMin: 10, zone: 1, description: 'Mobility: Huefte und Brustwirbelsaeule ruhig mobilisieren.' },
      { type: 'steady', durationMin: 10, zone: 1, description: 'Core/Prehab: kontrollierte Spannung, keine Ermuedung erzwingen.' },
      { type: 'steady', durationMin: 10, zone: 1, description: 'Glutes und Stabilitaet sauber aktivieren.' },
    ],
    garminWorkoutId: null,
    garminScheduledId: null,
    garminSyncContract: {
      version: 1,
      status: 'degraded',
      payloadReady: true,
      checkedAt: '2026-05-01T08:00:00.000Z',
      summary: 'Garmin-Upload mit Einschränkung: Support-Session wird als Notiz/Blockliste behandelt, nicht als Intervallstruktur.',
      issues: [{ code: 'strength_notes_only', severity: 'warning', message: 'Support-Session wird als Notiz/Blockliste behandelt, nicht als Intervallstruktur.' }],
    },
    status: 'planned',
    workoutFeedback: null,
    complianceScore: null,
    origin: 'generated',
    userLocked: false,
    completedActivityId: null,
    executionStatus: 'local_planned',
    executionMatchedAt: null,
    executionMatchConfidence: null,
    executionNotes: 'Support-Einheit bleibt bewusst niedrigschwellig.',
  };

  await mockPulseApi(page, { planWorkouts: [strengthWorkout] });

  await page.goto('/plan');
  await expect(page.getByRole('button', { name: '2026-05-11 Kraft öffnen' })).toBeVisible();
  await expect(page.getByTestId('plan-workout-structure-summary')).toContainText('3 Blöcke');
  await expect(page.getByTestId('plan-workout-structure-summary')).toContainText('30 min');

  await page.getByRole('button', { name: '2026-05-11 Kraft öffnen' }).click();

  await expect(page.getByTestId('support-session-blocks')).toContainText('SUPPORT-SESSION');
  await expect(page.getByTestId('support-session-blocks')).toContainText('Mobility: Huefte');
  await expect(page.getByTestId('support-session-blocks')).toContainText('Core/Prehab');
  await expect(page.getByTestId('support-session-blocks')).toContainText('Glutes und Stabilitaet');
  const handoff = page.getByTestId('garmin-workout-handoff');
  await expect(handoff).toContainText('Notiz/Blockliste');
  await expect(handoff).toContainText('Keine Repeat-Blöcke');
  await expect(handoff).toContainText('Keine HR-Ziele');
  await expect(page.getByText('1 Repeat-Block')).toHaveCount(0);
});

test('primary navigation reaches every Pulse page', async ({ page }) => {
  await page.goto('/');
  await expectHealthyPage(page, 'READINESS');

  for (const route of primaryNavRoutes.slice(1)) {
    await page.locator(`a[href="${route.navHref}"]`).filter({ visible: true }).click();
    await expect(page).toHaveURL(route.path);
    await expectHealthyPage(page, route.visibleText);
  }
});

test('Settings section deep links land near the target section', async ({ page }) => {
  await page.goto('/settings?section=push');
  await expectHealthyPage(page, 'Settings');

  const pushHeading = page.getByRole('heading', { name: 'Benachrichtigungen' });
  await expect(pushHeading).toBeVisible();
  const box = await pushHeading.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(260);
});

test('daily training surfaces use localized activity labels', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  const runWorkout = {
    id: 'run-label-test',
    plannedDate: '2026-05-01',
    activityType: 'run',
    zone: 2,
    durationMin: 45,
    targetTss: 38,
    status: 'planned',
    archetypeId: 'endurance_steady',
    description: 'Lockerer Lauf mit sauberer Grenze.',
  };
  const visibleWeekWorkout = {
    ...runWorkout,
    id: 'run-week-label-test',
    plannedDate: '2026-05-08',
  };
  await mockPulseApi(page, {
    home: {
      todayWorkout: runWorkout,
      nextWorkout: runWorkout,
    },
    planWorkouts: [runWorkout, visibleWeekWorkout],
    todayOptions: {
      todayOptions: {
        date: '2026-05-01',
        state: 'recovery_protect',
        summary: 'Heute ist Erholung wichtiger als zusätzliche Intensität.',
        signature: 'run-label-test',
        options: [{
          id: 'optional-run-z1',
          kind: 'recovery',
          priority: 'secondary',
          title: 'Optional 20 min Z1',
          detail: 'Nur wenn du dich nach Bewegung besser fühlst.',
          cta: 'Option planen',
          targetPath: '/plan?tab=training',
          evidence: ['Recovery protect'],
          activityType: 'run',
          zone: 1,
          durationMin: 20,
        }],
      },
    },
  });

  await page.goto('/');
  await expect(page.getByTestId('daily-decision-card')).toContainText('Laufen · Z2 · 45 min');
  await expect(page.getByTestId('today-options-card')).toContainText('Laufen · Z1 · 20 min');
  await expect(page.getByText('run', { exact: true })).toHaveCount(0);

  await page.goto('/plan');
  await expect(page.getByRole('button', { name: 'Fr 1: Laufen öffnen' })).toBeVisible();
  await expect(page.getByText('Archetyp: Steady Endurance').first()).toBeVisible();
  await expect(page.getByText('endurance_steady', { exact: true })).toHaveCount(0);
  await expect(page.getByText('endurance steady', { exact: true })).toHaveCount(0);
  await expect(page.getByText('run', { exact: true })).toHaveCount(0);
});

test('mobile Home availability intent opens a workout scenario preview', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile intent is a narrow viewport affordance');
  let previewBody: unknown = null;

  await mockPulseApi(page, {
    todayOptionsState: 'unplanned_trainable',
    onPlanScenarioPreview: body => { previewBody = body; },
    planScenarioPreview: body => ({
      preview: {
        type: 'add_custom_tour',
        summary: 'Heute 60 min moeglich: Pulse prueft Wochenlast und Garmin, bevor etwas gespeichert wird.',
        projectedWorkouts: [],
        changedDays: [{
          date: '2026-05-01',
          before: { sessions: 0, durationMin: 0, tss: 0 },
          after: { sessions: 1, durationMin: 60, tss: 36 },
          label: '+1 Einheit, +36 TSS',
        }],
        loadImpact: { tssDelta: 36, durationDeltaMin: body.workout?.durationMin ?? 0, nextDayRecoveryDate: null },
        reasons: ['Mobile Intent bleibt Preview-only bis zur expliziten Anwendung.'],
        warnings: [],
        applySupported: true,
      },
    }),
  });

  await page.goto('/');
  await expect(page.getByTestId('today-availability-intent')).toBeVisible();
  await page.getByRole('button', { name: '60 min' }).click();
  await expect(page).toHaveURL(/source=mobile-intent/);
  const scenarioCard = page.getByTestId('plan-scenario-preview-card');
  await expect(scenarioCard).toBeVisible();
  await expect(scenarioCard).toContainText('Mobile Quick Decision');
  await expect(page.getByTestId('plan-scenario-preview-result')).toBeVisible();
  await expect(page.getByTestId('scenario-garmin-impact')).toBeVisible();
  await expect(page.getByTestId('scenario-result-contract')).toContainText('Nach Apply');
  await expect(page.getByTestId('scenario-result-contract')).toContainText('Sicherste Entscheidung');
  await expect(page.getByTestId('plan-scenario-preview-result')).not.toContainText('Wende an');
  await expect(scenarioCard.getByTestId('plan-scenario-editor')).toHaveCount(0);
  await scenarioCard.getByTestId('plan-scenario-edit-toggle').click();
  const editor = scenarioCard.getByTestId('plan-scenario-editor');
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel('Dauer min')).toHaveValue('60');
  await expect(editor.getByLabel('Sportart')).toHaveValue('bike');
  await expect(editor.getByLabel('Zone')).toHaveValue('1');
  expect(previewBody).toMatchObject({
    type: 'add_custom_tour',
    workout: {
      activityType: 'bike',
      zone: 1,
      durationMin: 60,
      description: 'Heute 60 min moeglich; Pulse prueft Auswirkung auf Woche und Garmin.',
    },
  });
});

test('mobile Home free-day intent opens reduce-volume preview without creating a workout', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile intent is a narrow viewport affordance');
  let previewBody: unknown = null;
  const requests: string[] = [];

  await mockPulseApi(page, {
    todayOptionsState: 'unplanned_trainable',
    onRequest: (pathname, method) => requests.push(`${method} ${pathname}`),
    onPlanScenarioPreview: body => { previewBody = body; },
    planScenarioPreview: () => ({
      preview: {
        type: 'reduce_volume',
        summary: 'Heute frei: Pulse prueft defensivere offene Planlast.',
        projectedWorkouts: [],
        changedDays: [{
          date: '2026-05-03',
          before: { sessions: 1, durationMin: 90, tss: 68 },
          after: { sessions: 1, durationMin: 65, tss: 48 },
          label: '-25 min',
        }],
        loadImpact: { tssDelta: -20, durationDeltaMin: -25, nextDayRecoveryDate: null },
        reasons: ['Freier Tag bleibt bewusst frei.'],
        warnings: [],
        applySupported: true,
      },
    }),
  });

  await page.goto('/');
  await expect(page.getByTestId('today-availability-intent')).toBeVisible();
  await page.getByRole('button', { name: 'Frei' }).click();
  await expect(page).toHaveURL(/scenario=reduce_volume/);
  const scenarioCard = page.getByTestId('plan-scenario-preview-card');
  await expect(scenarioCard).toBeVisible();
  await expect(scenarioCard).toContainText('Heute bewusst frei halten.');
  await expect(page.getByTestId('plan-scenario-preview-result')).toBeVisible();
  await expect(page.getByTestId('scenario-garmin-impact')).toBeVisible();
  await expect(scenarioCard.getByTestId('plan-scenario-editor')).toHaveCount(0);
  await scenarioCard.getByTestId('plan-scenario-edit-toggle').click();
  await expect(scenarioCard.getByTestId('plan-scenario-editor')).toContainText('Nicht gesperrte Zukunfts-Workouts auf 70%');
  expect(previewBody).toMatchObject({ type: 'reduce_volume', factor: 0.7 });
  expect(requests).not.toContain('POST /api/pulse/plan/workout');
});

test('mobile Home planned workout state shows the concrete plan option without availability intents', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile intent is a narrow viewport affordance');

  await mockPulseApi(page, {
    todayOptionsState: 'planned_workout',
    home: {
      todayWorkout: {
        id: 'workout-planned-smoke',
        userId: 'user-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 75,
        distanceKm: null,
        targetTss: 62,
        archetypeId: 'endurance_steady',
        difficultyLevel: 3,
        difficultyEnergySystem: 'endurance',
        capabilityFit: 'productive',
        description: 'Aerobe Grundlage.',
        steps: null,
        garminWorkoutId: 'garmin-workout-planned',
        garminScheduledId: 'garmin-scheduled-planned',
        garminSyncContract: null,
        status: 'planned',
        workoutFeedback: null,
        complianceScore: null,
        origin: 'generated',
        userLocked: false,
        completedActivityId: null,
        executionStatus: 'garmin_scheduled',
        executionMatchedAt: null,
        executionMatchConfidence: null,
        executionNotes: null,
      },
    },
  });

  await page.goto('/');
  await expect(page.getByTestId('today-availability-intent')).toHaveCount(0);
  await expect(page.getByTestId('today-options-card')).toContainText('Heute trainieren');
  await expect(page.getByTestId('today-options-card')).toContainText('Plan ausfuehren: Rad');
  await expect(page.getByTestId('today-options-card')).toContainText('Workout oeffnen');
});

test('/insights renders as a top-level evidence route', async ({ page }) => {
  await page.goto('/insights');
  await expect(page).toHaveURL('/insights');
  await expect(page.getByRole('heading', { name: 'Insights', exact: true })).toBeVisible();
  await expect(page.getByTestId('insights-synthesis-hero')).toBeVisible();
  await expect(page.getByTestId('data-analysis-decision-quality-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tiefe Analyse anzeigen' })).toBeVisible();
});

test('primary navigation exposes Focus routes without Coach tab', async ({ page }) => {
  await page.goto('/');
  await expectPrimaryNavigationWithoutCoach(page);

  await page.goto('/coach');
  await expectHealthyPage(page, 'TAGESBRIEFING');
  await expectPrimaryNavigationWithoutCoach(page);
});

test('Data mobile subnavigation keeps every section tab in the visible viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile tab visibility is a narrow viewport affordance');

  await page.goto('/data');
  await expectHealthyPage(page, 'DATA');

  const viewportWidth = page.viewportSize()?.width ?? 0;
  const labels = ['Heute relevant', 'Trends', 'Datenqualität', 'Analyse'];

  for (const label of labels) {
    const tab = page.getByRole('tab', { name: label });
    await tab.scrollIntoViewIfNeeded();
    const box = await tab.boundingBox();
    expect(box, `${label} tab has a visible box`).not.toBeNull();
    expect(box!.x, `${label} tab left edge`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${label} tab right edge`).toBeLessThanOrEqual(viewportWidth);
  }
});

test('Data mobile deep links do not clip the tab row', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile tab visibility is a narrow viewport affordance');

  await page.goto('/data?tab=mental');
  await expectHealthyPage(page, 'DATA');

  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll('[role="tablist"][aria-label="Data Bereiche"] [role="tab"]'))
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          text: element.textContent?.trim() ?? '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      })
      .filter(item => item.left < -1 || item.right > viewportWidth + 1);
  });

  expect(overflow).toEqual([]);
});

test('Plan mobile week strip fits seven days without hidden horizontal scrolling', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile week strip fit is a narrow viewport affordance');

  await mockPulseApi(page, {
    planWorkouts: [{
      id: 'mobile-weekstrip-run',
      plannedDate: localIsoDate(),
      activityType: 'run',
      zone: 2,
      durationMin: 48,
      targetTss: 39,
      status: 'planned',
      description: 'Lockerer Lauf mit sauberer Grenze.',
    }],
  });

  await page.goto('/plan?tab=training');
  const workoutButton = page.getByRole('button', { name: /Laufen öffnen/ }).first();
  await expect(workoutButton).toBeVisible();

  const containment = await workoutButton.evaluate((element) => {
    let current: HTMLElement | null = element as HTMLElement;
    let hasHorizontalScroller = false;
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && current.scrollWidth > current.clientWidth + 1) {
        hasHorizontalScroller = true;
        break;
      }
      current = current.parentElement;
    }

    return {
      hasHorizontalScroller,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(containment.documentOverflow).toBeLessThanOrEqual(1);
  expect(containment.hasHorizontalScroller).toBe(false);
});

test('Plan mobile workout rows wrap status chips without horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile workout row containment is a narrow viewport affordance');

  await page.setViewportSize({ width: 320, height: 844 });
  const plannedDate = localIsoDate();
  await mockPulseApi(page, {
    planWorkouts: [{
      id: 'mobile-row-run',
      plannedDate,
      activityType: 'run',
      zone: 2,
      durationMin: 48,
      targetTss: 39,
      archetypeId: 'endurance_steady',
      capabilityFit: 'maintenance',
      status: 'planned',
      origin: 'generated',
      userLocked: false,
      completedActivityId: null,
      workoutFeedback: null,
      complianceScore: null,
      executionStatus: 'local_planned',
      executionMatchedAt: null,
      executionMatchConfidence: null,
      executionNotes: 'Workout ist nur lokal in Pulse geplant.',
      description: 'Lockerer Lauf mit sauberer Grenze.',
    }],
  });

  await page.goto('/plan?tab=training');
  const workoutRowButton = page.getByRole('button', { name: new RegExp(`${plannedDate}.*Laufen öffnen`) }).first();
  await expect(workoutRowButton).toBeVisible();

  const rowOverflow = await workoutRowButton.evaluate((element) => {
    return Array.from(element.querySelectorAll<HTMLElement>('*'))
      .map((node) => ({
        text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
      }))
      .filter(item => item.scrollWidth > item.clientWidth + 1);
  });

  expect(rowOverflow).toEqual([]);
});

test('top-level hotkeys follow the Focus navigation order', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'top-level numeric hotkeys are a desktop navigation affordance');

  await page.goto('/');
  await expectHealthyPage(page, 'TAGESENTSCHEIDUNG');

  await page.keyboard.press('2');
  await expect(page).toHaveURL('/data');
  await expectHealthyPage(page, 'DATA');

  await page.keyboard.press('3');
  await expect(page).toHaveURL('/plan');
  await expectHealthyPage(page, 'PLAN');

  await page.keyboard.press('4');
  await expect(page).toHaveURL('/insights');
  await expectHealthyPage(page, 'Insights');

  await page.keyboard.press('5');
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
