import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mockPulseApi } from './fixtures/pulse-api';

async function expectNoHorizontalOverflow(page: Page, route: string) {
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return Array.from(document.body.querySelectorAll('*'))
      .map((node) => {
        const element = node as HTMLElement;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 48);
        return {
          tag: element.tagName,
          text,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          insideHorizontalScroller: (() => {
            let current: HTMLElement | null = element;
            while (current && current !== document.body) {
              const currentStyle = window.getComputedStyle(current);
              const scrollable = (currentStyle.overflowX === 'auto' || currentStyle.overflowX === 'scroll')
                && current.scrollWidth > current.clientWidth + 1;
              if (scrollable) return true;
              current = current.parentElement;
            }
            return false;
          })(),
          display: style.display,
          visibility: style.visibility,
        };
      })
      .filter(item =>
        item.display !== 'none' &&
        item.visibility !== 'hidden' &&
        item.width > 0 &&
        item.height > 0 &&
        !item.insideHorizontalScroller &&
        (
          item.left < -1 ||
          item.right > viewportWidth + 1 ||
          item.scrollWidth > item.clientWidth + 1
        )
      )
      .slice(0, 8);
  });
  expect(overflow, `${route} has horizontal overflow`).toEqual([]);
}

async function expectTouchTarget(page: Page, name: string | RegExp, minSize = 44) {
  await expectTouchTargetAt(page, name, 0, minSize);
}

async function expectTouchTargetAt(page: Page, name: string | RegExp, index: number, minSize = 44) {
  const target = page.getByRole('button', { name }).nth(index);
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box, `Missing touch target ${String(name)} at index ${index}`).not.toBeNull();
  expect(box!.height, `${String(name)} at index ${index} should be at least ${minSize}px tall`).toBeGreaterThanOrEqual(minSize);
  expect(box!.width, `${String(name)} at index ${index} should be at least ${minSize}px wide`).toBeGreaterThanOrEqual(minSize);
}

async function expectRadioTouchTarget(page: Page, name: string | RegExp, minSize = 44) {
  const target = page.getByRole('radio', { name }).first();
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box, `Missing radio touch target ${String(name)}`).not.toBeNull();
  expect(box!.height, `${String(name)} radio should be at least ${minSize}px tall`).toBeGreaterThanOrEqual(minSize);
  expect(box!.width, `${String(name)} radio should be at least ${minSize}px wide`).toBeGreaterThanOrEqual(minSize);
}

async function expectTabTouchTarget(page: Page, name: string | RegExp, minSize = 44) {
  const target = page.getByRole('tab', { name }).first();
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box, `Missing tab touch target ${String(name)}`).not.toBeNull();
  expect(box!.height, `${String(name)} tab should be at least ${minSize}px tall`).toBeGreaterThanOrEqual(minSize);
  expect(box!.width, `${String(name)} tab should be at least ${minSize}px wide`).toBeGreaterThanOrEqual(minSize);
}

async function expectSelectorTouchTarget(page: Page, selector: string, minSize = 44) {
  const target = page.locator(selector).first();
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box, `Missing touch target ${selector}`).not.toBeNull();
  expect(box!.height, `${selector} should be at least ${minSize}px tall`).toBeGreaterThanOrEqual(minSize);
  expect(box!.width, `${selector} should be at least ${minSize}px wide`).toBeGreaterThanOrEqual(minSize);
}

function localIsoDateDaysFrom(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

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

test('Data analyses load only after the user opens a card', async ({ page }) => {
  let insightRequests = 0;
  await mockPulseApi(page, {
    onRequest: (pathname) => {
      if (pathname === '/api/pulse/insights') insightRequests += 1;
    },
  });

  await page.goto('/data?tab=analysen');
  await expect(page.getByRole('heading', { name: 'Analysen', exact: true })).toBeVisible();
  await expect(page.getByText('Öffne eine Karte, um die Analyse gezielt zu laden.')).toBeVisible();
  expect(insightRequests).toBe(0);

  await page.getByRole('button').filter({ hasText: 'Gesamt' }).click();
  await expect(page.getByText('Keine Auffälligkeiten im Smoke-Test-Datensatz.')).toBeVisible();
  expect(insightRequests).toBe(1);
});

test('Data analyses show evidence links for opened analysis cards', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data?tab=analysen');
  await page.getByRole('button').filter({ hasText: 'Gesamt' }).click();

  await expect(page.getByText('Datenbasis')).toBeVisible();
  await expect(page.getByText('Trainingsdaten')).toBeVisible();
  await expect(page.getByText('4 Aktivitäten')).toBeVisible();
  await expect(page.getByText('30 Tage')).toBeVisible();
  await page.getByRole('button', { name: /Trainingsdaten: Plan öffnen/ }).click();
  await expect(page).toHaveURL('/plan');
  await expect(page.getByText('OpenRouter')).toHaveCount(0);
});

test('Data analyses show a helpful state instead of raw server errors', async ({ page }) => {
  await mockPulseApi(page, { insightErrorKind: 'server' });

  await page.goto('/data?tab=analysen');
  await page.getByRole('button').filter({ hasText: 'Gesamt' }).click();

  await expect(page.getByText('Analyse konnte gerade nicht geladen werden.')).toBeVisible();
  await expect(page.getByText('Deine Daten bleiben sichtbar.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  await expect(page.getByText('Internal Server Error')).toHaveCount(0);
});

test('Data analyses classify provider errors with a retry action', async ({ page }) => {
  await mockPulseApi(page, { insightErrorKind: 'provider' });

  await page.goto('/data?tab=analysen');
  await page.getByRole('button').filter({ hasText: 'Gesamt' }).click();

  await expect(page.getByText('KI-Provider gerade nicht erreichbar.')).toBeVisible();
  await expect(page.getByText('Versuche es später erneut oder nutze den gecachten Stand.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  await expect(page.getByText('OpenRouter')).toHaveCount(0);
});

test('Data analyses classify missing data without offering a retry', async ({ page }) => {
  await mockPulseApi(page, { insightErrorKind: 'data_missing' });

  await page.goto('/data?tab=analysen');
  await page.locator('button[aria-controls="insight-mental-content"]').click();

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
  await expect(page.getByText('WAS JETZT?', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('GRENZE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ALTERNATIVE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ABSCHLUSS', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Zum Coach' }).click();
  await expect(page).toHaveURL(/\/coach\?focus=daily&prompt=/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Tagesentscheidung: Check-in eintragen/);
  await expect(page.getByText('GUTE STARTFRAGEN')).toBeVisible();
});

test('Daily loop clarity keeps Home guidance plain and slim support on task routes', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/');
  await expect(page.getByText('TAGESENTSCHEIDUNG')).toBeVisible();
  await expect(page.getByText('WAS JETZT?', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('GRENZE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ALTERNATIVE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ABSCHLUSS', { exact: true })).toHaveCount(0);

  await page.goto('/coach');
  await expect(page.getByText('TAGESBRIEFING')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gespräch damit starten' })).toBeVisible();
  await expect(page.getByText('Grenze', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Alternative', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Abschluss', { exact: true })).toHaveCount(0);

  await page.goto('/plan');
  await expect(page.getByText('NÄCHSTE TRAININGSENTSCHEIDUNG')).toBeVisible();
  await expect(page.getByRole('button', { name: /Coach fragen/i }).first()).toBeVisible();
  await expect(page.getByText('GRENZE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ALTERNATIVE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ABSCHLUSS', { exact: true })).toHaveCount(0);
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
  const recentDecisions: unknown[] = [];
  const suppressedActions: unknown[] = [];
  let patched: { id: string; body: unknown } | null = null;

  await mockPulseApi(page, {
    actions,
    recentDecisions,
    suppressedActions,
    onActionPatch: (id, body) => {
      patched = { id, body };
      actions.length = 0;
      recentDecisions.unshift({
        decisionId: id,
        source: 'next_best_action',
        kind: 'checkin',
        title: 'Check-in eintragen',
        status: 'completed',
        targetRoute: '/coach',
        createdAt: '2026-05-01T07:00:00.000Z',
        resolvedAt: '2026-05-01T08:00:00.000Z',
        resolutionReason: 'Heute erledigt.',
      });
      suppressedActions.unshift({
        id: 'checkin:/coach:0',
        decisionId: id,
        source: 'checkin',
        priority: 'high',
        title: 'Check-in eintragen',
        reason: 'Heute fehlt dein subjektives Signal; Coach, Readiness und Briefing bleiben dadurch vorsichtiger.',
        cta: 'Zum Coach',
        targetPath: '/coach',
        suppressedReason: 'already_completed_today',
        suppressedUntil: null,
        status: 'completed',
        resolvedAt: '2026-05-01T08:00:00.000Z',
        resolutionReason: 'Heute erledigt.',
      });
    },
  });

  await page.goto('/');
  await expect(page.getByText('TAGESAKTION', { exact: true })).toBeVisible();
  await expect(page.getByText('Check-in eintragen')).toBeVisible();

  await page.getByRole('button', { name: 'Erledigt' }).click();
  await expect.poll(() => patched).toEqual({ id: 'decision-1', body: { status: 'completed', reason: 'In Home erledigt.' } });
  await expect(page.getByText('ZULETZT IM LOOP')).toBeVisible();
  await expect(page.getByText('Heute erledigt.')).toBeVisible();

  await page.goto('/coach');
  await expect(page.getByText('TAGESAKTION', { exact: true })).toBeVisible();
  await expect(page.getByText('Keine offene Tagesaktion')).toBeVisible();
  await expect(page.getByText('Zuletzt berücksichtigt: Check-in eintragen')).toBeVisible();
});

test('Home and Coach show what Pulse learned from yesterday', async ({ page }) => {
  const dailyOutcomes = [{
    date: '2026-04-30',
    actionId: 'decision-1',
    actionTitle: 'Check-in eintragen',
    actionStatus: 'completed',
    status: 'reinforced',
    title: 'Empfehlung wurde durch Daten bestätigt',
    reason: 'Der Check-in wurde abgeschlossen und passt zu den Tagesdaten.',
    evidence: ['Check-in am selben Tag vorhanden', 'Stimmung 7/10, Energie 6/10'],
    suggestedAdjustment: 'Check-in Kontext weiter nutzen und die nächste Frage konkreter machen.',
  }];

  await mockPulseApi(page, { dailyOutcomes });

  await page.goto('/');
  await expect(page.getByText('GELERNT AUS GESTERN')).toBeVisible();
  await expect(page.getByText('Bestätigt', { exact: true })).toBeVisible();
  await expect(page.getByText('Check-in Kontext weiter nutzen und die nächste Frage konkreter machen.')).toBeVisible();
  await expect(page.getByText('Check-in am selben Tag vorhanden')).toBeVisible();

  await page.goto('/coach');
  await expect(page.getByText('GELERNT AUS GESTERN')).toBeVisible();
  await expect(page.getByText('Aus gestern gelernt')).toBeVisible();
  await page.getByRole('button', { name: 'Im Coach aufgreifen' }).click();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Was lernen wir aus gestern/);
});

test('Coach and Data analyses show the daily decision quality signal', async ({ page }) => {
  const decisionQuality = {
    range: { from: '2026-04-18', to: '2026-05-01', days: 14 },
    qualityScore: 44,
    status: 'stale',
    statusLabel: 'Wiederholung prüfen',
    repeatedThemes: [{
      theme: 'Mobilität 10 Minuten',
      count: 3,
      lastSeen: '2026-05-01',
      status: 'stale',
      evidence: ['3x wiederholt ohne Abschluss-/Outcome-Evidenz'],
    }],
    bestEvidence: ['Stale Outcome: Mobilität 10 Minuten: 3x verschoben'],
    evidence: [{
      label: 'Stale Outcome',
      detail: 'Mobilität 10 Minuten: 3x verschoben',
      source: 'outcome_learning',
      tone: 'negative',
      date: '2026-05-01',
      targetRoute: '/coach',
    }],
    suggestedAdjustment: 'Wiederkehrende Empfehlung kleiner, anders getaktet oder vorerst unterdrückt anbieten.',
  };

  await mockPulseApi(page, { decisionQuality });

  await page.goto('/');
  await expect(page.getByTestId('daily-decision-quality-strip')).toHaveCount(0);
  await expect(page.getByText('Wiederkehrende Empfehlung kleiner, anders getaktet')).toHaveCount(0);

  await page.goto('/coach');
  await expect(page.getByTestId('coach-decision-quality-chip')).toContainText('Entscheidungsqualität');
  await page.getByTestId('coach-decision-quality-chip').click();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Wiederholung prüfen/);

  await page.goto('/data?tab=analysen');
  await expect(page.getByTestId('data-analysis-decision-quality-card')).toContainText('Entscheidungsqualität');
  await expect(page.getByTestId('data-analysis-decision-quality-card')).toContainText('Mobilität 10 Minuten');
});

function completedWorkoutHome({ rpe, feedbackLoggedAt }: { rpe: number | null; feedbackLoggedAt: string | null }) {
  return {
    todayWorkout: {
      id: 'workout-done',
      userId: 'user-1',
      plannedDate: '2026-05-01',
      activityType: 'bike',
      zone: 2,
      durationMin: 80,
      distanceKm: null,
      targetTss: 65,
      description: 'Aerobe Grundlage.',
      steps: null,
      garminWorkoutId: 'garmin-workout-1',
      garminScheduledId: 'garmin-schedule-1',
      status: 'completed',
      workoutFeedback: null,
      complianceScore: null,
      completedActivityId: 'activity-done',
      executionStatus: 'completed_matched',
      executionMatchedAt: '2026-05-01T09:30:00.000Z',
      executionMatchConfidence: 0.91,
      executionNotes: 'Geplantes Training wurde über Garmin erledigt.',
    },
    nextWorkout: null,
    todayActivities: [{
      id: 'activity-done',
      userId: 'user-1',
      externalId: 'garmin-activity-done',
      source: 'garmin',
      startTime: '2026-05-01T08:00:00.000Z',
      activityType: 'bike',
      name: 'Grundlage draußen',
      durationSec: 4800,
      distanceM: 32000,
      avgHr: 138,
      maxHr: 168,
      avgPowerW: 182,
      normalizedPowerW: 194,
      tss: 66,
      calories: 820,
      elevationGainM: 240,
      trainingEffectAerobic: 3.1,
      trainingEffectAnaerobic: 0.4,
      vo2maxEstimate: null,
      rpe,
      rpeNote: null,
      sorenessAreas: null,
      feedbackLoggedAt,
    }],
    recentActivities: [{
      id: 'activity-done',
      userId: 'user-1',
      externalId: 'garmin-activity-done',
      source: 'garmin',
      startTime: '2026-05-01T08:00:00.000Z',
      activityType: 'bike',
      name: 'Grundlage draußen',
      durationSec: 4800,
      distanceM: 32000,
      avgHr: 138,
      maxHr: 168,
      avgPowerW: 182,
      normalizedPowerW: 194,
      tss: 66,
      calories: 820,
      elevationGainM: 240,
      trainingEffectAerobic: 3.1,
      trainingEffectAnaerobic: 0.4,
      vo2maxEstimate: null,
      rpe,
      rpeNote: null,
      sorenessAreas: null,
      feedbackLoggedAt,
    }],
  };
}

function offPlanActivityHome({ rpe, feedbackLoggedAt }: { rpe: number | null; feedbackLoggedAt: string | null }) {
  const activity = {
    id: 'activity-off-plan',
    userId: 'user-1',
    externalId: 'garmin-activity-off-plan',
    source: 'garmin',
    startTime: '2026-05-01T08:00:00.000Z',
    activityType: 'bike',
    name: 'Rennrad Tour',
    durationSec: 9300,
    distanceM: 52000,
    avgHr: 137,
    maxHr: 165,
    avgPowerW: 176,
    normalizedPowerW: 188,
    tss: 112,
    calories: 1480,
    elevationGainM: 520,
    trainingEffectAerobic: 3.4,
    trainingEffectAnaerobic: 0.2,
    vo2maxEstimate: null,
    rpe,
    rpeNote: null,
    sorenessAreas: null,
    feedbackLoggedAt,
  };
  return {
    todayWorkout: null,
    nextWorkout: null,
    todayActivities: [activity],
    recentActivities: [activity],
  };
}

test('Home treats completed planned training with feedback as done and stays focused', async ({ page }) => {
  await mockPulseApi(page, {
    home: completedWorkoutHome({ rpe: 5, feedbackLoggedAt: '2026-05-01T09:45:00.000Z' }),
    adaptationEvents: {
      events: [{
        id: 'adapt-1',
        userId: 'user-1',
        eventDate: '2026-05-01',
        kind: 'activity_completed',
        sourceId: 'activity-done',
        severity: 'action',
        recommendation: 'protect_recovery',
        summary: 'Lange reale Einheit erkannt; Folgetage müssen Belastung absorbieren.',
        evidence: ['bike 430 min', 'TSB -18.0'],
        resolvedAt: null,
        createdAt: '2026-05-01T10:00:00.000Z',
      }],
    },
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Training heute erledigt/i })).toBeVisible();
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Erledigt');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Training abgeschlossen');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Feedback eingetragen');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Für heute ist nichts mehr offen. Training und Feedback sind erledigt.');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Heute beachten');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Kein Zusatztraining');
  await expect(page.getByTestId('daily-decision-next-steps')).not.toContainText('Noch offen');
  await expect(page.getByRole('button', { name: /Feedback erfassen/i })).toHaveCount(0);
  await expect(page.getByText(/Feedback prüfen/i)).toHaveCount(0);
  await expect(page.getByText('Heute ist kein Training geplant.')).toHaveCount(0);
  await expect(page.getByText('Entscheidungsqualität')).toHaveCount(0);
  await expect(page.getByTestId('daily-decision-quality-strip')).toHaveCount(0);
  await expect(page.getByText('RECENT')).toHaveCount(0);
  await expect(page.getByText('Grundlage draußen')).toHaveCount(0);
  await expect(page.getByText(/Mental Health:/)).toHaveCount(0);
  await expect(page.getByTestId('home-adaptation-event')).toContainText('PLAN GEPRÜFT');
  await expect(page.getByTestId('home-adaptation-event')).toContainText('Lange reale Einheit erkannt');
});

test('Home routes to activity feedback only when completed training still misses RPE', async ({ page }) => {
  await mockPulseApi(page, {
    home: completedWorkoutHome({ rpe: null, feedbackLoggedAt: null }),
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Training heute erledigt/i })).toBeVisible();
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Noch offen');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Feedback erfassen');
  await expect(page.getByTestId('daily-decision-next-steps')).not.toContainText('Für heute ist nichts mehr offen');

  await page.getByRole('button', { name: /Feedback erfassen/i }).click();
  await expect(page).toHaveURL(/\/activity\/activity-done/);
});

