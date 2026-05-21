import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
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
  await expect(card).toContainText('Ziel-Fortschritt');
  await expect(card).toContainText('Ziel-Limiter beobachten');
  await expect(card).toContainText('70.3 Kraichgau');
  await expect(card).toContainText('Wirkung: Watch-Kontext');
  await expect(card).toContainText('Data-Evidenz und keine Planentscheidung');
  await expect(card).toContainText('Nach dem Klick');
  await expect(card.getByRole('button', { name: 'Zielprojektion prüfen' })).toBeVisible();
  await expect(card).toContainText('Interessant, aber noch nicht entscheidend');
  await expect(card).toContainText('Wiederholte stabile Fueling');
  await expect(card).toContainText('Read-only');
  await card.getByRole('button', { name: 'Zielprojektion prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-goal-projection');
  expect(insightRequests).toBe(0);
});

test('Data analysis keeps insufficient goal evidence in Data', async ({ page }) => {
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

  await expect(card).toContainText('Datenvertrauen');
  await expect(card).toContainText('Wahrscheinlichkeit offen');
  await expect(card).toContainText('Wirkung: Watch-Kontext');
  await expect(card).toContainText('Nach dem Klick');
  await expect(card).toContainText('Öffnet die Zielprojektion als Watch-Kontext');
  await card.getByRole('button', { name: 'Zielprojektion prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-goal-projection');
});

test('Data analysis opens secondary goal evidence from the watch signal', async ({ page }) => {
  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  await expect(card).toContainText('Interessant, aber noch nicht entscheidend');
  await expect(card).toContainText('Wiederholte stabile Fueling');
  await expect(card).toContainText('Öffnet die Zielprojektion');
  await card.getByRole('button', { name: 'Zielevidenz prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-goal-projection');
  await expect(page.locator('#data-goal-projection')).toBeVisible();
});

test('Data analysis opens plan impact from plan limiter evidence', async ({ page }) => {
  await mockPulseApi(page, {
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Noch kein Zielsignal führt.',
      projections: [],
      missingEvidence: [],
    },
    planTrace: {
      id: 'trace-limiter',
      userId: 'user-1',
      weekStart: '2026-04-27',
      createdAt: '2026-05-01T08:00:00.000Z',
      inputSnapshot: {
        phase: 'build',
        mesocycleWeek: 2,
        weeklyHoursTarget: 8,
        availableDays: [1, 2, 4, 6],
        load: { ctl: 48, atl: 55, tsb: -7 },
        profile: { ftpWatts: 240, maxHrBpm: 190, lthrBpm: 172 },
        goals: [],
        riskSignals: [],
        healthStates: [],
        recentRpe: [],
        rpeReasons: [],
        dataWarnings: [],
        recentSportMix: {},
        goalLimiter: {
          kind: 'long_endurance_fueling',
          label: 'Long Endurance + Fueling',
          confidence: 'medium',
          evidence: ['Long-Endurance-Level 3.1', 'Fueling-Verträglichkeit lernt'],
          planBias: 'Die Woche sollte den nächsten langen Fueling-Reiz kontrolliert prüfen.',
          workoutFocus: ['long_endurance', 'endurance'],
        },
      },
      planDecision: {
        summary: 'Limiter bestimmt die Woche.',
        selectedDays: [1, 4],
        skippedAvailableDays: [2, 6],
        targetSessionCount: 2,
        primaryGoal: '70.3 Kraichgau',
        reasons: [],
        riskFlags: [],
        adaptations: [],
      },
      sportMix: {},
      hardDays: [],
      generatedSummary: [],
    },
  });

  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  const risk = card.getByTestId('analysis-training-risk-contract');
  await expect(risk).toContainText('Trainingsrisiko prüfen');
  await expect(risk).toContainText('Long Endurance + Fueling');
  await expect(risk).toContainText('Wirkung: Planentscheidung');
  await expect(card).toContainText('Plan-Limiter');
  await expect(card).toContainText('Long Endurance + Fueling');
  await expect(card).toContainText('Nach dem Klick');
  await risk.getByRole('button', { name: 'Risiko einordnen' }).click();
  await expect(page).toHaveURL('/plan?tab=training&source=data-load#plan-weekly-decision');
  await expect(page.getByTestId('plan-weekly-decision-contract')).toBeVisible();
});

test('Data analysis opens power quality evidence from the watch signal', async ({ page }) => {
  await mockPulseApi(page, {
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion hat keine offene Evidenzlücke.',
      projections: [{
        goalId: 'race-1',
        title: '70.3 Kraichgau',
        category: 'race',
        targetDate: '2026-07-11',
        daysUntil: 71,
        probabilityPct: 72,
        status: 'on_track',
        confidence: 'medium',
        summary: '70.3 Kraichgau ist stabil genug, um die Datenqualität separat zu prüfen.',
        limiterRisk: {
          status: 'clear',
          label: 'Limiter stabil',
          summary: 'Kein Ziel-Limiter führt gerade.',
          evidence: ['Zielsignal stabil'],
        },
        nextBestIntervention: {
          kind: 'maintenance',
          title: 'Zielrhythmus halten',
          summary: 'Die nächste Planentscheidung bleibt bewusst klein.',
          actionLabel: 'Plan prüfen',
          targetPath: '/plan?tab=training',
          evidence: ['Zielsignal stabil'],
        },
        evidence: ['Zielsignal stabil'],
        missingEvidence: [],
      }],
      missingEvidence: [],
    },
  });

  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  await expect(card).toContainText('Power nur Hinweis');
  await expect(card).toContainText('Wirkung: Watch-Kontext');
  await expect(card).toContainText('Nach dem Klick');
  await expect(card).toContainText('Öffnet die Power-Datenqualität');
  await card.getByRole('button', { name: 'Power-Daten prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-power-quality');
  await expect(page.locator('#data-power-quality')).toBeVisible();
});

test('Data analysis opens durability evidence from the watch signal', async ({ page }) => {
  await mockPulseApi(page, {
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion hat keine offene Evidenzlücke.',
      projections: [],
      missingEvidence: [],
    },
    planTrace: null,
    powerDataQuality: {
      source: 'stream',
      status: 'trusted',
      coveragePct: 96,
      spikeCount: 0,
      limitations: [],
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
  });

  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  await expect(card).toContainText('Durability beobachten');
  await expect(card).toContainText('Nach dem Klick');
  await expect(card).toContainText('Öffnet die Durability-Evidenz');
  await card.getByRole('button', { name: 'Durability prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-power-duration');
  await expect(page.locator('#data-power-duration')).toBeVisible();
});

test('Data analysis opens decision-quality evidence from the primary learning signal', async ({ page }) => {
  await mockPulseApi(page, {
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion hat keine offene Evidenzlücke.',
      projections: [],
      missingEvidence: [],
    },
    planTrace: null,
  });

  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  await expect(card).toContainText('Entscheidungsqualität');
  await expect(card).toContainText('Hilfreich');
  await expect(card).toContainText('Wirkung: Tageshandlung');
  await expect(card).toContainText('Nach dem Klick');
  await expect(card).toContainText('Öffnet die Entscheidungsqualität');
  await card.getByRole('button', { name: 'Lernschleife prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-decision-quality');
  await expect(page.locator('#data-decision-quality')).toBeVisible();
});

test('Data analysis classifies repeated tradeoffs as weekly plan decisions', async ({ page }) => {
  await mockPulseApi(page, {
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion hat keine offene Evidenzlücke.',
      projections: [],
      missingEvidence: [],
    },
    planTrace: null,
    decisionQuality: {
      range: { from: '2026-04-18', to: '2026-05-01', days: 14 },
      qualityScore: 34,
      status: 'needs_strategy_change',
      statusLabel: 'Tageskonflikt wiederholt',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: '2026-05-01',
        status: 'stale',
        evidence: [
          '3x Tageskonflikt mit zu hartem Plan',
          '2x Abschluss als leichtere Option gelernt',
        ],
      }],
      bestEvidence: ['3x Tageskonflikt mit zu hartem Plan'],
      evidence: [],
      suggestedAdjustment: 'Diese Woche Intensitaet erst nach Warm-up freigeben und leichtere Option vorab festlegen.',
    },
  });

  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  await expect(card).toContainText('Tradeoff-Muster');
  await expect(card).toContainText('Tageskonflikte werden Wochenentscheidung');
  await expect(card).toContainText('Wirkung: Planentscheidung');
  await expect(card).toContainText('3x Tageskonflikt');
  await expect(card).toContainText('Plan und Garmin bleiben unverändert');
  await card.getByRole('button', { name: 'Wochenentscheidung prüfen' }).click();
  await expect(page).toHaveURL('/plan?tab=training&source=data-tradeoff#plan-weekly-decision');
  await expect(page.getByTestId('plan-weekly-decision-contract')).toBeVisible();
});

