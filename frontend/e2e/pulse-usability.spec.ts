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

function limiterPlanTraceFixture() {
  return {
    id: 'trace-limiter',
    userId: 'user-1',
    weekStart: '2026-04-27',
    createdAt: '2026-05-01T06:00:00.000Z',
    inputSnapshot: {
      load: { ctl: 42.4, atl: 40.1, tsb: 6.2, date: '2026-05-01' },
      phase: 'build',
      mesocycleWeek: 2,
      weeklyHoursTarget: 8,
      availableDays: [0, 2, 5],
      profile: { ftpWatts: 260, maxHrBpm: 185, lthrBpm: 170 },
      goals: [{ title: 'Lange Radform', category: 'race', targetDate: '2026-08-01', raceDiscipline: 'century', raceDistanceKm: 160, racePriority: 'A' }],
      riskSignals: [],
      healthStates: [],
      recentRpe: [],
      rpeReasons: [],
      dataWarnings: [],
      recentSportMix: { bike: { sessions: 2, totalMinutes: 260, totalTss: 180 } },
      learningSnapshot: null,
      trainingCapabilities: {
        generatedAt: '2026-05-01T06:00:00.000Z',
        lookbackDays: 90,
        levels: [
          { energySystem: 'long_endurance', label: 'Long Endurance', level: 3.1, nextRecommendedWorkoutLevel: 3.4, lastProgressionReason: null, staleReason: null, confidence: 'medium', evidence: ['letzte lange Einheit 4 h'], updatedAt: '2026-05-01T06:00:00.000Z' },
          { energySystem: 'endurance', label: 'Endurance', level: 3.8, nextRecommendedWorkoutLevel: 4.1, lastProgressionReason: 'Endurance stabil.', staleReason: null, confidence: 'medium', evidence: ['ruhige Ausdauer stabil'], updatedAt: '2026-05-01T06:00:00.000Z' },
        ],
        signals: ['quality_progress'],
        recommendations: [],
        fitLegend: {
          recovery: 'Aktive Erholung',
          maintenance: 'Erhaltung',
          productive: 'Produktiv',
          stretch: 'Stretch',
          too_hard_today: 'Zu hart heute',
        },
      },
      goalLimiter: {
        kind: 'long_endurance_fueling',
        label: 'Long Endurance + Fueling',
        confidence: 'medium',
        evidence: ['160 km Zieldistanz', 'Long-Endurance-Level 3.1'],
        planBias: 'lange Ausdauer kontrolliert aufbauen und Fueling-Verträglichkeit absichern',
        workoutFocus: ['long_endurance', 'endurance'],
      },
    },
    sportMix: { bike: { sessions: 2, totalMinutes: 210, totalTss: 150 } },
    hardDays: [],
    generatedSummary: ['Limiter: Long Endurance + Fueling — lange Ausdauer kontrolliert aufbauen.'],
    planDecision: {
      selectedDays: [0, 2, 5],
      skippedAvailableDays: [],
      targetSessionCount: 3,
      primaryGoal: 'race',
      reasons: ['Limiter: Long Endurance + Fueling — lange Ausdauer kontrolliert aufbauen.'],
    },
  };
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

  await page.goto('/data?tab=analysis');
  await expect(page.getByRole('heading', { name: 'Analysen', exact: true })).toBeVisible();
  await expect(page.getByText('Öffne eine Karte, um die Analyse gezielt zu laden.')).toBeVisible();
  expect(insightRequests).toBe(0);

  await page.getByRole('button').filter({ hasText: 'Gesamt' }).click();
  await expect(page.getByText('Keine Auffälligkeiten im Smoke-Test-Datensatz.')).toBeVisible();
  expect(insightRequests).toBe(1);
});

test('Data analyses show evidence links for opened analysis cards', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data?tab=analysis');
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

  await page.goto('/data?tab=analysis');
  await page.getByRole('button').filter({ hasText: 'Gesamt' }).click();

  await expect(page.getByText('Analyse konnte gerade nicht geladen werden.')).toBeVisible();
  await expect(page.getByText('Deine Daten bleiben sichtbar.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  await expect(page.getByText('Internal Server Error')).toHaveCount(0);
});

test('Data analyses classify provider errors with a retry action', async ({ page }) => {
  await mockPulseApi(page, { insightErrorKind: 'provider' });

  await page.goto('/data?tab=analysis');
  await page.getByRole('button').filter({ hasText: 'Gesamt' }).click();

  await expect(page.getByText('KI-Provider gerade nicht erreichbar.')).toBeVisible();
  await expect(page.getByText('Versuche es später erneut oder nutze den gecachten Stand.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  await expect(page.getByText('OpenRouter')).toHaveCount(0);
});

test('Data analyses classify missing data without offering a retry', async ({ page }) => {
  await mockPulseApi(page, { insightErrorKind: 'data_missing' });

  await page.goto('/data?tab=analysis');
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
  await expect(page.getByText('NÄCHSTER SCHRITT', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('GRENZE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ALTERNATIVE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ABSCHLUSS', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Zum Coach' }).click();
  await expect(page).toHaveURL(/\/coach\?focus=daily&prompt=/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Tagesentscheidung: Check-in eintragen/);
  await expect(page.getByText('GUTE STARTFRAGEN')).toBeVisible();
});

test('Home skips empty workout snapshot when no workout or completed activity exists', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      todayWorkout: null,
      nextWorkout: null,
      todayActivities: [],
      recentActivities: [],
    },
  });

  await page.goto('/');

  const hero = page.getByTestId('focus-decision-hero');
  await expect(hero).toBeVisible();
  await expect(hero.getByText('WORKOUT · HEUTE')).toHaveCount(0);
  await expect(hero.getByText('Heute frei · kein Pflichttraining')).toHaveCount(0);
  await expect(hero.getByRole('button', { name: 'Check-in öffnen' })).toHaveCount(1);
  await expect(hero.getByTestId('daily-decision-next-steps').getByRole('button', { name: 'Check-in öffnen' })).toBeVisible();
});

test('Home Focus hero Coach CTA keeps the prepared daily prompt', async ({ page }) => {
  let coachSends = 0;
  await mockPulseApi(page, {
    home: {
      nextBestActions: [
        {
          id: 'focus-coach-cta',
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
  await page.getByTestId('focus-decision-hero').getByRole('button', { name: 'Coach fragen' }).click();

  await expect(page).toHaveURL(/\/coach\?focus=daily&prompt=/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Tagesentscheidung: Training heute defensiv entscheiden/);
  expect(coachSends).toBe(0);
});

test('Home diary treats today nextWorkout as planned execution', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      todayWorkout: null,
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
    },
  });

  await page.goto('/');
  const diary = page.getByTestId('focus-day-diary');

  await expect(diary.getByText('EXECUTE · GEPLANT')).toBeVisible();
  await expect(diary.getByText('Radfahren · Z4 · 60 min', { exact: true })).toBeVisible();
  await expect(diary.getByText('Kein Pflichttraining geplant')).toHaveCount(0);
});

test('Coach command drawer manages focus and ignores command shortcut while typing', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop shell command drawer');
  await mockPulseApi(page);

  await page.goto('/');
  await page.locator('.pulse-focus-sidebar').getByRole('button', { name: '⌘K · COACH', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Coach Command' });
  await expect(dialog).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const dialogElement = document.querySelector('[role="dialog"]');
    return Boolean(dialogElement?.contains(document.activeElement));
  })).toBe(true);

  await page.keyboard.press('Tab');
  await expect.poll(async () => page.evaluate(() => {
    const dialogElement = document.querySelector('[role="dialog"]');
    return Boolean(dialogElement?.contains(document.activeElement));
  })).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.goto('/coach');
  const input = page.getByPlaceholder('Frage…');
  await input.fill('Ich tippe gerade');
  await input.focus();
  await input.dispatchEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true });

  await expect(page.getByRole('dialog', { name: 'Coach Command' })).toHaveCount(0);
  await expect(input).toHaveValue('Ich tippe gerade');
});

test('Daily loop clarity keeps Home guidance plain and slim support on task routes', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/');
  await expect(page.getByText('TAGESENTSCHEIDUNG')).toBeVisible();
  await expect(page.getByText('NÄCHSTER SCHRITT', { exact: true }).first()).toBeVisible();
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
  const planAction = page.getByTestId('plan-primary-action').first();
  await expect(planAction.getByText('Plan-Aktion')).toBeVisible();
  await expect(planAction.getByText(/Nach dem Klick/i)).toBeHidden();
  await expect(planAction.getByText(/Warum diese|Warum dieser/i)).toBeVisible();
  await expect(planAction.getByRole('button', { name: /Workout öffnen|Einheit öffnen|Verfügbarkeit prüfen/i })).toBeVisible();
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

  await page.goto('/data?tab=analysis');
  await expect(page.getByTestId('data-analysis-decision-quality-card')).toContainText('Entscheidungsqualität');
  await expect(page.getByTestId('data-analysis-decision-quality-card')).toContainText('Mobilität 10 Minuten');
});

test('Insights starts as synthesis and defers deep AI analysis until requested', async ({ page }) => {
  let insightRequests = 0;
  await mockPulseApi(page, {
    onRequest: (pathname) => {
      if (pathname === '/api/pulse/insights') insightRequests += 1;
    },
  });

  await page.goto('/insights');
  await expect(page.getByTestId('insights-synthesis-hero')).toBeVisible();
  await expect(page.getByTestId('insights-synthesis-hero')).toContainText('Aktueller Fokus');
  await expect(page.getByTestId('data-analysis-decision-quality-card')).toHaveCount(0);
  expect(insightRequests).toBe(0);

  await page.getByRole('button', { name: 'Tiefe Analyse anzeigen' }).click();
  await expect(page.getByTestId('insights-deep-analysis')).toBeVisible();
  expect(insightRequests).toBe(0);

  await page.getByRole('button', { name: /Gesamt/i }).click();
  await expect(page.getByTestId('insights-deep-analysis')).toContainText(/Datenbasis|Noch nicht genug Daten|Analyse konnte/i);
  expect(insightRequests).toBeGreaterThan(0);
});

test('Insights does not repeat the current focus as a second next-check card', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/insights');

  const hero = page.getByTestId('insights-synthesis-hero');
  await expect(hero).toContainText('Fueling-Praxis absichern');

  const nextChecks = page.getByTestId('insights-next-actions');
  await expect(nextChecks).toContainText('Nächste sinnvolle Prüfung');
  await expect(nextChecks.locator('.card')).toHaveCount(0);
  await expect(nextChecks).not.toContainText('Die wichtigste Prüfung steckt bereits im aktuellen Fokus.');
  await expect(nextChecks.getByText('Fueling-Praxis absichern', { exact: true })).toHaveCount(0);
  await expect(nextChecks.getByTestId('insights-next-check-item')).toHaveCount(1);
  await expect(nextChecks).toContainText('Datenqualität');
  await expect(nextChecks).not.toContainText('Capability');

  await nextChecks.getByRole('button', { name: 'Weitere Prüfungen anzeigen' }).click();

  await expect(nextChecks.getByTestId('insights-next-check-item')).toHaveCount(2);
  await expect(nextChecks).toContainText('Capability');
});