test('Home treats a completed off-plan Garmin activity as today done', async ({ page }) => {
  await mockPulseApi(page, {
    home: offPlanActivityHome({ rpe: null, feedbackLoggedAt: null }),
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Training heute erledigt/i })).toBeVisible();
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Garmin-Aktivität abgeschlossen');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Rennrad Tour');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Feedback erfassen');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Plan abgleichen');
  await expect(page.getByText('Heute ist kein Training geplant.')).toHaveCount(0);

  await page.getByRole('button', { name: /Feedback erfassen/i }).click();
  await expect(page).toHaveURL(/\/activity\/activity-off-plan/);
});

test('Activity fueling log captures 750ml bottles, powder, snacks and GI comfort', async ({ page }) => {
  let createdLog: unknown = null;
  await mockPulseApi(page, {
    nutritionLogs: [],
    fuelingDebt: {
      status: 'open_gi_issue',
      hasOpenDebt: true,
      label: 'GI-Schutz offen',
      summary: 'GI-/Magenhinweis vom 2026-04-29 ist noch nicht durch eine kontrollierte Folgeeinheit geschlossen.',
      closureCondition: 'Schließen: 75-120 min locker mit frühem Fueling und danach Magen ok loggen.',
      evidence: ['GI-Hinweis: 2026-04-29'],
      openIssueDate: '2026-04-29',
      controlledWorkoutId: null,
      followUpActivityId: null,
      updatedAt: '2026-05-01T08:00:00.000Z',
    },
    onNutritionCreate: body => {
      createdLog = body;
    },
    activityDetail: {
      activity: {
        id: 'activity-fueling',
        userId: 'user-1',
        externalId: 'garmin-activity-fueling',
        source: 'garmin',
        startTime: '2026-05-01T08:00:00.000Z',
        activityType: 'bike',
        name: 'Rennrad Tour',
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
        feedbackLoggedAt: '2026-05-01T13:00:00.000Z',
        equipmentIds: [],
      },
      laps: [],
      hrZones: [],
      analytics: null,
    },
  });

  await page.goto('/activity/activity-fueling');
  await expect(page.getByTestId('activity-fueling-debt')).toContainText('GI-Schutz offen');
  await expect(page.getByTestId('activity-fueling-debt')).toContainText('75-120 min locker');
  await page.getByRole('button', { name: '+ Fueling-Log' }).click();

  await expect(page.getByText('750-ml-Flaschen')).toBeVisible();
  await page.getByLabel('750-ml-Flaschen').fill('4');
  await page.getByLabel('POWER CARB Pulver (g)').fill('300');
  await page.getByRole('button', { name: 'POWER CARB Sour Cherry' }).click();
  await page.getByRole('button', { name: 'Mars' }).click();
  await page.getByRole('button', { name: 'Magen leicht unruhig' }).click();
  await page.getByLabel('Notizen (optional)').fill('Nach 100 km kurz Magenprobleme, Mars hat geholfen.');
  await page.getByRole('button', { name: 'SPEICHERN' }).click();

  await expect.poll(() => createdLog).toMatchObject({
    activityId: 'activity-fueling',
    context: 'during',
    bottles750Ml: 4,
    drinksMl: 3000,
    powderG: 300,
    fuelingProducts: expect.arrayContaining(['mnstry-power-carb-sour-cherry-1-0-8', 'mars']),
    giComfort: 'mild_issue',
  });
  expect(String((createdLog as { notes?: string }).notes)).toContain('Mars hat geholfen');
});

test('Home owns the full daily decision while Coach carries slim prompt context', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: 'Training heute defensiv entscheiden' })).toBeVisible();
  await expect(page.getByText('WAS JETZT?', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('GRENZE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ALTERNATIVE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ABSCHLUSS', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Coach fragen' }).first().click();
  await expect(page).toHaveURL(/\/coach\?focus=daily&prompt=/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Training heute defensiv entscheiden/);
  await expect(page.getByRole('heading', { name: 'Training heute defensiv entscheiden' })).toBeVisible();
  await expect(page.locator('p').filter({ hasText: 'Readiness und TSB sprechen gegen einen ungeprüften harten Reiz.' })).toBeVisible();
  await expect(page.getByText('Grenze', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Alternative', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Abschluss', { exact: true })).toHaveCount(0);

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

test('Coach prompt deep links prepare a draft without sending it', async ({ page }) => {
  let coachSends = 0;
  await mockPulseApi(page, {
    onRequest: (pathname, method) => {
      if (pathname === '/api/pulse/coach' && method === 'POST') coachSends += 1;
    },
  });

  await page.goto('/coach?focus=daily&prompt=Soll%20ich%20heute%20defensiv%20trainieren%3F');
  await expect(page.getByPlaceholder('Frage…')).toHaveValue('Soll ich heute defensiv trainieren?');
  expect(coachSends).toBe(0);
});

test('Coach prompt deep links can open a new prepared draft', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/coach?focus=daily&prompt=Erster%20Entwurf');
  await expect(page.getByPlaceholder('Frage…')).toHaveValue('Erster Entwurf');

  await page.goto('/coach?focus=plan&prompt=Zweiter%20Entwurf');
  await expect(page.getByPlaceholder('Frage…')).toHaveValue('Zweiter Entwurf');
});

test('Coach action deep links remain compatible without a prompt', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await mockPulseApi(page);

  await page.goto('/coach?actionId=checkin%3A%2Fcoach%3A0&decisionId=decision-1');
  await expect(page).toHaveURL(/\/coach\?actionId=/);
  await expect(page.getByText('TAGESBRIEFING')).toBeVisible();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue('');
  expect(consoleErrors).toEqual([]);
});

test('Home daily decision can open Coach with a prepared prompt', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Coach fragen' }).click();
  await expect(page).toHaveURL(/\/coach\?focus=daily&prompt=/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Training heute defensiv entscheiden/);
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
  await expect(page.getByText('Welche Grenze macht diesen freien Tag wirklich erholsam?')).toBeVisible();
  await expect(page.getByText('Nächster Ausblick')).toHaveCount(0);
  await expect(page.getByText('2026-05-04')).toHaveCount(0);
  await expect(page.getByText('04.05.')).toHaveCount(0);
  await expect(page.getByText(/bis zum Training/)).toHaveCount(0);
  await expect(page.getByText(/Soll ich bike.*wie geplant machen/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Gespräch damit starten' }).click();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Tagesentscheidung: Heute ist kein Training geplant/);
});

test('Coach uses today mental check-in as planning context instead of asking again', async ({ page }) => {
  let coachSends = 0;
  await mockPulseApi(page, {
    checkinToday: { checkin: { id: 'checkin-today', date: '2026-05-01' } },
    checkinHistory: {
      checkins: [{
        id: 'checkin-today',
        date: '2026-05-01',
        mood: 3,
        energy: 2,
        stress: 8,
        motivation: 3,
      }],
    },
    onRequest: (pathname, method) => {
      if (pathname === '/api/pulse/coach' && method === 'POST') coachSends += 1;
    },
  });

  await page.goto('/coach');

  const summary = page.getByTestId('coach-mental-context-summary');
  await expect(summary.getByText('MENTAL HEUTE')).toBeVisible();
  await expect(summary).toContainText('Mental Health schützen');
  await expect(summary).toContainText('Mental Fitness schonen');
  await expect(summary.getByText('Stimmung 3/10 · Energie 2/10 · Stress 8/10')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mit Check-in planen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Führe mich mit kurzen Fragen durch Stimmung, Energie, Stress, Motivation und mentale Belastung.' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Mit Check-in planen' }).click();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Mental Health schützen/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Mental Fitness schonen/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Stimmung 3\/10/);
  expect(coachSends).toBe(0);
});

test('Data mental check-in uses quick choices with guided context', async ({ page }) => {
  let submitted: unknown = null;
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
    onCheckinSubmit: body => {
      submitted = body;
    },
  });

  await page.goto('/data');
  await page.getByRole('tab', { name: 'Mental', exact: true }).click();

  await expect(page.getByText('Quick Check-in')).toBeVisible();
  await expect(page.getByText('Pulse Vorschlag')).toBeVisible();
  await expect(page.getByText('Schlafscore 82')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Heute speichern' })).toBeInViewport();
  await page.getByRole('button', { name: 'Mehr beschreiben' }).click();
  await expect(page.getByRole('radio', { name: 'Kopf: schwer' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Energie: begrenzt' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Druck: hoch' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Tagesbedarf: Ruhe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Feinjustieren' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Kopf: klar' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'Energie: bereit' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'Druck: ruhig' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'Tagesbedarf: Aktivierung' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('radio', { name: 'Kopf: schwer' }).click();
  await page.getByRole('radio', { name: 'Energie: begrenzt' }).click();
  await page.getByRole('radio', { name: 'Druck: hoch' }).click();
  await page.getByRole('radio', { name: 'Tagesbedarf: Ruhe' }).click();
  await expect(page.getByText('Welche Grenze macht diesen freien Tag wirklich erholsam?')).toBeVisible();
  await page.getByRole('button', { name: /Welche Grenze macht diesen freien Tag wirklich erholsam/ }).click();
  await page.getByRole('button', { name: 'Mental: angespannt' }).click();
  await page.getByRole('button', { name: 'Schutz: aktiv einplanen' }).click();
  await expect(page.getByPlaceholder(/Was ist mental gerade wichtig/)).toHaveValue(/Welche Grenze macht diesen freien Tag wirklich erholsam/);
  await expect(page.getByPlaceholder(/Was ist mental gerade wichtig/)).toHaveValue(/Mental: angespannt/);
  await expect(page.getByPlaceholder(/Was ist mental gerade wichtig/)).toHaveValue(/Schutz: aktiv einplanen/);
  await page.getByRole('button', { name: 'Heute speichern' }).click();
  await expect(page.getByText('CHECK-IN HEUTE ERLEDIGT')).toBeVisible();
  expect(submitted).toMatchObject({
    mood: 3,
    energy: 5,
    stress: 8,
    motivation: 3,
  });
  expect(String((submitted as { notes?: string }).notes)).toContain('Bedarf: Ruhe');
});

test('Data mental check-in keeps the primary save action in the first mobile viewport', async ({ page }) => {
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
  });

  await page.goto('/data?tab=mental');

  await expect(page.getByText('Quick Check-in')).toBeVisible();
  await expect(page.getByRole('button', { name: /Heute speichern|Check-in speichern|Check-in senden/i })).toBeInViewport();
});

test('Data mental check-in turns free text into editable scores before saving', async ({ page }) => {
  let textPreviewBody: unknown = null;
  let submitted: unknown = null;
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
    onTextCheckinSubmit: body => {
      textPreviewBody = body;
    },
    onCheckinSubmit: body => {
      submitted = body;
    },
  });

  await page.goto('/data?tab=mental');
  await page.getByRole('button', { name: 'Mehr beschreiben' }).click();

  await page.getByRole('textbox', { name: 'Kurz beschreiben' }).fill('Kopf voll, Energie begrenzt, Druck spuerbar.');
  await page.getByRole('button', { name: 'Text auswerten' }).click();

  expect(textPreviewBody).toMatchObject({ text: 'Kopf voll, Energie begrenzt, Druck spuerbar.' });
  await expect(page.getByText('Erkannte Werte prüfen')).toBeVisible();
  await expect(page.getByText('Arbeit')).toBeVisible();
  await expect(page.getByText('Muedigkeit')).toBeVisible();
  await expect(page.getByText('Was waere heute eine gute Grenze?')).toBeVisible();
  await expect(page.getByText('Stimmung 5/10')).toBeVisible();
  await expect(page.getByText('Energie 4/10')).toBeVisible();
  await expect(page.getByText('Stress 7/10')).toBeVisible();
  await expect(page.getByText('Motivation 6/10')).toBeVisible();

  await page.getByRole('button', { name: 'Ergebnis speichern' }).click();
  await expect(page.getByText('CHECK-IN HEUTE ERLEDIGT')).toBeVisible();
  expect(submitted).toMatchObject({
    mood: 5,
    energy: 4,
    stress: 7,
    motivation: 6,
  });
  expect(String((submitted as { notes?: string }).notes)).toContain('Kopf voll, Energie begrenzt, Druck spuerbar.');
});

test('Home completes a compact mental check-in without opening Data', async ({ page }) => {
  let submitted: unknown = null;
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
    actions: [
      {
        id: 'checkin',
        decisionId: 'decision-checkin',
        source: 'checkin',
        priority: 'normal',
        title: 'Check-in eintragen',
        reason: 'Tages-Check-in fehlt.',
        cta: 'Eintragen',
        targetPath: '/data?tab=mental',
        status: 'open',
        resolvedAt: null,
        resolutionReason: null,
        resolvedBy: 'Check-in heute speichern.',
      },
    ],
    onCheckinSubmit: body => {
      submitted = body;
    },
  });

  await page.goto('/');
  await expect(page.getByText('Mental Check-in')).toBeVisible();
  await page.getByRole('button', { name: 'Schützen' }).click();
  await page.getByRole('button', { name: 'Check-in speichern' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText('CHECK-IN HEUTE ERLEDIGT')).toBeVisible();
  expect(submitted).toMatchObject({
    mood: 3,
    energy: 2,
    stress: 8,
    motivation: 3,
  });
  expect(String((submitted as { notes?: string }).notes)).toContain('Home Quick: Schützen');
});

test('Data shows Garmin recovery depth signals without exposing raw payloads', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data');
  await page.getByRole('tab', { name: 'Metriken' }).click();

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
  await expect(page.getByText('Aktivitäten').first()).toBeVisible();
  await expect(page.getByText('Garmin').first()).toBeVisible();
});