test('Data analysis keeps resolved tradeoff patterns quiet', async ({ page }) => {
  await mockPulseApi(page, {
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion hat keine offene Evidenzlücke.',
      projections: [],
      missingEvidence: [],
    },
    planTrace: null,
    decisionQuality: {
      range: { from: '2026-04-18', to: '2026-05-01', days: 14 },
      qualityScore: 79,
      status: 'helpful',
      statusLabel: 'Tageskonflikt bereits eingeordnet',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: '2026-05-01',
        status: 'useful_repetition',
        evidence: [
          'Wochenentscheidung gemerkt: Beibehalten trotz Tageskonflikt',
          'Tradeoff bereits in Plan eingeordnet',
        ],
      }],
      bestEvidence: ['Tageskonflikt bereits in Plan eingeordnet und als Beibehalten gemerkt'],
      evidence: [],
      suggestedAdjustment: 'Bereits gehandhabt: ruhig lassen, bis frische Evidenz Plan oder Heute erneut veraendert.',
    },
  });

  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  await expect(card).toContainText('Tradeoff-Muster');
  await expect(card).toContainText('Tageskonflikt bereits eingeordnet');
  await expect(card).toContainText('Wirkung: Watch-Kontext');
  await expect(card).toContainText('Data haelt das Muster ruhig');
  await expect(card).not.toContainText('Tageskonflikte werden Wochenentscheidung');
  await expect(card).not.toContainText('Tageskonflikt verändert Heute');
  await card.getByRole('button', { name: 'Muster prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-decision-quality');
  await expect(page.locator('#data-decision-quality')).toBeVisible();
});

test('Data analysis opens personal response evidence from the primary response signal', async ({ page }) => {
  await mockPulseApi(page, {
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion hat keine offene Evidenzlücke.',
      projections: [],
      missingEvidence: [],
    },
    planTrace: null,
    decisionQuality: null,
    personalResponse: {
      summary: {
        generatedAt: '2026-05-01T00:00:00.000Z',
        range: { from: '2026-03-20', to: '2026-05-01', days: 42 },
        strength: 'useful',
        headline: 'Pulse erkennt persönliche Reaktionsmuster.',
        signals: [{
          kind: 'mental_response',
          label: 'Mentale Last begrenzt Ausführung',
          strength: 'useful',
          summary: 'Harte Tage kippen schneller, wenn Stress hoch und Energie niedrig ist.',
          evidence: ['2 harte Tage nach Stress', '4 Check-ins im Zeitraum'],
          nextAdjustment: 'Boundary, Warm-up und Umfang zuerst begrenzen, bevor Pulse harte Arbeit bestätigt.',
        }],
        missingEvidence: [],
      },
    },
  });

  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  await expect(card).toContainText('Reaktionsmodell');
  await expect(card).toContainText('Mentale Last begrenzt Ausführung');
  await expect(card).toContainText('Nach dem Klick');
  await expect(card).toContainText('Öffnet die Reaktionsmuster');
  await card.getByRole('button', { name: 'Reaktionsmuster prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-personal-response');
  await expect(page.locator('#data-personal-response')).toBeVisible();
});

test('Data analysis exposes fueling evidence as a concrete learning loop', async ({ page }) => {
  await mockPulseApi(page, {
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion hat keine offene Evidenzlücke.',
      projections: [],
      missingEvidence: [],
    },
    planTrace: null,
    decisionQuality: null,
    personalResponse: {
      summary: {
        generatedAt: '2026-05-01T00:00:00.000Z',
        range: { from: '2026-03-20', to: '2026-05-01', days: 42 },
        strength: 'learning',
        headline: 'Pulse lernt Fueling-Reaktionen.',
        signals: [{
          kind: 'fueling_response',
          label: 'Fueling-Baseline offen',
          strength: 'learning',
          summary: 'Lange Einheiten brauchen vollständige During-Logs.',
          evidence: ['Noch zwei komplette During-Logs fehlen.'],
          nextAdjustment: 'Nächste lange Einheit mit Carbs, Dauer und GI-Komfort loggen.',
        }],
        missingEvidence: [],
      },
    },
  });

  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  await expect(card).toContainText('Fueling-Lernschleife');
  await expect(card).toContainText('Fueling-Baseline offen');
  await expect(card).toContainText('Wirkung: Tageshandlung');
  await expect(card).toContainText('Öffnet die Reaktionsmuster und Fueling-Evidenz');
  await card.getByRole('button', { name: 'Fueling-Evidenz prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-personal-response');
  await expect(page.locator('#data-personal-response')).toBeVisible();
});