test('Insights keeps secondary synthesis signals behind a disclosure', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/insights');

  await expect(page.getByTestId('insights-synthesis-hero')).toBeVisible();
  await expect(page.getByText('Ziel', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Reaktion', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Planqualität', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Weitere Signale anzeigen' }).click();

  const secondarySignals = page.getByTestId('insights-secondary-signals');
  await expect(secondarySignals).toBeVisible();
  await expect(secondarySignals).toContainText('Ziel');
  await expect(secondarySignals).toContainText('Reaktion');
  await expect(secondarySignals).toContainText('Planqualität');
});

test('Data analyses explain personal response patterns without opening AI cards', async ({ page }) => {
  let insightRequests = 0;
  await mockPulseApi(page, {
    onRequest: (pathname) => {
      if (pathname === '/api/pulse/insights') insightRequests += 1;
    },
  });

  await page.goto('/data?tab=analysis#data-personal-response');

  const card = page.getByTestId('data-personal-response-card');
  await expect(card).toContainText('Persönliches Reaktionsmodell');
  await expect(card).toContainText('Pulse lernt deine Reaktionsmuster.');
  await expect(card).toContainText('Mentale Last einbeziehen');
  await expect(card).toContainText('Boundary');
  expect(insightRequests).toBe(0);
});

test('Data analyses show goal projection without opening AI cards', async ({ page }) => {
  let insightRequests = 0;
  await mockPulseApi(page, {
    onRequest: (pathname) => {
      if (pathname === '/api/pulse/insights') insightRequests += 1;
    },
  });

  await page.goto('/data?tab=analysis#data-goal-projection');

  const card = page.getByTestId('data-goal-projection-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Zielprojektion');
  await expect(card).toContainText('70.3 Kraichgau');
  await expect(card).toContainText('Fueling-Praxis absichern');
  await expect(card).toContainText('Long Endurance + Fueling');
  expect(insightRequests).toBe(0);
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
  await page.getByRole('button', { name: /Details & Evidenz/i }).click();
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Erledigt');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Training abgeschlossen');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Feedback eingetragen');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Für heute ist nichts mehr offen. Training und Feedback sind erledigt.');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Heute beachten');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Kein Zusatztraining');
  await expect(page.getByTestId('daily-decision-next-steps')).not.toContainText('Noch offen');
  await expect(page.getByTestId('daily-decision-next-steps')).not.toContainText(/Nach dem Klick/i);
  await expect(page.getByRole('button', { name: /Feedback erfassen/i })).toHaveCount(0);
  await expect(page.getByText(/Feedback prüfen/i)).toHaveCount(0);
  await expect(page.getByText('Heute ist kein Training geplant.')).toHaveCount(0);
  await expect(page.getByText('Entscheidungsqualität')).toHaveCount(0);
  await expect(page.getByTestId('daily-decision-quality-strip')).toHaveCount(0);
  await expect(page.getByText('RECENT')).toHaveCount(0);
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
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText(/Nächster Schritt/i);
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Feedback erfassen');
  await expect(page.getByTestId('daily-decision-next-steps')).not.toContainText('Für heute ist nichts mehr offen');

  await page.getByTestId('daily-decision-card').getByRole('button', { name: 'Feedback erfassen', exact: true }).click();
  await expect(page).toHaveURL(/\/plan\/activity\/activity-done/);
});

test('Home treats a completed off-plan Garmin activity as today done', async ({ page }) => {
  await mockPulseApi(page, {
    home: offPlanActivityHome({ rpe: null, feedbackLoggedAt: null }),
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Training heute erledigt/i })).toBeVisible();
  await page.getByRole('button', { name: /Details & Evidenz/i }).click();
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Garmin-Aktivität abgeschlossen');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Rennrad Tour');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Feedback erfassen');
  await expect(page.getByTestId('daily-decision-next-steps')).toContainText('Plan abgleichen');
  await expect(page.getByText('Heute ist kein Training geplant.')).toHaveCount(0);

  await page.getByTestId('daily-decision-card').getByRole('button', { name: 'Feedback erfassen', exact: true }).click();
  await expect(page).toHaveURL(/\/activity\/activity-off-plan/);
});

test('Home completed off-plan activity with feedback avoids no-op post-click copy', async ({ page }) => {
  await mockPulseApi(page, {
    home: offPlanActivityHome({ rpe: 5, feedbackLoggedAt: '2026-05-01T09:45:00.000Z' }),
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Training heute erledigt/i })).toBeVisible();
  const nextSteps = page.getByTestId('daily-decision-next-steps');
  await expect(nextSteps).toContainText('Alles Relevante ist erledigt');
  await expect(nextSteps).toContainText('Für heute ist nichts mehr offen. Garmin-Aktivität und Feedback sind erledigt.');
  await expect(nextSteps).not.toContainText(/Nach dem Klick/i);
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
    outcomeBaseline: {
      status: 'learning',
      label: 'Fueling-Baseline lernen',
      summary: 'Letzter langer Log: 42 g/h, 4 x 750 ml, 300 g Pulver; naechste Teststufe 50-70 g/h.',
      latestLogDate: '2026-04-29',
      observedCarbsPerHour: 42,
      targetCarbsPerHour: { min: 50, max: 70 },
      bottles750Ml: 4,
      powderG: 300,
      fluidMlPerHour: 419,
      sodiumMgPerHour: null,
      evidence: ['Letzter Log: 2026-04-29, 42 g/h, 4 x 750 ml, 300 g Pulver', 'Sodium nicht geloggt'],
      learningReadiness: {
        comparableCompleteLogs: 1,
        requiredComparableCompleteLogs: 3,
        readyForTrendSummary: false,
        missingEvidence: ['Noch 2 vergleichbare During-Logs mit Carbs, Dauer und GI-Komfort fehlen.'],
      },
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

  await page.goto('/plan/activity/activity-fueling');
  await expect(page.getByTestId('activity-fueling-debt')).toContainText('GI-Schutz offen');
  await expect(page.getByTestId('activity-fueling-debt')).toContainText('75-120 min locker');
  await expect(page.getByTestId('activity-fueling-baseline')).toContainText('Fueling-Baseline lernen');
  await expect(page.getByTestId('activity-fueling-baseline')).toContainText('42 g/h');
  await expect(page.getByTestId('activity-fueling-baseline')).toContainText('50-70 g/h');
  await expect(page.getByTestId('activity-fueling-baseline')).toContainText('4x750 ml');
  await expect(page.getByTestId('activity-fueling-baseline')).toContainText('Sodium: offen');
  await expect(page.getByTestId('activity-fueling-baseline')).toContainText('Trend-Evidenz: 1/3');
  await expect(page.getByTestId('activity-fueling-baseline')).toContainText('Noch 2 vergleichbare During-Logs');
  await page.getByRole('button', { name: '+ Fueling-Log' }).click();

  const saveButton = page.getByRole('button', { name: 'SPEICHERN' });
  await expect(saveButton).toBeDisabled();
  await expect(page.getByText('750-ml-Flaschen')).toBeVisible();
  await page.getByLabel('750-ml-Flaschen').fill('4');
  await page.getByLabel('POWER CARB Pulver (g)').fill('300');
  await expect(saveButton).toBeDisabled();
  await page.getByRole('button', { name: 'POWER CARB Sour Cherry' }).click();
  await page.getByRole('button', { name: 'Mars' }).click();
  await expect(saveButton).toBeDisabled();
  await page.getByRole('button', { name: 'Magen leicht unruhig' }).click();
  await expect(saveButton).toBeEnabled();
  await page.getByLabel('Notizen (optional)').fill('Nach 100 km kurz Magenprobleme, Mars hat geholfen.');
  await saveButton.click();

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

test('Activity fueling evidence quality names missing fields for incomplete long-session logs', async ({ page }) => {
  await mockPulseApi(page, {
    nutritionLogs: [{
      id: 'nutrition-incomplete-gi',
      userId: 'user-1',
      date: '2026-05-01',
      workoutId: null,
      activityId: 'activity-fueling',
      context: 'during',
      mealType: null,
      description: 'POWER CARB',
      calories: null,
      proteinG: null,
      carbsG: 242,
      fatG: null,
      gelsCount: null,
      drinksMl: 3000,
      sodiumMg: null,
      bottles750Ml: 4,
      powderG: 300,
      fuelingProducts: ['mnstry-power-carb-sour-cherry-1-0-8'],
      giComfort: null,
      notes: null,
      createdAt: '2026-05-01T13:15:00.000Z',
    }],
    outcomeBaseline: {
      status: 'insufficient_data',
      label: 'Fueling-Baseline offen',
      summary: 'Noch kein vergleichbarer During-Log mit Dauer, Carbs und GI-Komfort.',
      latestLogDate: null,
      observedCarbsPerHour: null,
      targetCarbsPerHour: null,
      bottles750Ml: null,
      powderG: null,
      fluidMlPerHour: null,
      sodiumMgPerHour: null,
      evidence: ['GI-Komfort fehlt im langen Log.'],
      learningReadiness: {
        comparableCompleteLogs: 0,
        requiredComparableCompleteLogs: 3,
        readyForTrendSummary: false,
        missingEvidence: ['Noch drei vergleichbare During-Logs mit Carbs, Dauer und GI-Komfort fehlen.'],
      },
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

  await page.goto('/plan/activity/activity-fueling');

  const quality = page.getByTestId('activity-fueling-evidence-quality');
  await expect(quality).toContainText('Lernevidenz unvollständig');
  await expect(quality).toContainText('Carbs erfasst');
  await expect(quality).toContainText('GI-Komfort fehlt');
  await expect(quality).toContainText('Trend-Evidenz 0/3');
});

test('Activity fueling evidence quality completes missing GI comfort on the existing log', async ({ page }) => {
  const incompleteLog = {
    id: 'nutrition-incomplete-gi',
    userId: 'user-1',
    date: '2026-05-01',
    workoutId: null,
    activityId: 'activity-fueling',
    context: 'during',
    mealType: null,
    description: 'POWER CARB',
    calories: null,
    proteinG: null,
    carbsG: 242,
    fatG: null,
    gelsCount: null,
    drinksMl: 3000,
    sodiumMg: null,
    bottles750Ml: 4,
    powderG: 300,
    fuelingProducts: ['mnstry-power-carb-sour-cherry-1-0-8'],
    giComfort: null,
    notes: null,
    createdAt: '2026-05-01T13:15:00.000Z',
  };
  const nutritionLogs = [incompleteLog];
  let patchedLog: unknown = null;

  await mockPulseApi(page, {
    nutritionLogs,
    onNutritionPatch: (id, body) => {
      patchedLog = { id, ...body };
      Object.assign(incompleteLog, body);
    },
    outcomeBaseline: {
      status: 'insufficient_data',
      label: 'Fueling-Baseline offen',
      summary: 'Noch kein vergleichbarer During-Log mit Dauer, Carbs und GI-Komfort.',
      latestLogDate: null,
      observedCarbsPerHour: null,
      targetCarbsPerHour: null,
      bottles750Ml: null,
      powderG: null,
      fluidMlPerHour: null,
      sodiumMgPerHour: null,
      evidence: ['GI-Komfort fehlt im langen Log.'],
      learningReadiness: {
        comparableCompleteLogs: 0,
        requiredComparableCompleteLogs: 3,
        readyForTrendSummary: false,
        missingEvidence: ['Noch drei vergleichbare During-Logs mit Carbs, Dauer und GI-Komfort fehlen.'],
      },
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

  await page.goto('/plan/activity/activity-fueling');

  const quality = page.getByTestId('activity-fueling-evidence-quality');
  await expect(quality).toContainText('GI-Komfort fehlt');
  await quality.getByRole('button', { name: 'Magen ok' }).click();

  await expect.poll(() => patchedLog).toMatchObject({
    id: 'nutrition-incomplete-gi',
    giComfort: 'ok',
  });
  await expect(quality).toContainText('GI-Komfort erfasst');
});

test('Activity fueling evidence quality structures obvious bottle and powder evidence on the existing log', async ({ page }) => {
  const textOnlyLog = {
    id: 'nutrition-text-details',
    userId: 'user-1',
    date: '2026-05-09',
    workoutId: null,
    activityId: 'activity-fueling',
    context: 'during',
    mealType: null,
    description: '159,5-km-Tour: 300 g POWER CARB Pulver plus 2 Marsriegel',
    calories: null,
    proteinG: null,
    carbsG: 356,
    fatG: null,
    gelsCount: null,
    drinksMl: 3000,
    sodiumMg: null,
    bottles750Ml: null,
    powderG: null,
    fuelingProducts: [],
    giComfort: 'mild_issue',
    notes: '4 x 750 ml getrunken; leichte Magenprobleme nach ca. 100 km; Mars half nach wenigen Minuten.',
    createdAt: '2026-05-09T15:21:14.000Z',
  };
  const nutritionLogs = [textOnlyLog];
  const patches: unknown[] = [];

  await mockPulseApi(page, {
    nutritionLogs,
    onNutritionPatch: (id, body) => {
      patches.push({ id, ...body });
      Object.assign(textOnlyLog, body);
    },
    outcomeBaseline: {
      status: 'learning',
      label: 'Fueling-Baseline lernen',
      summary: 'Letzter langer Log: 42 g/h; Praxisdetails fehlen noch strukturiert.',
      latestLogDate: '2026-05-09',
      observedCarbsPerHour: 42,
      targetCarbsPerHour: { min: 50, max: 70 },
      bottles750Ml: null,
      powderG: null,
      fluidMlPerHour: 357,
      sodiumMgPerHour: null,
      evidence: ['Letzter Log: 2026-05-09, 42 g/h', 'Sodium nicht geloggt'],
      learningReadiness: {
        comparableCompleteLogs: 1,
        requiredComparableCompleteLogs: 3,
        readyForTrendSummary: false,
        missingEvidence: ['Noch zwei vergleichbare During-Logs mit Carbs, Dauer und GI-Komfort fehlen.'],
      },
    },
    activityDetail: {
      activity: {
        id: 'activity-fueling',
        userId: 'user-1',
        externalId: 'garmin-activity-fueling',
        source: 'garmin',
        startTime: '2026-05-09T08:00:00.000Z',
        activityType: 'bike',
        name: '159,5-km-Tour',
        durationSec: 8.4 * 3600,
        distanceM: 159500,
        avgHr: 137,
        maxHr: 165,
        avgPowerW: 176,
        normalizedPowerW: 188,
        tss: 260,
        calories: 4200,
        elevationGainM: 1200,
        trainingEffectAerobic: 3.8,
        trainingEffectAnaerobic: 0.2,
        vo2maxEstimate: null,
        rpe: 8,
        rpeNote: null,
        sorenessAreas: null,
        feedbackLoggedAt: '2026-05-09T15:00:00.000Z',
        equipmentIds: [],
      },
      laps: [],
      hrZones: [],
      analytics: null,
    },
  });

  await page.goto('/plan/activity/activity-fueling');

  const quality = page.getByTestId('activity-fueling-evidence-quality');
  await quality.getByRole('button', { name: '4 x 750 ml übernehmen' }).click();
  await quality.getByRole('button', { name: '300 g Pulver übernehmen' }).click();

  await expect.poll(() => patches).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'nutrition-text-details', bottles750Ml: 4 }),
    expect.objectContaining({ id: 'nutrition-text-details', powderG: 300 }),
  ]));
  await expect(page.getByText('4 x 750 ml', { exact: true })).toBeVisible();
  await expect(page.getByText('300g Pulver', { exact: true })).toBeVisible();
});

test('Activity fueling evidence quality structures product and GI notes on the existing log', async ({ page }) => {
  const textOnlyLog = {
    id: 'nutrition-text-products-gi',
    userId: 'user-1',
    date: '2026-05-09',
    workoutId: null,
    activityId: 'activity-fueling',
    context: 'during',
    mealType: null,
    description: '159,5-km-Tour: 300 g POWER CARB Pulver plus 2 Marsriegel',
    calories: null,
    proteinG: null,
    carbsG: 356,
    fatG: null,
    gelsCount: null,
    drinksMl: 3000,
    sodiumMg: null,
    bottles750Ml: 4,
    powderG: 300,
    fuelingProducts: ['mnstry-power-carb-sour-cherry-1-0-8'],
    giComfort: null,
    notes: 'Leichte Magenprobleme nach ca. 100 km; Mars half nach wenigen Minuten.',
    createdAt: '2026-05-09T15:21:14.000Z',
  };
  const nutritionLogs = [textOnlyLog];
  const patches: unknown[] = [];

  await mockPulseApi(page, {
    nutritionLogs,
    onNutritionPatch: (id, body) => {
      patches.push({ id, ...body });
      Object.assign(textOnlyLog, body);
    },
    outcomeBaseline: {
      status: 'caution',
      label: 'Fueling-Baseline unvollstaendig',
      summary: 'Letzter langer Log: 42 g/h; Verträglichkeit fehlt strukturiert.',
      latestLogDate: '2026-05-09',
      observedCarbsPerHour: 42,
      targetCarbsPerHour: { min: 50, max: 70 },
      bottles750Ml: 4,
      powderG: 300,
      fluidMlPerHour: 357,
      sodiumMgPerHour: null,
      evidence: ['GI-Komfort fehlt strukturiert.', 'Sodium nicht geloggt'],
      learningReadiness: {
        comparableCompleteLogs: 0,
        requiredComparableCompleteLogs: 3,
        readyForTrendSummary: false,
        missingEvidence: ['Noch drei vergleichbare During-Logs mit Carbs, Dauer und GI-Komfort fehlen.'],
      },
    },
    activityDetail: {
      activity: {
        id: 'activity-fueling',
        userId: 'user-1',
        externalId: 'garmin-activity-fueling',
        source: 'garmin',
        startTime: '2026-05-09T08:00:00.000Z',
        activityType: 'bike',
        name: '159,5-km-Tour',
        durationSec: 8.4 * 3600,
        distanceM: 159500,
        avgHr: 137,
        maxHr: 165,
        avgPowerW: 176,
        normalizedPowerW: 188,
        tss: 260,
        calories: 4200,
        elevationGainM: 1200,
        trainingEffectAerobic: 3.8,
        trainingEffectAnaerobic: 0.2,
        vo2maxEstimate: null,
        rpe: 8,
        rpeNote: null,
        sorenessAreas: null,
        feedbackLoggedAt: '2026-05-09T15:00:00.000Z',
        equipmentIds: [],
      },
      laps: [],
      hrZones: [],
      analytics: null,
    },
  });

  await page.goto('/plan/activity/activity-fueling');

  const quality = page.getByTestId('activity-fueling-evidence-quality');
  await quality.getByRole('button', { name: 'Mars übernehmen' }).click();
  await quality.getByRole('button', { name: 'Magen leicht unruhig übernehmen' }).click();

  await expect.poll(() => patches).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: 'nutrition-text-products-gi',
      fuelingProducts: expect.arrayContaining(['mnstry-power-carb-sour-cherry-1-0-8', 'mars']),
    }),
    expect.objectContaining({
      id: 'nutrition-text-products-gi',
      giComfort: 'mild_issue',
    }),
  ]));
  await expect(page.getByText('POWER CARB, Mars', { exact: true })).toBeVisible();
  await expect(page.getByText('Magen leicht unruhig', { exact: true })).toBeVisible();
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
  await expect(page.getByText('NÄCHSTER SCHRITT', { exact: true }).first()).toBeVisible();
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

