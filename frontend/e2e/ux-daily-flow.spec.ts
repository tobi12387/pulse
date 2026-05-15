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

test('Home daily decision details expose top signals goal impact Garmin state and safest option', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      todayWorkout: {
        id: 'planned-default',
        userId: 'user-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 75,
        distanceKm: null,
        targetTss: 62,
        archetypeId: 'endurance_steady',
        difficultyLevel: 3.8,
        difficultyEnergySystem: 'endurance',
        capabilityFit: 'productive',
        description: 'Ruhige Ausdauer mit sauberem Fueling.',
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
      nextWorkout: null,
    },
    dailyDelta: [{
      date: '2026-05-01',
      status: 'matched',
      title: 'Plan und Ausführung passen zusammen',
      summary: 'Die echte Belastung lag +7 TSS zum Plan.',
      score: 88,
      loadDeltaTss: 7,
      recoveryDelta: null,
      nextPlanEffect: 'Plan kann diesen Reiz als erledigt behandeln und die nächste Empfehlung darauf aufbauen.',
      evidence: ['Geplant: Rad Z2 75 min', 'Garmin: Rad 77 min'],
      targetPath: '/plan/activity/activity-1',
    }],
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();

  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText(/Warum diese Aktion/i);
  await expect(contract).toContainText('Koerper');
  await expect(contract).toContainText('Readiness 78/100');
  await expect(contract).toContainText('Belastung');
  await expect(contract).toContainText('TSB -5.7');
  await expect(contract).toContainText('Zielwirkung');
  await expect(contract).toContainText('produktiver Trainingsreiz');
  await expect(contract).toContainText('Garmin');
  await expect(contract).toContainText('Pulse plant lokal');
  await expect(contract).toContainText('Seit letzter Entscheidung');
  await expect(contract).toContainText('Plan und Ausführung passen zusammen');
  await expect(contract).toContainText('Plan kann diesen Reiz als erledigt behandeln');
  await expect(contract).toContainText('Sicherste Option');
  await expect(contract).toContainText('Einheit locker halten');
});

test('Home daily decision details expose fueling debt as a top decision signal', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      todayWorkout: {
        id: 'planned-vo2',
        userId: 'user-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 4,
        durationMin: 60,
        distanceKm: null,
        targetTss: 82,
        archetypeId: 'threshold_over_under',
        difficultyLevel: 4.2,
        difficultyEnergySystem: 'threshold',
        capabilityFit: 'stretch',
        description: 'Harter Reiz nur mit sauberem Magen.',
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
      nextWorkout: null,
    },
    todayOptions: {
      todayOptions: {
        date: '2026-05-01',
        state: 'recovery_protect',
        summary: 'Fueling-Schutz ist heute wichtiger als Intensität.',
        signature: 'home-fueling-protect',
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
          evidence: ['Fueling: GI-Schutz offen'],
          signalLabels: [{
            kind: 'fueling_protect',
            label: 'Fueling schützen',
            detail: 'Magenhinweis begrenzt Intensität',
            tone: 'amber',
          }],
        }],
      },
    },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();

  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Fueling');
  await expect(contract).toContainText('GI-Schutz offen');
  await expect(contract).toContainText('75-120 min locker');
  await expect(contract).toContainText('Magenhinweis begrenzt Intensität');
});

test('Home daily decision details expose goal pressure as a top decision signal', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      todayWorkout: {
        id: 'planned-threshold',
        userId: 'user-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 3,
        durationMin: 70,
        distanceKm: null,
        targetTss: 74,
        archetypeId: 'tempo_sweet_spot',
        difficultyLevel: 4.0,
        difficultyEnergySystem: 'threshold',
        capabilityFit: 'productive',
        description: 'Kontrollierter Zielreiz.',
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
        executionStatus: 'garmin_scheduled',
        executionMatchedAt: null,
        executionMatchConfidence: null,
        executionNotes: null,
      },
      nextWorkout: null,
    },
    goalProjection: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      horizonDays: 180,
      headline: 'Top-Ziel braucht Aufmerksamkeit: 70.3 Kraichgau.',
      projections: [{
        goalId: 'race-1',
        title: '70.3 Kraichgau',
        category: 'race',
        targetDate: '2026-07-11',
        daysUntil: 71,
        probabilityPct: 64,
        status: 'watch',
        confidence: 'medium',
        summary: '70.3 Kraichgau: beobachten bei ca. 64% mit mittel-Konfidenz.',
        limiterRisk: {
          status: 'watch',
          label: 'Long Endurance + Fueling',
          summary: 'lange Ausdauer kontrolliert aufbauen und Fueling-Vertraeglichkeit absichern',
          evidence: ['Long-Endurance-Level 3.1', 'Fueling-Vertraeglichkeit lernt'],
        },
        nextBestIntervention: {
          kind: 'fueling_practice',
          title: 'Fueling-Praxis absichern',
          summary: 'Die naechste lange Einheit sollte kontrolliert Fueling und GI-Vertraeglichkeit schliessen.',
          actionLabel: 'Plan pruefen',
          targetPath: '/plan?tab=training',
          evidence: ['Long-Endurance-Level 3.1', '1 kontrollierter During-Log'],
        },
        evidence: ['Ziel in 71 Tagen'],
        missingEvidence: [],
      }],
      missingEvidence: [],
    },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();

  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Ziel');
  await expect(contract).toContainText('70.3 Kraichgau');
  await expect(contract).toContainText('64%');
  await expect(contract).toContainText('Fueling-Praxis absichern');
});