test('Settings can unlock a manual profile value for automatic Garmin sync', async ({ page }) => {
  let syncPayload: unknown = null;
  let profile = {
    userId: 'user-1',
    ftpWatts: 250,
    maxHrBpm: 185,
    lthrBpm: 170,
    restingHrBpm: 49,
    weeklyHoursTarget: 6,
    trainingPhase: 'base',
    vo2max: 52,
    provenance: {
      fields: {
        ftpWatts: { key: 'ftpWatts', label: 'FTP', value: 250, source: 'manual', sourceLabel: 'Manuell', updatedAt: '2026-05-01T06:00:00.000Z', warning: null },
        maxHrBpm: { key: 'maxHrBpm', label: 'Max. Puls', value: 185, source: 'activity_derived', sourceLabel: 'Aktivitäten', updatedAt: '2026-05-01T06:00:00.000Z', warning: null },
        lthrBpm: { key: 'lthrBpm', label: 'LTHR', value: 170, source: 'garmin_settings', sourceLabel: 'Garmin', updatedAt: '2026-05-01T06:00:00.000Z', warning: null },
        vo2max: { key: 'vo2max', label: 'VO2max', value: 52, source: 'garmin_settings', sourceLabel: 'Garmin', updatedAt: '2026-05-01T06:00:00.000Z', warning: null },
      },
      warnings: [],
    },
  };
  await mockPulseApi(page, {
    profile: () => profile,
    profileSyncResult: (body) => {
      syncPayload = body;
      profile = {
        ...profile,
        ftpWatts: 295,
        provenance: {
          ...profile.provenance,
          fields: {
            ...profile.provenance.fields,
            ftpWatts: { key: 'ftpWatts', label: 'FTP', value: 295, source: 'activity_derived', sourceLabel: 'Aktivitäten', updatedAt: '2026-05-01T08:00:00.000Z', warning: null },
          },
        },
      };
      return {
        synced: {
          ftpWatts: { field: 'ftpWatts', value: 295, source: 'activity_derived', status: 'updated', label: 'FTP aus bester 20-Minuten-Leistung' },
          maxHrBpm: { field: 'maxHrBpm', value: 185, source: 'activity_derived', status: 'updated', label: 'Max. Puls aus Aktivitäten' },
          lthrBpm: { field: 'lthrBpm', value: 170, source: 'garmin_settings', status: 'updated', label: 'LTHR aus Garmin-Einstellungen' },
          vo2max: { field: 'vo2max', value: 52, source: 'garmin_settings', status: 'updated', label: 'VO2max aus Garmin-Einstellungen' },
        },
        diagnostics: { garminSettings: 'ok', activityRows: 20 },
        profile,
      };
    },
  });

  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'FTP automatisch übernehmen' })).toBeVisible();

  await page.getByRole('button', { name: 'FTP automatisch übernehmen' }).click();

  await expect.poll(() => syncPayload).toEqual({ overrideManualFields: ['ftpWatts'] });
  await expect(page.getByText('295 W')).toBeVisible();
  await expect(page.getByText('FTP aus bester 20-Minuten-Leistung')).toBeVisible();
  await expect(page.getByRole('button', { name: /automatisch übernehmen/ })).toHaveCount(0);
});

test('Settings edits Fueling and Recovery preferences for future guidance', async ({ page }) => {
  let patched: unknown = null;
  await mockPulseApi(page, {
    onProfilePatch: (body) => {
      patched = body;
    },
  });

  await page.goto('/settings');
  await expect(page.getByText('Fueling & Recovery')).toBeVisible();
  await expect(page.getByText('Ministry')).toBeVisible();
  await expect(page.getByText('Carbs: Pulse schlägt g/h vor')).toBeVisible();

  await page.locator('.card').filter({ hasText: 'Athletenprofil' }).getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Bevorzugte Fueling-Produkte').fill('Ministry Drink Mix und Gels');
  await page.getByLabel('Ernährungseinschränkungen').fill('keine');
  await page.getByRole('button', { name: 'Profil speichern' }).click();

  await expect.poll(() => patched).toMatchObject({
    preferredFuelingProducts: 'Ministry Drink Mix und Gels',
    dietaryConstraints: [],
    fuelingEnabled: true,
    carbGuidanceStyle: 'suggest_ranges',
    sodiumGuidanceStyle: 'suggest_ranges',
    bodyWeightGuidanceEnabled: true,
  });
  await expect(page.getByText('Profil gespeichert.')).toBeVisible();
});

