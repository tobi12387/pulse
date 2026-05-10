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
            targetPath: '/activity/activity-planned-bike',
            evidence: ['Geplant: Rad 80 min Z2', 'Abgeschlossen: Rad 82 min · 33 km'],
          },
          {
            id: 'fueling-after-activity',
            kind: 'fueling',
            priority: 'secondary',
            title: 'Fueling-Log prüfen',
            detail: 'Lange Belastung: Flaschen, Pulver, Snacks und GI-Komfort festhalten.',
            cta: 'Fueling öffnen',
            targetPath: '/activity/activity-planned-bike',
            evidence: ['Fueling heute bereits geloggt'],
          },
          {
            id: 'recovery-after-activity',
            kind: 'recovery',
            priority: 'support',
            title: 'Resttag schützen',
            detail: 'Heute nicht nachlegen. Essen, Trinken, lockere Bewegung und Schlaf bestimmen den Nutzen der Einheit.',
            cta: 'Recovery ansehen',
            targetPath: '/data#data-recovery',
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

test('Home no-training daily decision offers local closure before Coach support', async ({ page }) => {
  let actionPatches = 0;
  await mockPulseApi(page, {
    onActionPatch: () => { actionPatches += 1; },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  await expect(decision).toContainText('Heute ist kein Training geplant.');
  const localClosure = decision.getByRole('button', { name: /Erholungstag abschliessen|Heute abschliessen/i });
  await expect(localClosure).toBeVisible();
  await expect(decision.getByRole('button', { name: /Coach/i })).toHaveCount(1);

  await localClosure.click();
  await expect(page).toHaveURL('/');
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
