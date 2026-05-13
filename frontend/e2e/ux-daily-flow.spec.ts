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

test('Plan keeps one training decision surface without duplicating the generic daily decision', async ({ page }) => {
  await page.goto('/plan');

  await expect(page.getByTestId('today-options-card-full')).toContainText('Heute trainieren');
  await expect(page.getByText('TAGESENTSCHEIDUNG')).toHaveCount(0);
});

test('Plan evidence does not show an empty decision beside a planned-workout today option', async ({ page }) => {
  await page.goto('/plan');

  await expect(page.getByTestId('today-options-card-full')).toContainText('Heute trainieren');
  await expect(page.getByText('Kein offenes Training geplant')).toHaveCount(0);
});

test('Focus shell exposes handoff keyboard help with ?', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('focus-decision-hero')).toBeVisible();

  await page.keyboard.press('Shift+/');
  const dialog = page.getByRole('dialog', { name: 'Tastaturhilfe' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('⌘K');
  await expect(dialog).toContainText('Coach');

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('Activity detail is available under the Plan route namespace', async ({ page }) => {
  await page.goto('/plan/activity/activity-detail');

  await expect(page).toHaveURL(/\/plan\/activity\/activity-detail/);
  await expect(page.getByText('Rennrad Tour').first()).toBeVisible();
});

test('Today options show compact signal labels for the strongest reason', async ({ page }) => {
  await mockPulseApi(page, {
    todayOptions: {
      todayOptions: {
        date: '2026-05-01',
        state: 'recovery_protect',
        summary: 'Fueling-Schutz ist heute wichtiger als Intensität.',
        signature: 'fueling-protect-label',
        fuelingDebt: {
          status: 'open_gi_issue',
          hasOpenDebt: true,
          label: 'GI-Schutz offen',
          summary: 'GI-/Magenhinweis ist noch offen.',
          closureCondition: 'Schließen: 75-120 min locker mit frühem Fueling und danach Magen ok loggen.',
          evidence: ['GI-Hinweis: 2026-04-29'],
          openIssueDate: '2026-04-29',
          controlledWorkoutId: null,
          followUpActivityId: null,
          updatedAt: '2026-05-01T08:00:00.000Z',
        },
        options: [{
          id: 'rest-fueling-protect',
          kind: 'rest',
          priority: 'primary',
          title: 'Heute bewusst pausieren',
          detail: 'Schließen: 75-120 min locker mit frühem Fueling und danach Magen ok loggen.',
          cta: 'Tagesentscheidung prüfen',
          targetPath: '/',
          evidence: ['Fueling: letzte Einheit mit GI-Hinweis'],
          signalLabels: [
            {
              kind: 'fueling_protect',
              label: 'Fueling schützen',
              detail: 'Magenhinweis begrenzt Intensität',
              tone: 'amber',
            },
            {
              kind: 'recovery',
              label: 'Recovery',
              detail: 'Erholung hat heute Vorrang',
              tone: 'green',
            },
          ],
        }],
      },
    },
  });

  await page.goto('/plan');
  const todayOptions = page.getByTestId('today-options-card-full');
  await expect(page.getByTestId('today-options-fueling-debt')).toContainText('GI-Schutz offen');
  await expect(todayOptions).toContainText('Fueling schützen');
  await expect(todayOptions).toContainText('Recovery');
  await expect(todayOptions).toContainText('75-120 min locker');
});

test('Plan renders completed planned workout today options as a closed decision', async ({ page }) => {
  await mockPulseApi(page, {
    todayOptions: {
      todayOptions: {
        date: '2026-05-01',
        state: 'completed_activity',
        summary: 'Geplantes Training erledigt: Rad 82 min · 33 km. Pulse schliesst die Trainingsentscheidung und priorisiert Feedback, Fueling und Regeneration.',
        signature: 'completed-planned-training',
        options: [
          {
            id: 'feedback-completed-activity',
            kind: 'feedback',
            priority: 'primary',
            title: 'Feedback ist erledigt',
            detail: 'Die Einheit hat bereits Feedback. Pulse kann die Belastung fuer die naechste Planung einordnen.',
            cta: 'Aktivität ansehen',
            targetPath: '/plan/activity/activity-planned-bike',
            evidence: ['Geplant: Rad 80 min Z2', 'Abgeschlossen: Rad 82 min · 33 km'],
          },
          {
            id: 'fueling-after-activity',
            kind: 'fueling',
            priority: 'secondary',
            title: 'Fueling-Log prüfen',
            detail: 'Lange Belastung: Flaschen, Pulver, Snacks und GI-Komfort festhalten.',
            cta: 'Fueling öffnen',
            targetPath: '/plan/activity/activity-planned-bike',
            evidence: ['Fueling heute bereits geloggt'],
          },
          {
            id: 'recovery-after-activity',
            kind: 'recovery',
            priority: 'support',
            title: 'Resttag schützen',
            detail: 'Heute nicht nachlegen. Essen, Trinken, lockere Bewegung und Schlaf bestimmen den Nutzen der Einheit.',
            cta: 'Recovery ansehen',
            targetPath: '/data?tab=trends#data-recovery',
            evidence: ['Readiness 76/100'],
          },
        ],
      },
    },
  });
  await page.goto('/plan');

  const todayOptions = page.getByTestId('today-options-card-full');
  await expect(todayOptions).toContainText('Nach der Einheit');
  await expect(todayOptions).toContainText('Geplantes Training erledigt');
  await expect(todayOptions).toContainText('Feedback ist erledigt');
  await expect(todayOptions).toContainText('Fueling-Log prüfen');
  await expect(todayOptions).not.toContainText('Plan ausführen');
});

test('Home renders exactly one main daily decision card', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('TAGESENTSCHEIDUNG')).toHaveCount(1);
});