test('Contextual Coach mode surfaces response goal and season evidence without sending', async ({ page }) => {
  let coachSends = 0;
  let insightRequests = 0;
  const writeRequests: string[] = [];
  await mockPulseApi(page, {
    onRequest: (pathname, method) => {
      if (pathname === '/api/pulse/coach' && method === 'POST') coachSends += 1;
      if (pathname === '/api/pulse/insights') insightRequests += 1;
      if (method !== 'GET' && method !== 'OPTIONS') writeRequests.push(`${method} ${pathname}`);
    },
  });

  await page.goto('/coach');

  const card = page.getByTestId('coach-contextual-mode-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Coach-Kontext');
  await expect(card).toContainText('Pulse lernt deine Reaktionsmuster');
  await expect(card).toContainText('70.3 Kraichgau');
  await expect(card).toContainText('Fueling-Praxis absichern');
  await expect(card).toContainText('Build');

  await card.getByRole('button', { name: 'Mit Kontext fragen' }).click();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Pulse lernt deine Reaktionsmuster/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/70\.3 Kraichgau/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Fueling-Praxis absichern/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Saisonvertrag: Build/);
  expect(coachSends).toBe(0);
  expect(insightRequests).toBe(0);
  expect(writeRequests).toEqual([]);
});

test('Data mental check-in uses quick choices with guided context', async ({ page }) => {
  let submitted: unknown = null;
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
    onCheckinSubmit: body => {
      submitted = body;
    },
  });

  await page.goto('/data?tab=mental');

  await expect(page.getByText('Quick Check-in')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Warum dieser Vorschlag?' })).toBeVisible();
  await expect(page.getByTestId('mental-suggestion-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Heute speichern' })).toBeInViewport();
  await page.getByRole('button', { name: 'Warum dieser Vorschlag?' }).click();
  await expect(page.getByTestId('mental-suggestion-panel')).toContainText('Pulse Vorschlag');
  await expect(page.getByTestId('mental-suggestion-panel')).toContainText('Schlafscore 82');
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

test('Data Mental shows resilience guidance without clinical labels', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      readiness: {
        score: 48,
        label: 'erholen',
        shortLabel: 'Erholen',
        color: 'rose',
        components: { sleep: 45, hrv: 50, tsb: 42, battery: 45, mental: 40, stress: 35 },
      },
      fitnessLoad: { date: '2026-05-01', ctl: 42.4, atl: 52.1, tsb: -9.7, cached: false },
      recovery: {
        sleepDebt7d: { hours: 2.4, targetH: 7.5, baselineSource: 'garmin_sleep_need', status: 'severe' },
        hrvDeviation7d: { pct: -8, recentMs: 43, baselineMs: 47, status: 'declining' },
        rhrDrift7d: { bpmAboveBaseline: 5, recent: 54, baseline: 49, status: 'elevated' },
        recoveryScore: 46,
        recommendation: 'Heute Belastung reduzieren.',
      },
    },
    checkinToday: {
      checkin: {
        id: 'checkin-1',
        userId: 'user-1',
        date: '2026-05-01',
        mood: 5,
        energy: 3,
        stress: 8,
        motivation: 4,
        notes: null,
        themes: null,
        source: 'manual',
        coachQuestions: null,
        createdAt: '2026-05-01T08:00:00.000Z',
      },
    },
  });

  await page.goto('/data?tab=today#data-mental');

  const card = page.getByTestId('resilience-guidance-card');
  await expect(card).toContainText('Resilienz heute');
  await expect(card).toContainText('Grenze');
  await expect(card).toContainText('Planwirkung');
  await expect(card).toContainText('Signalqualität');
  await expect(card.getByRole('button', { name: 'Planwirkung prüfen' })).toBeVisible();
  await expect(card).not.toContainText(/Diagnose|Depression|Krankheit/i);
});

