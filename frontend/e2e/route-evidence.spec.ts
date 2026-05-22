import { expect, test, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MOCK_TODAY, mockPulseApi } from './fixtures/pulse-api';

const routes = [
  { path: '/', label: 'home', visibleText: 'Heute im Fokus' },
  { path: '/coach', label: 'coach', visibleText: 'Frage klären' },
  { path: '/data', label: 'data', visibleText: 'Daten' },
  { path: '/data?tab=today#data-mental', label: 'data-mental', visibleText: 'Quick Check-in' },
  { path: '/data?tab=analysis', label: 'data-analysis', visibleText: 'Analysen' },
  { path: '/plan', label: 'plan', visibleText: 'Plan' },
  { path: '/plan/activity/activity-detail', label: 'activity-detail', visibleText: 'Rennrad Tour' },
  { path: '/insights', label: 'insights', visibleText: 'Analyse' },
  { path: '/settings', label: 'settings', visibleText: 'Setup' },
] as const;

const fuelingLearningOutcomeBaseline = {
  status: 'learning',
  label: 'Fueling-Baseline lernt',
  summary: 'Lange Einheiten brauchen vergleichbare During-Logs.',
  latestLogDate: '2026-04-30',
  observedCarbsPerHour: 48,
  targetCarbsPerHour: { min: 55, max: 65 },
  bottles750Ml: 3,
  powderG: 210,
  fluidMlPerHour: 680,
  sodiumMgPerHour: null,
  hydrationContextSummary: null,
  hydrationEvidenceGaps: ['Hitze nicht gemessen'],
  trendSummary: null,
  evidence: ['2 vorhandene lange Carb-Logs brauchen GI-Komfort.'],
  learningReadiness: {
    comparableCompleteLogs: 0,
    requiredComparableCompleteLogs: 3,
    readyForTrendSummary: false,
    missingEvidence: ['Noch drei vergleichbare During-Logs fehlen: zwei vorhandene lange Logs koennen durch GI-Komfort zaehlen; danach fehlt noch ein neuer vollstaendiger Lernlog.'],
    nextAction: {
      kind: 'complete_gi_comfort',
      label: 'GI-Komfort ergänzen',
      detail: 'GI-Komfort am vorhandenen langen During-Log ergänzen.',
      activityId: 'activity-fueling-gap',
    },
    completionCandidates: [{
      kind: 'complete_gi_comfort',
      label: 'GI-Komfort ergänzen',
      detail: 'GI-Komfort am vorhandenen langen During-Log ergänzen.',
      activityId: 'activity-fueling-gap',
      date: '2026-04-30',
      summary: 'Long Fueling Check · 240 min · 120 g Carbs',
      missingEvidence: ['GI-Komfort'],
    }],
  },
};

const fuelingGapNutritionLog = {
  id: 'nutrition-fueling-gap',
  userId: 'user-1',
  date: '2026-04-30',
  workoutId: null,
  activityId: 'activity-fueling-gap',
  context: 'during',
  mealType: null,
  description: null,
  calories: null,
  proteinG: null,
  carbsG: 120,
  fatG: null,
  gelsCount: null,
  drinksMl: null,
  sodiumMg: null,
  ambientTempC: null,
  sweatRateLPerHour: null,
  bottles750Ml: null,
  powderG: null,
  fuelingProducts: [],
  giComfort: null,
  notes: null,
  createdAt: '2026-04-30T13:15:00.000Z',
};