test('Settings edits explicit coach preferences for future recommendations', async ({ page }) => {
  let patched: unknown = null;
  await mockPulseApi(page, {
    coachPreferences: {
      timeWindows: 'Werktags nach 18:30.',
      dislikedWorkoutPatterns: ['lange Sweetspot-Blöcke'],
      preferredLongDays: [6],
      injurySensitiveConstraints: ['Achillessehne vorsichtig steigern'],
      communicationStyle: 'data_first',
      updatedAt: '2026-05-01T08:00:00.000Z',
    },
    onCoachPreferencesPatch: (body) => {
      patched = body;
    },
  });

  await page.goto('/settings');
  await expect(page.getByText('Coach-Präferenzen')).toBeVisible();
  await expect(page.getByText('lange Sweetspot-Blöcke')).toBeVisible();

  await page.locator('.card').filter({ hasText: 'Coach-Präferenzen' }).getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Zeitfenster').fill('Werktags vor 07:30 oder nach 18:30.');
  await page.getByLabel('Unbeliebte Muster').fill('lange Sweetspot-Blöcke\nzu viele harte Tage');
  await page.getByRole('button', { name: 'Fr' }).click();
  await page.getByLabel('Vorsicht / Constraints').fill('Achillessehne vorsichtig steigern');
  await page.getByLabel('Kommunikation').selectOption('direct');
  await page.getByRole('button', { name: 'Coach speichern' }).click();

  await expect.poll(() => patched).toEqual({
    timeWindows: 'Werktags vor 07:30 oder nach 18:30.',
    dislikedWorkoutPatterns: ['lange Sweetspot-Blöcke', 'zu viele harte Tage'],
    preferredLongDays: [5, 6],
    injurySensitiveConstraints: ['Achillessehne vorsichtig steigern'],
    communicationStyle: 'direct',
  });
  await expect(page.getByText('Coach-Präferenzen gespeichert.')).toBeVisible();
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
  await expect(page.getByText('Grenze', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Alternative', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Abschluss', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Heute entscheiden')).toBeVisible();
  await expect(page.getByText('Plan anpassen')).toBeVisible();
  await expect(page.getByText('Warum?')).toBeVisible();

  await page.getByRole('button', { name: 'Gespräch damit starten' }).click();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Tagesentscheidung: Training bewusst prüfen/);
  expect(coachSends).toBe(0);
});

test('Daily loop keeps context from Home to Coach, Plan and evidence tabs', async ({ page }) => {
  let coachSends = 0;
  const plannedDate = localIsoDateDaysFrom(1);
  await mockPulseApi(page, {
    home: {
      nextWorkout: {
        id: 'workout-1',
        plannedDate,
        activityType: 'bike',
        zone: 2,
        durationMin: 80,
        targetTss: 65,
        status: 'planned',
        description: 'Aerobe Grundlage, primär über Puls steuern.',
      },
    },
    planWorkouts: [
      {
        id: 'workout-1',
        plannedDate,
        activityType: 'bike',
        zone: 2,
        durationMin: 80,
        targetTss: 65,
        status: 'planned',
        description: 'Aerobe Grundlage, primär über Puls steuern.',
      },
    ],
    coachHistory: [
      {
        role: 'assistant',
        content: 'Gestern haben wir den freien Tag bewusst geschlossen.',
        timestamp: '2026-05-01T18:00:00.000Z',
      },
    ],
    onRequest: (pathname, method) => {
      if (pathname === '/api/pulse/coach' && method === 'POST') coachSends += 1;
    },
  });

  await page.goto('/');
  await expect(page.getByText('Heute ist kein Training geplant.')).toBeVisible();
  await page.getByRole('button', { name: 'Coach fragen' }).click();
  await expect(page).toHaveURL(/\/coach\?focus=daily&prompt=/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Tagesentscheidung: Heute ist kein Training geplant/);
  await expect(page.getByText('TAGESBRIEFING')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Welche Grenze macht diesen freien Tag wirklich erholsam?' })).toBeVisible();

  await page.getByRole('button', { name: 'Gespräch damit starten' }).click();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Tagesentscheidung: Heute ist kein Training geplant/);
  expect(coachSends).toBe(0);

  await page.goto('/plan?tab=training');
  const nextDecisionBox = await page.getByText('NÄCHSTE TRAININGSENTSCHEIDUNG').boundingBox();
  expect(nextDecisionBox).not.toBeNull();
  await expect(page.getByText('Heute ist kein Training geplant.')).toHaveCount(0);
  await expect(page.getByText('Radfahren · Zone 2')).toBeVisible();

  await page.getByRole('button', { name: 'Metriken prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=metrics');
  await expect(page.getByRole('tab', { name: 'Metriken' })).toHaveAttribute('aria-selected', 'true');

  await page.goBack();
  await expect(page).toHaveURL('/plan?tab=training');
  await expect(page.getByRole('tab', { name: 'Training', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('Home evidence chips deep-link to Data evidence sections', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/');
  await expect(page.getByText('TAGESENTSCHEIDUNG')).toBeVisible();

  await page.getByRole('button', { name: /Readiness 78\/100/ }).click();
  await expect(page).toHaveURL(/\/data/);
  await expect(page).toHaveURL(/#data-recovery$/);
  await expect(page.getByRole('tab', { name: 'Metriken' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#data-recovery')).toBeVisible();
});

test('Plan evidence chips deep-link to Data plan trace', async ({ page }) => {
  const plannedDate = localIsoDateDaysFrom(0);
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-1',
        plannedDate,
        activityType: 'bike',
        zone: 2,
        durationMin: 80,
        targetTss: 65,
        status: 'planned',
        description: 'Aerobe Grundlage, primaer ueber Puls steuern.',
      },
    ],
    planTrace: {
      weekStart: plannedDate,
      inputSnapshot: {
        load: { ctl: 42.4, atl: 48.1, tsb: -5.7 },
        weeklyHoursTarget: 8,
        phase: 'base',
        goals: [],
        riskSignals: [],
        healthStates: [],
        recentRpe: [],
        dataWarnings: [],
        recentSportMix: {},
        learningSnapshot: null,
        adaptation: null,
        restDayRationale: [],
        seasonStrategy: null,
      },
      sportMix: {},
      hardDays: [],
      generatedSummary: [],
      adaptation: null,
      restDayRationale: [],
    },
  });

  await page.goto('/plan?tab=training');
  await expect(page.getByText('NÄCHSTE TRAININGSENTSCHEIDUNG')).toBeVisible();

  await page.getByRole('button', { name: /Einbezogen: TSB -5\.7/ }).click();
  await expect(page).toHaveURL('/data?tab=analysen#data-plan-trace');
  await expect(page.getByRole('tab', { name: 'Analysen' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#data-plan-trace')).toBeVisible();
});

test('Data overview exposes provenance shortcuts', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data');
  await expect(page.getByText('DATA · ÜBERBLICK')).toBeVisible();
  const triage = page.getByTestId('data-evidence-triage');
  await expect(triage).toContainText('Readiness 78/100');
  await expect(triage).toContainText('TSB -5.7');
  await expect(triage).toContainText('Mental Check-in');
  await expect(triage).toContainText('Garmin bereit');

  await page.getByTestId('data-triage-readiness').click();
  await expect(page).toHaveURL('/data?tab=metrics#data-recovery');
  await expect(page.locator('#data-recovery')).toBeVisible();

  await page.goto('/data');
  await page.getByTestId('data-triage-garmin').click();
  await expect(page).toHaveURL('/data?tab=coverage#data-garmin-quality');
  await expect(page.locator('#data-garmin-quality')).toBeVisible();

  await page.goto('/data');
  await page.getByRole('button', { name: 'Plan-/Load-Analyse prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=analysen#data-plan-trace');
  await expect(page.locator('#data-plan-trace')).toBeVisible();
});

test('Data Plan Load triage hands off to the actionable Plan scenario surface', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data');
  await page.getByTestId('data-triage-plan-load').click();

  await expect(page).toHaveURL('/plan?tab=training&source=data-load#plan-scenario-preview');
  const scenarioCard = page.getByTestId('plan-scenario-preview-card');
  await expect(scenarioCard).toBeVisible();
  await expect(scenarioCard).toBeInViewport();
  await expect(scenarioCard).toBeFocused();
  await expect(scenarioCard).toContainText('Szenario-Vorschau');
  await expect(scenarioCard).toContainText('Aus Data geöffnet');
  await expect(scenarioCard).toContainText('Readiness, TSB und Plan-/Load-Evidenz');
});

test('Data ignores malformed hashes and stays usable', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data#%');
  await expect(page.getByText('DATA · ÜBERBLICK')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Überblick' })).toHaveAttribute('aria-selected', 'true');
});

test('Data, Plan and Settings preserve URL-backed UI state', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data?tab=mental');
  await expect(page.getByRole('tab', { name: 'Mental', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Gewicht' }).click();
  await expect(page).toHaveURL('/data?tab=weight');

  await page.goto('/plan?tab=goals');
  await expect(page.getByRole('tab', { name: 'Ziele' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Statistik' }).click();
  await expect(page).toHaveURL('/plan?tab=stats');

  await page.goto('/settings?section=push');
  const pushHeading = page.getByRole('heading', { name: 'Benachrichtigungen' });
  await expect(pushHeading).toBeVisible();
  const box = await pushHeading.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(260);
});

test('Tablet navigation and segmented panels expose accessible targets', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  await mockPulseApi(page);

  await page.goto('/');
  const sidebarTargets = page.locator('aside nav a');
  await expect(sidebarTargets).toHaveCount(4);
  for (const index of [0, 1, 2, 3]) {
    const box = await sidebarTargets.nth(index).boundingBox();
    expect(box, `sidebar nav target ${index} should render`).not.toBeNull();
    expect(box!.height, `sidebar nav target ${index} should be at least 44px tall`).toBeGreaterThanOrEqual(44);
  }
  const logoutBox = await page.getByRole('button', { name: 'out' }).boundingBox();
  expect(logoutBox, 'desktop logout should render').not.toBeNull();
  expect(logoutBox!.height, 'desktop logout should be at least 44px tall').toBeGreaterThanOrEqual(44);
  expect(logoutBox!.width, 'desktop logout should be at least 44px wide').toBeGreaterThanOrEqual(44);

  await page.goto('/data?tab=mental');
  const mentalTab = page.getByRole('tab', { name: 'Mental', exact: true });
  await expect(mentalTab).toHaveAttribute('aria-controls', 'data-mental-panel');
  const mentalPanel = page.locator('#data-mental-panel[role="tabpanel"]');
  await expect(mentalPanel).toBeVisible();
  await expect(mentalPanel).toHaveAttribute('aria-labelledby', 'data-mental-tab');

  await page.goto('/plan?tab=training');
  const trainingTab = page.getByRole('tab', { name: 'Training', exact: true });
  await expect(trainingTab).toHaveAttribute('aria-controls', 'plan-training-panel');
  const trainingPanel = page.locator('#plan-training-panel[role="tabpanel"]');
  await expect(trainingPanel).toBeVisible();
  await expect(trainingPanel).toHaveAttribute('aria-labelledby', 'plan-training-tab');
});

test('Home metric tooltips and Plan activity rows work from keyboard', async ({ page }) => {
  await mockPulseApi(page, {
    activities: [
      {
        id: 'activity-row-1',
        startTime: '2026-05-01T07:30:00.000Z',
        activityType: 'bike',
        name: 'Rennrad Grundlage',
        durationSec: 3600,
        distanceM: 30000,
        tss: 45,
      },
    ],
  });

  await page.goto('/');
  const readinessTrigger = page.getByRole('button', { name: /READINESS erklären/i });
  await readinessTrigger.focus();
  await page.keyboard.press('Enter');
  await expect(readinessTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('tooltip')).toContainText(/Readiness|Trainingsbereitschaft/i);
  await page.keyboard.press('Escape');
  await expect(readinessTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  await page.goto('/plan?tab=training');
  const activityButton = page.getByRole('button', { name: /Rennrad Grundlage.*Aktivität öffnen/i });
  await expect(activityButton).toBeVisible();
  const activityBox = await activityButton.boundingBox();
  expect(activityBox, 'activity row button should render').not.toBeNull();
  expect(activityBox!.height, 'activity row button should be at least 44px tall').toBeGreaterThanOrEqual(44);
  await activityButton.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/activity\/activity-row-1$/);
});

test('Home surfaces quick availability intents when no workout is planned', async ({ page }) => {
  let previewBody: unknown = null;
  await mockPulseApi(page, {
    todayOptionsState: 'unplanned_trainable',
    onPlanScenarioPreview: body => { previewBody = body; },
  });

  await page.goto('/');
  await expect(page.getByTestId('today-options-card')).toBeVisible();
  await expect(page.getByTestId('today-options-card')).toContainText('Heute möglich');
  await expect(page.getByTestId('today-availability-intent')).toBeVisible();
  await page.getByRole('button', { name: '60 min' }).click();
  await expect(page).toHaveURL(/source=mobile-intent/);
  const scenarioCard = page.getByTestId('plan-scenario-preview-card');
  await expect(scenarioCard).toBeVisible();
  await expect(scenarioCard).toBeInViewport();
  await expect(scenarioCard).toContainText('Mobile Quick Decision');
  await expect(scenarioCard.getByLabel('Dauer min')).toHaveValue('60');
  await expect(scenarioCard.getByLabel('Sportart')).toHaveValue('bike');
  await expect(scenarioCard.getByLabel('Zone')).toHaveValue('1');
  await expect(page.getByTestId('plan-scenario-preview-result')).toBeVisible();
  await expect(page.getByTestId('scenario-garmin-impact')).toBeVisible();
  await expect(page.getByTestId('plan-scenario-entry-context')).toBeVisible();
  await expect(page.getByTestId('plan-scenario-entry-context')).toBeInViewport();
  await expect(scenarioCard).not.toContainText('155 km');
  await expect(scenarioCard).not.toContainText('423 min');
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

test('Home does not show planned-training options when the daily decision says no training is planned', async ({ page }) => {
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
    todayOptionsState: 'planned_workout',
    home: { todayWorkout: null, nextWorkout: null },
  });

  await page.goto('/');

  await expect(page.getByTestId('daily-decision-card')).toContainText('Heute ist kein Training geplant');
  await expect(page.getByTestId('today-options-card')).toHaveCount(0);
  await expect(page.getByTestId('today-availability-intent')).toHaveCount(0);
});

test('Plan scenario preview shows long-tour load and recovery impact before applying', async ({ page }) => {
  let previewBody: unknown = null;
  await mockPulseApi(page, {
    planWorkouts: [{
      id: 'planned-1',
      userId: 'user-1',
      plannedDate: '2026-05-03',
      activityType: 'bike',
      zone: 2,
      durationMin: 90,
      distanceKm: null,
      targetTss: 68,
      archetypeId: 'endurance_steady',
      difficultyLevel: 2.5,
      difficultyEnergySystem: 'endurance',
      capabilityFit: 'productive',
      description: 'Ruhige Ausdauer.',
      steps: null,
      garminWorkoutId: null,
      garminScheduledId: null,
      status: 'planned',
      workoutFeedback: null,
      complianceScore: null,
      origin: 'generated',
      userLocked: false,
      completedActivityId: null,
      executionStatus: 'local_planned',
      executionMatchedAt: null,
      executionMatchConfidence: null,
      executionNotes: null,
    }],
    onPlanScenarioPreview: body => { previewBody = body; },
  });

  await page.goto('/plan?tab=training');
  const scenarioCard = page.getByTestId('plan-scenario-preview-card');
  await expect(scenarioCard).toBeVisible();
  await scenarioCard.getByLabel('km optional').fill('155');
  await scenarioCard.getByLabel('km/h optional').fill('22');
  await scenarioCard.getByLabel('Notiz').fill('Entspannte Rennradtour mit Stops.');
  await scenarioCard.getByRole('button', { name: 'Szenario prüfen' }).click();
  await expect(page.getByTestId('plan-scenario-preview-result')).toBeVisible();
  await expect(page.getByText('TSS', { exact: true })).toBeVisible();
  await expect(page.getByText('+296', { exact: true })).toBeVisible();
  await expect(page.getByTestId('scenario-garmin-impact')).toContainText('Garmin nach Apply: 1 neu');
  await expect(page.getByText(/Fueling und GI-Komfort/)).toBeVisible();
  expect(previewBody).toMatchObject({ type: 'add_custom_tour' });
});

test('Plan scenario preview lists affected future workouts before applying', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  let previewBody: unknown = null;
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'planned-reduce-1',
        userId: 'user-1',
        plannedDate: '2026-05-03',
        activityType: 'bike',
        zone: 2,
        durationMin: 90,
        distanceKm: null,
        targetTss: 68,
        archetypeId: 'endurance_steady',
        difficultyLevel: 2.5,
        difficultyEnergySystem: 'endurance',
        capabilityFit: 'productive',
        description: 'Ruhige Ausdauer.',
        steps: null,
        garminWorkoutId: null,
        garminScheduledId: null,
        status: 'planned',
        workoutFeedback: null,
        complianceScore: null,
        origin: 'generated',
        userLocked: false,
        completedActivityId: null,
        executionStatus: 'local_planned',
        executionMatchedAt: null,
        executionMatchConfidence: null,
        executionNotes: null,
      },
      {
        id: 'planned-reduce-2',
        userId: 'user-1',
        plannedDate: '2026-05-05',
        activityType: 'run',
        zone: 3,
        durationMin: 60,
        distanceKm: null,
        targetTss: 54,
        archetypeId: 'tempo',
        difficultyLevel: 3,
        difficultyEnergySystem: 'tempo',
        capabilityFit: 'productive',
        description: 'Tempo kontrolliert.',
        steps: null,
        garminWorkoutId: null,
        garminScheduledId: null,
        status: 'planned',
        workoutFeedback: null,
        complianceScore: null,
        origin: 'generated',
        userLocked: false,
        completedActivityId: null,
        executionStatus: 'local_planned',
        executionMatchedAt: null,
        executionMatchConfidence: null,
        executionNotes: null,
      },
    ],
    onPlanScenarioPreview: body => { previewBody = body; },
    planScenarioPreview: {
      preview: {
        type: 'reduce_volume',
        summary: 'Offene, nicht gesperrte Workouts werden im Preview reduziert.',
        projectedWorkouts: [
          {
            id: 'planned-reduce-1',
            plannedDate: '2026-05-03',
            activityType: 'bike',
            zone: 2,
            durationMin: 70,
            targetTss: 51,
            userLocked: false,
            status: 'planned',
            description: 'Ruhige Ausdauer.',
          },
          {
            id: 'planned-reduce-2',
            plannedDate: '2026-05-05',
            activityType: 'run',
            zone: 3,
            durationMin: 45,
            targetTss: 41,
            userLocked: false,
            status: 'planned',
            description: 'Tempo kontrolliert.',
          },
        ],
        changedDays: [
          {
            date: '2026-05-03',
            before: { sessions: 1, durationMin: 90, tss: 68 },
            after: { sessions: 1, durationMin: 70, tss: 51 },
            label: '-17 TSS',
          },
          {
            date: '2026-05-05',
            before: { sessions: 1, durationMin: 60, tss: 54 },
            after: { sessions: 1, durationMin: 45, tss: 41 },
            label: '-13 TSS',
          },
        ],
        loadImpact: { tssDelta: -30, durationDeltaMin: -35, nextDayRecoveryDate: null },
        garminImpact: { creates: 0, updates: 2, deletes: 0, unchanged: 0, summary: 'Garmin nach Apply: 2 Update.' },
        reasons: ['Offene Planlast wird auf 75% reduziert.'],
        warnings: [],
        applySupported: true,
      },
    },
  });

  await page.goto('/plan?tab=training');
  await page.getByRole('button', { name: 'Umfang senken' }).click();
  await page.getByTestId('plan-scenario-preview-card').getByRole('button', { name: 'Szenario prüfen' }).click();

  await expect(page.getByTestId('plan-scenario-preview-result')).toBeVisible();
  await expect(page.getByTestId('plan-scenario-preview-result')).toContainText('Betroffene Einheiten');
  await expect(page.getByText('Radfahren · 2026-05-03')).toBeVisible();
  await expect(page.getByText('90 -> 70 min')).toBeVisible();
  await expect(page.getByText('68 -> 51 TSS')).toBeVisible();
  await expect(page.getByText('Laufen · 2026-05-05')).toBeVisible();
  expect(previewBody).toMatchObject({ type: 'reduce_volume', factor: 0.75 });
});

test('Plan refresh preview compares stale workouts without write requests', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  const requests: Array<{ method: string; pathname: string }> = [];
  await mockPulseApi(page, {
    onRequest: (pathname, method) => { requests.push({ method, pathname }); },
    planWorkouts: [{
      id: 'stale-hard-1',
      userId: 'user-1',
      plannedDate: '2026-05-03',
      activityType: 'bike',
      zone: 5,
      durationMin: 75,
      distanceKm: null,
      targetTss: 92,
      archetypeId: 'bike_vo2_4x4',
      difficultyLevel: 4.4,
      difficultyEnergySystem: 'vo2',
      capabilityFit: 'stretch',
      description: 'Warum diese Einheit: VO2-Reiz fuer kurze Anstiege.\n\n4x4 min.',
      steps: null,
      garminWorkoutId: null,
      garminScheduledId: null,
      status: 'planned',
      workoutFeedback: null,
      complianceScore: null,
      origin: 'generated',
      userLocked: false,
      completedActivityId: null,
      executionStatus: 'local_planned',
      executionMatchedAt: null,
      executionMatchConfidence: null,
      executionNotes: null,
    }],
    planRefreshPreview: {
      preview: {
        weekStart: '2026-04-27',
        generatedAt: '2026-05-01T08:00:00.000Z',
        stale: true,
        summary: '3 Signal(e) sprechen fuer eine Planpruefung; 1 offene Einheit(en) wuerden sich aendern.',
        triggers: [
          { kind: 'high_rpe', label: 'RPE-Schutz', detail: 'RPE 9 spricht gegen harte Reize.', severity: 'watch', evidence: ['RPE 9/10'] },
          { kind: 'capability_update', label: 'Capability-Update', detail: 'Capabilities neuer als Plan.', severity: 'info', evidence: ['Endurance 3.8 -> 4.1'] },
          { kind: 'stale_engine', label: 'Planlogik aktualisiert', detail: 'Plan Engine neuer als Trace.', severity: 'info', evidence: ['older-plan-engine'] },
        ],
        comparisons: [{
          date: '2026-05-03',
          current: {
            id: 'stale-hard-1',
            plannedDate: '2026-05-03',
            activityType: 'bike',
            zone: 5,
            durationMin: 75,
            targetTss: 92,
            archetypeId: 'bike_vo2_4x4',
            why: 'VO2-Reiz fuer kurze Anstiege.',
            userLocked: false,
          },
          proposed: {
            id: 'stale-hard-1',
            plannedDate: '2026-05-03',
            activityType: 'bike',
            zone: 2,
            durationMin: 50,
            targetTss: 35,
            archetypeId: 'bike_vo2_4x4',
            why: 'Schutzsignal aktiv: harte Reize erst wieder nach Feedback.',
            userLocked: false,
          },
          changes: ['zone', 'duration', 'why'],
          reason: 'Harte Einheit wuerde im Refresh zu kontrollierter Endurance werden.',
        }],
        loadImpact: { tssDelta: -57, durationDeltaMin: -25 },
        garminImpact: { creates: 0, updates: 1, deletes: 0, unchanged: 0, summary: 'Garmin nach Apply: 1 Workout-Update erwartet.' },
        applySupported: false,
        mutationBoundary: 'Read-only: diese Vorschau fuehrt keine DB- oder Garmin-Schreibaktion aus.',
      },
    },
  });

  await page.goto('/plan?tab=training');
  const refreshCard = page.getByTestId('plan-refresh-preview-card');
  await expect(refreshCard).toBeVisible();
  await expect(refreshCard).toContainText('Plan prüfen');
  await expect(refreshCard).toContainText('RPE-Schutz');
  await expect(refreshCard).toContainText('Capability-Update');
  await expect(refreshCard).toContainText('Jetzt: Radfahren · Z5 · 75 min · bike_vo2_4x4');
  await expect(refreshCard).toContainText('Vorschlag: Radfahren · Z2 · 50 min · bike_vo2_4x4');
  await expect(refreshCard).toContainText('Warum: Schutzsignal aktiv');
  await expect(refreshCard).toContainText('Garmin nach Apply: 1 Workout-Update erwartet.');
  await expect(refreshCard.getByRole('button', { name: 'Vorschau anwenden' })).toBeDisabled();

  await refreshCard.getByRole('button', { name: 'Refresh Preview' }).click();
  expect(requests.some(request => request.method === 'GET' && request.pathname.startsWith('/api/pulse/plan/refresh-preview/'))).toBe(true);
  expect(requests.filter(request => ['POST', 'PATCH', 'DELETE'].includes(request.method)).map(request => `${request.method} ${request.pathname}`))
    .not.toContain('POST /api/pulse/plan/generate');
  expect(requests.filter(request => request.pathname.includes('/sync-garmin'))).toEqual([]);
});

test('Plan surfaces Garmin sync failure after applying a custom tour scenario', async ({ page }) => {
  await mockPulseApi(page, {
    createWorkoutResult: (body) => ({
      workout: {
        id: 'created-workout',
        userId: 'user-1',
        plannedDate: (body as { plannedDate?: string }).plannedDate ?? '2026-05-02',
        activityType: 'bike',
        zone: 2,
        durationMin: 423,
        distanceKm: 155,
        targetTss: 296,
        archetypeId: 'long_endurance',
        difficultyLevel: 4.2,
        difficultyEnergySystem: 'long_endurance',
        capabilityFit: 'stretch',
        description: 'Entspannte Rennradtour mit Stops.',
        steps: null,
        garminWorkoutId: null,
        garminScheduledId: null,
        status: 'planned',
        workoutFeedback: null,
        complianceScore: null,
        origin: 'user',
        userLocked: true,
        completedActivityId: null,
        executionStatus: 'local_planned',
        executionMatchedAt: null,
        executionMatchConfidence: null,
        executionNotes: 'Garmin Sync fehlgeschlagen.',
      },
      garminSync: { status: 'failed', error: 'Garmin Sync fehlgeschlagen.' },
    }),
  });

  await page.goto('/plan?tab=training');
  const scenarioCard = page.getByTestId('plan-scenario-preview-card');
  await expect(scenarioCard).toBeVisible();
  await scenarioCard.getByLabel('km optional').fill('155');
  await scenarioCard.getByLabel('km/h optional').fill('22');
  await scenarioCard.getByLabel('Notiz').fill('Entspannte Rennradtour mit Stops.');
  await scenarioCard.getByRole('button', { name: 'Szenario prüfen' }).click();
  await expect(page.getByTestId('plan-scenario-preview-result')).toBeVisible();
  await page.getByRole('button', { name: 'Vorschau anwenden' }).click();
  await expect(page).toHaveURL(/tab=execution/);
  await expect(page.getByText('Garmin-Ausführung prüfen')).toBeVisible();
  await expect(page.getByTestId('garmin-execution-trust-panel')).toBeVisible();
});

test('Plan custom workout starts neutral and saves duration-only units without tour distance', async ({ page }) => {
  let createBody: unknown = null;
  await mockPulseApi(page, {
    createWorkoutResult: (body) => {
      createBody = body;
      const payload = body as { plannedDate?: string; activityType?: string; zone?: number; durationMin?: number; description?: string };
      return {
        workout: {
          id: 'created-duration-workout',
          userId: 'user-1',
          plannedDate: payload.plannedDate ?? '2026-05-02',
          activityType: payload.activityType ?? 'bike',
          zone: payload.zone ?? 2,
          durationMin: payload.durationMin ?? 75,
          distanceKm: null,
          targetTss: null,
          archetypeId: 'endurance',
          difficultyLevel: 3.2,
          difficultyEnergySystem: 'endurance',
          capabilityFit: 'productive',
          description: payload.description ?? null,
          steps: null,
          garminWorkoutId: null,
          garminScheduledId: null,
          status: 'planned',
          workoutFeedback: null,
          complianceScore: null,
          origin: 'user',
          userLocked: true,
          completedActivityId: null,
          executionStatus: 'local_planned',
          executionMatchedAt: null,
          executionMatchConfidence: null,
          executionNotes: 'Workout ist nur lokal in Pulse geplant.',
        },
        garminSync: { status: 'skipped' },
      };
    },
  });

  await page.goto('/plan?tab=training');
  await page.getByRole('button', { name: '+ Einheit' }).click();
  const customWorkoutForm = page.getByTestId('custom-workout-form');

  await expect(customWorkoutForm.getByLabel('km optional')).toHaveValue('');
  await expect(customWorkoutForm.getByLabel('km/h optional')).toHaveValue('');
  await expect(customWorkoutForm.getByText('Dauer offen')).toBeVisible();

  await customWorkoutForm.getByLabel('Minuten').fill('75');
  await customWorkoutForm.getByLabel('Notiz').fill('Lockere manuelle Ausdauer.');
  await customWorkoutForm.getByLabel('Garmin synchronisieren').uncheck();
  await customWorkoutForm.getByRole('button', { name: 'Einheit speichern' }).click();

  await expect.poll(() => createBody).toMatchObject({
    activityType: 'bike',
    durationMin: 75,
    description: 'Lockere manuelle Ausdauer.',
    syncGarmin: false,
    userLocked: true,
  });
  expect(createBody).not.toMatchObject({ distanceKm: 155, expectedSpeedKmh: 22 });
});

test('Plan custom workout does not expose a fixed 155-km tour preset', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/plan?tab=training');
  await page.getByRole('button', { name: '+ Einheit' }).click();
  const customWorkoutForm = page.getByTestId('custom-workout-form');

  await expect(customWorkoutForm.getByRole('button', { name: '155-km Tour vorbereiten' })).toHaveCount(0);
  await expect(customWorkoutForm.getByLabel('km optional')).toHaveValue('');
  await expect(customWorkoutForm.getByLabel('km/h optional')).toHaveValue('');
  await expect(customWorkoutForm.getByText('Dauer offen')).toBeVisible();
  await expect(customWorkoutForm.getByLabel('Notiz')).toHaveValue('');
});

test('Home stays usable when the readiness endpoint fails locally', async ({ page }) => {
  let readinessCalls = 0;
  await mockPulseApi(page, {
    failEndpoints: {
      'GET /api/pulse/readiness': {
        error: 'Readiness momentan nicht erreichbar.',
        status: 503,
      },
    },
    onRequest: (pathname) => {
      if (pathname === '/api/pulse/readiness') readinessCalls += 1;
    },
  });

  await page.goto('/');
  await expect(page.getByText('Guten')).toBeVisible();
  await expect(page.getByText('Heute ist kein Training geplant.')).toBeVisible();
  await expect(page.getByText('Readiness separat nicht erreichbar')).toBeVisible();
  await page.getByRole('button', { name: 'Readiness erneut laden' }).click();
  await expect.poll(() => readinessCalls).toBeGreaterThan(1);
});

test('Coach send failure preserves the draft and can retry', async ({ page }) => {
  let coachPosts = 0;
  await mockPulseApi(page, {
    failEndpoints: {
      'POST /api/pulse/coach': {
        error: 'KI-Provider gerade nicht verfügbar.',
        status: 503,
        times: 1,
      },
    },
    onRequest: (pathname, method) => {
      if (pathname === '/api/pulse/coach' && method === 'POST') coachPosts += 1;
    },
  });

  await page.goto('/coach?focus=daily');
  await page.getByPlaceholder('Frage…').fill('Was ist heute der sinnvollste nächste Schritt?');
  await page.getByRole('button', { name: 'Nachricht senden' }).click();

  await expect(page.getByText('Nachricht nicht gesendet')).toBeVisible();
  await expect(page.getByText('KI-Provider gerade nicht verfügbar.')).toBeVisible();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue('Was ist heute der sinnvollste nächste Schritt?');
  await page.getByRole('button', { name: 'Erneut senden' }).click();
  await expect.poll(() => coachPosts).toBe(2);
  await expect(page.getByText('Nachricht nicht gesendet')).toHaveCount(0);
});

test('Plan alternative failure keeps the workout visible and offers retry', async ({ page }) => {
  let updates = 0;
  const plannedDate = localIsoDateDaysFrom(1);
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-1',
        plannedDate,
        activityType: 'bike',
        zone: 2,
        durationMin: 80,
        targetTss: 65,
        status: 'planned',
        description: 'Aerobe Grundlage.',
      },
    ],
    failEndpoints: {
      'PATCH /api/pulse/plan/workout/workout-1': {
        error: 'Planänderung konnte nicht gespeichert werden.',
        status: 500,
        times: 1,
      },
    },
    onRequest: (pathname, method) => {
      if (pathname === '/api/pulse/plan/workout/workout-1' && method === 'PATCH') updates += 1;
    },
  });

  await page.goto('/plan?tab=training');
  await expect(page.getByText('Radfahren · Zone 2')).toBeVisible();
  await page.getByRole('button', { name: /Kürzer/ }).click();
  await expect(page.getByText('Änderung nicht gespeichert')).toBeVisible();
  await expect(page.getByText('Planänderung konnte nicht gespeichert werden.')).toBeVisible();
  await expect(page.getByText('Radfahren · Zone 2')).toBeVisible();
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect.poll(() => updates).toBe(2);
  await expect(page.getByText('Änderung nicht gespeichert')).toHaveCount(0);
});

test('Plan generation failure keeps the config open with retry', async ({ page }) => {
  await mockPulseApi(page, {
    failEndpoints: {
      'POST /api/pulse/plan/generate': {
        error: 'Plan-Engine momentan nicht erreichbar.',
        status: 503,
      },
    },
  });

  await page.goto('/plan?tab=training');
  await page.getByRole('button', { name: '+ Plan generieren' }).click();
  await page.getByRole('button', { name: 'Plan erstellen' }).click();

  await expect(page.getByText('Plan nicht erstellt')).toBeVisible();
  await expect(page.getByText('Plan-Engine momentan nicht erreichbar.')).toBeVisible();
  await expect(page.getByText('Erstellt einen wissenschaftlich fundierten Wochenplan')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
});

test('Plan generation shows the freshly returned trace without requiring reload', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  const staleTrace = {
    weekStart: '2026-04-27',
    inputSnapshot: {
      load: { ctl: 42.4, atl: 42.7, tsb: -0.3, date: '2026-04-27' },
      phase: 'base',
      weeklyHoursTarget: 8,
      goals: [],
      riskSignals: [],
      healthStates: [],
      recentRpe: [],
      dataWarnings: [],
      recentSportMix: {},
      learningSnapshot: null,
    },
    sportMix: {},
    generatedSummary: ['Form: CTL 42.4, TSB -0.3, Phase base.'],
    hardDays: [],
    planDecision: null,
  };
  const freshTrace = {
    ...staleTrace,
    inputSnapshot: {
      ...staleTrace.inputSnapshot,
      load: { ctl: 16.9, atl: 43.7, tsb: -26.8, date: '2026-05-01' },
    },
    generatedSummary: ['Form: CTL 16.9, TSB -26.8, Phase base.'],
  };
  await mockPulseApi(page, {
    planTrace: staleTrace,
    generatePlanResult: {
      workouts: [],
      planDecision: null,
      planTrace: freshTrace,
    },
  });

  await page.goto('/plan?tab=training');
  await expect(page.getByText('Form: CTL 42.4, TSB -0.3, Phase base.')).toBeVisible();

  await page.getByRole('button', { name: '+ Plan generieren' }).click();
  await page.getByRole('button', { name: 'Plan erstellen' }).click();

  await expect(page.getByText('Form: CTL 16.9, TSB -26.8, Phase base.')).toBeVisible();
  await expect(page.getByText('Form: CTL 42.4, TSB -0.3, Phase base.')).toHaveCount(0);
});

test('Settings health-state save failure keeps the form open with an inline retry hint', async ({ page }) => {
  await mockPulseApi(page, {
    failEndpoints: {
      'POST /api/pulse/health-state': {
        error: 'Health-State konnte nicht gespeichert werden.',
        status: 500,
      },
    },
  });

  await page.goto('/settings?section=health');
  await page.getByRole('button', { name: '+ Hinzufügen' }).click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Gesundheits-Status nicht gespeichert')).toBeVisible();
  await expect(page.getByText('Health-State konnte nicht gespeichert werden.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible();
});

test('Data Garmin backfill failure shows local recovery', async ({ page }) => {
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
        updatedAt: '2026-05-01T05:00:00.000Z',
        ftpWatts: 250,
        maxHrBpm: 185,
        lthrBpm: 172,
        vo2max: 52,
        missing: [],
      },
      issues: [],
      days: [{
        date: '2026-05-01',
        dailyMetrics: { status: 'missing', reason: 'not_synced', syncedAt: null, missingFields: ['hrvRmssd'] },
        sleep: { status: 'present', reason: 'present', durationH: 7.4, hasStages: true, missingFields: [] },
        activities: { status: 'missing', reason: 'not_recorded', count: 0, weatherCount: 0, missingWeatherCount: 0, missingFields: [] },
        weight: { status: 'present', reason: 'present', hasBodyComposition: true, missingFields: [] },
      }],
    },
    failEndpoints: {
      'POST /api/pulse/garmin/backfill': {
        error: 'Garmin Backfill konnte nicht gestartet werden.',
        status: 503,
      },
    },
  });

  await page.goto('/data?tab=coverage');
  await page.getByRole('button', { name: 'Nachladen' }).click();
  await expect(page.getByText('Garmin Backfill fehlgeschlagen')).toBeVisible();
  await expect(page.getByText('Garmin Backfill konnte nicht gestartet werden.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
});

test('Plan prioritizes the next training decision before tools', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
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
  await expect(page.getByText('Lokal', { exact: true })).toBeVisible();
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

test('Plan empty training decision offers direct next actions', async ({ page }) => {
  await mockPulseApi(page, { planWorkouts: [], todayOptionsState: 'unplanned_trainable' });

  await page.goto('/plan');
  const emptyDecision = page.locator('.card').filter({ hasText: 'Kein offenes Training geplant' }).first();
  await expect(emptyDecision).toBeVisible();
  await expect(emptyDecision.getByRole('button', { name: 'Verfügbarkeit prüfen' })).toBeVisible();
  await expect(emptyDecision.getByRole('button', { name: 'Plan generieren', exact: true })).toBeVisible();
  await expect(emptyDecision.getByRole('button', { name: 'Coach fragen' })).toBeVisible();

  await emptyDecision.getByRole('button', { name: 'Verfügbarkeit prüfen' }).click();
  await expect(page.getByText('Verfügbarkeit — nächste 2 Wochen')).toBeVisible();

  await emptyDecision.getByRole('button', { name: 'Plan generieren', exact: true }).click();
  await expect(page.getByText('Erstellt einen wissenschaftlich fundierten Wochenplan')).toBeVisible();

  await emptyDecision.getByRole('button', { name: 'Coach fragen' }).click();
  await expect(page).toHaveURL(/\/coach\?focus=plan&prompt=/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/kein offenes Training/i);
});

test('Plan shows race command with readiness evidence', async ({ page }) => {
  await mockPulseApi(page, {
    raceCommand: {
      race: {
        goalId: 'race-1',
        title: '70.3 Kraichgau',
        date: '2026-05-12',
        daysUntil: 10,
        phase: 'taper',
        discipline: 'triathlon_70_3',
        distanceKm: 113,
        targetTimeSec: 18_900,
        priority: 'A',
        predictedTimeSec: 19_080,
        predictionConfidence: 'medium',
        location: 'Kraichgau',
        notes: 'A-Rennen',
      },
      phase: {
        key: 'taper',
        label: 'Taper',
        daysUntil: 10,
        description: 'Taper: Fitness halten, Müdigkeit abbauen.',
      },
      readinessStatus: 'watch',
      readinessLabel: 'Beobachten',
      nextKeyWorkout: {
        id: 'key-1',
        plannedDate: '2026-05-05',
        activityType: 'bike',
        zone: 4,
        durationMin: 75,
        targetTss: 82,
        description: 'Race-pace Intervalle',
        reason: 'Nächster Schlüsselreiz vor dem Rennen.',
      },
      recoveryBoundary: {
        label: 'Taper-Grenze',
        detail: 'Keine zusätzliche harte Einheit ohne klaren Planbezug.',
        severity: 'caution',
      },
      riskImpact: {
        status: 'watch',
        label: 'Beobachten',
        reasons: ['TSB niedrig'],
      },
      evidence: ['CTL 52.4', 'ATL 64.5', 'TSB -12.1', 'Risiken 1', 'Health-States 0'],
    },
  });

  await page.goto('/plan');

  await expect(page.getByText('Race Command')).toBeVisible();
  await expect(page.getByRole('heading', { name: '70.3 Kraichgau', exact: true })).toBeVisible();
  await expect(page.getByText('Taper').first()).toBeVisible();
  await expect(page.getByText('Schlüsselreiz', { exact: true })).toBeVisible();
  await expect(page.getByText(/Z4 · 75 min · TSS 82/)).toBeVisible();
  await expect(page.getByText('Taper-Grenze')).toBeVisible();
  await expect(page.getByText('CTL 52.4')).toBeVisible();
  await expect(page.getByText('TSB -12.1')).toBeVisible();
});

test('Plan shows season strategy guardrails and intentional free-day rationale', async ({ page }) => {
  await mockPulseApi(page, {
    seasonStrategy: {
      horizonWeeks: 12,
      primaryGoal: { id: 'race-1', title: '70.3 Kraichgau', category: 'race', targetDate: '2026-07-11', priority: 'A' },
      currentBlock: {
        kind: 'build',
        label: 'Build',
        startWeek: '2026-05-04',
        endWeek: '2026-06-01',
        focus: 'Spezifische Belastbarkeit aufbauen, ohne jeden freien Tag zu fuellen.',
      },
      upcomingBlocks: [],
      guardrails: {
        targetSessions: 4,
        maxHardDays: 1,
        deload: false,
        freeDayRationale: 'Pulse nutzt nicht alle verfügbaren Tage: mindestens ein freier Tag bleibt für Erholung, Alltag und bessere Ausführung geschützt.',
        rationale: ['Sechs Tage sind verfügbar, aber nur vier sind sinnvoll.'],
        nextBoundary: { label: 'Taper', date: '2026-06-29' },
      },
      loadModel: {
        method: 'weekly_hours_tss_ctl',
        rampRateCapPct: 7,
        deloadEveryWeeks: 4,
        taperWeeks: 2,
        annualTargetHours: 384,
        annualTargetTss: 18432,
        eventPriorityBias: 'a_event',
        missedLoadCompensation: {
          missedTssLast14d: 120,
          compensationTssNext14d: 42,
          capReason: 'Nur ein Teil verpasster Last wird nachgeholt; Recovery und Ramp-Cap bleiben wichtiger.',
        },
        currentWeek: {
          weekStart: '2026-05-04',
          kind: 'build',
          targetHours: 8,
          targetTss: 384,
          ctlTarget: 42,
          rampPct: 4,
          note: 'Build: konservativer Lastaufbau innerhalb Ramp-Cap.',
        },
        forecast: [
          { weekStart: '2026-05-04', kind: 'build', targetHours: 8, targetTss: 384, ctlTarget: 42, rampPct: 4, note: 'Build: konservativer Lastaufbau innerhalb Ramp-Cap.' },
          { weekStart: '2026-05-11', kind: 'build', targetHours: 8.4, targetTss: 403, ctlTarget: 43, rampPct: 4.9, note: 'Build: konservativer Lastaufbau innerhalb Ramp-Cap.' },
          { weekStart: '2026-05-18', kind: 'build', targetHours: 8.4, targetTss: 403, ctlTarget: 44, rampPct: 0, note: 'Build: konservativer Lastaufbau innerhalb Ramp-Cap.' },
          { weekStart: '2026-05-25', kind: 'deload', targetHours: 5.2, targetTss: 250, ctlTarget: 42.8, rampPct: -38, note: 'Deload: ATL/TSB zuerst beruhigen, danach wieder aufbauen.' },
        ],
        warnings: [],
      },
      evidence: ['A-Race in 10 Wochen', 'TSB 3.0', '6 verfügbare Tage'],
    },
  });

  await page.goto('/plan');

  await expect(page.getByText('Saisonlinie')).toBeVisible();
  await expect(page.getByText('Build · 70.3 Kraichgau')).toBeVisible();
  await expect(page.getByText('4 Einheiten')).toBeVisible();
  await expect(page.getByText('max. 1')).toBeVisible();
  await expect(page.getByText('8h / 384 TSS')).toBeVisible();
  await expect(page.getByText(/Pulse nutzt nicht alle verfügbaren Tage/)).toBeVisible();
  await expect(page.getByText(/Taper ab .*29\.06/)).toBeVisible();
  await expect(page.getByText('6 verfügbare Tage')).toBeVisible();
});

test('Plan season strategy keeps rendering when load model is absent', async ({ page }) => {
  await mockPulseApi(page, {
    seasonStrategy: {
      horizonWeeks: 12,
      primaryGoal: null,
      currentBlock: {
        kind: 'maintenance',
        label: 'Maintenance',
        startWeek: '2026-05-04',
        endWeek: '2026-06-01',
        focus: 'Robuste Routine erhalten und Spielraum für Alltag lassen.',
      },
      upcomingBlocks: [],
      guardrails: {
        targetSessions: 3,
        maxHardDays: 1,
        deload: false,
        freeDayRationale: 'Mindestens ein freier Tag bleibt geschützt.',
        rationale: ['Health- und Risk-Regeln bleiben stärker.'],
        nextBoundary: null,
      },
      loadModel: undefined,
      evidence: ['Maintenance ohne Race-Ziel'],
    },
  });

  await page.goto('/plan');

  await expect(page.getByText('Saisonlinie')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Maintenance' })).toBeVisible();
  await expect(page.getByText('Saisonlast')).toHaveCount(0);
  await expect(page.getByText('Maintenance ohne Race-Ziel')).toBeVisible();
  await expect(page.getByText('Diese Ansicht ist gerade abgestürzt.')).toHaveCount(0);
});

test('Plan preserves race goal metadata when editing', async ({ page }) => {
  let updateBody: Record<string, unknown> | null = null;
  await mockPulseApi(page, {
    goals: [
      {
        id: 'goal-race-1',
        userId: 'user-1',
        title: '70.3 Kraichgau',
        description: 'Aero-Setup testen',
        targetDate: '2026-05-12',
        status: 'active',
        progress: 0.4,
        metrics: {},
        category: 'race',
        raceDiscipline: 'triathlon_70_3',
        raceDistanceKm: 113,
        raceTargetTimeSec: 18_900,
        racePriority: 'B',
        raceLocation: 'Kraichgau',
        raceNotes: 'Aero-Setup testen',
        createdAt: '2026-05-01T08:00:00.000Z',
        updatedAt: '2026-05-01T08:00:00.000Z',
      },
    ],
    onGoalUpdate: (_id, body) => {
      updateBody = body as Record<string, unknown>;
    },
  });

  await page.goto('/plan');
  await page.getByRole('tab', { name: 'Ziele' }).click();
  await page.getByRole('button', { name: 'Bearbeiten' }).click();

  await expect(page.locator('select').first()).toHaveValue('half');
  await expect(page.locator('input[placeholder="5:15:00 oder 45:00"]')).toHaveValue('5:15:00');
  await expect(page.locator('input[placeholder="z.B. Frankfurt am Main"]')).toHaveValue('Kraichgau');
  await expect(page.locator('input[placeholder="Logistik, Pacing-Plan…"]')).toHaveValue('Aero-Setup testen');

  await page.getByRole('button', { name: 'Speichern' }).click();

  await expect.poll(() => updateBody).not.toBeNull();
  expect(updateBody).toMatchObject({
    category: 'race',
    raceDiscipline: 'triathlon_70_3',
    raceDistanceKm: 113,
    raceTargetTimeSec: 18_900,
    racePriority: 'B',
    raceLocation: 'Kraichgau',
    raceNotes: 'Aero-Setup testen',
  });
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

test('Plan summarizes Garmin sync debt before opening individual workouts', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-local',
        userId: 'user-1',
        plannedDate: '2026-05-04',
        activityType: 'bike',
        zone: 2,
        durationMin: 60,
        distanceKm: null,
        targetTss: 42,
        archetypeId: 'endurance_steady',
        difficultyLevel: 2.1,
        difficultyEnergySystem: 'endurance',
        capabilityFit: 'productive',
        description: 'Noch nicht auf Garmin.',
        steps: null,
        garminWorkoutId: null,
        garminScheduledId: null,
        garminSyncContract: null,
        status: 'planned',
        workoutFeedback: null,
        complianceScore: null,
        origin: 'generated',
        userLocked: false,
        completedActivityId: null,
        executionStatus: 'local_planned',
        executionMatchedAt: null,
        executionMatchConfidence: null,
        executionNotes: null,
      },
      {
        id: 'workout-template',
        userId: 'user-1',
        plannedDate: '2026-05-05',
        activityType: 'run',
        zone: 2,
        durationMin: 45,
        distanceKm: null,
        targetTss: 35,
        archetypeId: 'endurance_steady',
        difficultyLevel: 2,
        difficultyEnergySystem: 'endurance',
        capabilityFit: 'maintenance',
        description: 'Vorlage ohne Kalender.',
        steps: null,
        garminWorkoutId: 'gw-template',
        garminScheduledId: null,
        garminSyncContract: null,
        status: 'planned',
        workoutFeedback: null,
        complianceScore: null,
        origin: 'generated',
        userLocked: false,
        completedActivityId: null,
        executionStatus: 'garmin_template',
        executionMatchedAt: null,
        executionMatchConfidence: null,
        executionNotes: null,
      },
      {
        id: 'workout-degraded',
        userId: 'user-1',
        plannedDate: '2026-05-06',
        activityType: 'swim',
        zone: 3,
        durationMin: 50,
        distanceKm: null,
        targetTss: 50,
        archetypeId: 'threshold',
        difficultyLevel: 3,
        difficultyEnergySystem: 'threshold',
        capabilityFit: 'stretch',
        description: 'Mit Einschränkung.',
        steps: null,
        garminWorkoutId: 'gw-degraded',
        garminScheduledId: 'sched-degraded',
        garminSyncContract: {
          version: 1,
          status: 'degraded',
          payloadReady: true,
          checkedAt: '2026-05-01T08:00:00.000Z',
          summary: 'Garmin-Upload mit Einschränkung: Schwimmen ohne HR-Zielzonen.',
          issues: [],
        },
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
    ],
  });

  await page.goto('/plan');
  const card = page.getByTestId('plan-garmin-sync-debt');
  await expect(card).toContainText('Garmin Sync-Check');
  await expect(card).toContainText('1 lokal');
  await expect(card).toContainText('1 nur Vorlage');
  await expect(card).toContainText('1 Einschränkung');
  await expect(card).toContainText('Gerätehorizont 15 Tage');
  await expect(card).toContainText('3 offen im Gerätehorizont');

  await card.getByRole('button', { name: 'Garmin öffnen' }).click();
  await expect(page).toHaveURL('/settings?section=garmin');
});

test('Plan surfaces an adaptation check when recent Garmin execution diverged', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-missed-review',
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
        id: 'workout-replaced-review',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 3,
        durationMin: 75,
        targetTss: 70,
        status: 'planned',
        description: 'Durch anderes Training ersetzt.',
        executionStatus: 'replaced_or_off_plan',
        executionNotes: 'Am Plantag wurde eine andere Aktivität gefunden.',
      },
      {
        id: 'workout-future-review',
        plannedDate: '2026-05-03',
        activityType: 'bike',
        zone: 2,
        durationMin: 90,
        targetTss: 68,
        status: 'planned',
        description: 'Zukunftsgrundlage.',
        executionStatus: 'garmin_scheduled',
        garminWorkoutId: 'gw-1',
        garminScheduledId: 'sched-1',
      },
    ],
  });

  await page.goto('/plan');
  await expect(page.getByTestId('plan-adaptation-review')).toContainText('Adaptions-Check');
  await expect(page.getByTestId('plan-adaptation-review')).toContainText('Verpasste Einheit');
  await expect(page.getByTestId('plan-adaptation-review')).toContainText('Andere Garmin-Ausführung');

  const adaptationReview = page.getByTestId('plan-adaptation-review');
  await adaptationReview.getByRole('button', { name: 'Szenario prüfen' }).click();
  await expect(page.getByTestId('plan-scenario-preview-card')).toBeInViewport();
  await expect(page.getByTestId('plan-scenario-review-hint')).toContainText('Adaptions-Check vorbereitet');
  await expect(page.getByTestId('plan-scenario-preview-card')).toContainText('Nicht gesperrte Zukunfts-Workouts');
  await expect(page.getByTestId('plan-scenario-preview-card')).not.toContainText('Entspannte Rennradtour mit Stops.');

  await adaptationReview.getByRole('button', { name: 'Plan beibehalten' }).click();
  await expect(page.getByTestId('plan-adaptation-review')).toHaveCount(0);
});