test('Data analysis keeps learning calibration gated until comparable fueling evidence is complete', async ({ page }) => {
  await mockPulseApi(page, {
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion hat keine offene Evidenzlücke.',
      projections: [],
      missingEvidence: [],
    },
    planTrace: null,
    decisionQuality: {
      range: { from: '2026-04-18', to: '2026-05-01', days: 14 },
      qualityScore: 58,
      status: 'watch',
      statusLabel: 'Beobachten',
      repeatedThemes: [{ theme: 'Fueling nach langen Einheiten', count: 2, lastSeen: '2026-04-30', status: 'watch', evidence: ['2x ohne kompletten During-Log'] }],
      bestEvidence: ['Fueling-Entscheidungen wiederholen sich, aber Outcome-Evidenz ist noch offen.'],
      evidence: [],
      suggestedAdjustment: 'Noch nicht hochregeln; erst komplette Fueling-Logs schließen.',
    },
    personalResponse: {
      summary: {
        generatedAt: '2026-05-01T00:00:00.000Z',
        range: { from: '2026-03-20', to: '2026-05-01', days: 42 },
        strength: 'learning',
        headline: 'Pulse lernt Fueling-Reaktionen.',
        signals: [{
          kind: 'fueling_response',
          label: 'Fueling-Baseline offen',
          strength: 'learning',
          summary: 'Lange Einheiten brauchen vollständige During-Logs.',
          evidence: ['Noch ein kompletter During-Log fehlt.'],
          nextAdjustment: 'GI-Komfort am vorhandenen Long-Run-Log ergänzen.',
        }],
        missingEvidence: [],
      },
    },
    outcomeBaseline: {
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
      trendSummary: 'Fueling-Trend: 3/3 komplette During-Logs, Schnitt 58 g/h; GI stabil.',
      evidence: ['2 lange During-Logs vollständig'],
      learningReadiness: {
        comparableCompleteLogs: 2,
        requiredComparableCompleteLogs: 3,
        readyForTrendSummary: false,
        missingEvidence: ['GI-Komfort fehlt strukturiert beim vorhandenen Carb-Log.'],
        nextAction: {
          kind: 'complete_gi_comfort',
          label: 'GI-Komfort ergänzen',
          detail: 'GI-Komfort am vorhandenen Long-Run-Log ergänzen.',
          activityId: 'activity-fueling-gap',
        },
      },
    },
  });

  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  await expect(card).toContainText('Lernkalibrierung');
  await expect(card).toContainText('Noch nicht kalibrieren');
  await expect(card).toContainText('Wirkung: Watch-Kontext');
  await expect(card).toContainText('Trend-Evidenz 2/3');
  await expect(card).toContainText('GI-Komfort ergänzen');
  await expect(card).not.toContainText('Fueling-Trend:');

  await card.getByRole('button', { name: 'GI-Komfort ergänzen' }).click();
  await expect(page).toHaveURL('/plan/activity/activity-fueling-gap#activity-fueling-log');
});

test('Data today promotes actionable fueling learning gaps', async ({ page }) => {
  await mockPulseApi(page, {
    outcomeBaseline: {
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
      trendSummary: 'Fueling-Trend: 3/3 komplette During-Logs, Schnitt 58 g/h; GI stabil.',
      evidence: ['2 lange During-Logs vollständig'],
      learningReadiness: {
        comparableCompleteLogs: 2,
        requiredComparableCompleteLogs: 3,
        readyForTrendSummary: false,
        missingEvidence: ['GI-Komfort fehlt strukturiert beim vorhandenen Carb-Log.'],
        nextAction: {
          kind: 'complete_gi_comfort',
          label: 'GI-Komfort ergänzen',
          detail: 'GI-Komfort am vorhandenen Long-Run-Log ergänzen.',
          activityId: 'activity-fueling-gap',
        },
      },
    },
  });

  await page.goto('/data');
  const action = page.getByTestId('data-primary-action');

  await expect(action).toContainText('Fueling-Evidenz schließen');
  await expect(action).toContainText('Trend-Evidenz 2/3');
  await expect(action).toContainText('GI-Komfort ergänzen');

  await page.getByRole('button', { name: 'Weitere Datenbereiche anzeigen' }).click();
  const triage = page.getByTestId('data-triage-fueling');
  await expect(triage).toContainText('Fueling-Evidenz');
  await expect(triage).toContainText('Trend-Evidenz 2/3');

  await action.getByRole('button', { name: 'GI-Komfort ergänzen' }).click();
  await expect(page).toHaveURL('/plan/activity/activity-fueling-gap#activity-fueling-log');
});