const fuelingGapActivityDetail = {
  activity: {
    id: 'activity-fueling-gap',
    userId: 'user-1',
    externalId: 'garmin-fueling-gap',
    source: 'garmin',
    startTime: '2026-04-30T08:00:00.000Z',
    activityType: 'bike',
    name: 'Long Fueling Check',
    durationSec: 4 * 3600,
    distanceM: 88000,
    avgHr: 137,
    maxHr: 165,
    avgPowerW: 176,
    normalizedPowerW: 188,
    tss: 210,
    calories: 2600,
    elevationGainM: 900,
    trainingEffectAerobic: 3.4,
    trainingEffectAnaerobic: 0.2,
    vo2maxEstimate: null,
    rpe: 7,
    rpeNote: null,
    sorenessAreas: null,
    feedbackLoggedAt: '2026-04-30T13:00:00.000Z',
    equipmentIds: [],
    plannedWorkoutId: null,
  },
  laps: [],
  hrZones: [],
  analytics: null,
};

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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

async function overflowSummary(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const documentScrollWidth = document.documentElement.scrollWidth;
    const overflowingNodes = Array.from(document.querySelectorAll('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent ?? '').trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.width > 0 && (item.left < -1 || item.right > viewportWidth + 1))
      .slice(0, 20);

    return {
      viewportWidth,
      documentScrollWidth,
      horizontalOverflow: documentScrollWidth > viewportWidth + 1,
      overflowingNodes,
    };
  });
}

async function resetRouteScroll(page: Page) {
  await page.evaluate(() => {
    document.scrollingElement?.scrollTo({ top: 0, left: 0 });
    document.querySelector('main')?.scrollTo({ top: 0, left: 0 });
  });
}

async function expectBelowMobileChrome(page: Page, locator: Locator) {
  const topbar = await page.locator('.pulse-mobile-topbar').boundingBox();
  const target = await locator.boundingBox();
  expect(topbar).not.toBeNull();
  expect(target).not.toBeNull();
  expect(target!.y).toBeGreaterThanOrEqual(topbar!.y + topbar!.height + 8);
}