test('Plan shows persisted adaptation events with concrete actions', async ({ page }) => {
  await mockPulseApi(page, {
    adaptationEvents: {
      events: [
        {
          id: 'adapt-sync',
          userId: 'user-1',
          eventDate: '2026-05-01',
          kind: 'sync_debt',
          sourceId: null,
          severity: 'action',
          recommendation: 'sync_garmin',
          summary: 'Garmin-Sync-Schulden müssen vor Ausführung geschlossen werden.',
          evidence: ['2 offene Einheiten'],
          resolvedAt: null,
          createdAt: '2026-05-01T07:00:00.000Z',
        },
        {
          id: 'adapt-recovery',
          userId: 'user-1',
          eventDate: '2026-05-01',
          kind: 'activity_completed',
          sourceId: 'activity-long',
          severity: 'watch',
          recommendation: 'protect_recovery',
          summary: 'Lange reale Einheit erkannt; Folgetage müssen Belastung absorbieren.',
          evidence: ['bike 430 min', 'TSS 310'],
          resolvedAt: null,
          createdAt: '2026-05-01T06:00:00.000Z',
        },
        {
          id: 'adapt-move',
          userId: 'user-1',
          eventDate: '2026-05-01',
          kind: 'planned_workout_missed',
          sourceId: 'workout-missed',
          severity: 'watch',
          recommendation: 'move_workout',
          summary: 'Mindestens eine geplante Einheit wurde nicht ausgeführt.',
          evidence: ['2026-04-30: run Z2 45 min'],
          resolvedAt: null,
          createdAt: '2026-05-01T05:00:00.000Z',
        },
      ],
    },
  });

  await page.goto('/plan');
  const card = page.getByTestId('plan-adaptation-events');
  await expect(card).toContainText('Adaptionshinweise');
  await expect(card).toContainText('Garmin-Sync-Schulden');
  await expect(card).toContainText('Lange reale Einheit erkannt');

  await card.getByRole('button', { name: 'Szenario prüfen' }).first().click();
  await expect(page.getByTestId('plan-scenario-preview-card')).toBeInViewport();
  await expect(page.getByTestId('plan-scenario-review-hint')).toContainText('Umfang senken');

  await card.getByRole('button', { name: 'Szenario prüfen' }).nth(1).click();
  await expect(page.getByTestId('plan-scenario-review-hint')).toContainText('Verschieben');

  await card.getByRole('button', { name: 'Garmin öffnen' }).click();
  await expect(page).toHaveURL('/settings?section=garmin');
});