test('Data mental shows resilience radar support prompt', async ({ page }) => {
  let coachSends = 0;
  await mockPulseApi(page, {
    checkinToday: { checkin: { id: 'checkin-1', date: '2026-05-01' } },
    checkinHistory: {
      checkins: [
        { id: 'checkin-1', date: '2026-05-01', mood: 3, energy: 3, stress: 8, motivation: 3 },
      ],
    },
    resilienceRadar: {
      days: 14,
      state: 'protect',
      title: 'Heute bewusst schützen.',
      summary: 'Mehrere sichtbare Signale sprechen dafür, Druck aus dem Tag zu nehmen.',
      primaryAction: {
        label: 'Supportplan vorbereiten',
        targetPath: `/coach?prompt=${encodeURIComponent('Bitte hilf mir, meinen Supportplan ruhig zu aktivieren. Max kurz schreiben.')}`,
        resultPreview: 'Coach öffnet mit vorbereitetem Supportplan-Prompt; Pulse kontaktiert niemanden automatisch.',
      },
      signals: [
        {
          id: 'low_mood_trend',
          label: 'Stimmung',
          summary: 'Ø 3.4/10 in den letzten Check-ins.',
          evidence: ['2026-05-01: Stimmung 3/10'],
        },
        {
          id: 'support_plan',
          label: 'Supportplan',
          summary: 'Ein vorbereiteter Coach-Prompt ist erlaubt.',
          evidence: ['Warnzeichen: Rueckzug', 'Stabilisieren: 10 Minuten rausgehen'],
        },
      ],
      support: {
        configured: true,
        suggested: true,
        preference: 'coach_prompt',
        note: 'Max kurz schreiben.',
      },
      evidenceQuality: {
        checkins: 4,
        garminDays: 7,
        loadDays: 14,
        confidence: 'usable',
      },
    },
    onRequest: (pathname, method) => {
      if (pathname === '/api/pulse/coach' && method === 'POST') coachSends += 1;
    },
  });

  await page.goto('/data?tab=mental');

  const radar = page.getByTestId('resilience-radar-card');
  await expect(radar).toContainText('Resilienz-Radar');
  await expect(radar).toContainText('Heute bewusst schützen.');
  await expect(radar).toContainText('Supportplan vorbereiten');
  await expect(radar).toContainText('Warnzeichen: Rueckzug');

  await radar.getByRole('button', { name: 'Supportplan vorbereiten' }).click();
  await expect(page).toHaveURL(/\/coach\?prompt=/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Supportplan ruhig zu aktivieren/);
  expect(coachSends).toBe(0);
});

test('Data mental check-in keeps the primary save action in the first mobile viewport', async ({ page }) => {
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
  });

  await page.goto('/data?tab=mental');

  await expect(page.getByText('Quick Check-in')).toBeVisible();
  await expect(page.getByRole('button', { name: /Heute speichern|Check-in speichern|Check-in senden/i })).toBeInViewport();
});

test('Data mental focus keeps evidence context behind disclosure', async ({ page }) => {
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
  });

  await page.goto('/data?tab=today#data-mental');

  await expect(page.getByRole('heading', { name: 'Mental Check-in' })).toBeVisible();
  await expect(page.getByText('Quick Check-in')).toBeVisible();
  await expect(page.getByTestId('data-evidence-triage')).toHaveCount(0);

  await page.getByRole('button', { name: 'Kontext anzeigen' }).click();
  const triage = page.getByTestId('data-evidence-triage');
  await expect(triage).toBeVisible();
  await expect(triage).toContainText('Readiness');
  await expect(triage).toContainText('Garmin');
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
        targetPath: '/data?tab=today#data-mental',
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
  const checkinCard = page.getByTestId('home-mental-checkin-card');
  await expect(checkinCard.getByText('Mental Check-in', { exact: true })).toBeVisible();
  await checkinCard.getByRole('button', { name: 'Schützen' }).click();
  await checkinCard.getByRole('button', { name: 'Check-in speichern' }).click();

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

test('Daily Surface focus mode is local and read-only', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', request => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) {
      writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  await mockPulseApi(page, {
    todayOptionsState: 'unplanned_trainable',
    dailyDelta: [{
      date: '2026-05-01',
      status: 'matched',
      title: 'Plan und Ausführung passen zusammen',
      summary: 'Die geplante Einheit wurde mit Garmin-Ausführung abgeglichen.',
      score: 92,
      loadDeltaTss: 4,
      recoveryDelta: null,
      nextPlanEffect: 'Plan kann diesen Reiz als erledigt behandeln.',
      evidence: ['Geplant: Rad 75 min', 'Garmin: Rad 77 min'],
      targetPath: '/plan/activity/activity-done',
    }],
  });

  await page.goto('/');

  await expect(page.getByTestId('home-surface-focus-card')).toBeVisible();
  await expect(page.getByRole('button', { name: /Standard/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('daily-delta-card')).toBeVisible();
  await expect(page.getByTestId('today-options-card')).toBeVisible();
  const focusBox = await page.getByTestId('home-surface-focus-card').boundingBox();
  expect(focusBox).not.toBeNull();
  expect(focusBox!.height).toBeLessThanOrEqual(125);

  await page.getByRole('button', { name: /Training/i }).click();

  await expect(page.getByRole('button', { name: /Training/i })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('pulse.home.surface.focus.v1'))).toBe('training');
  expect(writes).toEqual([]);
});

test('Daily Surface can put the mental check-in before training options', async ({ page }) => {
  await mockPulseApi(page, {
    checkinToday: { checkin: null },
    todayOptionsState: 'unplanned_trainable',
    actions: [
      {
        id: 'checkin',
        decisionId: 'decision-checkin',
        source: 'checkin',
        priority: 'normal',
        title: 'Check-in eintragen',
        reason: 'Tages-Check-in fehlt.',
        cta: 'Eintragen',
        targetPath: '/data?tab=today#data-mental',
        status: 'open',
        resolvedAt: null,
        resolutionReason: null,
        resolvedBy: 'Check-in heute speichern.',
      },
    ],
  });

  await page.goto('/');

  await expect(page.getByTestId('home-mental-checkin-card')).toBeVisible();
  await expect(page.getByTestId('today-options-card')).toBeVisible();
  await page.getByRole('button', { name: /Mental/i }).click();

  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('pulse.home.surface.focus.v1'))).toBe('mental');
  const mentalBox = await page.getByTestId('home-focus-item-mental').boundingBox();
  const optionsBox = await page.getByTestId('home-focus-item-todayOptions').boundingBox();
  expect(mentalBox).not.toBeNull();
  expect(optionsBox).not.toBeNull();
  expect(mentalBox!.y).toBeLessThan(optionsBox!.y);
});

test('Daily Surface resets to the safe default order', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('pulse.home.surface.focus.v1', 'review');
  });
  await mockPulseApi(page, {
    todayOptionsState: 'unplanned_trainable',
    dailyDelta: [{
      date: '2026-05-01',
      status: 'matched',
      title: 'Plan und Ausführung passen zusammen',
      summary: 'Die geplante Einheit wurde mit Garmin-Ausführung abgeglichen.',
      score: 92,
      loadDeltaTss: 4,
      recoveryDelta: null,
      nextPlanEffect: 'Plan kann diesen Reiz als erledigt behandeln.',
      evidence: ['Geplant: Rad 75 min', 'Garmin: Rad 77 min'],
      targetPath: '/plan/activity/activity-done',
    }],
  });

  await page.goto('/');

  await expect(page.getByRole('button', { name: /Rueckblick/i })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Standard/i }).click();

  await expect(page.getByRole('button', { name: /Standard/i })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('pulse.home.surface.focus.v1'))).toBeNull();
  const deltaBox = await page.getByTestId('home-focus-item-delta').boundingBox();
  const optionsBox = await page.getByTestId('home-focus-item-todayOptions').boundingBox();
  expect(deltaBox).not.toBeNull();
  expect(optionsBox).not.toBeNull();
  expect(deltaBox!.y).toBeLessThan(optionsBox!.y);
});

test('Data shows Garmin recovery depth signals without exposing raw payloads', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data');
  await page.getByRole('tab', { name: 'Trends' }).click();

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

  const profileCard = page.locator('.card').filter({ hasText: 'Athletenprofil' }).first();
  await expect(profileCard).toBeVisible();
  await expect(profileCard).toContainText('LTHR');
  await expect(profileCard).toContainText('VO2max');
  await expect(profileCard).toContainText('Manuell');
  await expect(profileCard).toContainText('Aktivitäten');
  await expect(profileCard).toContainText('Garmin');
});

test('Settings keeps manual profile unlock actions compact on mobile', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 600, 'mobile profile density check');

  await mockPulseApi(page, {
    profile: {
      userId: 'user-1',
      ftpWatts: 250,
      maxHrBpm: 185,
      lthrBpm: 170,
      restingHrBpm: 49,
      weeklyHoursTarget: 6,
      trainingPhase: 'base',
      vo2max: 52,
      fuelingEnabled: true,
      dietaryConstraints: [],
      preferredFuelingProducts: 'Ministry',
      carbGuidanceStyle: 'suggest_ranges',
      sodiumGuidanceStyle: 'suggest_ranges',
      bodyWeightGuidanceEnabled: true,
      provenance: {
        fields: {
          ftpWatts: { key: 'ftpWatts', label: 'FTP', value: 250, source: 'manual', sourceLabel: 'Manuell', updatedAt: '2026-05-01T06:00:00.000Z', warning: null },
          maxHrBpm: { key: 'maxHrBpm', label: 'Max. Puls', value: 185, source: 'manual', sourceLabel: 'Manuell', updatedAt: '2026-05-01T06:00:00.000Z', warning: null },
          lthrBpm: { key: 'lthrBpm', label: 'LTHR', value: 170, source: 'manual', sourceLabel: 'Manuell', updatedAt: '2026-05-01T06:00:00.000Z', warning: null },
          vo2max: { key: 'vo2max', label: 'VO2max', value: 52, source: 'manual', sourceLabel: 'Manuell', updatedAt: '2026-05-01T06:00:00.000Z', warning: null },
        },
        warnings: [],
      },
    },
  });

  await page.goto('/settings?section=profile');

  const profileCard = page.locator('.card').filter({ hasText: 'Athletenprofil' }).first();
  await expect(profileCard).toBeVisible();
  await expect(profileCard.getByRole('button', { name: /automatisch übernehmen/ })).toHaveCount(4);

  const box = await profileCard.boundingBox();
  expect(box, 'Missing profile card bounds').not.toBeNull();
  expect(box!.height, 'Profile card should fit manual unlock controls without dominating the mobile page').toBeLessThanOrEqual(560);
});