test.describe('Route evidence screenshot pack', () => {
  test.skip(process.env.PULSE_ROUTE_EVIDENCE !== 'true', 'set PULSE_ROUTE_EVIDENCE=true to capture route screenshots');
  test.setTimeout(60_000);

  test('captures core routes with manifest metadata', async ({ page, baseURL }, testInfo) => {
    await page.clock.setFixedTime(new Date(`${MOCK_TODAY}T08:00:00+02:00`));
    await mockPulseApi(page, { checkinToday: { checkin: null } });
    await seedAuth(page);

    const commit = currentCommit();
    const capturedAt = new Date().toISOString();
    const date = process.env.PULSE_ROUTE_EVIDENCE_DATE ?? capturedAt.slice(0, 10);
    const outputRoot = process.env.PULSE_ROUTE_EVIDENCE_DIR ?? path.join(process.cwd(), 'test-results', 'route-evidence');
    const runDir = path.join(outputRoot, `${date}-${commit}`, slug(testInfo.project.name));
    await fs.mkdir(runDir, { recursive: true });

    const screenshots: Array<{
      route: string;
      url: string;
      label: string;
      file: string;
      overflow: Awaited<ReturnType<typeof overflowSummary>>;
    }> = [];

    async function capture(
      route: { path: string; label: string; visibleText: string },
      verify?: () => Promise<void>,
    ) {
      await resetRouteScroll(page);
      await page.goto(route.path);
      await expect(page.locator('main').getByText(route.visibleText).filter({ visible: true }).first()).toBeVisible();
      await verify?.();
      if (!route.path.includes('#')) await resetRouteScroll(page);
      const overflow = await overflowSummary(page);
      const filename = `${String(screenshots.length + 1).padStart(2, '0')}-${route.label}.png`;
      const file = path.join(runDir, filename);
      await page.screenshot({ path: file, fullPage: true });
      screenshots.push({
        route: route.path,
        url: page.url(),
        label: route.label,
        file,
        overflow,
      });
    }

    for (const route of routes) {
      await capture(route, route.label === 'data-analysis'
        ? async () => {
            const qualityCard = page.getByTestId('power-data-quality');
            await expect(qualityCard).toBeVisible();
            await expect(qualityCard).toContainText('Nur Lap-Approximation');
            await expect(page.getByTestId('power-duration-summary')).toContainText('Durability limited');
          }
        : undefined);
    }

    if (testInfo.project.name === 'mobile-chromium') {
      await mockPulseApi(page, {
        checkinToday: { checkin: null },
        todayOptionsState: 'planned_workout',
        home: {
          todayWorkout: {
            id: 'workout-planned-command',
            userId: 'user-1',
            plannedDate: MOCK_TODAY,
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
      await capture(
        { path: '/', label: 'home-planned-command', visibleText: 'Heute im Fokus' },
        async () => {
          await expect(page.getByTestId('today-options-card')).toContainText('Plan ausfuehren: Rad');
          await expect(page.getByTestId('today-availability-intent')).toHaveCount(0);
        },
      );

      await mockPulseApi(page, { checkinToday: { checkin: null }, todayOptionsState: 'unplanned_trainable' });
      await capture(
        { path: '/', label: 'home-free-command', visibleText: 'Heute im Fokus' },
        async () => {
          await expect(page.getByTestId('today-availability-intent')).toBeVisible();
        },
      );

      await mockPulseApi(page, {
        checkinToday: { checkin: null },
        todayOptionsState: 'completed_activity',
        home: {
          todayActivities: [{
            id: 'activity-completed-command',
            userId: 'user-1',
            externalId: 'garmin-activity-completed-command',
            source: 'garmin',
            startTime: `${MOCK_TODAY}T07:30:00.000Z`,
            activityType: 'bike',
            name: 'Rennrad Grundlage',
            durationSec: 4200,
            distanceM: 26000,
            avgHr: 136,
            maxHr: 162,
            avgPowerW: 178,
            normalizedPowerW: 188,
            tss: 58,
            calories: 690,
            elevationGainM: 180,
            trainingEffectAerobic: 3,
            trainingEffectAnaerobic: 0.2,
            vo2maxEstimate: null,
            rpe: 5,
            rpeNote: null,
            sorenessAreas: null,
            feedbackLoggedAt: `${MOCK_TODAY}T09:10:00.000Z`,
            equipmentIds: [],
          }],
        },
      });
      await capture(
        { path: '/', label: 'home-completed-command', visibleText: 'Heute im Fokus' },
        async () => {
          await expect(page.getByTestId('daily-decision-card')).toContainText('Training heute erledigt');
          await expect(page.getByTestId('today-options-card')).toHaveCount(0);
          await expect(page.getByTestId('today-availability-intent')).toHaveCount(0);
        },
      );

      await mockPulseApi(page, { checkinToday: { checkin: null }, todayOptionsState: 'recovery_protect' });
      await capture(
        { path: '/', label: 'home-recovery-no-intent', visibleText: 'Heute im Fokus' },
        async () => {
          await expect(page.getByTestId('today-availability-intent')).toHaveCount(0);
        },
      );

      await mockPulseApi(page, { checkinToday: { checkin: null } });
      await capture(
        { path: '/data?tab=today#data-mental', label: 'data-mental-first-viewport', visibleText: 'Quick Check-in' },
        async () => {
          await expectBelowMobileChrome(page, page.getByRole('heading', { name: 'Mental Check-in' }));
          await expect(page.getByRole('button', { name: 'Heute speichern' })).toBeInViewport();
          await expect(page.getByRole('button', { name: 'Mehr beschreiben' })).toBeVisible();
          await expect(page.getByRole('radio', { name: 'Kopf: klar' })).toHaveCount(0);
        },
      );

      await mockPulseApi(page, {
        checkinToday: { checkin: { id: 'checkin-1', date: MOCK_TODAY } },
        outcomeBaseline: fuelingLearningOutcomeBaseline,
        nutritionLogs: [fuelingGapNutritionLog],
        activityDetail: fuelingGapActivityDetail,
      });
      await capture(
        { path: '/data', label: 'data-fueling-action', visibleText: 'Daten' },
        async () => {
          const action = page.getByTestId('data-primary-action');
          await expect(action).toBeVisible();
          await expect(action).toBeInViewport();
          await expect(action).toContainText('Fueling-Evidenz schließen');
          await expect(action.getByTestId('data-primary-action-target')).toContainText('Long Fueling Check');
          await expect(action).toContainText('Trend-Evidenz 0/3');
          await expect(action.getByRole('button', { name: 'GI-Komfort ergänzen' })).toBeInViewport();
        },
      );
      await capture(
        { path: '/plan/activity/activity-fueling-gap#activity-fueling-log', label: 'activity-fueling-anchor', visibleText: 'Long Fueling Check' },
        async () => {
          const fuelingLog = page.locator('#activity-fueling-log');
          await expect(fuelingLog).toBeInViewport();
          await expect(fuelingLog).toContainText('GI-Komfort ergänzen');
          const giComfortAction = page.getByTestId('activity-gi-comfort-action');
          await expect(giComfortAction).toBeFocused();
          await expect(giComfortAction).toHaveClass(/evidence-section/);
          await expect(giComfortAction).toBeInViewport();
          await expect(giComfortAction.getByTestId('activity-gi-comfort-options')).toBeInViewport();
          await expect(giComfortAction.getByRole('button', { name: 'Magen ok' })).toBeInViewport();
          await expect(giComfortAction.getByRole('button', { name: 'Magen leicht unruhig' })).toBeInViewport();
          await expect(giComfortAction.getByRole('button', { name: 'Magenprobleme' })).toBeInViewport();
        },
      );

      await mockPulseApi(page, { checkinToday: { checkin: null }, todayOptionsState: 'unplanned_trainable' });
      await capture(
        {
          path: '/plan?tab=training&source=mobile-intent&scenario=workout&activityType=bike&zone=1&durationMin=60&description=Heute%2060%20min%20moeglich%3B%20Pulse%20prueft%20Auswirkung%20auf%20Woche%20und%20Garmin.#plan-scenario-preview',
          label: 'plan-mobile-intent-scenario',
          visibleText: 'Szenario-Vorschau',
        },
        async () => {
          const scenarioCard = page.getByTestId('plan-scenario-preview-card');
          await expect(scenarioCard).toBeVisible();
          await expect(scenarioCard).toBeInViewport();
          await expect(page.getByRole('heading', { name: /Plan|Training, Ziele|Szenario/i }).first()).toBeVisible();
          await expect(page.getByTestId('plan-scenario-entry-context')).toBeVisible();
          await expect(page.getByTestId('plan-scenario-entry-context')).toBeInViewport();
          await expect(scenarioCard).toContainText('Mobile Quick Decision');
          await expect(scenarioCard).toContainText('Nur Vorschau');
          await expect(scenarioCard).not.toContainText('Preview-only');
          await expect(scenarioCard).not.toContainText('155 km');
          await expect(scenarioCard).not.toContainText('423 min');
        },
      );
    }

    const manifest = {
      capturedAt,
      date,
      commit,
      project: testInfo.project.name,
      baseURL,
      viewport: page.viewportSize(),
      screenshots,
    };

    await fs.writeFile(path.join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await fs.writeFile(
      path.join(runDir, 'README.md'),
      [
        '# Pulse Route Evidence',
        '',
        `- Date: ${date}`,
        `- Commit: ${commit}`,
        `- Project: ${testInfo.project.name}`,
        `- Base URL: ${baseURL}`,
        `- Viewport: ${manifest.viewport?.width ?? 'unknown'}x${manifest.viewport?.height ?? 'unknown'}`,
        '',
        '## Screenshots',
        '',
        ...screenshots.map((shot) => `- ${shot.route}: ${path.basename(shot.file)} (${shot.overflow.horizontalOverflow ? 'overflow' : 'no overflow'})`),
        '',
      ].join('\n'),
    );
  });
});