test('Home shows the latest planned-vs-completed daily delta', async ({ page }) => {
  await mockPulseApi(page, {
    dailyDelta: [{
      date: '2026-05-01',
      status: 'matched',
      title: 'Plan und Ausführung passen zusammen',
      summary: 'Die echte Belastung lag +7 TSS zum Plan.',
      score: 88,
      loadDeltaTss: 7,
      recoveryDelta: 'Recovery seit Vortag: Schlaf +0.6 h',
      nextPlanEffect: 'Plan kann diesen Reiz als erledigt behandeln und die nächste Empfehlung darauf aufbauen.',
      evidence: ['Geplant: Radfahren · Z2 · 75 min', 'Garmin: Radfahren · 80 min · TSS 72'],
      targetPath: '/plan/activity/activity-planned-bike',
    }],
  });
  await page.goto('/');

  const delta = page.getByTestId('daily-delta-card');
  await expect(delta).toContainText('Plan vs Ausführung');
  await expect(delta).toContainText('Match 88%');
  await expect(delta).toContainText('+7 TSS');
  await expect(delta).toContainText('Plan kann diesen Reiz als erledigt behandeln');
});

test('Home no-training daily decision opens the missing check-in before Coach support', async ({ page }) => {
  let actionPatches = 0;
  await mockPulseApi(page, {
    onActionPatch: () => { actionPatches += 1; },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  await expect(decision).toContainText('Heute ist kein Training geplant.');
  await expect(decision).toContainText(/Warum jetzt/i);
  await expect(decision).toContainText(/Nach dem Klick/i);
  await expect(decision).toContainText('Kurz Stimmung, Energie, Stress und Motivation eintragen');
  await expect(decision).toContainText('Nach dem Speichern nutzen Home, Plan und Coach dasselbe mentale Tagessignal.');
  await expect(decision.getByText('Readiness 78/100')).not.toBeVisible();
  const checkinAction = decision.getByRole('button', { name: /Check-in öffnen/i });
  await expect(checkinAction).toBeVisible();
  await expect(decision.getByRole('button', { name: /Coach/i })).toHaveCount(1);

  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();
  await expect(decision.getByText('Readiness 78/100')).toBeVisible();

  await checkinAction.click();
  await expect(page).toHaveURL('/data?tab=today#data-mental');
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