test('Plan explains Garmin workout sync confidence in the workout modal', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-local',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 45,
        status: 'planned',
        description: 'Lokale Grundlage.',
        garminWorkoutId: null,
        garminScheduledId: null,
        executionStatus: 'local_planned',
      },
      {
        id: 'workout-calendar',
        plannedDate: '2026-05-02',
        activityType: 'run',
        zone: 3,
        durationMin: 50,
        status: 'planned',
        description: 'Kalendertermin.',
        garminWorkoutId: 'gw-calendar',
        garminScheduledId: 'sched-calendar',
        executionStatus: 'garmin_scheduled',
      },
    ],
  });

  await page.goto('/plan');
  await expect(page.getByText('Lokal').first()).toBeVisible();
  await expect(page.getByText('Kalender').first()).toBeVisible();

  await page.getByText('Kalendertermin.').click();
  const panel = page.getByTestId('garmin-sync-confidence');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Auf Garmin geplant');
  await expect(panel).toContainText('Template und Kalendertermin sind vorhanden.');
});

test('Plan surfaces Garmin sync contract degradations before execution', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-swim-contract',
        plannedDate: '2026-05-02',
        activityType: 'swim',
        zone: 3,
        durationMin: 45,
        status: 'planned',
        description: 'Schwimmen mit Zielbereich.',
        garminWorkoutId: 'gw-swim',
        garminScheduledId: 'sched-swim',
        executionStatus: 'garmin_scheduled',
        garminSyncContract: {
          version: 1,
          status: 'degraded',
          payloadReady: true,
          checkedAt: '2026-05-09T12:00:00.000Z',
          summary: 'Garmin-Upload mit Einschränkung: Schwimmen wird auf Garmin ohne HR-Zielzonen hochgeladen.',
          issues: [{
            code: 'unsupported_hr_target',
            severity: 'warning',
            message: 'Schwimmen wird auf Garmin ohne HR-Zielzonen hochgeladen.',
          }],
        },
      },
    ],
  });

  await page.goto('/plan');
  await expect(page.getByText('Garmin mit Einschränkung')).toBeVisible();

  await page.getByText('Schwimmen mit Zielbereich.').click();
  const panel = page.getByTestId('garmin-sync-confidence');
  await expect(panel).toContainText('Garmin mit Einschränkung');
  await expect(panel).toContainText('ohne HR-Zielzonen');
});

test('Plan workout modal explains latest Garmin execution ledger entry', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-ledger',
        plannedDate: '2026-05-02',
        activityType: 'bike',
        zone: 4,
        durationMin: 60,
        status: 'planned',
        description: 'Ledger-Workout mit Repeat.',
        garminWorkoutId: 'gw-ledger',
        garminScheduledId: 'sched-ledger',
        executionStatus: 'garmin_scheduled',
        steps: [
          { type: 'warmup', durationMin: 10, zone: 1, description: 'Einrollen' },
          { type: 'interval', durationMin: 8, reps: 3, restMin: 3, zone: 4, description: 'Schwelle' },
          { type: 'cooldown', durationMin: 10, zone: 1, description: 'Ausrollen' },
        ],
      },
    ],
    garminExecutionLedger: {
      entries: [{
        id: 'ledger-1',
        plannedWorkoutId: 'workout-ledger',
        attemptedAt: '2026-05-10T10:00:00.000Z',
        operation: 'manual_resync',
        outcome: 'ready',
        summary: 'Garmin-Ausfuehrung bereit und lokal verifiziert.',
        payloadSnapshot: {
          workoutId: 'gw-ledger',
          scheduledId: 'sched-ledger',
          stepCount: 5,
          repeatGroupCount: 1,
          invalidRepeatCount: 0,
          hrTargetStepCount: 4,
          durationSec: 3600,
          checkedAt: '2026-05-10T10:00:00.000Z',
        },
        issues: [],
        errorMessage: null,
      }],
    },
  });

  await page.goto('/plan');
  await page.getByText('Ledger-Workout mit Repeat.').click();

  const ledger = page.getByTestId('garmin-execution-ledger');
  await expect(ledger).toBeVisible();
  await expect(ledger).toContainText('Garmin Ausführung');
  await expect(ledger).toContainText('1 Wiederholungsblock');
  await expect(ledger).toContainText('4 HR-Zielschritte');
  await expect(ledger).toContainText('0 Repeat-Fehler');
});

test('Plan workout modal shows Fueling and Recovery guidance for long sessions', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-fuel',
        plannedDate: '2026-05-02',
        activityType: 'bike',
        zone: 3,
        durationMin: 180,
        status: 'planned',
        description: 'Lange Ausfahrt mit Race-Fueling.',
        garminWorkoutId: 'gw-fuel',
        garminScheduledId: 'sched-fuel',
        executionStatus: 'garmin_scheduled',
      },
    ],
    fuelingGuidance: (workoutId) => ({
      shouldShow: workoutId === 'workout-fuel',
      preferenceStatus: 'ready',
      before: [{ id: 'before', text: '2-3 h vorher ca. 80-160 g Kohlenhydrate.' }],
      during: [
        { id: 'carbs', text: '60-90 g Kohlenhydrate pro Stunde; Ministry als Produktanker nutzen.' },
        { id: 'sodium', text: '400-800 mg Sodium pro Liter, an Hitze und Schweißrate anpassen.' },
      ],
      after: [{ id: 'after', text: 'Recovery innerhalb von 2 h starten.' }],
      recoveryCautions: [],
      evidence: [
        { label: 'Workout', value: '180 min Zone 3', status: 'supporting' },
        { label: 'Guideline', value: 'Rad lang: Carb-/Sodium-Plan sinnvoll', status: 'supporting' },
      ],
    }),
  });

  await page.goto('/plan');
  await page.getByText('Lange Ausfahrt mit Race-Fueling.').click();

  const card = page.getByTestId('fueling-recovery-guidance');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Fueling & Recovery');
  await expect(card).toContainText('60-90 g Kohlenhydrate pro Stunde');
  await expect(card).toContainText('400-800 mg Sodium pro Liter');
  await expect(card).toContainText('Recovery innerhalb von 2 h');
  await expect(card).toContainText('Workout');
});

test('Plan keeps Garmin confidence visible when sync-garmin fails', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-sync-fail',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 45,
        status: 'planned',
        description: 'Sync-Test.',
        garminWorkoutId: null,
        garminScheduledId: null,
        executionStatus: 'local_planned',
        steps: [
          { type: 'warmup', durationMin: 10, zone: 1, description: 'Einrollen' },
          { type: 'steady', durationMin: 25, zone: 2, description: 'Grundlage' },
          { type: 'cooldown', durationMin: 10, zone: 1, description: 'Ausschwingen' },
        ],
      },
    ],
    failEndpoints: {
      'POST /api/pulse/plan/workout/workout-sync-fail/sync-garmin': {
        status: 503,
        error: 'Garmin Sync fehlgeschlagen.',
      },
    },
  });

  await page.goto('/plan');
  await page.getByText('Sync-Test.').click();
  const panel = page.getByTestId('garmin-sync-confidence');
  await expect(panel).toContainText('Nur in Pulse geplant');

  await page.getByRole('button', { name: /Auf Garmin/ }).click();
  await expect(page.getByText('Garmin Sync fehlgeschlagen.')).toBeVisible();
  await expect(panel).toContainText('Nur in Pulse geplant');
});

test('Plan workout rows expose Garmin structure before opening detail', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-row-structure',
        plannedDate: '2026-05-02',
        activityType: 'bike',
        zone: 4,
        durationMin: 62,
        targetTss: 74,
        status: 'planned',
        description: 'Schwellenintervalle mit sauberem Garmin-Repeat.',
        garminWorkoutId: null,
        garminScheduledId: null,
        executionStatus: 'local_planned',
        steps: [
          { type: 'warmup', durationMin: 12, zone: 1, description: 'Einrollen', targetLabel: 'Z1 105-125 bpm' },
          { type: 'interval', durationMin: 8, zone: 4, reps: 4, restMin: 3, description: 'Schwelle', targetLabel: 'Z4 158-172 bpm' },
          { type: 'cooldown', durationMin: 9, zone: 1, description: 'Ausschwingen', targetLabel: 'Z1 105-125 bpm' },
        ],
      },
    ],
  });

  await page.goto('/plan');

  const structure = page.getByTestId('plan-workout-structure-summary');
  await expect(structure).toBeVisible();
  await expect(structure).toContainText('3 Blöcke');
  await expect(structure).toContainText('1 Repeat');
  await expect(structure).toContainText('3 HR-Ziele');
  await expect(structure).toContainText('62 min');
});

