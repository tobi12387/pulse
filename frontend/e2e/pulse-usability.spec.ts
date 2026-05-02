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
          display: style.display,
          visibility: style.visibility,
        };
      })
      .filter(item =>
        item.display !== 'none' &&
        item.visibility !== 'hidden' &&
        item.width > 0 &&
        item.height > 0 &&
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

async function expectTouchTarget(page: Page, name: string | RegExp, minHeight = 40) {
  await expectTouchTargetAt(page, name, 0, minHeight);
}

async function expectTouchTargetAt(page: Page, name: string | RegExp, index: number, minHeight = 40) {
  const target = page.getByRole('button', { name }).nth(index);
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box, `Missing touch target ${String(name)} at index ${index}`).not.toBeNull();
  expect(box!.height, `${String(name)} at index ${index} should be at least ${minHeight}px tall`).toBeGreaterThanOrEqual(minHeight);
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
  await page.getByRole('button', { name: /Trainingsdaten: Plan öffnen/ }).click();
  await expect(page).toHaveURL('/plan');
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

test('Home, Coach and Insights show the daily decision quality signal', async ({ page }) => {
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
  await expect(page.getByTestId('daily-decision-quality-strip')).toContainText('ENTSCHEIDUNGSQUALITÄT');
  await expect(page.getByTestId('daily-decision-quality-strip')).toContainText('WIEDERHOLUNG PRÜFEN');
  await expect(page.getByText('Wiederkehrende Empfehlung kleiner, anders getaktet')).toBeVisible();

  await page.goto('/coach');
  await expect(page.getByTestId('coach-decision-quality-chip')).toContainText('Entscheidungsqualität');
  await page.getByTestId('coach-decision-quality-chip').click();
  await expect(page.getByPlaceholder('Frage…')).toHaveValue(/Wiederholung prüfen/);

  await page.goto('/insights');
  await expect(page.getByTestId('insights-decision-quality-card')).toContainText('Entscheidungsqualität');
  await expect(page.getByTestId('insights-decision-quality-card')).toContainText('Mobilität 10 Minuten');
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
  await expect(page.getByText('Welche Grenze macht diesen freien Tag wirklich erholsam?')).toBeVisible();
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
  await expect(page.getByText('Welche Grenze macht diesen freien Tag wirklich erholsam?')).toBeVisible();
  await expect(page.getByText('Was wäre heute genug?')).toBeVisible();
  await page.getByRole('button', { name: /Welche Grenze macht diesen freien Tag wirklich erholsam/ }).click();
  await page.getByRole('button', { name: 'Mental: angespannt' }).click();
  await page.getByRole('button', { name: 'Schutz: aktiv einplanen' }).click();
  await expect(page.getByPlaceholder(/Was ist mental gerade wichtig/)).toHaveValue(/Welche Grenze macht diesen freien Tag wirklich erholsam/);
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
        freeDayRationale: 'Pulse nutzt nicht alle verfügbaren Tage: mindestens ein freier Tag bleibt fuer Erholung, Alltag und bessere Ausfuehrung geschuetzt.',
        rationale: ['Sechs Tage sind verfuegbar, aber nur vier sind sinnvoll.'],
        nextBoundary: { label: 'Taper', date: '2026-06-29' },
      },
      evidence: ['A-Race in 10 Wochen', 'TSB 3.0', '6 verfuegbare Tage'],
    },
  });

  await page.goto('/plan');

  await expect(page.getByText('Saisonlinie')).toBeVisible();
  await expect(page.getByText('Build · 70.3 Kraichgau')).toBeVisible();
  await expect(page.getByText('4 Einheiten')).toBeVisible();
  await expect(page.getByText('max. 1')).toBeVisible();
  await expect(page.getByText(/Pulse nutzt nicht alle verfügbaren Tage/)).toBeVisible();
  await expect(page.getByText(/Taper ab .*29\.06/)).toBeVisible();
  await expect(page.getByText('6 verfuegbare Tage')).toBeVisible();
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
  await page.getByRole('button', { name: 'Ziele' }).click();
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
        reasons: ['Ausführung stabil: ähnliche Struktur ist bewusst gewählt.'],
      },
    },
  });

  await page.goto('/plan');

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
  await page.getByRole('button', { name: 'Abdeckung' }).click();

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
  await page.getByRole('button', { name: 'Abdeckung' }).click();

  await expect(page.getByTestId('garmin-quality-panel')).toContainText('Garmin Domainqualität');
  await expect(page.getByTestId('garmin-quality-sleep')).toContainText('TEIL');
  await expect(page.getByTestId('garmin-quality-body_composition')).toContainText('ALT');
  await expect(page.getByTestId('garmin-quality-body_composition')).toContainText('Körperzusammensetzung fehlt');

  await page.getByRole('button', { name: 'Gewicht' }).click();
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
          whyItMatters: 'HR-Zonen und Laps zeigen Ausfuehrungsqualitaet.',
          evidence: ['8 Tage mit Detailcache'],
        },
      ],
      recommendedUseCases: ['daily_decision', 'plan_generation'],
      items: [],
    },
  });

  await page.goto('/data');
  await page.getByRole('button', { name: 'Abdeckung' }).click();

  await expect(page.getByTestId('garmin-signal-usefulness-panel')).toContainText('Garmin Signalnutzen');
  await expect(page.getByTestId('garmin-signal-body_battery_depth')).toContainText('UNTERGENUTZT');
  await expect(page.getByTestId('garmin-signal-body_battery_depth')).toContainText('Daily Decision');
  await expect(page.getByTestId('garmin-signal-activity_hr_zones_laps')).toContainText('Plan-Generierung');
});

test('Settings surfaces blocked Garmin provider state with bounded actions', async ({ page }) => {
  await mockPulseApi(page, {
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
  await expect(page.getByTestId('garmin-quality-calendar')).toContainText('Öffnen');
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

test('Mobile routes avoid unintended horizontal overflow', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 600, 'mobile containment check');

  await mockPulseApi(page);

  for (const route of ['/', '/coach', '/data', '/plan', '/insights', '/settings']) {
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
  });

  await page.goto('/data');
  await expectTouchTarget(page, 'Abdeckung');
  await expectTouchTarget(page, 'Mental');
  await expectTouchTarget(page, '30T');
  await expectTouchTarget(page, '90T');

  await page.goto('/plan');
  await expectTouchTarget(page, 'Training');
  await expectTouchTarget(page, 'Statistik');
  await expectTouchTarget(page, 'Vorherige Woche');
  await expectTouchTarget(page, 'Nächste Woche');
  await expectTouchTarget(page, 'Sportart ändern');

  await page.goto('/coach');
  await expectTouchTarget(page, 'Verlauf löschen');

  await page.goto('/insights');
  await expectTouchTarget(page, '7T');
  await expectTouchTarget(page, '30T');
  await expectTouchTarget(page, '90T');

  await page.goto('/settings');
  await expectTouchTarget(page, 'Von Garmin');
  await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(2);
  await expectTouchTargetAt(page, 'Bearbeiten', 0);
  await expectTouchTargetAt(page, 'Bearbeiten', 1);
  await expectTouchTarget(page, 'Abdeckung');
  await expectTouchTarget(page, 'ERLEDIGT');
  await expectTouchTarget(page, 'LÖSCHEN');
  await expectTouchTarget(page, 'Push aktivieren');
});