test('Home daily decision details expose saved mental boundary as a top decision signal', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      todayWorkout: {
        id: 'planned-easy',
        userId: 'user-1',
        plannedDate: '2026-05-01',
        activityType: 'run',
        zone: 2,
        durationMin: 45,
        distanceKm: null,
        targetTss: 38,
        archetypeId: 'endurance_easy',
        difficultyLevel: 2.8,
        difficultyEnergySystem: 'endurance',
        capabilityFit: 'productive',
        description: 'Ruhiger Lauf mit klarer Grenze.',
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
      nextWorkout: null,
    },
    checkinToday: { checkin: { id: 'mental-protect', date: '2026-05-01' } },
    checkinHistory: {
      checkins: [{
        id: 'mental-protect',
        userId: 'user-1',
        date: '2026-05-01',
        mood: 4,
        energy: 3,
        stress: 8,
        motivation: 4,
        notes: 'Alltag zieht heute stark.',
        themes: ['Arbeit'],
        source: 'manual',
        coachQuestions: null,
        createdAt: '2026-05-01T07:30:00.000Z',
      }],
    },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();

  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Mental');
  await expect(contract).toContainText('Schutzmodus');
  await expect(contract).toContainText('Heute kleinere Schritte, klare Grenze und kein Zusatzdruck.');
});

test('Home daily decision details expose stale Garmin data confidence as a top decision signal', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      dataStatus: {
        userReady: true,
        profileReady: true,
        garmin: {
          status: 'stale',
          lastMetricDate: '2026-04-30',
          lastMetricSyncAt: '2026-04-30T05:00:00.000Z',
          lastActivityAt: '2026-05-01T06:00:00.000Z',
          metricsDays14: 10,
          activitiesDays14: 5,
          issues: ['today_metrics_missing'],
        },
      },
      todayWorkout: {
        id: 'planned-stale-data',
        userId: 'user-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 60,
        distanceKm: null,
        targetTss: 48,
        archetypeId: 'endurance_steady',
        difficultyLevel: 3.2,
        difficultyEnergySystem: 'endurance',
        capabilityFit: 'productive',
        description: 'Ruhige Ausdauer, wenn die Signale stimmen.',
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
      nextWorkout: null,
    },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();

  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Daten');
  await expect(contract).toContainText('Garmin alt');
  await expect(contract).toContainText('Letzte Tagesdaten: 2026-04-30');
  await expect(contract).toContainText('Heute fehlen frische Signale.');
});