test('Settings keeps Fueling and Recovery preferences collapsed in profile read mode', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 600, 'mobile profile density check');

  await mockPulseApi(page);

  await page.goto('/settings?section=profile');

  const profileCard = page.locator('.card').filter({ hasText: 'Athletenprofil' }).first();
  await expect(profileCard).toBeVisible();
  await expect(profileCard).toContainText('FTP');
  await expect(profileCard).toContainText('LTHR');
  await expect(profileCard.getByRole('button', { name: /automatisch übernehmen/ })).toBeVisible();
  await expect(profileCard.getByText('Fueling & Recovery')).toBeVisible();
  await expect(profileCard.getByText('Produkte', { exact: true })).toHaveCount(0);
  await expect(profileCard.getByText('Einschränkungen', { exact: true })).toHaveCount(0);
  await expect(profileCard.getByText('Carbs', { exact: true })).toHaveCount(0);
  await expect(profileCard.getByText('Sodium', { exact: true })).toHaveCount(0);
  await expect(profileCard.getByText('Körpergewicht', { exact: true })).toHaveCount(0);

  await profileCard.getByRole('button', { name: 'Fueling & Recovery anzeigen' }).click();

  await expect(profileCard.getByText('Produkte', { exact: true })).toBeVisible();
  await expect(profileCard.getByText('Einschränkungen', { exact: true })).toBeVisible();
  await expect(profileCard.getByText('Carbs', { exact: true })).toBeVisible();
  await expect(profileCard.getByText('Sodium', { exact: true })).toBeVisible();
  await expect(profileCard.getByText('Körpergewicht', { exact: true })).toBeVisible();
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
  const profileCard = page.locator('.card').filter({ hasText: 'Athletenprofil' }).first();
  await expect(profileCard.getByText('Fueling & Recovery')).toBeVisible();
  await expect(profileCard.getByText('Ministry')).toBeVisible();
  await profileCard.getByRole('button', { name: 'Fueling & Recovery anzeigen' }).click();
  await expect(profileCard.getByText('Carbs: Pulse schlägt g/h vor')).toBeVisible();

  await profileCard.getByRole('button', { name: 'Bearbeiten' }).click();
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
      supportWarningSigns: ['Rueckzug'],
      supportStabilizingActions: ['10 Minuten rausgehen'],
      supportContactNote: 'Max kurz schreiben.',
      supportActivationPreference: 'suggest_only',
      updatedAt: '2026-05-01T08:00:00.000Z',
    },
    onCoachPreferencesPatch: (body) => {
      patched = body;
    },
  });

  await page.goto('/settings');
  await expect(page.getByText('Coach-Präferenzen')).toBeVisible();
  await expect(page.getByText('lange Sweetspot-Blöcke')).toBeVisible();
  await expect(page.getByText('Unterstützung')).toBeVisible();
  await expect(page.getByText('Pulse kontaktiert niemanden automatisch.')).toBeVisible();
  await expect(page.getByText('Rueckzug')).toBeVisible();

  await page.locator('.card').filter({ hasText: 'Coach-Präferenzen' }).getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Zeitfenster').fill('Werktags vor 07:30 oder nach 18:30.');
  await page.getByLabel('Unbeliebte Muster').fill('lange Sweetspot-Blöcke\nzu viele harte Tage');
  await page.getByRole('button', { name: 'Fr' }).click();
  await page.getByLabel('Vorsicht / Constraints').fill('Achillessehne vorsichtig steigern');
  await page.getByLabel('Kommunikation').selectOption('direct');
  await page.getByLabel('Warnzeichen').fill('Rueckzug\nmehrere Tage sehr wenig Energie');
  await page.getByLabel('Stabilisierende Schritte').fill('10 Minuten rausgehen\nTraining bewusst klein halten');
  await page.getByLabel('Support-Hinweis').fill('Wenn ich festhaenge: Max kurz schreiben.');
  await page.getByLabel('Support-Aktivierung').selectOption('coach_prompt');
  await page.getByRole('button', { name: 'Coach speichern' }).click();

  await expect.poll(() => patched).toEqual({
    timeWindows: 'Werktags vor 07:30 oder nach 18:30.',
    dislikedWorkoutPatterns: ['lange Sweetspot-Blöcke', 'zu viele harte Tage'],
    preferredLongDays: [5, 6],
    injurySensitiveConstraints: ['Achillessehne vorsichtig steigern'],
    communicationStyle: 'direct',
    supportWarningSigns: ['Rueckzug', 'mehrere Tage sehr wenig Energie'],
    supportStabilizingActions: ['10 Minuten rausgehen', 'Training bewusst klein halten'],
    supportContactNote: 'Wenn ich festhaenge: Max kurz schreiben.',
    supportActivationPreference: 'coach_prompt',
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
  await expect(page.getByRole('heading', { name: 'Heute ist kein Training geplant.' })).toBeVisible();
  const homeDecision = page.getByTestId('daily-decision-card');
  await expect(homeDecision.getByRole('button', { name: 'Coach fragen' })).toHaveCount(0);
  await homeDecision.getByRole('button', { name: 'Details & Evidenz anzeigen' }).click();
  await homeDecision.getByRole('button', { name: 'Coach fragen' }).click();
  await expect(page).toHaveURL(/\/coach\?focus=daily&prompt=/);
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Tagesentscheidung: Heute ist kein Training geplant/);
  await expect(page.getByText('TAGESBRIEFING')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Welche Grenze macht diesen freien Tag wirklich erholsam?' })).toBeVisible();

  await page.getByRole('button', { name: 'Gespräch damit starten' }).click();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Tagesentscheidung: Heute ist kein Training geplant/);
  expect(coachSends).toBe(0);

  await page.goto('/plan?tab=training');
  await expect(page.getByText('NÄCHSTE TRAININGSENTSCHEIDUNG')).toBeVisible();
  await expect(page.getByText('Heute ist kein Training geplant.')).toHaveCount(0);
  await expect(page.getByText('Radfahren · Zone 2')).toBeVisible();

  await page.getByRole('button', { name: 'Details & Evidenz anzeigen' }).click();
  await page.getByRole('button', { name: 'Metriken prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=trends#data-recovery');
  await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute('aria-selected', 'true');

  await page.goBack();
  await expect(page).toHaveURL('/plan?tab=training');
  await expect(page.getByRole('tab', { name: 'Training', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('Home evidence chips deep-link to Data evidence sections', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/');
  await expect(page.getByText('TAGESENTSCHEIDUNG')).toBeVisible();

  await page.getByRole('button', { name: 'Details & Evidenz anzeigen' }).click();
  await page.getByRole('button', { name: /Readiness 78\/100/ }).click();
  await expect(page).toHaveURL(/\/data/);
  await expect(page).toHaveURL(/#data-recovery$/);
  await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute('aria-selected', 'true');
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

  await expect(page.getByRole('button', { name: /Einbezogen: TSB -5\.7/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Details & Evidenz anzeigen' }).click();
  await page.getByRole('button', { name: /Einbezogen: TSB -5\.7/ }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-plan-trace');
  await expect(page.getByRole('tab', { name: 'Analyse' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#data-plan-trace')).toBeVisible();
});

test('Data overview exposes provenance shortcuts', async ({ page }, testInfo) => {
  await mockPulseApi(page);

  await page.goto('/data');
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.getByTestId('data-today-intro-eyebrow')).toBeHidden();
    await expect(page.getByTestId('data-today-intro-summary')).toBeHidden();
  } else {
    await expect(page.getByText('DATA · HEUTE RELEVANT')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Weitere Datenbereiche anzeigen' }).click();
  const triage = page.getByTestId('data-evidence-triage');
  await expect(triage).toContainText('Readiness 78/100');
  await expect(triage).toContainText('TSB -5.7');
  await expect(triage).toContainText('Mental Check-in');
  await expect(triage).toContainText('Garmin bereit');

  await page.getByTestId('data-triage-readiness').click();
  await expect(page).toHaveURL('/data?tab=trends#data-recovery');
  await expect(page.locator('#data-recovery')).toBeVisible();

  await page.goto('/data');
  await page.getByRole('button', { name: 'Weitere Datenbereiche anzeigen' }).click();
  await page.getByTestId('data-triage-garmin').click();
  await expect(page).toHaveURL('/data?tab=quality#data-garmin-quality');
  await expect(page.locator('#data-garmin-quality')).toBeVisible();

  await page.goto('/data');
  await page.getByRole('button', { name: 'Weitere Datenbereiche anzeigen' }).click();
  await page.getByRole('button', { name: 'Plan-/Load-Analyse prüfen' }).click();
  await expect(page).toHaveURL('/data?tab=analysis#data-plan-trace');
  await expect(page.locator('#data-plan-trace')).toBeVisible();
});

test('Data starts with one daily action before secondary areas', async ({ page }, testInfo) => {
  await mockPulseApi(page);

  await page.goto('/data');
  const action = page.getByTestId('data-primary-action');
  await expect(action).toBeVisible();
  await expect(action).toContainText('Daten-Aktion');
  await expect(action).toContainText('Warum jetzt');
  await expect(action).toContainText('Nach dem Klick');
  await expect(action).toContainText('Planwirkung prüfen');
  if (testInfo.project.name === 'mobile-chromium') {
    const actionBox = await action.boundingBox();
    expect(actionBox).not.toBeNull();
    expect(actionBox!.height).toBeLessThan(340);
    await expect(action.getByRole('button', { name: /öffnen/i })).toBeInViewport();
  }

  await expect(page.getByTestId('data-secondary-areas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Weitere Datenbereiche anzeigen' }).click();
  const secondary = page.getByTestId('data-secondary-areas');
  await expect(secondary).toBeVisible();
  await expect(secondary.getByRole('button', { name: 'Analyse öffnen' })).toBeVisible();
  await expect(secondary.getByRole('button', { name: 'Check-in öffnen' })).toBeVisible();
  await expect(secondary.getByRole('button', { name: 'Trends öffnen' })).toBeVisible();
  await expect(secondary.getByRole('button', { name: 'Plan-/Load-Analyse prüfen' })).toBeVisible();
});

test('Data mobile keeps the missing-check-in action before optional detail copy', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 600, 'mobile action-first check');

  await mockPulseApi(page, { checkinToday: { checkin: null } });

  await page.goto('/data');
  const action = page.getByTestId('data-primary-action');
  await expect(action).toContainText('Mental Check-in abschließen');
  await expect(action.getByRole('button', { name: 'Check-in öffnen' })).toBeInViewport();
  await expect(action.getByRole('button', { name: 'Warum diese Aufgabe?' })).toBeVisible();
  await expect(action.getByTestId('data-primary-action-mobile-contract')).toHaveCount(0);

  await action.getByRole('button', { name: 'Warum diese Aufgabe?' }).click();
  await expect(action.getByTestId('data-primary-action-mobile-contract')).toContainText('Nach dem Klick');
});

test('Data Plan Load triage hands off to the actionable Plan scenario surface', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data');
  await page.getByRole('button', { name: 'Weitere Datenbereiche anzeigen' }).click();
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
  await expect(page.getByRole('heading', { name: 'Heute relevant', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Heute relevant' })).toHaveAttribute('aria-selected', 'true');
});

test('Data, Plan and Settings preserve URL-backed UI state', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/data?tab=mental');
  await expect(page.getByRole('tab', { name: 'Heute relevant', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Trends' }).click();
  await expect(page).toHaveURL('/data?tab=trends');

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
  await expect(sidebarTargets).toHaveCount(5);
  for (const index of [0, 1, 2, 3, 4]) {
    const box = await sidebarTargets.nth(index).boundingBox();
    expect(box, `sidebar nav target ${index} should render`).not.toBeNull();
    expect(box!.height, `sidebar nav target ${index} should be at least 44px tall`).toBeGreaterThanOrEqual(44);
  }
  const logoutBox = await page.getByRole('button', { name: 'out' }).boundingBox();
  expect(logoutBox, 'desktop logout should render').not.toBeNull();
  expect(logoutBox!.height, 'desktop logout should be at least 44px tall').toBeGreaterThanOrEqual(44);
  expect(logoutBox!.width, 'desktop logout should be at least 44px wide').toBeGreaterThanOrEqual(44);

  await page.goto('/data?tab=mental');
  const mentalTab = page.getByRole('tab', { name: 'Heute relevant', exact: true });
  await expect(mentalTab).toHaveAttribute('aria-controls', 'data-heute-panel');
  const mentalPanel = page.locator('#data-heute-panel[role="tabpanel"]');
  await expect(mentalPanel).toBeVisible();
  await expect(mentalPanel).toHaveAttribute('aria-labelledby', 'data-heute-tab');

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
  await expect(page.getByTestId('plan-scenario-preview-result')).toBeVisible();
  await expect(page.getByTestId('scenario-garmin-impact')).toBeVisible();
  await expect(page.getByTestId('scenario-result-contract')).toContainText('Nach Apply');
  await expect(page.getByTestId('scenario-result-contract')).toContainText('Sicherste Entscheidung');
  await expect(page.getByTestId('plan-scenario-preview-result')).not.toContainText('Wende an');
  await expect(page.getByTestId('plan-scenario-preview-result')).not.toContainText('Mobile Vorschau simuliert');
  await expect(page.getByTestId('plan-scenario-preview-result')).not.toContainText('Mobile Vorschau: erst Wochenlast');
  await expect(page.getByTestId('plan-scenario-preview-result')).not.toContainText('Plan oder Garmin werden erst nach Apply verändert.');
  await expect(scenarioCard).not.toContainText('Mobile Quick Decision vorbereitet');
  await expect(scenarioCard.getByTestId('plan-scenario-editor')).toHaveCount(0);
  const editToggle = scenarioCard.getByTestId('plan-scenario-edit-toggle');
  await expect(editToggle).toBeVisible();
  await editToggle.click();
  const editor = scenarioCard.getByTestId('plan-scenario-editor');
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel('Dauer min')).toHaveValue('60');
  await expect(editor.getByLabel('Sportart')).toHaveValue('bike');
  await expect(editor.getByLabel('Zone')).toHaveValue('1');
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

test('Home planned-day change option opens the existing plan decision without creating a new workout', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  const requests: Array<{ method: string; pathname: string }> = [];
  const plannedWorkout = {
    id: 'planned-default',
    plannedDate: '2026-05-01',
    activityType: 'bike',
    zone: 2,
    durationMin: 75,
    targetTss: 64,
    status: 'planned',
    description: 'Ruhige Grundlage mit Garmin-Handoff.',
    executionStatus: 'garmin_scheduled',
    garminWorkoutId: 'garmin-workout-planned',
    garminScheduledId: 'garmin-scheduled-planned',
  };

  await mockPulseApi(page, {
    home: { todayWorkout: plannedWorkout, nextWorkout: plannedWorkout },
    planWorkouts: [plannedWorkout],
    todayOptionsState: 'planned_workout',
    onRequest: (pathname, method) => requests.push({ pathname, method }),
  });

  await page.goto('/');
  const todayOptions = page.getByTestId('today-options-card');
  await expect(todayOptions).toContainText('Heute trainieren');
  await todayOptions.getByRole('button', { name: /Leichtere Alternative/i }).click();

  await expect(page).toHaveURL(/source=today-change/);
  await expect(page).toHaveURL(/#next-training-decision/);
  await expect(page.getByTestId('next-training-decision')).toBeInViewport();
  expect(requests).not.toContainEqual({ method: 'POST', pathname: '/api/pulse/plan/scenario/preview' });
  expect(requests).not.toContainEqual({ method: 'POST', pathname: '/api/pulse/plan/workout' });
});

test('Plan full today action does not duplicate the planned-day summary copy', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  await mockPulseApi(page, {
    planWorkouts: [],
    todayOptionsState: 'planned_workout',
  });

  await page.goto('/plan?tab=training');

  const card = page.getByTestId('today-options-card-full');
  await expect(card).toBeVisible();
  const action = card.getByTestId('plan-primary-action');
  await expect(action.locator('p').filter({
    hasText: /^Heute ist Training geplant; Pulse zeigt den Plan plus sinnvolle Ausweichoptionen\.$/,
  })).toBeVisible();
  await expect(action.getByText(/Warum jetzt:/i)).toBeHidden();

  const summary = 'Heute ist Training geplant; Pulse zeigt den Plan plus sinnvolle Ausweichoptionen.';
  const occurrences = await card.evaluate((element, expectedSummary) => (
    ((element as HTMLElement).innerText ?? '').split(expectedSummary).length - 1
  ), summary);
  expect(occurrences).toBe(1);

  await action.getByText(/Warum dieser Plan-Schritt/i).click();
  await expect(action.getByText(/Warum jetzt:/i)).toBeVisible();
});

test('Plan mobile promotes the action contract above refresh chrome', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  await mockPulseApi(page, {
    planWorkouts: [],
    todayOptionsState: 'planned_workout',
  });

  await page.goto('/plan?tab=training');

  const card = page.getByTestId('today-options-card-full');
  await expect(card.getByTestId('plan-primary-action')).toBeVisible();
  await expect(card.getByRole('button', { name: /Workout (öffnen|oeffnen)|Einheit (öffnen|oeffnen)/i })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Tagesoptionen aktualisieren' })).toBeHidden();
});

test('Plan desktop avoids nesting the primary action inside a second card shell', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-specific action shell contract');
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  await mockPulseApi(page, {
    planWorkouts: [],
    todayOptionsState: 'planned_workout',
  });

  await page.goto('/plan?tab=training');

  const card = page.getByTestId('today-options-card-full');
  const action = card.getByTestId('plan-primary-action');
  await expect(card).toContainText('Heute trainieren');
  await expect(card.getByRole('button', { name: 'Tagesoptionen aktualisieren' })).toBeVisible();
  await expect(action).toContainText('Plan-Aktion');

  await expect(action).toHaveCSS('border-top-width', '0px');
  await expect(action).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('Plan desktop keeps the primary action CTA from dominating the action contract', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-specific action CTA density');
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  await mockPulseApi(page, {
    planWorkouts: [],
    todayOptionsState: 'planned_workout',
  });

  await page.goto('/plan?tab=training');

  const action = page.getByTestId('today-options-card-full').getByTestId('plan-primary-action');
  const button = action.getByRole('button', { name: /Workout (öffnen|oeffnen)|Einheit (öffnen|oeffnen)/i });
  await expect(button).toBeVisible();

  const actionBox = await action.boundingBox();
  const buttonBox = await button.boundingBox();
  expect(actionBox, 'Missing plan action bounds').not.toBeNull();
  expect(buttonBox, 'Missing plan action CTA bounds').not.toBeNull();
  expect(buttonBox!.width, 'Desktop primary CTA should be a compact command, not a full-width banner').toBeLessThanOrEqual(260);
  expect(buttonBox!.x, 'Desktop primary CTA should sit in the right action column').toBeGreaterThan(actionBox!.x + actionBox!.width - 320);
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
  await scenarioCard.getByRole('button', { name: 'Szenario-Vorschau öffnen' }).click();
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
            archetypeLabel: 'Steady Endurance',
            difficultyLevel: 2.8,
            difficultyEnergySystem: 'endurance',
            capabilityFit: 'productive',
            capabilityFitDetail: {
              energySystem: 'endurance',
              workoutLevel: 2.8,
              capabilityLevel: 3.4,
              label: 'productive',
              displayLabel: 'Produktiv',
              message: 'Workout-Level 2.8 passt zu deinem aktuellen Bereich 3.4.',
              recommendation: 'Sinnvoller Progressionsreiz, wenn Tagesform und Fueling stimmen.',
              confidence: 'high',
            },
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
            archetypeLabel: 'Tempo Builder',
            difficultyLevel: 3.6,
            difficultyEnergySystem: 'tempo',
            capabilityFit: 'maintenance',
            capabilityFitDetail: {
              energySystem: 'tempo',
              workoutLevel: 3.6,
              capabilityLevel: 4.8,
              label: 'maintenance',
              displayLabel: 'Erhaltung',
              message: 'Workout-Level 3.6 liegt klar unter deinem aktuellen Bereich 4.8.',
              recommendation: 'Gut fuer Erhaltung, Technik oder ruhige Alltagskonsistenz.',
              confidence: 'high',
            },
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
  await page.getByTestId('plan-scenario-preview-card').getByRole('button', { name: 'Szenario-Vorschau öffnen' }).click();
  await page.getByRole('button', { name: 'Umfang senken' }).click();
  await page.getByTestId('plan-scenario-preview-card').getByRole('button', { name: 'Szenario prüfen' }).click();

  await expect(page.getByTestId('plan-scenario-preview-result')).toBeVisible();
  await expect(page.getByTestId('plan-scenario-preview-result')).toContainText('Betroffene Einheiten');
  await expect(page.getByText('Radfahren · 2026-05-03')).toBeVisible();
  await expect(page.getByText('90 -> 70 min')).toBeVisible();
  await expect(page.getByText('68 -> 51 TSS')).toBeVisible();
  await expect(page.getByTestId('plan-scenario-preview-result')).toContainText('Athlete-Level');
  await expect(page.getByTestId('plan-scenario-preview-result')).toContainText('Steady Endurance');
  await expect(page.getByTestId('plan-scenario-preview-result')).toContainText('Workout-Level 2.8');
  await expect(page.getByTestId('plan-scenario-preview-result')).toContainText('Produktiv');
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
  await scenarioCard.getByRole('button', { name: 'Szenario-Vorschau öffnen' }).click();
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
  await expect(page.getByRole('heading', { name: 'Heute ist kein Training geplant.' })).toBeVisible();
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

  await page.goto('/plan?tab=goals');

  const seasonLine = page.getByTestId('plan-season-strategy-card');
  await expect(seasonLine).toBeVisible();
  await expect(seasonLine).toContainText('Build · 70.3 Kraichgau');
  await seasonLine.getByRole('button', { name: 'Saisonlinie anzeigen' }).click();
  await expect(seasonLine).toContainText('4 Einheiten');
  await expect(seasonLine).toContainText('max. 1');
  await expect(seasonLine).toContainText('8h / 384 TSS');
  await expect(seasonLine).toContainText(/Pulse nutzt nicht alle verfügbaren Tage/);
  await expect(seasonLine).toContainText(/Taper ab .*29\.06/);
  await expect(seasonLine).toContainText('6 verfügbare Tage');
});

test('Plan shows adaptive season contract from season and goal projection evidence', async ({ page }) => {
  let insightRequests = 0;
  const writeRequests: string[] = [];
  const garminWriteRequests: string[] = [];
  await mockPulseApi(page, {
    onRequest(pathname, method) {
      if (pathname === '/api/pulse/insights') insightRequests += 1;
      if (method !== 'GET') writeRequests.push(`${method} ${pathname}`);
      if (method !== 'GET' && pathname.toLocaleLowerCase().includes('garmin')) {
        garminWriteRequests.push(`${method} ${pathname}`);
      }
    },
  });

  await page.goto('/plan?tab=goals');

  const contract = page.getByTestId('plan-adaptive-season-contract');
  await expect(contract).toBeVisible();
  await expect(contract).toContainText('Saisonvertrag');
  await expect(contract).toContainText('70.3 Kraichgau');
  await expect(contract).toContainText('ca. 64%');
  await expect(contract).toContainText('Aufbau fortsetzen');
  await expect(contract.getByText('Fueling-Praxis absichern', { exact: true })).toHaveCount(0);
  await expect(contract.getByText('Naechste 14 Tage', { exact: true })).toHaveCount(0);
  await expect(contract.getByText('Hard-Day-Cap', { exact: true })).toHaveCount(0);
  await expect(contract.getByRole('button', { name: 'Saisonvertrag anzeigen' })).toBeVisible();
  await expect(contract).not.toContainText('Keine zusaetzlichen harten Tage ohne klare Evidenz.');
  await contract.getByRole('button', { name: 'Saisonvertrag anzeigen' }).click();
  await expect(contract).toContainText('Fueling-Praxis absichern');
  await expect(contract).toContainText('Naechste 14 Tage');
  await expect(contract).toContainText('Hard-Day-Cap');
  await expect(contract).toContainText('Keine zusaetzlichen harten Tage ohne klare Evidenz.');
  expect(insightRequests).toBe(0);
  expect(writeRequests).toEqual([]);
  expect(garminWriteRequests).toEqual([]);
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

  await page.goto('/plan?tab=goals');

  const seasonLine = page.getByTestId('plan-season-strategy-card');
  await expect(seasonLine).toBeVisible();
  await expect(seasonLine.getByRole('heading', { name: 'Maintenance' })).toBeVisible();
  await seasonLine.getByRole('button', { name: 'Saisonlinie anzeigen' }).click();
  await expect(seasonLine.getByText('Saisonlast')).toHaveCount(0);
  await expect(seasonLine).toContainText('Maintenance ohne Race-Ziel');
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
  for (const [date, label] of [
    ['2026-05-01', 'Lokal'],
    ['2026-05-02', 'Garmin'],
    ['2026-05-03', 'Kalender'],
    ['2026-05-04', 'Erledigt'],
    ['2026-04-30', 'Verpasst'],
    ['2026-05-05', 'Ersetzt'],
  ] as const) {
    await expect(page.getByRole('button', { name: new RegExp(`${date} .* öffnen`) })).toContainText(label);
  }

  await page.getByRole('button', { name: /2026-05-04 .* öffnen/ }).click();
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
  const inbox = page.getByTestId('plan-change-inbox');
  await expect(inbox).toContainText('Garmin absichern');
  await expect(inbox).toContainText('3 geplante Einheit(en) brauchen noch Ausführungs- oder Sync-Sicherheit.');
  await expect(inbox).toContainText('1 nur in Pulse geplant');
  await expect(inbox).toContainText('1 nur als Garmin-Vorlage');
  await expect(inbox).toContainText('1 mit Sync-Einschränkung');

  await inbox.getByRole('button', { name: 'Garmin prüfen' }).click();
  await expect(page).toHaveURL('/plan?tab=execution');
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
  const card = page.getByTestId('plan-change-inbox');
  await expect(card).toContainText('Plan-Änderungen');
  await expect(card).toContainText('Garmin-Handoff prüfen');
  await expect(card).toContainText('Lange reale Einheit erkannt');

  await card.getByRole('button', { name: 'Szenario prüfen' }).first().click();
  await expect(page.getByTestId('plan-scenario-preview-card')).toBeInViewport();
  await expect(page.getByTestId('plan-scenario-review-hint')).toContainText('Umfang senken');

  await card.getByRole('button', { name: 'Szenario prüfen' }).nth(1).click();
  await expect(page.getByTestId('plan-scenario-review-hint')).toContainText('Verschieben');

  await card.getByRole('button', { name: 'Garmin prüfen' }).click();
  await expect(page).toHaveURL('/plan?tab=execution');
});

test('Plan Review surfaces the weekly coach review with a clear next action', async ({ page }) => {
  await mockPulseApi(page, {
    adaptationEvents: {
      events: [{
        id: 'weekly-regen',
        userId: 'user-1',
        eventDate: '2026-05-01',
        kind: 'planned_workout_missed',
        sourceId: null,
        severity: 'action',
        recommendation: 'regenerate_week',
        summary: 'Lange reale Einheit erkannt; die Woche sollte neu geprüft werden.',
        evidence: ['Garmin-Ausführung weicht vom Plan ab'],
        resolvedAt: null,
        createdAt: '2026-05-01T08:00:00.000Z',
      }],
    },
    personalResponse: {
      summary: {
        generatedAt: '2026-05-01T08:00:00.000Z',
        range: { from: '2026-04-01', to: '2026-05-01', days: 30 },
        strength: 'learning',
        headline: 'Pulse lernt deine Reaktionsmuster.',
        signals: [{
          kind: 'mental_response',
          label: 'Mentale Last einbeziehen',
          strength: 'learning',
          summary: 'Stressreiche Tage brauchen klarere Boundaries.',
          evidence: ['2 Check-ins mit Stress >=7'],
          nextAdjustment: 'Vor harten Einheiten zuerst Boundary und Warm-up prüfen.',
        }],
        missingEvidence: [],
      },
    },
    goalProjection: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      horizonDays: 180,
      headline: 'Top-Ziel braucht Aufmerksamkeit.',
      projections: [{
        goalId: 'race-1',
        title: '70.3 Kraichgau',
        category: 'race',
        targetDate: '2026-07-11',
        daysUntil: 71,
        probabilityPct: 64,
        status: 'watch',
        confidence: 'medium',
        summary: '70.3 Kraichgau beobachten.',
        limiterRisk: { status: 'watch', label: 'Long Endurance', summary: 'Lange Ausdauer kontrolliert aufbauen.', evidence: ['Long Endurance lernt'] },
        nextBestIntervention: {
          kind: 'fueling_practice',
          title: 'Fueling-Praxis absichern',
          summary: 'Die nächste lange Einheit sollte kontrolliert Fueling und GI-Verträglichkeit schließen.',
          actionLabel: 'Fueling planen',
          targetPath: '/plan?tab=training',
          evidence: ['GI-Komfort noch Lernfeld'],
        },
        evidence: ['Ziel in 71 Tagen'],
        missingEvidence: [],
      }],
      missingEvidence: [],
    },
    seasonStrategy: {
      horizonWeeks: 12,
      primaryGoal: { id: 'race-1', title: '70.3 Kraichgau', category: 'race', targetDate: '2026-07-11', priority: 'A' },
      currentBlock: { kind: 'build', label: 'Build', startWeek: '2026-05-01', endWeek: '2026-06-01', focus: 'Spezifität aufbauen, aber freie Tage schützen.' },
      upcomingBlocks: [],
      guardrails: {
        targetSessions: 4,
        maxHardDays: 1,
        deload: false,
        freeDayRationale: 'Mindestens ein freier Tag bleibt geschützt.',
        rationale: ['Verfügbarkeit ist größer als sinnvolle Trainingsdichte.'],
        nextBoundary: { label: 'Taper', date: '2026-06-29' },
      },
      loadModel: {
        method: 'weekly_hours_tss_ctl',
        rampRateCapPct: 8,
        deloadEveryWeeks: 4,
        taperWeeks: 2,
        annualTargetHours: null,
        annualTargetTss: null,
        eventPriorityBias: 'a_event',
        missedLoadCompensation: { missedTssLast14d: 0, compensationTssNext14d: 0, capReason: 'Keine Kompensation nötig.' },
        currentWeek: { weekStart: '2026-05-01', kind: 'build', targetHours: 8, targetTss: 384, ctlTarget: 55, rampPct: 5, note: 'Build ruhig halten.' },
        forecast: [],
        warnings: [],
      },
      evidence: ['A-Race in 71 Tagen'],
    },
  });

  await page.goto('/plan?tab=review');

  const review = page.getByTestId('weekly-coach-review');
  await expect(review).toContainText('Wochenentscheidung offen');
  await expect(review).toContainText('Gelernt');
  await expect(review).toContainText('Planänderung');
  await expect(review).toContainText('Entscheidung');
  await expect(review).toContainText('Planpunkte prüfen');

  await review.getByRole('button', { name: 'Planpunkte prüfen' }).click();
  await expect(page).toHaveURL('/plan?tab=training&source=weekly-review#plan-change-inbox');
  await expect(page.getByTestId('plan-change-inbox')).toBeVisible();
});

test('Plan Review keeps the long weekly narrative behind disclosure', async ({ page }) => {
  await mockPulseApi(page);
  await page.route('**/api/pulse/review/latest', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'review-density',
      userId: 'user-1',
      weekStart: '2026-04-27',
      weekEnd: '2026-05-03',
      narrative: 'Starke Woche: Du hast solide trainiert und bewusst Pausen zugelassen. Die Analyse bleibt hilfreich, sollte aber nicht die Entscheidung im ersten Viewport dominieren.\\n\\nFür die nächste Woche zählt vor allem, die Belastung gleichmäßig zu verteilen und Planpunkte bewusst zu prüfen.',
      metrics: {},
      recommendations: [],
      createdAt: '2026-05-03T20:00:00.000Z',
    }),
  }));

  await page.goto('/plan?tab=review');

  await expect(page.getByTestId('weekly-coach-review')).toBeVisible();
  await expect(page.getByTestId('weekly-review-narrative')).toHaveCount(0);

  await page.getByRole('button', { name: 'Analyse anzeigen' }).click();
  await expect(page.getByTestId('weekly-review-narrative')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analyse ausblenden' })).toBeVisible();
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
  await expect(page.getByRole('button', { name: /2026-05-01 .* öffnen/ })).toContainText('Lokal');
  const calendarWorkout = page.getByRole('button', { name: /2026-05-02 .* öffnen/ });
  await expect(calendarWorkout).toContainText('Kalender');

  await calendarWorkout.click();
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
      outcomeBaseline: {
        status: 'learning',
        label: 'Fueling-Baseline lernen',
        summary: 'Letzter langer Log: 42 g/h, 4 x 750 ml, 300 g Pulver; naechste Teststufe 50-70 g/h.',
        latestLogDate: '2026-04-29',
        observedCarbsPerHour: 42,
        targetCarbsPerHour: { min: 50, max: 70 },
        bottles750Ml: 4,
        powderG: 300,
        fluidMlPerHour: 419,
        sodiumMgPerHour: null,
        evidence: ['Letzter Log: 2026-04-29, 42 g/h, 4 x 750 ml, 300 g Pulver', 'Sodium nicht geloggt'],
      },
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
  await expect(page.getByTestId('workout-fueling-baseline')).toContainText('Fueling-Baseline lernen');
  await expect(page.getByTestId('workout-fueling-baseline')).toContainText('42 g/h');
  await expect(page.getByTestId('workout-fueling-baseline')).toContainText('50-70 g/h');
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
  await decision.getByRole('button', { name: 'Details & Evidenz anzeigen' }).click();
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
  await decision.getByRole('button', { name: 'Details & Evidenz anzeigen' }).click();
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

  await page.getByTestId('next-training-decision').getByRole('button', { name: 'Details & Evidenz anzeigen' }).click();
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
  await page.getByRole('tab', { name: 'Datenqualität' }).click();

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
  await page.getByRole('tab', { name: 'Datenqualität' }).click();

  await expect(page.getByTestId('garmin-quality-panel')).toContainText('Garmin Domainqualität');
  await expect(page.getByTestId('garmin-quality-sleep')).toContainText('TEIL');
  await expect(page.getByTestId('garmin-quality-body_composition')).toContainText('ALT');
  await expect(page.getByTestId('garmin-quality-body_composition')).toContainText('Körperzusammensetzung fehlt');

  await page.getByRole('tab', { name: 'Trends' }).click();
  const bodyCompositionHint = page.getByTestId('garmin-quality-hint').filter({ hasText: 'Körperdaten' });
  await expect(bodyCompositionHint).toContainText('Körperdaten');
  await expect(bodyCompositionHint).toContainText('ALT');
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
  await page.getByRole('tab', { name: 'Datenqualität' }).click();

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
  const chain = page.getByTestId('garmin-execution-chain');
  await expect(chain).toContainText('Vorlage');
  await expect(chain).toContainText('Kalender');
  await expect(chain).toContainText('Readback');
  await expect(chain).toContainText('Repeats');
  await expect(chain).toContainText('Ausführung');
  await expect(page.getByTestId('garmin-execution-next-action')).toContainText('Kalendertermin schließen');
  await expect(panel).toContainText('Auf Garmin bereit');
  await expect(panel).toContainText('Fehlt im Garmin-Kalender');
  await expect(panel).toContainText('Wiederholungen prüfen');
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

test('Plan explains Athlete-Level fit and recommends the safer stretch alternative', async ({ page }) => {
  await mockPulseApi(page, {
    planWorkouts: [{
      id: 'stretch-level-workout',
      userId: 'user-1',
      plannedDate: localIsoDateDaysFrom(1),
      activityType: 'bike',
      zone: 4,
      durationMin: 75,
      distanceKm: null,
      targetTss: 92,
      archetypeId: 'bike_threshold_cruise',
      difficultyLevel: 4.4,
      difficultyEnergySystem: 'threshold',
      capabilityFit: 'stretch',
      description: 'Warum diese Einheit: Threshold-Reiz, aber Athlete-Level ist Stretch. Sauber entscheiden, nicht blind ausführen.',
      steps: [{ type: 'steady', durationMin: 75, zone: 4 }],
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
    }],
  });

  await page.goto('/plan?tab=training');

  const level = page.getByTestId('plan-athlete-level-summary');
  await expect(level).toContainText('Athlete-Level');
  await expect(level).toContainText('Stretch');
  await expect(level).toContainText('Workout-Level 4.4');
  const progression = page.getByTestId('plan-workout-progression');
  await expect(progression).toContainText('Grenzreiz kontrollieren');
  await expect(progression).toContainText('Ändern wenn');
  await expect(progression).toContainText(/entschärfen|verschieben/);
  await expect(page.getByTestId('plan-adaptation-status')).toContainText('Athlete-Level: Stretch kontrollieren');
  await expect(page.getByText('Level-Wirkung: Zielreiz bleibt, Belastung sinkt')).toBeVisible();
});

test('Plan Training explains repeated-looking workouts as deliberate consolidation', async ({ page }) => {
  const repeatedWorkouts = [
    {
      id: 'repeat-endurance-1',
      userId: 'user-1',
      plannedDate: localIsoDateDaysFrom(1),
      activityType: 'bike',
      zone: 2,
      durationMin: 75,
      distanceKm: null,
      targetTss: 58,
      archetypeId: 'endurance_steady',
      difficultyLevel: 3.1,
      difficultyEnergySystem: 'endurance',
      capabilityFit: 'maintenance',
      description: 'Aerobe Grundlage, bewusst gleichmaessig.',
      steps: [{ type: 'steady', durationMin: 75, zone: 2 }],
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
      id: 'repeat-endurance-2',
      userId: 'user-1',
      plannedDate: localIsoDateDaysFrom(3),
      activityType: 'bike',
      zone: 2,
      durationMin: 80,
      distanceKm: null,
      targetTss: 62,
      archetypeId: 'endurance_steady',
      difficultyLevel: 3.1,
      difficultyEnergySystem: 'endurance',
      capabilityFit: 'maintenance',
      description: 'Aerobe Grundlage, zweite Konsolidierung.',
      steps: [{ type: 'steady', durationMin: 80, zone: 2 }],
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
  ];

  await mockPulseApi(page, { planWorkouts: repeatedWorkouts });
  await page.goto('/plan?tab=training');

  const progression = page.getByTestId('plan-workout-progression');
  await expect(progression).toContainText('Bewusste Konsolidierung');
  await expect(progression).toContainText('2x');
  await expect(progression).toContainText('bewusst wiederholbar');

  const rowProgression = page.getByTestId('plan-workout-progression-row').first();
  await expect(rowProgression).toContainText('Progression');
  await expect(rowProgression).toContainText('Bewusste Konsolidierung');
});

test('Plan Statistik shows progression guidance in capability levels', async ({ page }) => {
  await mockPulseApi(page);
  await page.goto('/plan?tab=stats');

  await expect(page.getByText('Capability Levels')).toBeVisible();
  await expect(page.getByText('nächster produktiver Reiz 4.0')).toBeVisible();
  await expect(page.getByText('geschützt · nächster Reiz 4.3')).toBeVisible();
});

test('Plan Training highlights the why-this-workout rationale separately from the body copy', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  await mockPulseApi(page, {
    planTrace: limiterPlanTraceFixture(),
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
        description: 'Warum diese Einheit: Cadence Endurance, Limiter Long Endurance + Fueling, aerober Reiz passt zur aktuellen Belastung, RPE unauffaellig, Fueling kontrollieren, mentale Lage ohne harte Bremse. Aerobe Grundlage, primaer ueber Puls steuern.',
      },
    ],
  });

  await page.goto('/plan?tab=training');

  await expect(page.getByTestId('plan-workout-rationale')).toContainText('Warum diese Einheit');
  await expect(page.getByTestId('plan-workout-rationale')).toContainText('Limiter Long Endurance + Fueling');
  await expect(page.getByTestId('plan-workout-description-body')).toContainText('Aerobe Grundlage, primaer ueber Puls steuern.');
  await expect(page.getByTestId('plan-limiter-workout-summary')).toContainText('Limiter: Long Endurance + Fueling');
  await expect(page.getByTestId('plan-limiter-workout-summary')).toContainText('Fueling');
});

test('Data analyses show limiter evidence freshness from the plan trace', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
  await mockPulseApi(page, {
    planTrace: limiterPlanTraceFixture(),
  });

  await page.goto('/data?tab=analysis');

  await expect(page.getByTestId('data-limiter-evidence-card')).toContainText('Limiter-Evidenz');
  await expect(page.getByTestId('data-limiter-evidence-card')).toContainText('Long Endurance + Fueling');
  await expect(page.getByTestId('data-limiter-evidence-card')).toContainText('letzte lange Einheit 4 h');
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
  await page.getByRole('tab', { name: 'Datenqualität' }).click();
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
  await page.addInitScript(() => {
    Object.defineProperty(window.Notification, 'permission', { get: () => 'default' });
  });
  await mockPulseApi(page);

  await page.goto('/settings');
  const matrix = page.getByTestId('settings-diagnostics-matrix');
  const summary = page.getByTestId('settings-status-summary');
  await expect(matrix).toBeVisible();
  await expect(summary).toContainText('Alles bereit');
  await expect(summary).toContainText('Optional');
  await expect(summary.getByRole('button', { name: 'Push öffnen' })).toBeVisible();
  await expect(matrix).toContainText('DIAGNOSE');
  await expect(matrix).toContainText('Zugriff');
  await expect(matrix).toContainText('Diagnose anzeigen');
  await expect(matrix.getByText('Zertifikat')).toHaveCount(0);

  const matrixBox = await matrix.boundingBox();
  const profileBox = await page.getByRole('heading', { name: 'Profil', exact: true }).boundingBox();
  expect(matrixBox).not.toBeNull();
  expect(profileBox).not.toBeNull();
  expect(matrixBox!.y).toBeLessThanOrEqual(profileBox!.y + 4);

  await summary.getByRole('button', { name: 'Push öffnen' }).click();
  await expect(page).toHaveURL('/settings?section=push');

  await page.goto('/settings');
  await matrix.getByText('Diagnose anzeigen').click();
  await expect(matrix).toContainText('Zertifikat');
  await matrix.getByRole('button', { name: 'Gerät', exact: true }).click();
  await expect(page).toHaveURL('/settings?section=device');
  await expect(page.getByRole('heading', { name: 'iPhone & PWA' })).toBeVisible();
});

test('Settings uses desktop width for status and profile while keeping mobile stacked', async ({ page }) => {
  await mockPulseApi(page);

  await page.goto('/settings');

  const status = page.getByTestId('settings-diagnostics-matrix');
  const profile = page.locator('[data-settings-section="profile"]');
  await expect(status).toBeVisible();
  await expect(profile).toBeVisible();

  const statusBox = await status.boundingBox();
  const profileBox = await profile.boundingBox();
  const viewport = page.viewportSize();
  expect(statusBox, 'Missing settings status bounds').not.toBeNull();
  expect(profileBox, 'Missing settings profile bounds').not.toBeNull();
  expect(viewport, 'Missing viewport').not.toBeNull();

  if (viewport!.width >= 1024) {
    expect(profileBox!.y, 'desktop profile should start beside the status card').toBeLessThan(statusBox!.y + 80);
    expect(profileBox!.x, 'desktop profile should use the second column').toBeGreaterThan(statusBox!.x + statusBox!.width * 0.75);
  } else {
    expect(profileBox!.y, 'mobile profile should remain below the status card').toBeGreaterThan(statusBox!.y + statusBox!.height - 4);
    expect(Math.abs(profileBox!.x - statusBox!.x), 'mobile profile should stay in the same column').toBeLessThanOrEqual(2);
  }
});

test('Settings treats blocked push as optional when core access is ready', async ({ page }) => {
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
  });

  await page.goto('/settings');
  const summary = page.getByTestId('settings-status-summary');
  await expect(summary).toContainText('Alles bereit');
  await expect(summary).toContainText('Optional');
  await expect(summary).toContainText('Push');
  await expect(summary).not.toContainText('Problem beheben');
  const optionalRow = summary.getByTestId('settings-optional-summary-row');
  await expect(optionalRow).toContainText('Push');
  await expect(optionalRow).toContainText('Browser blockiert');
  await expect(summary.getByRole('button', { name: 'Push öffnen' })).toBeVisible();
  const optionalBox = await optionalRow.boundingBox();
  expect(optionalBox).not.toBeNull();
  expect(optionalBox!.height).toBeLessThan(80);
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
  const summary = page.getByTestId('settings-status-summary');
  await expect(summary).toContainText('Problem beheben');
  await expect(summary).toContainText('1 Punkt prüfen');
  await expect(summary).toContainText('Garmin');
  await expect(summary).not.toContainText('1 Punkt prüfen: Push');
  await matrix.getByRole('button', { name: 'Diagnose anzeigen' }).click();
  await expect(matrix).toContainText('Push');
  await expect(matrix).toContainText('Browser blockiert');
  await expect(matrix).toContainText('Garmin');
  await expect(matrix).toContainText('Blockiert');
  await expect(matrix).toContainText('Zertifikat');
  await expect(matrix).toContainText('manuell');

  await summary.getByRole('button', { name: 'Garmin öffnen' }).click();
  await expect(page).toHaveURL('/settings?section=garmin');
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
  await matrix.getByRole('button', { name: 'Diagnose anzeigen' }).click();
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
  await expect(bottomNav.locator('a[href="/insights"]')).toContainText('Insights');
  await expect(bottomNav.locator('a[href="/settings"]')).toContainText('Settings');
  const bottomNavBox = await bottomNav.boundingBox();
  expect(bottomNavBox).not.toBeNull();
  expect(bottomNavBox!.y + bottomNavBox!.height).toBeLessThanOrEqual(viewport.height);

  await page.goto('/data');
  const overviewTab = page.getByRole('tab', { name: 'Heute relevant', exact: true });
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
  expect(['auto', 'visible']).toContain(dataTabs.overflowX);
  expect(dataTabs.scrollWidth).toBeLessThanOrEqual(dataTabs.clientWidth + 1);

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

  for (const route of ['/', '/coach', '/data', '/data?tab=analysis', '/plan', '/insights', '/settings']) {
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
  await expectTabTouchTarget(page, 'Heute relevant');
  await expectTabTouchTarget(page, 'Datenqualität');
  await expectTouchTarget(page, '30T');
  await expectTouchTarget(page, '90T');
  await expectTouchTarget(page, 'Vorschau');
  await expectTouchTarget(page, 'Nachladen');

  await page.goto('/data?tab=overview');
  await expectTouchTarget(page, 'Check-in öffnen');
  await expectTouchTarget(page, 'Weitere Datenbereiche anzeigen');
  await page.getByRole('button', { name: 'Weitere Datenbereiche anzeigen' }).click();
  await expectTouchTarget(page, 'Analyse öffnen');
  await expectTouchTarget(page, 'Check-in öffnen');
  await expectTouchTarget(page, 'Trends öffnen');

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
  await expectTouchTarget(page, 'Warum dieser Vorschlag?');
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

  await page.goto('/data?tab=analysis');
  await expectTouchTarget(page, '7T');
  await expectTouchTarget(page, '30T');
  await expectTouchTarget(page, '90T');

  await page.goto('/settings');
  await expectTouchTarget(page, 'Garmin prüfen');
  await expectTouchTarget(page, 'FTP automatisch übernehmen');
  await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(2);
  await expectTouchTargetAt(page, 'Bearbeiten', 0);
  await expectTouchTargetAt(page, 'Bearbeiten', 1);
  await page.getByRole('button', { name: 'Diagnose anzeigen' }).click();
  await expectTouchTarget(page, 'Abdeckung');
  await expectTouchTarget(page, 'ERLEDIGT');
  await expectTouchTarget(page, 'LÖSCHEN');
  await expectTouchTarget(page, 'Push aktivieren');
});