test('Data analysis opens personal response evidence from the watch response signal', async ({ page }) => {
  await mockPulseApi(page, {
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion hat keine offene Evidenzlücke.',
      projections: [],
      missingEvidence: [],
    },
    planTrace: null,
    powerDataQuality: {
      source: 'stream',
      status: 'trusted',
      coveragePct: 98,
      spikeCount: 0,
      limitations: [],
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
    powerDuration: {
      bestEfforts: [],
      durability: {
        rating: 'strong',
        powerDropPct: -4,
        hrDriftBpm: 1,
        evidence: ['Power stabil', 'HR +1 bpm'],
        activityId: 'activity-power-duration',
        activityDate: '2026-05-01',
        qualitySource: 'stream',
        qualityStatus: 'trusted',
      },
      bestEffortLine: 'Power-Evidenz stabil',
      durabilityLine: 'Durability stabil genug.',
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
    personalResponse: {
      summary: {
        generatedAt: '2026-05-01T00:00:00.000Z',
        range: { from: '2026-03-20', to: '2026-05-01', days: 42 },
        strength: 'learning',
        headline: 'Pulse sammelt Reaktionsmuster.',
        signals: [],
        missingEvidence: ['Noch zwei vergleichbare harte Tage mit Check-in und RPE fehlen.'],
      },
    },
  });

  await page.goto('/data?tab=analysis');
  const card = page.getByTestId('analysis-translation-card');

  await expect(card).toContainText('Entscheidungsqualität');
  await expect(card).toContainText('Lernsignal offen');
  await expect(card).toContainText('Noch zwei vergleichbare harte Tage');
  await expect(card).toContainText('Öffnet die Reaktionsmuster');
  await card.getByRole('button', { name: 'Reaktionsmuster prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-personal-response');
  await expect(page.locator('#data-personal-response')).toBeVisible();
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
  const weeklyDecision = page.getByTestId('plan-weekly-decision-contract');
  await expect(weeklyDecision).toBeVisible();
  await expect(weeklyDecision).toContainText('Wochenentscheidung offen');
  await expect(weeklyDecision).toContainText('Garmin');
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-option-accept_current')).toContainText('Aktuelle Woche bewusst akzeptieren');
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-active-preview')).toContainText('Wochenvorschau pruefen');
  await weeklyDecision.getByRole('button', { name: /Aktuelle Woche bewusst akzeptieren/ }).click();
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-option-accept_current')).toHaveAttribute('aria-pressed', 'true');
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-active-preview')).toContainText('keine Plan- oder Garmin-Aenderung');
  await weeklyDecision.getByRole('button', { name: /Wochenvorschau pruefen/ }).click();
  await expect(page).toHaveURL(/#plan-scenario-preview$/);
  await expect(page.getByTestId('plan-scenario-preview-card')).toBeInViewport();

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

test('Plan weekly decision surfaces repeated tradeoffs without applying plan or Garmin', async ({ page }, testInfo) => {
  const writeRequests: string[] = [];
  await mockPulseApi(page, {
    planWorkouts: [{
      id: 'plan-learning-calibration',
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
    decisionQuality: {
      range: { from: '2026-04-18', to: '2026-05-01', days: 14 },
      qualityScore: 31,
      status: 'needs_strategy_change',
      statusLabel: 'Tageskonflikt wiederholt',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: '2026-05-01',
        status: 'stale',
        evidence: [
          '3x Tageskonflikt mit zu hartem Plan und kleinerem Alltagsfenster',
          '2x Abschluss als leichtere Option gelernt',
        ],
      }],
      bestEvidence: ['3x Tageskonflikt mit zu hartem Plan und kleinerem Alltagsfenster'],
      evidence: [],
      suggestedAdjustment: 'Diese Woche Intensitaet erst nach Warm-up freigeben und eine leichtere Option vorab festlegen.',
    },
    outcomeBaseline: {
      status: 'learning',
      label: 'Fueling-Baseline lernt',
      summary: 'Fueling-Reaktionen werden gesammelt.',
      latestLogDate: '2026-04-30',
      observedCarbsPerHour: 58,
      targetCarbsPerHour: { min: 60, max: 75 },
      bottles750Ml: null,
      powderG: null,
      fluidMlPerHour: null,
      sodiumMgPerHour: null,
      trendSummary: 'Fueling-Trend: 3/3 komplette During-Logs, Schnitt 58 g/h; GI stabil.',
      evidence: ['Fueling-Trend: 3/3 komplette During-Logs, Schnitt 58 g/h; GI stabil.'],
      learningReadiness: {
        comparableCompleteLogs: 3,
        requiredComparableCompleteLogs: 3,
        readyForTrendSummary: true,
        missingEvidence: [],
      },
    },
    onRequest: (path, method) => {
      if (method !== 'GET' && method !== 'OPTIONS') {
        writeRequests.push(`${method} ${path}`);
      }
    },
  });

  await page.goto('/plan');

  const weeklyDecision = page.getByTestId('plan-weekly-decision-contract');
  await expect(weeklyDecision).toBeVisible();
  await expect(weeklyDecision).toContainText('Wochenentscheidung offen');
  await expect(weeklyDecision).toContainText('Tageskonflikte verändern die Woche');
  await expect(weeklyDecision).toContainText('Wiederholter Tageskonflikt');
  await expect(weeklyDecision).toContainText('3x Tageskonflikt');
  await expect(weeklyDecision).toContainText('Intensitaet erst nach Warm-up');
  await expect(weeklyDecision).toContainText('Plan und Garmin bleiben unverändert');
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-option-accept_current')).toContainText('trotz wiederholter Tageskonflikte');
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-option-adapt_week')).toContainText('wiederholte Tageskonflikte');
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-active-preview')).toContainText('erst ein explizites Anwenden');
  if (testInfo.project.name === 'mobile-chromium') {
    const learnedBox = await weeklyDecision.getByTestId('plan-weekly-decision-section-learned').boundingBox();
    const changedBox = await weeklyDecision.getByTestId('plan-weekly-decision-section-changed').boundingBox();
    expect(learnedBox).not.toBeNull();
    expect(changedBox).not.toBeNull();
    expect(changedBox!.y).toBeGreaterThanOrEqual(learnedBox!.y + learnedBox!.height + 6);
  }

  writeRequests.length = 0;
  await weeklyDecision.getByRole('button', { name: 'Entscheidung merken', exact: true }).click();
  expect(writeRequests).toEqual([]);
  const receipt = weeklyDecision.getByTestId('plan-weekly-decision-receipt');
  await expect(receipt).toContainText('Keine Plan- oder Garmin-Aenderung gespeichert');
  await expect(receipt).toContainText('Tageskonflikt Wochenentscheidung');
});

test('Plan weekly decision keeps today tradeoff learning out of weekly change', async ({ page }) => {
  const writeRequests: string[] = [];
  await mockPulseApi(page, {
    planWorkouts: [{
      id: 'plan-today-tradeoff',
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
      garminWorkoutId: 'garmin-plan-today-tradeoff',
      garminScheduledId: 'schedule-plan-today-tradeoff',
      executionStatus: 'garmin_scheduled',
    }],
    personalResponse: null,
    outcomeBaseline: null,
    goalProjection: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion hat keine offene Wochenintervention.',
      projections: [],
      missingEvidence: [],
    },
    decisionQuality: {
      range: { from: '2026-04-18', to: '2026-05-01', days: 14 },
      qualityScore: 78,
      status: 'helpful',
      statusLabel: 'Tageskonflikt hilft heute',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 2,
        lastSeen: '2026-05-01',
        status: 'useful_repetition',
        evidence: ['2x leichtere Option hat Folgetag-RPE gesenkt'],
      }],
      bestEvidence: ['2x leichtere Option hat Folgetag-RPE gesenkt'],
      evidence: [],
      suggestedAdjustment: 'Heute zuerst die leichtere Option bestaetigen, wenn Schlaf und Alltag eng sind.',
    },
    onRequest: (path, method) => {
      if (method !== 'GET' && method !== 'OPTIONS') {
        writeRequests.push(`${method} ${path}`);
      }
    },
  });

  await page.goto('/plan');

  const weeklyDecision = page.getByTestId('plan-weekly-decision-contract');
  await expect(weeklyDecision).toBeVisible();
  await expect(weeklyDecision).toContainText('Woche aktuell stabil');
  await expect(weeklyDecision).toContainText('Tageskonflikt bleibt Heute-Kontext');
  await expect(weeklyDecision).toContainText('Heute veraendert');
  await expect(weeklyDecision).toContainText('keine Wochenentscheidung');
  await expect(weeklyDecision).not.toContainText('Wochenentscheidung offen');
  await expect(weeklyDecision).not.toContainText('Tageskonflikte verändern die Woche');
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-option-accept_current')).not.toContainText('trotz wiederholter Tageskonflikte');
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-option-adapt_week')).not.toContainText('wiederholte Tageskonflikte');

  writeRequests.length = 0;
  await weeklyDecision.getByRole('button', { name: 'Entscheidung merken', exact: true }).click();
  expect(writeRequests).toEqual([]);
  const receipt = weeklyDecision.getByTestId('plan-weekly-decision-receipt');
  await expect(receipt).toContainText('Tageskonflikt Watch-Kontext');
  await expect(receipt).toContainText('Keine Plan- oder Garmin-Aenderung gespeichert');
});

test('Plan weekly decision stores a local receipt without applying plan or Garmin', async ({ page }) => {
  const writeRequests: string[] = [];
  await mockPulseApi(page, {
    planWorkouts: [{
      id: 'plan-receipt-contract',
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
    onRequest: (path, method) => {
      if (method !== 'GET' && method !== 'OPTIONS') {
        writeRequests.push(`${method} ${path}`);
      }
    },
  });
  await page.goto('/plan');

  const weeklyDecision = page.getByTestId('plan-weekly-decision-contract');
  await expect(weeklyDecision).toBeVisible();
  writeRequests.length = 0;

  await weeklyDecision.getByRole('button', { name: /Aktuelle Woche bewusst akzeptieren/ }).click();
  await weeklyDecision.getByRole('button', { name: 'Entscheidung merken', exact: true }).click();

  expect(writeRequests).toEqual([]);
  const receipt = weeklyDecision.getByTestId('plan-weekly-decision-receipt');
  await expect(receipt).toContainText('Beibehalten gemerkt');
  await expect(receipt).toContainText('Woche bleibt wie gewaehlt');
  await expect(receipt).toContainText('Keine Plan- oder Garmin-Aenderung gespeichert');

  await page.reload();
  const reloadedWeeklyDecision = page.getByTestId('plan-weekly-decision-contract');
  await expect(reloadedWeeklyDecision.getByTestId('plan-weekly-decision-receipt')).toContainText('Beibehalten gemerkt');

  await page.goto('/data');
  await page.getByRole('button', { name: 'Weitere Datenbereiche anzeigen' }).click();
  await page.getByTestId('data-triage-plan-load').click();
  await expect(page).toHaveURL('/plan?tab=training&source=data-load#plan-weekly-decision');
  await expect(page.getByTestId('plan-weekly-decision-receipt')).toContainText('Beibehalten gemerkt');
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
  const weeklyDecision = inbox.getByTestId('plan-weekly-decision-contract');
  await expect(weeklyDecision).toContainText('Wochenentscheidung');
  await expect(weeklyDecision).toContainText('Was die Woche veraendert');
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-option-accept_current')).toContainText('Beibehalten');
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-option-adapt_week')).toContainText('TSS -40');
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-option-defer_decision')).toContainText('keine Plan- oder Garmin-Aenderung');
  await expect(weeklyDecision.getByTestId('plan-weekly-decision-active-preview')).toContainText('TSS -40');
  await weeklyDecision.getByRole('button', { name: /Wochenvorschau pruefen/ }).click();
  await expect(page).toHaveURL(/#plan-refresh-preview-card$/);
  await expect(page.getByTestId('plan-refresh-preview-card')).toBeInViewport();

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
        reasons: ['Alltagsanpassung bleibt nur Vorschau bis zur expliziten Anwendung.'],
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

test('Home daily decision opens strong learning calibration from Data evidence', async ({ page }) => {
  await mockPulseApi(page, {
    decisionQuality: {
      range: { from: '2026-04-18', to: '2026-05-01', days: 14 },
      qualityScore: 34,
      status: 'needs_strategy_change',
      statusLabel: 'Strategie ändern',
      repeatedThemes: [{
        theme: 'Zu spaet intensive Optionen gewählt',
        count: 3,
        lastSeen: '2026-05-01',
        status: 'stale',
        evidence: ['3x harte Alternative nach schlechtem Warm-up gewählt'],
      }],
      bestEvidence: ['3x harte Alternative nach schlechtem Warm-up gewählt'],
      evidence: [],
      suggestedAdjustment: 'Heute zuerst kleinere Option festlegen und Intensität erst nach Warm-up freigeben.',
    },
  });

  await page.goto('/');
  const decision = page.getByTestId('daily-decision-card');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Lernkalibrierung');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Entscheidungsmuster ändern');
  await expect(decision.getByTestId('daily-decision-leading-factor')).not.toContainText('Empfehlung darf lernen');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Heute zuerst kleinere Option');
  await expect(decision.getByTestId('daily-decision-safest-option')).toContainText('Lernkalibrierung zuerst prüfen');
  await expect(decision.getByTestId('daily-decision-safest-option')).toContainText('kleinere Option zuerst festlegen');
  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();
  await expect(decision.getByTestId('daily-decision-contract')).toContainText('Lernkalibrierung');
  await expect(decision).toContainText('Lern-Evidenz als Tageshandlung');

  await decision.getByRole('button', { name: 'Kalibrierung prüfen', exact: true }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-decision-quality');
  await expect(page.locator('#data-decision-quality')).toBeVisible();
});

test('Home daily decision keeps on-track goal progress as quiet motivation', async ({ page }) => {
  await mockPulseApi(page, {
    goalProjection: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      horizonDays: 180,
      headline: '70.3 Kraichgau ist auf Kurs.',
      projections: [{
        goalId: 'goal-703',
        title: '70.3 Kraichgau',
        category: 'race',
        targetDate: '2026-06-14',
        daysUntil: 44,
        probabilityPct: 78,
        status: 'on_track',
        confidence: 'medium',
        summary: 'Ziel ist auf Kurs; die aktuelle Woche haelt den Aufbau stabil.',
        limiterRisk: {
          status: 'clear',
          label: 'Kein dominanter Limiter',
          summary: 'Kein dominanter Ziel-Limiter begrenzt die Projektion.',
          evidence: ['Zielsignal stabil'],
        },
        nextBestIntervention: {
          kind: 'consistency',
          title: 'Zielrhythmus halten',
          summary: 'Ruhig weitertrainieren und keine neue Planentscheidung erzwingen.',
          actionLabel: 'Zielprojektion prüfen',
          targetPath: '/data?tab=analysis#data-goal-projection',
          evidence: ['Zielsignal stabil'],
        },
        evidence: ['Zielsignal stabil'],
        missingEvidence: [],
      }],
      missingEvidence: [],
    },
  });

  await page.goto('/');
  const decision = page.getByTestId('daily-decision-card');
  await expect(decision.getByTestId('daily-decision-leading-factor')).not.toContainText('Ziel-Fortschritt');
  await expect(decision.getByTestId('daily-decision-leading-factor')).not.toContainText('70.3 Kraichgau');
  await expect(decision.getByTestId('daily-decision-safest-option')).not.toContainText('Ziel-Fortschritt');
  await expect(decision.getByTestId('daily-decision-continuity')).toContainText('Ziel-Fortschritt stabil');
  await expect(decision.getByTestId('daily-decision-continuity')).toContainText('70.3 Kraichgau 78%');
  await expect(decision.getByTestId('daily-decision-continuity')).toContainText('bleibt Data-Evidenz');
  await expect(decision.getByTestId('daily-decision-continuity')).not.toContainText('aktuelle Woche haelt den Aufbau stabil');
  await expect(decision.getByTestId('daily-decision-continuity')).not.toContainText('Kein dominanter Ziel-Limiter');

  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();
  await expect(decision).toContainText('Ziel-Fortschritt stabil: 70.3 Kraichgau 78%');
  await decision.getByRole('button', { name: /Ziel-Fortschritt stabil/ }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-goal-projection');
});

test('Home daily decision uses repeated tradeoff learning for todays adaptive option', async ({ page }) => {
  const plannedWorkout = {
    id: 'planned-default',
    userId: 'user-1',
    plannedDate: '2026-05-01',
    activityType: 'bike',
    zone: 2,
    durationMin: 75,
    distanceKm: null,
    targetTss: 62,
    archetypeId: 'endurance_steady',
    difficultyLevel: 3.1,
    difficultyEnergySystem: 'endurance',
    capabilityFit: 'productive',
    description: 'Ruhige Ausdauer.',
    steps: null,
    garminWorkoutId: 'garmin-planned-default',
    garminScheduledId: 'schedule-planned-default',
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
  };

  await mockPulseApi(page, {
    home: { todayWorkout: plannedWorkout },
    todayOptionsState: 'planned_workout',
    personalResponse: null,
    powerDataQuality: {
      source: 'stream',
      status: 'trusted',
      coveragePct: 98,
      spikeCount: 0,
      limitations: [],
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
    powerDuration: {
      bestEfforts: [],
      durability: {
        rating: 'strong',
        powerDropPct: -4,
        hrDriftBpm: 1,
        evidence: ['Power stabil', 'HR +1 bpm'],
        activityId: null,
        activityDate: '2026-05-01',
        qualitySource: 'stream',
        qualityStatus: 'trusted',
      },
      bestEffortLine: '20 min 215 W',
      durabilityLine: 'Durability strong: Power stabil · HR +1 bpm',
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
    goalProjection: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion hat keine offene Tagesintervention.',
      projections: [],
      missingEvidence: [],
    },
    decisionQuality: {
      range: { from: '2026-04-18', to: '2026-05-01', days: 14 },
      qualityScore: 82,
      status: 'helpful',
      statusLabel: 'Tageskonflikt mit neuer heutiger Evidenz',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 4,
        lastSeen: '2026-05-01',
        status: 'useful_repetition',
        evidence: [
          'Tageskonflikt bereits in Plan eingeordnet',
          'Neue Evidenz seit gemerkter Tagesentscheidung: 2x Recovery nach harter Einheit niedrig',
        ],
      }],
      bestEvidence: ['Wiederholter Reopen-Grund: Recovery 2x mit niedrigem HRV und schlechtem Schlaf'],
      evidence: [],
      suggestedAdjustment: 'Heute leichtere Option wegen wiederholter Recovery-Reopens bestaetigen; alte Plan-Einordnung bleibt Kontext.',
    },
  });

  await page.goto('/');
  const decision = page.getByTestId('daily-decision-card');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Tageskonflikt');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Frische Heute-Evidenz');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Recovery nach harter Einheit niedrig');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Reopen-Quellentrend: Recovery 2x');
  await expect(decision.getByTestId('daily-decision-leading-factor')).not.toContainText('Wiederholter Reopen-Grund');
  await expect(decision.getByTestId('daily-decision-leading-factor')).not.toContainText('Lernkalibrierung');
  await expect(decision.getByTestId('daily-decision-safest-option')).toContainText('Tageskonflikt-Lernen heute nutzen');
  await expect(decision.getByTestId('daily-decision-safest-option')).toContainText('Reopen-Quellentrend: Recovery 2x');
  await expect(decision.getByTestId('daily-decision-safest-option')).toContainText('Leichtere Alternative');
  await expect(decision.getByTestId('daily-decision-continuity')).toContainText('Geloester Tageskonflikt bleibt Kontext');

  await decision.getByRole('button', { name: 'Plan anpassen', exact: true }).click();
  await expect(page).toHaveURL('/plan?tab=training&source=today-change&intent=easier&workoutId=planned-default#next-training-decision');
});

test('Home daily decision keeps resolved tradeoff learning as continuity', async ({ page }) => {
  const plannedWorkout = {
    id: 'planned-resolved-tradeoff',
    userId: 'user-1',
    plannedDate: '2026-05-01',
    activityType: 'bike',
    zone: 2,
    durationMin: 75,
    distanceKm: null,
    targetTss: 62,
    archetypeId: 'endurance_steady',
    difficultyLevel: 3.1,
    difficultyEnergySystem: 'endurance',
    capabilityFit: 'productive',
    description: 'Ruhige Ausdauer.',
    steps: null,
    garminWorkoutId: 'garmin-planned-resolved',
    garminScheduledId: 'schedule-planned-resolved',
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
  };

  await mockPulseApi(page, {
    home: { todayWorkout: plannedWorkout },
    todayOptionsState: 'planned_workout',
    personalResponse: null,
    powerDataQuality: {
      source: 'stream',
      status: 'trusted',
      coveragePct: 98,
      spikeCount: 0,
      limitations: [],
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
    powerDuration: {
      bestEfforts: [],
      durability: {
        rating: 'strong',
        powerDropPct: -4,
        hrDriftBpm: 1,
        evidence: ['Power stabil', 'HR +1 bpm'],
        activityId: null,
        activityDate: '2026-05-01',
        qualitySource: 'stream',
        qualityStatus: 'trusted',
      },
      bestEffortLine: '20 min 215 W',
      durabilityLine: 'Durability strong: Power stabil · HR +1 bpm',
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
    goalProjection: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      horizonDays: 180,
      headline: 'Zielprojektion hat keine offene Tagesintervention.',
      projections: [],
      missingEvidence: [],
    },
    decisionQuality: {
      range: { from: '2026-04-18', to: '2026-05-01', days: 14 },
      qualityScore: 79,
      status: 'helpful',
      statusLabel: 'Tageskonflikt bereits eingeordnet',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: '2026-05-01',
        status: 'useful_repetition',
        evidence: [
          'Wochenentscheidung gemerkt: Beibehalten trotz Tageskonflikt',
          'Tradeoff bereits in Plan eingeordnet',
        ],
      }],
      bestEvidence: ['Tageskonflikt bereits in Plan eingeordnet und als Beibehalten gemerkt'],
      evidence: [],
      suggestedAdjustment: 'Bereits gehandhabt: ruhig lassen, bis frische Evidenz Heute oder Plan erneut veraendert.',
    },
  });

  await page.goto('/');
  const decision = page.getByTestId('daily-decision-card');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Training');
  await expect(decision.getByTestId('daily-decision-leading-factor')).not.toContainText('Tageskonflikt');
  await expect(decision.getByTestId('daily-decision-safest-option')).not.toContainText('Tageskonflikt-Lernen');
  await expect(decision.getByTestId('daily-decision-safest-option')).not.toContainText('Lernkalibrierung');
  await expect(decision.getByTestId('daily-decision-continuity')).toContainText('Geloester Tageskonflikt bleibt ruhig');

  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();
  await expect(decision.getByTestId('daily-decision-contract')).not.toContainText('Watch-Kontext: 3x Tageskonflikt');
  await expect(decision).toContainText('Geloester Tageskonflikt: 3x Tageskonflikt');

  await decision.getByRole('button', { name: 'Workout öffnen', exact: true }).click();
  await expect(page).toHaveURL('/plan?tab=training');
});

test('Home daily decision opens the body goal everyday tradeoff as one safe option', async ({ page }) => {
  const plannedWorkout = {
    id: 'home-tradeoff-workout',
    userId: 'user-1',
    plannedDate: '2026-05-01',
    activityType: 'bike',
    zone: 4,
    durationMin: 75,
    distanceKm: null,
    targetTss: 96,
    archetypeId: 'threshold_build',
    difficultyLevel: 4.4,
    difficultyEnergySystem: 'threshold',
    capabilityFit: 'too_hard_today',
    description: 'Schwellenreiz fuer das Ziel.',
    steps: null,
    garminWorkoutId: 'garmin-home-tradeoff',
    garminScheduledId: 'schedule-home-tradeoff',
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
  };
  const easierPath = '/plan?tab=training&source=today-change&intent=easier&workoutId=home-tradeoff-workout#next-training-decision';

  await mockPulseApi(page, {
    home: {
      todayWorkout: plannedWorkout,
      recovery: {
        sleepDebt7d: { hours: 2.4, targetH: 7.5, baselineSource: 'garmin_sleep_need', status: 'mild' },
        hrvDeviation7d: { pct: 2, recentMs: 51, baselineMs: 50, status: 'stable' },
        rhrDrift7d: { bpmAboveBaseline: 1, recent: 49, baseline: 48, status: 'normal' },
        recoveryScore: 62,
        recommendation: 'Heute Grenze klein halten.',
      },
    },
    goalProjection: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      horizonDays: 180,
      headline: '70.3 Kraichgau braucht Fueling-Praxis.',
      projections: [{
        goalId: 'goal-703',
        title: '70.3 Kraichgau',
        category: 'race',
        targetDate: '2026-06-14',
        daysUntil: 44,
        probabilityPct: 48,
        status: 'at_risk',
        confidence: 'medium',
        summary: 'Long-Endurance und Fueling sind noch nicht belastbar genug.',
        limiterRisk: {
          status: 'blocked',
          label: 'Fueling-Limiter',
          summary: 'GI- und During-Logs fehlen fuer lange Einheiten.',
          evidence: ['1/3 vergleichbare Logs'],
        },
        nextBestIntervention: {
          kind: 'fueling_practice',
          title: 'Fueling-Praxis absichern',
          summary: 'Die naechste lange Einheit sollte kontrolliert Fueling und GI-Vertraeglichkeit schliessen.',
          actionLabel: 'Plan prüfen',
          targetPath: '/plan?tab=training#goal-projection',
          evidence: ['Long-Endurance-Level 3.1', '1 kontrollierter During-Log'],
        },
        evidence: ['Ziel in 44 Tagen'],
        missingEvidence: ['Fueling-Vertraeglichkeit offen'],
      }],
      missingEvidence: [],
    },
    todayOptions: {
      todayOptions: {
        date: '2026-05-01',
        state: 'planned_workout',
        summary: 'Heute ist Training geplant; Pulse zeigt Plan und alltagstaugliche Ausweichoption.',
        signature: 'home-tradeoff-options',
        options: [
          {
            id: 'home-tradeoff-primary',
            kind: 'workout',
            priority: 'primary',
            title: 'Plan ausführen',
            detail: '75 min Z4. Nur sinnvoll, wenn Warm-up und Tagesfenster passen.',
            cta: 'Workout öffnen',
            targetPath: '/plan?tab=training',
            evidence: ['Zielreiz geplant'],
            activityType: 'bike',
            zone: 4,
            durationMin: 75,
            archetypeId: 'threshold_build',
            capabilityFit: 'too_hard_today',
            signalLabels: [{ kind: 'fit_too_hard_today', label: 'Zu hart heute', detail: 'Warm-up und Recovery muessen die Freigabe liefern', tone: 'rose' }],
          },
          {
            id: 'home-tradeoff-easier',
            kind: 'workout',
            priority: 'secondary',
            title: '45 min Z2 statt Schwelle',
            detail: 'Erhaelt Routine und Zielkontakt, ohne den Tag zu ueberziehen.',
            cta: 'Alternative prüfen',
            targetPath: easierPath,
            evidence: ['Schlafdefizit', 'Alltagsfenster kleiner'],
            activityType: 'bike',
            zone: 2,
            durationMin: 45,
            archetypeId: 'recovery_spin',
            capabilityFit: 'maintenance',
            signalLabels: [{ kind: 'fit_maintenance', label: 'Machbar', detail: 'Erhaltung statt Progression', tone: 'green' }],
          },
        ],
      },
    },
  });

  await page.goto('/');
  const decision = page.getByTestId('daily-decision-card');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Tageskonflikt');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Koerper: Schlafdefizit: 2.4 h');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Ziel: 70.3 Kraichgau: 48%');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Alltag: 45 min Z2 statt Schwelle');
  await expect(decision.getByTestId('daily-decision-safest-option')).toContainText('Tageskonflikt zuerst lösen');
  await expect(decision.getByTestId('daily-decision-safest-option')).toContainText('alltagstaugliche Alternative');

  await decision.getByRole('button', { name: 'Alternative prüfen', exact: true }).click();
  await expect(page).toHaveURL(/source=today-change.*#next-training-decision$/);
});

test('Home daily decision closes completed body goal everyday tradeoffs as learning evidence', async ({ page }) => {
  const completedActivity = {
    id: 'activity-home-tradeoff-closure',
    userId: 'user-1',
    externalId: 'garmin-activity-home-tradeoff-closure',
    source: 'garmin',
    startTime: '2026-05-01T08:00:00.000Z',
    activityType: 'bike',
    name: '45 min Z2 statt Schwelle',
    durationSec: 45 * 60,
    distanceM: 21000,
    avgHr: 132,
    maxHr: 151,
    avgPowerW: 148,
    normalizedPowerW: 156,
    tss: 38,
    calories: 520,
    elevationGainM: 120,
    trainingEffectAerobic: 2.2,
    trainingEffectAnaerobic: 0,
    vo2maxEstimate: null,
    rpe: null,
    rpeNote: null,
    sorenessAreas: null,
    feedbackLoggedAt: null,
    plannedWorkoutId: 'home-tradeoff-closure-workout',
  };
  const plannedWorkout = {
    id: 'home-tradeoff-closure-workout',
    userId: 'user-1',
    plannedDate: '2026-05-01',
    activityType: 'bike',
    zone: 4,
    durationMin: 75,
    distanceKm: null,
    targetTss: 96,
    archetypeId: 'threshold_build',
    difficultyLevel: 4.4,
    difficultyEnergySystem: 'threshold',
    capabilityFit: 'too_hard_today',
    description: 'Schwellenreiz fuer das Ziel.',
    steps: null,
    garminWorkoutId: 'garmin-home-tradeoff-closure',
    garminScheduledId: 'schedule-home-tradeoff-closure',
    garminSyncContract: null,
    status: 'completed',
    workoutFeedback: null,
    complianceScore: null,
    origin: 'generated',
    userLocked: false,
    completedActivityId: completedActivity.id,
    executionStatus: 'completed_matched',
    executionMatchedAt: '2026-05-01T08:55:00.000Z',
    executionMatchConfidence: 0.92,
    executionNotes: null,
  };

  await mockPulseApi(page, {
    home: {
      todayWorkout: plannedWorkout,
      todayActivities: [completedActivity],
      recentActivities: [completedActivity],
      recovery: {
        sleepDebt7d: { hours: 2.4, targetH: 7.5, baselineSource: 'garmin_sleep_need', status: 'mild' },
        hrvDeviation7d: { pct: 2, recentMs: 51, baselineMs: 50, status: 'stable' },
        rhrDrift7d: { bpmAboveBaseline: 1, recent: 49, baseline: 48, status: 'normal' },
        recoveryScore: 62,
        recommendation: 'Heute Grenze klein halten.',
      },
    },
    goalProjection: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      horizonDays: 180,
      headline: '70.3 Kraichgau braucht Fueling-Praxis.',
      projections: [{
        goalId: 'goal-703',
        title: '70.3 Kraichgau',
        category: 'race',
        targetDate: '2026-06-14',
        daysUntil: 44,
        probabilityPct: 48,
        status: 'at_risk',
        confidence: 'medium',
        summary: 'Long-Endurance und Fueling sind noch nicht belastbar genug.',
        limiterRisk: { status: 'blocked', label: 'Fueling-Limiter', summary: 'GI- und During-Logs fehlen fuer lange Einheiten.', evidence: ['1/3 vergleichbare Logs'] },
        nextBestIntervention: {
          kind: 'fueling_practice',
          title: 'Fueling-Praxis absichern',
          summary: 'Die naechste lange Einheit sollte kontrolliert Fueling und GI-Vertraeglichkeit schliessen.',
          actionLabel: 'Plan prüfen',
          targetPath: '/plan?tab=training#goal-projection',
          evidence: ['Long-Endurance-Level 3.1', '1 kontrollierter During-Log'],
        },
        evidence: ['Ziel in 44 Tagen'],
        missingEvidence: ['Fueling-Vertraeglichkeit offen'],
      }],
      missingEvidence: [],
    },
    todayOptions: {
      todayOptions: {
        date: '2026-05-01',
        state: 'planned_workout',
        summary: 'Heute ist Training geplant; Pulse zeigt Plan und alltagstaugliche Ausweichoption.',
        signature: 'home-tradeoff-closure-options',
        options: [
          {
            id: 'home-tradeoff-closure-primary',
            kind: 'workout',
            priority: 'primary',
            title: 'Plan ausführen',
            detail: '75 min Z4. Nur sinnvoll, wenn Warm-up und Tagesfenster passen.',
            cta: 'Workout öffnen',
            targetPath: '/plan?tab=training',
            evidence: ['Zielreiz geplant'],
            activityType: 'bike',
            zone: 4,
            durationMin: 75,
            archetypeId: 'threshold_build',
            capabilityFit: 'too_hard_today',
            signalLabels: [{ kind: 'fit_too_hard_today', label: 'Zu hart heute', detail: 'Warm-up und Recovery muessen die Freigabe liefern', tone: 'rose' }],
          },
          {
            id: 'home-tradeoff-closure-easier',
            kind: 'workout',
            priority: 'secondary',
            title: '45 min Z2 statt Schwelle',
            detail: 'Erhaelt Routine und Zielkontakt, ohne den Tag zu ueberziehen.',
            cta: 'Alternative prüfen',
            targetPath: '/plan?tab=training&source=today-change&intent=easier&workoutId=home-tradeoff-closure-workout#next-training-decision',
            evidence: ['Schlafdefizit', 'Alltagsfenster kleiner'],
            activityType: 'bike',
            zone: 2,
            durationMin: 45,
            archetypeId: 'recovery_spin',
            capabilityFit: 'maintenance',
            signalLabels: [{ kind: 'fit_maintenance', label: 'Machbar', detail: 'Erhaltung statt Progression', tone: 'green' }],
          },
        ],
      },
    },
    dailyDelta: [{
      date: '2026-05-01',
      status: 'replaced',
      title: 'Schwelle wurde als 45 min Z2 geschlossen',
      summary: 'Die alltagstaugliche Alternative wurde statt des harten Reizes erledigt.',
      score: 72,
      loadDeltaTss: -58,
      recoveryDelta: null,
      nextPlanEffect: 'Plan kann den Zielkontakt halten, muss aber die naechste Intensitaet bewusst bestaetigen.',
      evidence: ['Geplant: Rad Z4 75 min', 'Garmin: Rad Z2 45 min'],
      targetPath: '/plan/activity/activity-home-tradeoff-closure',
    }],
    activityDetail: {
      activity: completedActivity,
      fueling: null,
      weather: null,
      plannedWorkout,
    },
  });

  await page.goto('/');
  const decision = page.getByTestId('daily-decision-card');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Tageskonflikt');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Abschluss lernbar');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Schwelle wurde als 45 min Z2 geschlossen');
  await expect(decision.getByTestId('daily-decision-safest-option')).toContainText('Tageskonflikt-Abschluss zuerst schließen');
  await expect(decision).toContainText('wird jetzt zur Lernschleife');

  await decision.getByRole('button', { name: 'Feedback erfassen', exact: true }).click();
  await expect(page).toHaveURL('/plan/activity/activity-home-tradeoff-closure');
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
        reasons: ['Mobile Intent bleibt nur Vorschau bis zur expliziten Anwendung.'],
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
  await expect(scenarioCard).toContainText('Nur Vorschau');
  await expect(scenarioCard).not.toContainText('Preview-only');
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

test('service worker navigation fallback explains local server or VPN outage', async () => {
  const source = await fs.readFile(path.resolve(process.cwd(), 'frontend/public/sw.js'), 'utf8');
  const listeners = new Map<string, (event: {
    request: { mode: string };
    respondWith: (response: Promise<Response>) => void;
  }) => void>();
  const noopAsync = async () => undefined;
  const sandbox = {
    Response,
    fetch: () => Promise.reject(new Error('network unavailable')),
    self: {
      addEventListener: (type: string, listener: (event: never) => void) => listeners.set(type, listener),
      skipWaiting: noopAsync,
      clients: { claim: noopAsync },
      registration: { showNotification: noopAsync },
      location: { origin: 'https://127.0.0.1:5173' },
    },
    clients: { matchAll: async () => [], openWindow: noopAsync },
  };

  vm.runInNewContext(source, sandbox);
  const fetchListener = listeners.get('fetch');
  expect(fetchListener).toBeTruthy();

  let responsePromise: Promise<Response> | null = null;
  fetchListener!({
    request: { mode: 'navigate' },
    respondWith: (response) => {
      responsePromise = Promise.resolve(response);
    },
  });
  expect(responsePromise).not.toBeNull();

  const response = await responsePromise!;
  expect(response.headers.get('content-type')).toContain('text/html');
  const html = await response.text();
  expect(html).toContain('Pulse ist offline');
  expect(html).toContain('lokale Server oder die VPN-Verbindung');
  expect(html).toContain('VPN oder WLAN prüfen');
  expect(html).toContain('Neu laden');
});