test('Plan sport switch explains detail rebuild and Garmin resync', async ({ page }) => {
  const updates: Array<{ id: string; body: Record<string, unknown> }> = [];
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-sport-switch',
        plannedDate: '2026-05-02',
        activityType: 'bike',
        zone: 4,
        durationMin: 62,
        targetTss: 74,
        status: 'planned',
        description: 'Rad-Schwellenintervalle.',
        garminWorkoutId: 'old-garmin-workout',
        garminScheduledId: 'old-garmin-schedule',
        executionStatus: 'garmin_scheduled',
        steps: [
          { type: 'interval', durationMin: 8, zone: 4, reps: 4, restMin: 3, description: 'Schwelle', targetLabel: 'Z4 158-172 bpm' },
        ],
      },
    ],
    onPlanWorkoutUpdate: (id, body) => updates.push({ id, body: body as Record<string, unknown> }),
  });

  await page.goto('/plan');
  await page.getByRole('button', { name: 'Sportart ändern' }).click();
  await page.getByRole('button', { name: 'Laufen' }).click();

  await expect.poll(() => updates).toEqual([
    { id: 'workout-sport-switch', body: { activityType: 'run' } },
  ]);
  const notice = page.getByTestId('plan-workout-update-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Sportart aktualisiert');
  await expect(notice).toContainText('Beschreibung');
  await expect(notice).toContainText('Garmin');
});

test('Plan workout detail summarizes the Garmin handoff before syncing', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-garmin-handoff',
        plannedDate: '2026-05-02',
        activityType: 'bike',
        zone: 4,
        durationMin: 62,
        targetTss: 74,
        status: 'planned',
        description: 'Schwellenintervalle mit sauberem Garmin-Repeat.',
        garminWorkoutId: null,
        garminScheduledId: null,
        executionStatus: 'local_planned',
        steps: [
          { type: 'warmup', durationMin: 12, zone: 1, description: 'Einrollen', targetLabel: 'Z1 105-125 bpm' },
          { type: 'interval', durationMin: 8, zone: 4, reps: 4, restMin: 3, description: 'Schwelle', targetLabel: 'Z4 158-172 bpm' },
          { type: 'cooldown', durationMin: 9, zone: 1, description: 'Ausschwingen', targetLabel: 'Z1 105-125 bpm' },
        ],
      },
    ],
  });

  await page.goto('/plan');
  await page.getByText('Schwellenintervalle mit sauberem Garmin-Repeat.').click();

  const handoff = page.getByTestId('garmin-workout-handoff');
  await expect(handoff).toBeVisible();
  await expect(handoff).toContainText('Garmin Workout-Inhalt');
  await expect(handoff).toContainText('3 Blöcke');
  await expect(handoff).toContainText('1 Repeat-Block');
  await expect(handoff).toContainText('4 Wiederholungen');
  await expect(handoff).toContainText('3 HR-Ziele');
  await expect(handoff).toContainText('Prüfe hier, was auf Uhr oder Edge landet');
});

test('Plan alternatives adapt the next workout with semantic choices', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  const updates: unknown[] = [];
  await mockPulseApi(page, {
    load: { date: '2026-05-01', ctl: 42.4, atl: 58.2, tsb: -15.8, cached: false },
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

  const decision = page.getByTestId('next-training-decision');
  await expect(page.getByText('ALTERNATIVEN')).toBeVisible();
  await expect(page.getByText('Einbezogen: TSB -15.8')).toBeVisible();
  await expect(page.getByText('Ziele 1 aktiv')).toBeVisible();
  await expect(decision.getByText('ADAPTIONS-CHECK')).toBeVisible();
  await expect(decision.getByText('1 Empfehlung prüfen')).toBeVisible();
  await expect(decision.getByText('Leichter empfohlen')).toBeVisible();
  await expect(decision.getByRole('button', { name: /Kürzer/ })).toBeVisible();
  const easier = decision.getByRole('button', { name: /Leichter/ });
  await expect(easier).toBeVisible();
  await expect(easier).toContainText('Empfohlen');
  await expect(easier).toContainText('TSB/Risiko');
  await expect(decision.getByRole('button', { name: /Verschieben/ })).toBeVisible();
  await expect(decision.getByRole('button', { name: /Frei lassen/ })).toBeVisible();

  await easier.click();
  await expect.poll(() => updates).toHaveLength(1);
  expect(updates[0]).toMatchObject({
    zone: 2,
    durationMin: 75,
    status: 'planned',
  });
});

test('Plan alternatives offer goal-oriented extra endurance only when signals are green', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  const updates: unknown[] = [];
  await mockPulseApi(page, {
    load: { date: '2026-05-01', ctl: 42.4, atl: 36.1, tsb: 8.4, cached: false },
    planWorkouts: [
      {
        id: 'workout-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 60,
        targetTss: 45,
        status: 'planned',
        description: 'Lockere Grundlage, wenn die Signale grün bleiben.',
      },
    ],
    planTrace: {
      weekStart: '2026-04-27',
      inputSnapshot: {
        load: { ctl: 42.4, atl: 36.1, tsb: 8.4 },
        phase: 'base',
        weeklyHoursTarget: 8,
        goals: [{ title: 'Ausdauerbasis ausbauen' }],
        riskSignals: [],
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

  const decision = page.getByTestId('next-training-decision');
  await expect(decision.getByText('ADAPTIONS-CHECK')).toBeVisible();
  await expect(decision.getByText('1 Empfehlung prüfen')).toBeVisible();
  const longer = decision.getByRole('button', { name: /Länger/ });
  await expect(longer).toBeVisible();
  await expect(longer).toContainText('Empfohlen');
  await expect(longer).toContainText('Ziel + grüne Signale');

  await longer.click();
  await expect.poll(() => updates).toHaveLength(1);
  expect(updates[0]).toMatchObject({
    durationMin: 75,
    status: 'planned',
  });
});

test('Plan decision uses current fitness load instead of a stale generation trace', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  await mockPulseApi(page, {
    load: { date: '2026-05-01', ctl: 16.9, atl: 43.7, tsb: -26.8, cached: false },
    planWorkouts: [
      {
        id: 'workout-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 90,
        targetTss: 68,
        status: 'planned',
        description: 'Ruhige Grundlage, nur wenn die Tagesform passt.',
      },
    ],
    planTrace: {
      weekStart: '2026-04-27',
      inputSnapshot: {
        load: { ctl: 42.4, atl: 42.7, tsb: -0.3 },
        phase: 'base',
        weeklyHoursTarget: 8,
        goals: [{ title: 'Ausdauerbasis ausbauen' }],
        riskSignals: [],
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

  const decision = page.getByTestId('next-training-decision');
  await expect(decision.getByText('Einbezogen: TSB -26.8')).toBeVisible();
  await expect(decision.getByText('TSB -0.3')).toHaveCount(0);
  await expect(decision.getByText('Frei lassen empfohlen')).toBeVisible();
  await expect(decision.getByRole('button', { name: /Frei lassen/ })).toContainText('Empfohlen');
});

test('Plan alternatives avoid stale trace context for next-week workouts', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  await mockPulseApi(page, {
    load: { date: '2026-05-01', ctl: 16.9, atl: 43.7, tsb: -26.8, cached: false },
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
  await expect(page.getByText('Einbezogen: TSB -26.8')).toBeVisible();
  await expect(page.getByText('Verfügbarkeit offen')).toBeVisible();
});

test('Plan trace shows execution rationale and deliberate free days', async ({ page }) => {
  await mockPulseApi(page, {
    planTrace: {
      id: 'trace-1',
      userId: 'user-1',
      weekStart: '2026-05-04',
      createdAt: '2026-05-04T06:00:00.000Z',
      inputSnapshot: {
        load: { ctl: 42.4, atl: 40.1, tsb: 6.2, date: '2026-05-04' },
        phase: 'build',
        mesocycleWeek: 2,
        weeklyHoursTarget: 8,
        availableDays: [0, 1, 2, 3],
        profile: { ftpWatts: 260, maxHrBpm: 185, lthrBpm: 170 },
        goals: [{ title: 'FTP Aufbau', category: 'ftp', targetDate: null, raceDiscipline: null, raceDistanceKm: null, racePriority: null }],
        riskSignals: [],
        healthStates: [],
        recentRpe: [],
        rpeReasons: [],
        dataWarnings: [],
        recentSportMix: { bike: { sessions: 2, totalMinutes: 120, totalTss: 110 } },
        learningSnapshot: null,
        adaptation: {
          learnedFromExecution: ['Ausführung stabil: 2/2 Einheiten abgeglichen.'],
          variationRationale: ['Planstruktur bleibt bewusst ähnlich.'],
          signals: ['matched', 'maintain_structure'],
        },
        restDayRationale: [
          { date: '2026-05-07', reason: 'Bewusster freier Tag: stabile Ausführung und gute Erholung.' },
        ],
        goalLimiter: {
          kind: 'threshold_vo2',
          label: 'Schwelle + VO2',
          confidence: 'medium',
          evidence: ['Schwelle/VO2 2.2/2.1', 'Endurance 4.6'],
          planBias: 'eine kontrollierte Schwellen-/VO2-Schlüsseleinheit setzen',
          workoutFocus: ['threshold', 'vo2'],
        },
      },
      adaptation: {
        learnedFromExecution: ['Ausführung stabil: 2/2 Einheiten abgeglichen.'],
        variationRationale: ['Planstruktur bleibt bewusst ähnlich.'],
        signals: ['matched', 'maintain_structure'],
      },
      restDayRationale: [
        { date: '2026-05-07', reason: 'Bewusster freier Tag: stabile Ausführung und gute Erholung.' },
      ],
      sportMix: { bike: { sessions: 2, totalMinutes: 110, totalTss: 120 } },
      generatedSummary: ['Ausführung: Ausführung stabil: 2/2 Einheiten abgeglichen.'],
      hardDays: [{ date: '2026-05-06', activityType: 'bike', zone: 4, durationMin: 50 }],
      planDecision: {
        selectedDays: [0, 2],
        skippedAvailableDays: [1, 3],
        targetSessionCount: 2,
        primaryGoal: 'ftp',
        reasons: [
          'Fueling-Toleranz: lange Ausdauerreize bleiben gedeckelt.',
          'TSB -14.2 und RPE 7 -> Erholung schützen.',
          'Ausführung stabil: ähnliche Struktur ist bewusst gewählt.',
          'Limiter: Schwelle + VO2 — eine kontrollierte Schwellen-/VO2-Schlüsseleinheit setzen.',
          'Do verfügbar, bleibt frei als Reserve.',
        ],
      },
    },
  });

  await page.goto('/plan');

  await expect(page.getByText('Warum diese Woche so?')).toBeVisible();
  await expect(page.getByText('2 Einheiten · Ziel: ftp · 2 freie verfügbare Tage')).toBeVisible();
  await expect(page.getByText('Fueling', { exact: true })).toBeVisible();
  await expect(page.getByText('Erholung', { exact: true })).toBeVisible();
  await expect(page.getByText('Variation', { exact: true })).toBeVisible();
  await expect(page.getByText('Freie Tage', { exact: true })).toBeVisible();
  await expect(page.getByText('Zielbezug', { exact: true })).toBeVisible();
  await expect(page.getByText('Limiter · Schwelle + VO2')).toBeVisible();
  await expect(page.getByText('eine kontrollierte Schwellen-/VO2-Schlüsseleinheit setzen').first()).toBeVisible();
  await expect(page.getByText('Gelernt aus Ausführung')).toBeVisible();
  await expect(page.getByText('Warum ähnlich/anders')).toBeVisible();
  await expect(page.getByText('Freie Tage bewusst')).toBeVisible();
  await expect(page.getByText(/2026-05-07: Bewusster freier Tag/)).toBeVisible();
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
  await page.getByRole('tab', { name: 'Abdeckung' }).click();

  await expect(page.getByText('Coverage Diagnose')).toBeVisible();
  await expect(page.getByText('Status', { exact: true })).toBeVisible();
  await expect(page.getByText('Ursache', { exact: true })).toBeVisible();
  await expect(page.getByText('Aktion', { exact: true })).toBeVisible();
  await expect(page.getByText('Profil unvollständig')).toBeVisible();
  const backfillAction = page.getByText('Backfill möglich.');
  await expect((page.viewportSize()?.width ?? 999) <= 600 ? backfillAction.last() : backfillAction.first()).toBeVisible();
  await expect(page.getByText('Vorschau verändert nichts; Nachladen schreibt Garmin-Daten für den gewählten Monat in Pulse.')).toBeVisible();
});

test('Data shows Garmin domain quality and affected-tab hints', async ({ page }) => {
  await mockPulseApi(page, {
    garminCoverage: {
      range: { from: '2026-04-02', to: '2026-05-01', days: 30 },
      generatedAt: '2026-05-01T08:00:00.000Z',
      circuit: { status: 'ok', failures: 0, reason: null },
      domains: [
        {
          domain: 'activities',
          label: 'Aktivitäten',
          status: 'fresh',
          reason: 'Aktivitäten sind frisch synchronisiert.',
          lastFreshAt: '2026-05-01T06:00:00.000Z',
          lastFreshDate: '2026-05-01',
          missingDays: 0,
          partialDays: 0,
          repairableDays: 0,
          repairAction: null,
          evidence: ['1 Aktivitäten'],
        },
        {
          domain: 'sleep',
          label: 'Schlaf',
          status: 'partial',
          reason: 'Schlaf ist vorhanden, aber Detailstufen fehlen.',
          lastFreshAt: '2026-05-01T00:00:00.000Z',
          lastFreshDate: '2026-05-01',
          missingDays: 0,
          partialDays: 2,
          repairableDays: 2,
          repairAction: { type: 'backfill', label: 'Schlaf nachladen', route: '/data?tab=abdeckung', domains: ['sleep'], candidateDays: ['2026-04-30', '2026-05-01'] },
          evidence: ['2 Tage mit Schlafphasen'],
        },
        {
          domain: 'body_composition',
          label: 'Körperdaten',
          status: 'stale',
          reason: 'Gewicht ist vorhanden, aber Körperzusammensetzung fehlt oder ist alt.',
          lastFreshAt: null,
          lastFreshDate: '2026-05-01',
          missingDays: 0,
          partialDays: 1,
          repairableDays: 1,
          repairAction: { type: 'backfill', label: 'Körperdaten nachladen', route: '/data?tab=abdeckung', domains: ['weight'], candidateDays: ['2026-05-01'] },
          evidence: ['1 Gewichtseinträge'],
        },
      ],
    },
  });

  await page.goto('/data');
  await page.getByRole('tab', { name: 'Abdeckung' }).click();

  await expect(page.getByTestId('garmin-quality-panel')).toContainText('Garmin Domainqualität');
  await expect(page.getByTestId('garmin-quality-sleep')).toContainText('TEIL');
  await expect(page.getByTestId('garmin-quality-body_composition')).toContainText('ALT');
  await expect(page.getByTestId('garmin-quality-body_composition')).toContainText('Körperzusammensetzung fehlt');

  await page.getByRole('tab', { name: 'Gewicht' }).click();
  await expect(page.getByTestId('garmin-quality-hint')).toContainText('Körperdaten');
  await expect(page.getByTestId('garmin-quality-hint')).toContainText('ALT');
});

test('Data shows Garmin signal usefulness priorities', async ({ page }) => {
  await mockPulseApi(page, {
    garminSignalUsefulness: {
      range: { from: '2026-04-02', to: '2026-05-01', days: 30 },
      summary: { used: 2, underused: 3, missingOrSparse: 1 },
      topUnderused: [
        {
          signalKey: 'body_battery_depth',
          label: 'Body Battery Tiefe',
          status: 'underused',
          coverageDays: 21,
          sampleDays: ['2026-05-01'],
          currentConsumers: ['Data'],
          recommendedNextConsumer: 'daily_decision',
          whyItMatters: 'Charge und Drain zeigen, ob Erholung wirklich aufgebaut wurde.',
          evidence: ['Aufwachen 68%'],
        },
        {
          signalKey: 'activity_hr_zones_laps',
          label: 'HR-Zonen + Laps',
          status: 'underused',
          coverageDays: 8,
          sampleDays: ['2026-05-01'],
          currentConsumers: ['Activity Detail'],
          recommendedNextConsumer: 'plan_generation',
          whyItMatters: 'HR-Zonen und Laps zeigen Ausführungsqualität.',
          evidence: ['8 Tage mit Detailcache'],
        },
      ],
      recommendedUseCases: ['daily_decision', 'plan_generation'],
      items: [],
    },
  });

  await page.goto('/data');
  await page.getByRole('tab', { name: 'Abdeckung' }).click();

  await expect(page.getByTestId('garmin-signal-usefulness-panel')).toContainText('Garmin Signalnutzen');
  await expect(page.getByTestId('garmin-signal-body_battery_depth')).toContainText('UNTERGENUTZT');
  await expect(page.getByTestId('garmin-signal-body_battery_depth')).toContainText('Daily Decision');
  await expect(page.getByTestId('garmin-signal-activity_hr_zones_laps')).toContainText('Plan-Generierung');
});

test('Settings surfaces blocked Garmin provider state with bounded actions', async ({ page }) => {
  const requests: Array<{ method: string; pathname: string }> = [];
  await mockPulseApi(page, {
    onRequest: (pathname, method) => requests.push({ pathname, method }),
    garminCoverage: {
      range: { from: '2026-04-02', to: '2026-05-01', days: 30 },
      generatedAt: '2026-05-01T08:00:00.000Z',
      circuit: { status: 'open', failures: 3, reason: 'Garmin rate limit' },
      domains: [
        {
          domain: 'daily_metrics',
          label: 'Tagesmetriken',
          status: 'blocked',
          reason: 'Garmin rate limit',
          lastFreshAt: '2026-04-30T05:00:00.000Z',
          lastFreshDate: '2026-04-30',
          missingDays: 1,
          partialDays: 0,
          repairableDays: 0,
          repairAction: null,
          evidence: ['Circuit Breaker offen'],
        },
        {
          domain: 'calendar',
          label: 'Garmin-Kalender',
          status: 'partial',
          reason: 'Einige zukünftige Workouts sind noch nicht im Garmin-Kalender geplant.',
          lastFreshAt: null,
          lastFreshDate: null,
          missingDays: 1,
          partialDays: 0,
          repairableDays: 1,
          repairAction: { type: 'calendar_sync', label: 'Garmin-Kalender synchronisieren', route: '/settings', candidateDays: ['2026-05-04'] },
          evidence: ['1 ohne Garmin-Termin'],
        },
      ],
    },
  });

  await page.goto('/settings');

  await expect(page.getByText('Domainqualität')).toBeVisible();
  await expect(page.getByTestId('garmin-quality-daily_metrics')).toContainText('BLOCKIERT');
  await expect(page.getByTestId('garmin-quality-daily_metrics')).toContainText('Garmin rate limit');
  await expect(page.getByTestId('garmin-quality-calendar')).toContainText('Sync');

  await page.getByRole('button', { name: 'Garmin-Kalender synchronisieren' }).click();
  await expect(page.getByText('Garmin Kalender synchronisiert')).toBeVisible();
  expect(requests).toContainEqual({ method: 'POST', pathname: '/api/pulse/garmin/calendar/sync' });
});

test('Plan Ausführung shows Garmin execution trust without live sync on load', async ({ page }) => {
  const requests: Array<{ method: string; pathname: string }> = [];
  await mockPulseApi(page, {
    onRequest: (pathname, method) => requests.push({ pathname, method }),
    garminExecutionDiff: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      window: { from: '2026-05-01', to: '2026-05-15', days: 15 },
      rows: [
        {
          workoutId: 'workout-ready',
          plannedDate: '2026-05-02',
          title: 'Rad · Z2 · 75 min',
          status: 'ready',
          summary: 'Auf Garmin bereit: Vorlage und Kalendertermin wurden im Readback gefunden.',
          local: { garminWorkoutId: 'gw-ready', garminScheduledId: 'sched-ready' },
          remote: { workoutId: 'gw-ready', scheduledId: 'sched-ready', lastSeenAt: '2026-05-01T08:00:00.000Z' },
          repairActions: [],
        },
        {
          workoutId: 'workout-missing',
          plannedDate: '2026-05-03',
          title: 'Laufen · Z2 · 45 min',
          status: 'missing_calendar',
          summary: 'Vorlage bekannt, aber die Einheit fehlt im Garmin-Kalenderfenster.',
          local: { garminWorkoutId: 'gw-missing', garminScheduledId: 'sched-missing' },
          remote: { workoutId: null, scheduledId: null, lastSeenAt: null },
          repairActions: ['schedule_calendar'],
        },
        {
          workoutId: 'workout-repeat',
          plannedDate: '2026-05-04',
          title: 'Rad · Z4 · 30 min',
          status: 'broken_repeat',
          summary: 'Remote-Workout hat defekte Wiederholungen und sollte neu synchronisiert werden.',
          local: { garminWorkoutId: 'gw-repeat', garminScheduledId: 'sched-repeat' },
          remote: { workoutId: 'gw-repeat', scheduledId: 'sched-repeat', lastSeenAt: '2026-05-01T08:00:00.000Z' },
          repairActions: ['repair_repeat'],
        },
      ],
    },
  });

  await page.goto('/plan?tab=training');
  await page.getByRole('tab', { name: 'Ausführung' }).click();

  const panel = page.getByTestId('garmin-execution-trust-panel');
  await expect(panel).toContainText('Auf Garmin bereit');
  await expect(panel).toContainText('Fehlt im Garmin-Kalender');
  await expect(panel).toContainText('Repeat reparieren');
  expect(requests).toContainEqual({ method: 'GET', pathname: '/api/pulse/garmin/execution-diff' });
  expect(requests).not.toContainEqual({ method: 'POST', pathname: '/api/pulse/garmin/calendar/sync' });
  expect(requests).not.toContainEqual({ method: 'POST', pathname: '/api/pulse/plan/workout/workout-repeat/sync-garmin' });
});

test('Plan Ausführung repair actions call existing Garmin repair endpoints only after explicit click', async ({ page }) => {
  const requests: Array<{ method: string; pathname: string }> = [];
  await mockPulseApi(page, {
    onRequest: (pathname, method) => requests.push({ pathname, method }),
    garminExecutionDiff: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      window: { from: '2026-05-01', to: '2026-05-15', days: 15 },
      rows: [
        {
          workoutId: 'workout-upload',
          plannedDate: '2026-05-02',
          title: 'Rad · Z2 · 75 min',
          status: 'missing_template',
          summary: 'In Pulse geplant, aber es gibt noch keine Garmin-Workout-Vorlage.',
          local: { garminWorkoutId: null, garminScheduledId: null },
          remote: { workoutId: null, scheduledId: null, lastSeenAt: null },
          repairActions: ['upload_template'],
        },
        {
          workoutId: 'workout-calendar',
          plannedDate: '2026-05-03',
          title: 'Laufen · Z2 · 45 min',
          status: 'missing_calendar',
          summary: 'Vorlage bekannt, aber die Einheit fehlt im Garmin-Kalenderfenster.',
          local: { garminWorkoutId: 'gw-calendar', garminScheduledId: 'sched-calendar' },
          remote: { workoutId: null, scheduledId: null, lastSeenAt: null },
          repairActions: ['schedule_calendar'],
        },
      ],
    },
  });

  await page.goto('/plan?tab=execution');
  const panel = page.getByTestId('garmin-execution-trust-panel');
  await expect(panel).toContainText('Vorlage hochladen');
  await expect(panel).toContainText('Kalender syncen');
  expect(requests.filter(request => request.method === 'POST')).toEqual([]);

  await panel.getByRole('button', { name: 'Vorlage hochladen' }).click();
  await expect(panel).toContainText('Reparatur ausgeführt');
  expect(requests).toContainEqual({ method: 'POST', pathname: '/api/pulse/plan/workout/workout-upload/sync-garmin' });

  await panel.getByRole('button', { name: 'Kalender syncen' }).click();
  expect(requests).toContainEqual({ method: 'POST', pathname: '/api/pulse/garmin/calendar/sync' });
});

test('Plan Statistik shows progression guidance in capability levels', async ({ page }) => {
  await mockPulseApi(page);
  await page.goto('/plan?tab=stats');

  await expect(page.getByText('Capability Levels')).toBeVisible();
  await expect(page.getByText('nächster produktiver Reiz 4.0')).toBeVisible();
  await expect(page.getByText('geschützt · nächster Reiz 4.3')).toBeVisible();
});

test('Plan Training highlights the why-this-workout rationale separately from the body copy', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [
      {
        id: 'workout-rationale',
        plannedDate: '2026-05-11',
        activityType: 'bike',
        zone: 2,
        durationMin: 90,
        targetTss: 74,
        archetypeId: 'endurance_cadence',
        capabilityFit: 'productive',
        status: 'planned',
        description: 'Warum diese Einheit: Cadence Endurance, aerober Reiz passt zur aktuellen Belastung, RPE unauffaellig, GI unauffaellig, mentale Lage ohne harte Bremse. Aerobe Grundlage, primaer ueber Puls steuern.',
      },
    ],
  });

  await page.goto('/plan?tab=training');

  await expect(page.getByTestId('plan-workout-rationale')).toContainText('Warum diese Einheit');
  await expect(page.getByTestId('plan-workout-description-body')).toContainText('Aerobe Grundlage, primaer ueber Puls steuern.');
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
  await page.getByRole('tab', { name: 'Abdeckung' }).click();
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

  const pushSection = page.locator('[data-settings-section="push"]');
  await expect(pushSection.getByText('BROWSER BLOCKIERT')).toBeVisible();
  await expect(pushSection.getByText('Server ist bereit, aber dieser Browser erlaubt keine neuen Push-Abos.')).toBeVisible();
  await expect(pushSection.getByText('bereit').first()).toBeVisible();
  await expect(pushSection.getByText('denied')).toBeVisible();
  await expect(pushSection.getByText('1 aktiv')).toBeVisible();
  await expect(pushSection.getByText('Test sendet an alle aktiven registrierten Geräte.')).toHaveCount(0);
  await expect(pushSection.getByText('push.example.test · Endpunkt gespeichert')).toBeVisible();
  await expect(pushSection.getByText('very/long/secret')).toHaveCount(0);
});

test('Settings diagnostics matrix is visible first and routes to support sections', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/settings');
  const matrix = page.getByTestId('settings-diagnostics-matrix');
  await expect(matrix).toBeVisible();
  await expect(matrix).toContainText('DIAGNOSE');
  await expect(matrix).toContainText('Zugriff');
  await expect(matrix).toContainText('Zertifikat');

  const matrixBox = await matrix.boundingBox();
  const profileBox = await page.getByRole('heading', { name: 'Profil', exact: true }).boundingBox();
  expect(matrixBox).not.toBeNull();
  expect(profileBox).not.toBeNull();
  expect(matrixBox!.y).toBeLessThan(profileBox!.y);

  await matrix.getByRole('button', { name: 'Gerät', exact: true }).click();
  await expect(page).toHaveURL('/settings?section=device');
  await expect(page.getByRole('heading', { name: 'iPhone & PWA' })).toBeVisible();
});

test('Settings diagnostics matrix separates denied push and blocked Garmin states', async ({ page }) => {
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
      subscriptions: [],
    },
    garminCoverage: {
      range: { from: '2026-04-02', to: '2026-05-01', days: 30 },
      generatedAt: '2026-05-01T08:00:00.000Z',
      circuit: { status: 'open', failures: 3, reason: 'Garmin rate limit' },
      domains: [{
        domain: 'daily_metrics',
        label: 'Tagesmetriken',
        status: 'blocked',
        reason: 'Garmin blockiert weitere Requests.',
        lastFreshAt: null,
        lastFreshDate: '2026-04-29',
        missingDays: 2,
        partialDays: 0,
        repairableDays: 0,
        repairAction: null,
        evidence: ['Circuit offen'],
      }],
    },
  });

  await page.goto('/settings');
  const matrix = page.getByTestId('settings-diagnostics-matrix');
  await expect(matrix).toContainText('Push');
  await expect(matrix).toContainText('Browser blockiert');
  await expect(matrix).toContainText('Garmin');
  await expect(matrix).toContainText('Blockiert');
  await expect(matrix).toContainText('Zertifikat');
  await expect(matrix).toContainText('manuell');
});