test('Home daily decision details keep combined data fueling mental goal and training signals visible', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      dataStatus: {
        userReady: true,
        profileReady: true,
        garmin: {
          status: 'stale',
          lastMetricDate: '2026-04-30',
          lastMetricSyncAt: '2026-04-30T05:00:00.000Z',
          lastActivityAt: '2026-05-01T06:00:00.000Z',
          metricsDays14: 10,
          activitiesDays14: 5,
          issues: ['today_metrics_missing'],
        },
      },
      todayWorkout: {
        id: 'planned-saturated-signals',
        userId: 'user-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 60,
        distanceKm: null,
        targetTss: 48,
        archetypeId: 'endurance_steady',
        difficultyLevel: 3.2,
        difficultyEnergySystem: 'endurance',
        capabilityFit: 'productive',
        description: 'Ruhige Ausdauer mit sauberem Fueling.',
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
      nextWorkout: null,
    },
    todayOptions: {
      todayOptions: {
        date: '2026-05-01',
        state: 'recovery_protect',
        summary: 'Fueling-Schutz ist heute wichtiger als Intensität.',
        signature: 'home-saturated-signals',
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
          evidence: ['Fueling: GI-Schutz offen'],
          signalLabels: [{
            kind: 'fueling_protect',
            label: 'Fueling schützen',
            detail: 'Magenhinweis begrenzt Intensität',
            tone: 'amber',
          }],
        }],
      },
    },
    checkinToday: { checkin: { id: 'mental-protect', date: '2026-05-01' } },
    checkinHistory: {
      checkins: [{
        id: 'mental-protect',
        userId: 'user-1',
        date: '2026-05-01',
        mood: 4,
        energy: 3,
        stress: 8,
        motivation: 4,
        notes: 'Alltag zieht heute stark.',
        themes: ['Arbeit'],
        source: 'manual',
        coachQuestions: null,
        createdAt: '2026-05-01T07:30:00.000Z',
      }],
    },
    goalProjection: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      horizonDays: 180,
      headline: 'Top-Ziel braucht Aufmerksamkeit: 70.3 Kraichgau.',
      projections: [{
        goalId: 'race-1',
        title: '70.3 Kraichgau',
        category: 'race',
        targetDate: '2026-07-11',
        daysUntil: 71,
        probabilityPct: 64,
        status: 'watch',
        confidence: 'medium',
        summary: '70.3 Kraichgau: beobachten bei ca. 64% mit mittel-Konfidenz.',
        limiterRisk: {
          status: 'watch',
          label: 'Long Endurance + Fueling',
          summary: 'lange Ausdauer kontrolliert aufbauen und Fueling-Vertraeglichkeit absichern',
          evidence: ['Long-Endurance-Level 3.1', 'Fueling-Vertraeglichkeit lernt'],
        },
        nextBestIntervention: {
          kind: 'fueling_practice',
          title: 'Fueling-Praxis absichern',
          summary: 'Die naechste lange Einheit sollte kontrolliert Fueling und GI-Vertraeglichkeit schliessen.',
          actionLabel: 'Plan pruefen',
          targetPath: '/plan?tab=training',
          evidence: ['Long-Endurance-Level 3.1', '1 kontrollierter During-Log'],
        },
        evidence: ['Ziel in 71 Tagen'],
        missingEvidence: [],
      }],
      missingEvidence: [],
    },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  const leadingFactor = decision.getByTestId('daily-decision-leading-factor');
  await expect(leadingFactor).toContainText(/Heute entscheidet/i);
  await expect(leadingFactor).toContainText('Mental: Schutzmodus: Heute kleinere Schritte, klare Grenze und kein Zusatzdruck.');
  const safestOption = decision.getByTestId('daily-decision-safest-option');
  await expect(safestOption).toContainText(/Sicherste Option/i);
  await expect(safestOption).toContainText('Fueling-Schutz zuerst schließen');
  await expect(safestOption).toContainText('75-120 min locker');

  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();

  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Heute entscheidet');
  await expect(contract).toContainText('Mental: Schutzmodus: Heute kleinere Schritte, klare Grenze und kein Zusatzdruck.');
  await expect(contract).toContainText('Daten');
  await expect(contract).toContainText('Fueling');
  await expect(contract).toContainText('Mental');
  await expect(contract).toContainText('Schutzmodus');
  await expect(contract).toContainText('Ziel');
  await expect(contract).toContainText('70.3 Kraichgau');
  await expect(contract).toContainText('Training');
  await expect(contract).toContainText('Radfahren Z2 · 60 min');

  const contractText = await contract.textContent();
  expect(contractText).toBeTruthy();
  const signalIndex = (label: string) => {
    const index = contractText!.indexOf(label);
    expect(index, `${label} should be visible in the decision contract`).toBeGreaterThanOrEqual(0);
    return index;
  };

  const mentalIndex = signalIndex('Mental');
  const dataIndex = signalIndex('Daten');
  const fuelingIndex = signalIndex('Fueling');
  const goalIndex = signalIndex('70.3 Kraichgau');
  const trainingIndex = signalIndex('Training');
  const bodyIndex = signalIndex('Koerper');
  const loadIndex = signalIndex('Belastung');

  expect(mentalIndex).toBeLessThan(dataIndex);
  expect(dataIndex).toBeLessThan(fuelingIndex);
  expect(fuelingIndex).toBeLessThan(goalIndex);
  expect(goalIndex).toBeLessThan(trainingIndex);
  expect(trainingIndex).toBeLessThan(bodyIndex);
  expect(bodyIndex).toBeLessThan(loadIndex);
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
  await expect(decision).toContainText('Kurz Stimmung, Energie, Stress und Motivation eintragen');
  await expect(decision).not.toContainText(/Nach dem Klick/i);
  await expect(decision).not.toContainText('Nach dem Speichern nutzen Home, Plan und Coach dasselbe mentale Tagessignal.');
  await expect(decision.getByText('Readiness 78/100')).not.toBeVisible();
  const checkinAction = decision.getByRole('button', { name: /Check-in öffnen/i });
  await expect(checkinAction).toBeVisible();
  await expect(decision.getByRole('button', { name: /Coach fragen/i })).toHaveCount(0);

  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();
  await expect(decision).toContainText(/Nach dem Klick/i);
  await expect(decision).toContainText('Nach dem Speichern nutzen Home, Plan und Coach dasselbe mentale Tagessignal.');
  await expect(page.getByTestId('daily-decision-contract')).toContainText('Garmin: kein Schreibpfad fuer heute');
  await expect(decision.getByRole('button', { name: 'Readiness 78/100', exact: true })).toBeVisible();
  await expect(decision.getByRole('button', { name: /Coach fragen/i })).toHaveCount(1);

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