test('Settings PWA diagnostics reflect standalone iPhone context', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit', 'bounded iPhone WebKit PWA slice');

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      get: () => true,
    });
  });

  await mockPulseApi(page);
  await page.goto('/settings');

  const matrix = page.getByTestId('settings-diagnostics-matrix');
  await expect(matrix).toContainText('PWA');
  await expect(matrix).toContainText('Installiert');
  await expect(matrix).toContainText('Service Worker');
  await expect(matrix).toContainText('Zertifikat');
});

test('Settings groups actions by risk and daily maintenance area', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/settings');

  await expect(page.getByRole('heading', { name: 'Profil', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Coach' })).toBeVisible();
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
  await expect(bottomNav.locator('a[href="/insights"]')).toHaveCount(0);
  await expect(bottomNav.locator('a[href="/settings"]')).toContainText('Settings');
  const bottomNavBox = await bottomNav.boundingBox();
  expect(bottomNavBox).not.toBeNull();
  expect(bottomNavBox!.y + bottomNavBox!.height).toBeLessThanOrEqual(viewport.height);

  await page.goto('/data');
  const overviewTab = page.getByRole('tab', { name: 'Überblick', exact: true });
  await expect(overviewTab).toBeVisible();
  const box = await overviewTab.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  const dataTabs = await overviewTab.evaluate((element) => {
    const parent = element.parentElement as HTMLElement;
    return {
      overflowX: window.getComputedStyle(parent).overflowX,
      scrollWidth: parent.scrollWidth,
      clientWidth: parent.clientWidth,
    };
  });
  expect(['auto', 'scroll']).toContain(dataTabs.overflowX);
  expect(dataTabs.scrollWidth).toBeGreaterThan(dataTabs.clientWidth);

  await page.goto('/plan');
  await expect(page.getByRole('tab', { name: 'Statistik' })).toBeVisible();

  await page.goto('/coach');
  const coachInput = page.getByPlaceholder('Frage…');
  await expect(coachInput).toBeVisible();
  const inputBox = await coachInput.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(viewport.height);
});

test('Mobile routes avoid unintended horizontal overflow', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 600, 'mobile containment check');

  await mockPulseApi(page);

  for (const route of ['/', '/coach', '/data', '/data?tab=analysen', '/plan', '/settings']) {
    await expectNoHorizontalOverflow(page, route);
  }
});

test('Mobile repeated controls have reliable touch targets', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 600, 'mobile touch target check');

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
    healthState: {
      active: [
        {
          id: 'health-1',
          type: 'fatigue',
          severity: 'mild',
          bodyPart: null,
          notes: 'Leichte Müdigkeit',
          startDate: '2026-05-01',
          endDate: null,
        },
      ],
      recent: [],
    },
    checkinToday: { checkin: null },
  });

  await page.goto('/data?tab=coverage');
  await expectTabTouchTarget(page, 'Überblick');
  await expectTabTouchTarget(page, 'Abdeckung');
  await expectTouchTarget(page, '30T');
  await expectTouchTarget(page, '90T');

  await page.goto('/data?tab=overview');
  await expectTouchTarget(page, 'Analysen öffnen');
  await expectTouchTarget(page, 'Check-in öffnen');
  await expectTouchTarget(page, 'Schlaf öffnen');

  await page.goto('/plan');
  await expectTabTouchTarget(page, 'Training');
  await expectTabTouchTarget(page, 'Statistik');
  await expectTouchTarget(page, 'Vorherige Woche');
  await expectTouchTarget(page, 'Nächste Woche');
  await expectTouchTarget(page, 'Sportart ändern');

  await page.goto('/coach');
  await expectSelectorTouchTarget(page, 'button[aria-label="Sprachaufnahme starten"]');
  await expectSelectorTouchTarget(page, 'button[aria-label="Nachricht senden"]');
  await expectTouchTarget(page, 'Verlauf löschen');

  await page.goto('/data?tab=mental');
  await expectTouchTarget(page, 'Heute speichern');
  await expectTouchTarget(page, 'Mehr beschreiben');
  await page.getByRole('button', { name: 'Mehr beschreiben' }).click();
  await expectSelectorTouchTarget(page, 'button:has-text("Text auswerten")');
  await expectSelectorTouchTarget(page, 'button:has-text("Feinjustieren")');
  await page.getByRole('button', { name: 'Feinjustieren' }).click();
  await expectRadioTouchTarget(page, 'Stimmung 1/10');
  await expectRadioTouchTarget(page, 'Energie 1/10');
  await expectRadioTouchTarget(page, 'Stress 1/10');
  await expectRadioTouchTarget(page, 'Motivation 1/10');
  await expectTouchTarget(page, 'Welche Grenze macht diesen freien Tag wirklich erholsam?');
  await expectTouchTarget(page, 'Mental: ruhig');

  await page.goto('/data?tab=analysen');
  await expectTouchTarget(page, '7T');
  await expectTouchTarget(page, '30T');
  await expectTouchTarget(page, '90T');

  await page.goto('/settings');
  await expectTouchTarget(page, 'Garmin prüfen');
  await expectTouchTarget(page, 'FTP automatisch übernehmen');
  await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(2);
  await expectTouchTargetAt(page, 'Bearbeiten', 0);
  await expectTouchTargetAt(page, 'Bearbeiten', 1);
  await expectTouchTarget(page, 'Abdeckung');
  await expectTouchTarget(page, 'ERLEDIGT');
  await expectTouchTarget(page, 'LÖSCHEN');
  await expectTouchTarget(page, 'Push aktivieren');
});
