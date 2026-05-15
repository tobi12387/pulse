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
  const continuity = decision.getByTestId('daily-decision-continuity');
  await expect(continuity).toContainText(/Seit letzter Entscheidung/i);
  await expect(continuity).toContainText('Bleibt gültig: Plan und Ausführung passen zusammen');
  await expect(continuity).toContainText('Plan kann diesen Reiz als erledigt behandeln');

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

test('Home daily decision uses stale decision quality as a leading learning signal', async ({ page }) => {
  await mockPulseApi(page, {
    decisionQuality: {
      range: { from: '2026-04-18', to: '2026-05-01', days: 14 },
      qualityScore: 42,
      status: 'stale',
      statusLabel: 'Wiederholung prüfen',
      repeatedThemes: [{
        theme: 'Mobilität 10 Minuten',
        count: 3,
        lastSeen: '2026-05-01',
        status: 'stale',
        evidence: ['3x wiederholt ohne Abschluss-/Outcome-Evidenz'],
      }],
      bestEvidence: ['Mobilität 10 Minuten: 3x wiederholt ohne Abschluss-/Outcome-Evidenz'],
      evidence: [],
      suggestedAdjustment: 'Wiederkehrende Empfehlung kleiner, anders getaktet oder vorerst unterdrückt anbieten.',
    },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  const leading = decision.getByTestId('daily-decision-leading-factor');
  await expect(leading).toContainText('Lernen');
  await expect(leading).toContainText('Wiederholung prüfen');
  await expect(leading).toContainText('Wiederkehrende Empfehlung kleiner');

  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();
  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Lernen');
  await expect(contract).toContainText('Mobilität 10 Minuten');
});

test('Home daily decision uses recovery pressure as a leading body signal', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      recovery: {
        sleepDebt7d: {
          hours: 5.8,
          targetH: 7.5,
          baselineSource: 'garmin_sleep_need',
          status: 'severe',
        },
        hrvDeviation7d: {
          pct: -9.4,
          recentMs: 42,
          baselineMs: 51,
          status: 'declining',
        },
        rhrDrift7d: {
          bpmAboveBaseline: 6,
          recent: 55,
          baseline: 49,
          status: 'elevated',
        },
        recoveryScore: 38,
        recommendation: 'Heute Belastung klein halten und Schlafdruck abbauen.',
      },
    },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  const leading = decision.getByTestId('daily-decision-leading-factor');
  await expect(leading).toContainText('Recovery');
  await expect(leading).toContainText('Schlafdefizit schwer: 5.8 h offen');
  await expect(leading).toContainText('Heute Belastung klein halten');
  await expect(decision.getByRole('button', { name: /Recovery ansehen/i })).toBeVisible();

  const safestOption = decision.getByTestId('daily-decision-safest-option');
  await expect(safestOption).toContainText('Recovery schützen');
  await expect(safestOption).toContainText('Schlafdefizit schwer');
  await expect(safestOption).toContainText('keine harte Intensität');

  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();
  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Recovery');
  await expect(contract).toContainText('HRV -9.4%');
  await expect(contract).toContainText('RHR +6 bpm');
});

test('Home daily decision uses open plan adaptation as a leading signal', async ({ page }) => {
  await mockPulseApi(page, {
    adaptationEvents: {
      events: [{
        id: 'adapt-sync-debt',
        userId: 'user-1',
        eventDate: '2026-05-01',
        kind: 'sync_debt',
        sourceId: 'planned-sync-debt',
        severity: 'action',
        recommendation: 'sync_garmin',
        summary: 'Garmin-Sync-Schulden muessen vor Ausfuehrung geschlossen werden.',
        evidence: ['1 offene Einheit'],
        resolvedAt: null,
        createdAt: '2026-05-01T07:50:00.000Z',
      }],
    },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  const leading = decision.getByTestId('daily-decision-leading-factor');
  await expect(leading).toContainText('Anpassung');
  await expect(leading).toContainText('Garmin-Sync-Schulden');
  const primaryCta = decision.getByRole('button', { name: 'Garmin prüfen', exact: true });
  await expect(primaryCta).toBeVisible();

  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();
  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Anpassung');
  await expect(contract).toContainText('1 offene Einheit');
  await expect(contract).toContainText('Garmin prüfen');

  await primaryCta.click();
  await expect(page).toHaveURL(/\/settings\?section=garmin/);
});

test('Home daily decision uses Garmin execution gaps as a leading signal for planned workouts', async ({ page }) => {
  const plannedWorkout = {
    id: 'planned-garmin-gap',
    userId: 'user-1',
    plannedDate: '2026-05-01',
    activityType: 'bike',
    zone: 2,
    durationMin: 60,
    distanceKm: null,
    targetTss: 48,
    archetypeId: 'endurance_steady',
    difficultyLevel: 2.8,
    difficultyEnergySystem: 'endurance',
    capabilityFit: 'productive',
    description: 'Ruhige Grundlage, aber noch nicht auf Garmin vorbereitet.',
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
    executionNotes: 'Workout ist nur lokal in Pulse geplant.',
  };
  await mockPulseApi(page, {
    home: {
      todayWorkout: plannedWorkout,
      nextWorkout: null,
    },
    planWorkouts: [plannedWorkout],
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Keine Zielprojektion im Test.',
      projections: [],
    },
    powerDuration: {
      bestEfforts: [],
      durability: null,
      bestEffortLine: 'Best Efforts offen',
      durabilityLine: 'Durability noch nicht belastbar',
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
    garminExecutionDiff: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      window: { from: '2026-05-01', to: '2026-05-15', days: 15 },
      rows: [{
        workoutId: 'planned-garmin-gap',
        plannedDate: '2026-05-01',
        title: 'Rad · Z2 · 60 min',
        status: 'missing_template',
        summary: 'In Pulse geplant, aber es gibt noch keine Garmin-Workout-Vorlage.',
        local: { garminWorkoutId: null, garminScheduledId: null },
        remote: { workoutId: null, scheduledId: null, lastSeenAt: null },
        repairActions: ['upload_template'],
      }],
    },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  const leading = decision.getByTestId('daily-decision-leading-factor');
  await expect(leading).toContainText('Garmin');
  await expect(leading).toContainText('Nur lokal geplant');
  const primaryCta = decision.getByRole('button', { name: 'Garmin prüfen', exact: true });
  await expect(primaryCta).toBeVisible();

  const safestOption = decision.getByTestId('daily-decision-safest-option');
  await expect(safestOption).toContainText('Garmin zuerst schließen');
  await expect(safestOption).toContainText('noch keine Garmin-Vorlage oder Kalenderprüfung');
  await expect(safestOption).toContainText('vor Ausführung');

  await primaryCta.click();
  await expect(page).toHaveURL(/\/plan\?tab=execution&source=daily-garmin&workoutId=planned-garmin-gap/);
  await expect(page.getByTestId('garmin-execution-trust-panel')).toContainText('Geräte-Check abschließen');
  await expect(page.getByTestId('garmin-execution-trust-panel')).toContainText('In Pulse geplant');
});

test('Home daily decision uses personal response patterns as a leading signal for planned workouts', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      todayWorkout: {
        id: 'planned-response-pattern',
        userId: 'user-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 55,
        distanceKm: null,
        targetTss: 44,
        archetypeId: 'endurance_steady',
        difficultyLevel: 2.5,
        difficultyEnergySystem: 'endurance',
        capabilityFit: 'productive',
        description: 'Ruhige Grundlage mit mentaler Boundary.',
        steps: null,
        garminWorkoutId: 'gw-response',
        garminScheduledId: 'sched-response',
        garminSyncContract: {
          version: 1,
          status: 'ready',
          payloadReady: true,
          checkedAt: '2026-05-01T07:00:00.000Z',
          summary: 'Garmin bereit.',
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
      nextWorkout: null,
    },
    personalResponse: {
      summary: {
        generatedAt: '2026-05-01T00:00:00.000Z',
        range: { from: '2026-03-20', to: '2026-05-01', days: 42 },
        strength: 'useful',
        headline: 'Mentale Belastung veraendert deine Trainingsantwort sichtbar.',
        signals: [{
          kind: 'mental_response',
          label: 'Mentale Last begrenzt Ausführung',
          strength: 'useful',
          summary: 'Niedrige Energie oder hoher Stress kippen geplante Einheiten haeufig in kleinere Ausfuehrung.',
          evidence: ['5 Check-ins mit Energie <=4 oder Stress >=7', '3 bestaetigte kleinere Ausfuehrungen'],
          nextAdjustment: 'Heute zuerst Boundary setzen und die Einheit bewusst klein halten.',
        }],
        missingEvidence: [],
      },
    },
    goalProjection: {
      generatedAt: '2026-05-01T00:00:00.000Z',
      horizonDays: 180,
      headline: 'Keine Zielprojektion im Test.',
      projections: [],
      missingEvidence: [],
    },
    powerDuration: {
      bestEfforts: [],
      durability: null,
      bestEffortLine: 'Best Efforts offen',
      durabilityLine: 'Durability noch nicht belastbar',
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  const leading = decision.getByTestId('daily-decision-leading-factor');
  await expect(leading).toContainText('Reaktion');
  await expect(leading).toContainText('Mentale Last begrenzt Ausführung');
  await expect(leading).toContainText('Heute zuerst Boundary setzen');
  const primaryCta = decision.getByRole('button', { name: 'Reaktion prüfen', exact: true });
  await expect(primaryCta).toBeVisible();

  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();
  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Reaktion');
  await expect(contract).toContainText('5 Check-ins mit Energie <=4');

  await primaryCta.click();
  await expect(page).toHaveURL('/data?tab=analysis#data-personal-response');
  await expect(page.getByTestId('data-personal-response-card')).toContainText('Mentale Last begrenzt Ausführung');
});

test('Home daily decision uses durability analysis as a leading signal for a planned workout', async ({ page }) => {
  await mockPulseApi(page, {
    home: {
      todayWorkout: {
        id: 'planned-durability-limiter',
        userId: 'user-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 90,
        distanceKm: null,
        targetTss: 78,
        archetypeId: 'long_endurance_durability',
        difficultyLevel: 4.1,
        difficultyEnergySystem: 'long_endurance',
        capabilityFit: 'productive',
        description: 'Lange Ausdauer mit Durability-Fokus.',
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
    powerDuration: {
      bestEfforts: [{
        durationSec: 1200,
        avgPowerW: 215,
        startSec: 3600,
        activityId: 'activity-power-duration',
        activityDate: '2026-05-01',
        source: 'lap_approximation',
        qualityStatus: 'usable_with_caution',
      }],
      durability: {
        rating: 'limited',
        powerDropPct: -21,
        hrDriftBpm: 3,
        evidence: ['Power -21%', 'HR +3 bpm', '240 min'],
        activityId: 'activity-power-duration',
        activityDate: '2026-05-01',
        qualitySource: 'lap_approximation',
        qualityStatus: 'usable_with_caution',
      },
      bestEffortLine: '20 min 215 W (Lap-Approximation)',
      durabilityLine: 'Durability limited: Power -21% · HR +3 bpm · 240 min (Lap-Approximation)',
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  const leading = decision.getByTestId('daily-decision-leading-factor');
  await expect(leading).toContainText('Analyse');
  await expect(leading).toContainText('Durability limited');
  await expect(leading).toContainText('Power -21%');
  await expect(leading).toContainText('Nächste Handlung: Durability-Limiter prüfen');
  await expect(leading).toContainText('bevor du Ausführung oder Anpassung bestätigst');
  const primaryCta = decision.getByRole('button', { name: 'Analyse prüfen', exact: true });
  await expect(primaryCta).toBeVisible();

  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();
  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Analyse');
  await expect(contract).toContainText('HR +3 bpm');
  await expect(contract).toContainText('240 min');

  await primaryCta.click();
  await expect(page).toHaveURL('/data?tab=analysis#data-plan-trace');
});

test('Home daily decision uses fueling learning readiness as a leading signal for long workout practice', async ({ page }) => {
  const outcomeBaseline = {
    status: 'insufficient_data',
    label: 'Fueling-Baseline offen',
    summary: 'Noch kein langer Fueling-Log mit Dauer, Carbs und Verträglichkeit als Baseline.',
    latestLogDate: null,
    observedCarbsPerHour: null,
    targetCarbsPerHour: { min: 50, max: 70 },
    bottles750Ml: null,
    powderG: null,
    fluidMlPerHour: null,
    sodiumMgPerHour: null,
    hydrationEvidenceGaps: [
      'Sodium nicht strukturiert geloggt.',
      'Hitze und Schweißrate nicht gemessen.',
    ],
    evidence: ['Lange Einheiten nachtraeglich mit Carbs, Flaschen, Pulver und GI-Komfort loggen.'],
    learningReadiness: {
      comparableCompleteLogs: 0,
      requiredComparableCompleteLogs: 3,
      readyForTrendSummary: false,
      missingEvidence: ['Noch drei vergleichbare During-Logs mit Dauer, Carbs und GI-Komfort fehlen.'],
    },
  };
  const fuelingDebt = {
    status: 'resolved',
    hasOpenDebt: false,
    label: 'Fueling frei',
    summary: 'Kein offener GI-/Fueling-Blocker.',
    closureCondition: 'Weiterhin lange oder harte Einheiten mit Fueling-Log schließen.',
    evidence: ['Stand heute: kein offener GI-Hinweis'],
    openIssueDate: null,
    controlledWorkoutId: null,
    followUpActivityId: null,
    updatedAt: '2026-05-01T08:00:00.000Z',
  };
  const plannedWorkout = {
    id: 'planned-fueling-learning',
    userId: 'user-1',
    plannedDate: '2026-05-01',
    activityType: 'bike',
    zone: 2,
    durationMin: 150,
    distanceKm: null,
    targetTss: 108,
    archetypeId: 'long_endurance_fueling_practice',
    difficultyLevel: 4.4,
    difficultyEnergySystem: 'long_endurance',
    capabilityFit: 'productive',
    description: 'Langer Z2-Reiz mit bewusst frühem, gleichmäßigem Fueling als Lernziel.',
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
  };
  await mockPulseApi(page, {
    home: {
      todayWorkout: plannedWorkout,
      nextWorkout: null,
    },
    planWorkouts: [plannedWorkout],
    goalProjection: {
      generatedAt: '2026-05-01T06:00:00.000Z',
      horizonDays: 180,
      headline: 'Keine Zielprojektion fuer diesen Test.',
      projections: [],
      missingEvidence: [],
    },
    powerDuration: {
      bestEfforts: [],
      durability: null,
      bestEffortLine: 'Best Efforts offen',
      durabilityLine: 'Durability noch nicht belastbar',
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
    fuelingDebt,
    outcomeBaseline,
    fuelingGuidance: (workoutId) => ({
      shouldShow: workoutId === 'planned-fueling-learning',
      preferenceStatus: 'ready',
      fuelingDebt,
      outcomeBaseline,
      before: [],
      during: [{ id: 'during-carbs', text: '50-70 g/h kontrolliert testen und danach GI-Komfort loggen.' }],
      after: [],
      recoveryCautions: [],
      evidence: [],
    }),
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  const leading = decision.getByTestId('daily-decision-leading-factor');
  await expect(leading).toContainText('Fueling-Lernen');
  await expect(leading).toContainText('Trend-Evidenz 0/3');
  await expect(leading).toContainText('Noch drei vergleichbare During-Logs');
  await expect(leading).toContainText('Nächster Lernlog: 50-70 g/h kontrolliert testen');
  await expect(leading).toContainText('Dauer, Carbs und GI-Komfort zusammen erfassen');
  await expect(leading).toContainText('Kontextlücken');
  await expect(leading).toContainText('Sodium nicht strukturiert geloggt');
  await expect(leading).toContainText('Hitze und Schweißrate nicht gemessen');
  await expect(leading).toContainText('Sodium, Hitze und Schweißrate nur notieren, wenn du sie wirklich gemessen hast');
  const safestOption = decision.getByTestId('daily-decision-safest-option');
  await expect(safestOption).toContainText('Fueling-Lernlog vollständig erfassen');
  await expect(safestOption).toContainText('50-70 g/h kontrolliert testen');
  await expect(safestOption).toContainText('Kontextlücken');
  await expect(safestOption).toContainText('Sodium nicht strukturiert geloggt');
  await expect(safestOption).toContainText('Hitze und Schweißrate nicht gemessen');
  await expect(safestOption).toContainText('Sodium, Hitze und Schweißrate nur notieren, wenn du sie wirklich gemessen hast');
  await expect(safestOption).toContainText('locker kürzen statt Ziel-Carbs erzwingen');
  const primaryCta = decision.getByRole('button', { name: 'Fueling vorbereiten', exact: true });
  await expect(primaryCta).toBeVisible();

  await primaryCta.click();
  await expect(page).toHaveURL(/\/plan\?tab=training&source=fueling-learning&workoutId=planned-fueling-learning#workout-fueling-baseline/);
  await expect(page.getByTestId('workout-fueling-baseline')).toContainText('Fueling-Baseline offen');
  await expect(page.getByTestId('workout-fueling-baseline')).toContainText('Trend-Evidenz: 0/3');
  await expect(page.getByTestId('workout-fueling-baseline')).toContainText('Kontextlücken');
  await expect(page.getByTestId('workout-fueling-baseline')).toContainText('Sodium nicht strukturiert geloggt');
  await expect(page.getByTestId('workout-fueling-baseline')).toContainText('Hitze und Schweißrate nicht gemessen');
  await expect(page.getByTestId('workout-fueling-baseline')).toContainText('Sodium, Hitze und Schweißrate nur notieren, wenn du sie wirklich gemessen hast');
});

test('Home daily decision names measured hydration context for fueling learning', async ({ page }) => {
  const outcomeBaseline = {
    status: 'insufficient_data',
    label: 'Fueling-Baseline offen',
    summary: 'Noch kein langer Fueling-Log mit Dauer, Carbs und Verträglichkeit als Baseline.',
    latestLogDate: null,
    observedCarbsPerHour: null,
    targetCarbsPerHour: { min: 50, max: 70 },
    bottles750Ml: null,
    powderG: null,
    fluidMlPerHour: null,
    sodiumMgPerHour: null,
    hydrationContextSummary: 'Hydration-Kontext gemessen: Sodium ca. 325 mg/h, 28°C, Schweißrate 0.9 l/h',
    hydrationEvidenceGaps: [],
    evidence: ['Hydration-Kontext gemessen: Sodium ca. 325 mg/h, 28°C, Schweißrate 0.9 l/h'],
    learningReadiness: {
      comparableCompleteLogs: 1,
      requiredComparableCompleteLogs: 3,
      readyForTrendSummary: false,
      missingEvidence: ['Noch zwei vergleichbare During-Logs mit Dauer, Carbs und GI-Komfort fehlen.'],
    },
  };
  const fuelingDebt = {
    status: 'resolved',
    hasOpenDebt: false,
    label: 'Fueling frei',
    summary: 'Kein offener GI-/Fueling-Blocker.',
    closureCondition: 'Weiterhin lange oder harte Einheiten mit Fueling-Log schließen.',
    evidence: ['Stand heute: kein offener GI-Hinweis'],
    openIssueDate: null,
    controlledWorkoutId: null,
    followUpActivityId: null,
    updatedAt: '2026-05-01T08:00:00.000Z',
  };
  const plannedWorkout = {
    id: 'planned-measured-hydration',
    userId: 'user-1',
    plannedDate: '2026-05-01',
    activityType: 'bike',
    zone: 2,
    durationMin: 150,
    distanceKm: null,
    targetTss: 108,
    archetypeId: 'long_endurance_fueling_practice',
    difficultyLevel: 4.4,
    difficultyEnergySystem: 'long_endurance',
    capabilityFit: 'productive',
    description: 'Langer Z2-Reiz mit bewusst frühem, gleichmäßigem Fueling als Lernziel.',
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
  };
  await mockPulseApi(page, {
    home: {
      todayWorkout: plannedWorkout,
      nextWorkout: null,
    },
    planWorkouts: [plannedWorkout],
    goalProjection: {
      generatedAt: '2026-05-01T06:00:00.000Z',
      horizonDays: 180,
      headline: 'Keine Zielprojektion fuer diesen Test.',
      projections: [],
      missingEvidence: [],
    },
    powerDuration: {
      bestEfforts: [],
      durability: null,
      bestEffortLine: 'Best Efforts offen',
      durabilityLine: 'Durability noch nicht belastbar',
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
    fuelingDebt,
    outcomeBaseline,
    fuelingGuidance: (workoutId) => ({
      shouldShow: workoutId === 'planned-measured-hydration',
      preferenceStatus: 'ready',
      fuelingDebt,
      outcomeBaseline,
      before: [],
      during: [{ id: 'during-carbs', text: '50-70 g/h kontrolliert testen und danach GI-Komfort loggen.' }],
      after: [],
      recoveryCautions: [],
      evidence: [],
    }),
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Hydration-Kontext gemessen');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Sodium ca. 325 mg/h');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('28°C');
  await expect(decision.getByTestId('daily-decision-leading-factor')).toContainText('Schweißrate 0.9 l/h');
  await expect(decision.getByTestId('daily-decision-safest-option')).toContainText('Hydration-Kontext gemessen');
  await expect(decision.getByTestId('daily-decision-safest-option')).not.toContainText('Kontextlücken');

  await decision.getByRole('button', { name: 'Fueling vorbereiten', exact: true }).click();
  await expect(page.getByTestId('workout-fueling-baseline')).toContainText('Hydration-Kontext gemessen');
  await expect(page.getByTestId('workout-fueling-baseline')).not.toContainText('Kontextlücken');
});

test('Home daily decision uses complete fueling trends as a leading signal for long workout practice', async ({ page }) => {
  const outcomeBaseline = {
    status: 'stable',
    label: 'Fueling-Baseline vertraeglich',
    summary: 'Letzter vertraeglicher Log: 58 g/h; naechste kleine Stufe 60-75 g/h.',
    latestLogDate: '2026-05-13',
    observedCarbsPerHour: 58,
    targetCarbsPerHour: { min: 60, max: 75 },
    bottles750Ml: 3,
    powderG: 220,
    fluidMlPerHour: 690,
    sodiumMgPerHour: 380,
    trendSummary: 'Fueling-Trend: 3/3 komplette During-Logs, Schnitt 50 g/h; 2x Magen ok, 1x unruhig.',
    hydrationEvidenceGaps: [],
    evidence: ['Fueling-Trend: 3/3 komplette During-Logs, Schnitt 50 g/h; 2x Magen ok, 1x unruhig.'],
    learningReadiness: {
      comparableCompleteLogs: 3,
      requiredComparableCompleteLogs: 3,
      readyForTrendSummary: true,
      missingEvidence: [],
    },
  };
  const fuelingDebt = {
    status: 'resolved',
    hasOpenDebt: false,
    label: 'Fueling frei',
    summary: 'Kein offener GI-/Fueling-Blocker.',
    closureCondition: 'Weiterhin lange oder harte Einheiten mit Fueling-Log schließen.',
    evidence: [],
    openIssueDate: null,
    controlledWorkoutId: null,
    followUpActivityId: null,
    updatedAt: '2026-05-01T08:00:00.000Z',
  };
  const plannedWorkout = {
    id: 'planned-fueling-trend',
    userId: 'user-1',
    plannedDate: '2026-05-01',
    activityType: 'bike',
    zone: 2,
    durationMin: 150,
    distanceKm: null,
    targetTss: 108,
    archetypeId: 'long_endurance_fueling_practice',
    difficultyLevel: 4.4,
    difficultyEnergySystem: 'long_endurance',
    capabilityFit: 'productive',
    description: 'Langer Z2-Reiz mit stabiler Fueling-Baseline.',
    steps: null,
    garminWorkoutId: 'gw-fueling-trend',
    garminScheduledId: 'sched-fueling-trend',
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
    home: {
      todayWorkout: plannedWorkout,
      nextWorkout: null,
    },
    planWorkouts: [plannedWorkout],
    goalProjection: {
      generatedAt: '2026-05-01T06:00:00.000Z',
      horizonDays: 180,
      headline: 'Keine Zielprojektion fuer diesen Test.',
      projections: [],
      missingEvidence: [],
    },
    powerDuration: {
      bestEfforts: [],
      durability: null,
      bestEffortLine: 'Best Efforts offen',
      durabilityLine: 'Durability noch nicht belastbar',
      updatedAt: '2026-05-01T06:00:00.000Z',
    },
    outcomeBaseline,
    fuelingDebt,
    personalResponse: {
      summary: {
        generatedAt: '2026-05-01T06:00:00.000Z',
        range: { from: '2026-03-20', to: '2026-05-01', days: 42 },
        strength: 'insufficient',
        headline: 'Keine Response-Muster fuer diesen Test.',
        signals: [],
        missingEvidence: [],
      },
    },
    fuelingGuidance: (workoutId) => ({
      shouldShow: workoutId === 'planned-fueling-trend',
      preferenceStatus: 'ready',
      fuelingDebt,
      outcomeBaseline,
      before: [],
      during: [{ id: 'carbs', text: '60-75 g/h als Ausgangspunkt nutzen und nur klein veraendern.' }],
      after: [],
      recoveryCautions: [],
      evidence: [],
    }),
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  const leading = decision.getByTestId('daily-decision-leading-factor');
  await expect(leading).toContainText('Fueling-Lernen');
  await expect(leading).toContainText('Fueling-Trend');
  await expect(leading).toContainText('Schnitt 50 g/h');
  await expect(leading).toContainText('2x Magen ok');
  await expect(leading).not.toContainText('Nächster Lernlog');

  await decision.getByRole('button', { name: 'Fueling vorbereiten', exact: true }).click();
  await expect(page.getByTestId('workout-fueling-baseline')).toContainText('Fueling-Trend');
  await expect(page.getByTestId('workout-fueling-baseline')).not.toContainText('Nächster Lernlog');
});

test('Home daily decision closes completed long workouts with fueling evidence capture', async ({ page }) => {
  const outcomeBaseline = {
    status: 'insufficient_data',
    label: 'Fueling-Baseline offen',
    summary: 'Noch kein langer Fueling-Log mit Dauer, Carbs und Verträglichkeit als Baseline.',
    latestLogDate: null,
    observedCarbsPerHour: null,
    targetCarbsPerHour: null,
    bottles750Ml: null,
    powderG: null,
    fluidMlPerHour: null,
    sodiumMgPerHour: null,
    evidence: ['Lange Einheiten nachtraeglich mit Carbs, Flaschen, Pulver und GI-Komfort loggen.'],
    learningReadiness: {
      comparableCompleteLogs: 1,
      requiredComparableCompleteLogs: 3,
      readyForTrendSummary: false,
      missingEvidence: [
        'Noch zwei vergleichbare During-Logs mit Dauer, Carbs und GI-Komfort fehlen.',
        'GI-Komfort fehlt strukturiert fuer mindestens einen langen During-Log.',
      ],
      nextAction: {
        kind: 'complete_gi_comfort',
        label: 'GI-Komfort ergänzen',
        detail: 'GI-Komfort am vorhandenen langen During-Log ergänzen, damit der vorhandene Carb-Log für die Fueling-Baseline zählt.',
        activityId: 'activity-post-fueling',
      },
    },
  };
  const completedActivity = {
    id: 'activity-post-fueling',
    userId: 'user-1',
    externalId: 'garmin-activity-post-fueling',
    source: 'garmin',
    startTime: '2026-05-01T08:00:00.000Z',
    activityType: 'bike',
    name: 'Lange Z2-Ausfahrt',
    durationSec: 3 * 3600,
    distanceM: 78000,
    avgHr: 136,
    maxHr: 162,
    avgPowerW: 172,
    normalizedPowerW: 184,
    tss: 168,
    calories: 2100,
    elevationGainM: 620,
    trainingEffectAerobic: 3.2,
    trainingEffectAnaerobic: 0.1,
    vo2maxEstimate: null,
    rpe: 6,
    rpeNote: 'Kontrolliert, kein Zusatztraining.',
    sorenessAreas: null,
    feedbackLoggedAt: '2026-05-01T12:00:00.000Z',
    equipmentIds: [],
  };
  const completedWorkout = {
    id: 'planned-post-fueling',
    userId: 'user-1',
    plannedDate: '2026-05-01',
    activityType: 'bike',
    zone: 2,
    durationMin: 180,
    distanceKm: null,
    targetTss: 155,
    archetypeId: 'long_endurance_fueling_practice',
    difficultyLevel: 4.2,
    difficultyEnergySystem: 'long_endurance',
    capabilityFit: 'productive',
    description: 'Lange Ausfahrt mit bewusstem Fueling als Lernziel.',
    steps: null,
    garminWorkoutId: null,
    garminScheduledId: null,
    garminSyncContract: null,
    status: 'completed',
    workoutFeedback: 'RPE bereits erfasst.',
    complianceScore: 0.96,
    origin: 'generated',
    userLocked: false,
    completedActivityId: completedActivity.id,
    executionStatus: 'completed_matched',
    executionMatchedAt: '2026-05-01T12:05:00.000Z',
    executionMatchConfidence: 0.94,
    executionNotes: null,
  };

  await mockPulseApi(page, {
    home: {
      todayWorkout: completedWorkout,
      todayActivities: [completedActivity],
      recentActivities: [completedActivity],
      nextWorkout: null,
    },
    planWorkouts: [completedWorkout],
    activityDetail: {
      activity: completedActivity,
      laps: [],
      hrZones: [],
      analytics: null,
    },
    nutritionLogs: [{
      id: 'nutrition-post-fueling-carbs',
      userId: 'user-1',
      date: '2026-05-01',
      workoutId: completedWorkout.id,
      activityId: completedActivity.id,
      context: 'during',
      mealType: null,
      description: 'During-Fueling',
      calories: null,
      proteinG: null,
      carbsG: 125,
      fatG: null,
      gelsCount: null,
      drinksMl: 3000,
      sodiumMg: 1300,
      ambientTempC: 28,
      sweatRateLPerHour: 0.9,
      bottles750Ml: 4,
      powderG: 300,
      fuelingProducts: [],
      giComfort: null,
      notes: null,
      createdAt: '2026-05-01T12:10:00.000Z',
    }],
    outcomeBaseline,
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  await expect(decision.getByTestId('daily-decision-next-steps')).toContainText('Fueling-Log prüfen');
  await expect(decision.getByTestId('daily-decision-next-steps')).toContainText('Trend-Evidenz 1/3');
  await expect(decision.getByTestId('daily-decision-next-steps')).toContainText('Nächste Evidence: GI-Komfort ergänzen');
  await expect(decision.getByTestId('daily-decision-next-steps')).toContainText('vorhandenen langen During-Log');
  const primaryCta = decision.getByRole('button', { name: 'GI-Komfort ergänzen', exact: true });
  await expect(primaryCta).toBeVisible();

  await primaryCta.click();
  await expect(page).toHaveURL('/plan/activity/activity-post-fueling#activity-fueling-log');
  await expect(page.getByTestId('activity-fueling-baseline')).toContainText('Fueling-Baseline offen');
  await expect(page.getByTestId('activity-fueling-evidence-quality')).toContainText('GI-Komfort ergänzen');
  await expect(page.getByRole('button', { name: 'Magen ok' })).toBeVisible();
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
        probabilityPct: 42,
        status: 'at_risk',
        confidence: 'medium',
        summary: '70.3 Kraichgau: beobachten bei ca. 42% mit mittel-Konfidenz.',
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
    powerDuration: {
      bestEfforts: [],
      durability: null,
      bestEffortLine: 'Keine Power-Durability-Begrenzung in diesem Test.',
      durabilityLine: 'Durability unauffällig.',
      updatedAt: '2026-05-01T08:00:00.000Z',
    },
  });
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  const leading = decision.getByTestId('daily-decision-leading-factor');
  await expect(leading).toContainText('Ziel');
  await expect(leading).toContainText('70.3 Kraichgau');
  await expect(leading).toContainText('42%');
  await expect(decision.getByRole('button', { name: /Plan pruefen/i })).toBeVisible();

  const safestOption = decision.getByTestId('daily-decision-safest-option');
  await expect(safestOption).toContainText('Zielintervention');
  await expect(safestOption).toContainText('Fueling-Praxis absichern');
  await expect(safestOption).toContainText('kontrolliert Fueling und GI-Vertraeglichkeit');

  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();

  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Ziel');
  await expect(contract).toContainText('70.3 Kraichgau');
  await expect(contract).toContainText('42%');
  await expect(contract).toContainText('Fueling-Praxis absichern');

  const contractText = await contract.textContent();
  expect(contractText).toBeTruthy();
  const goalImpactIndex = contractText!.indexOf('Zielwirkung');
  const garminIndex = contractText!.indexOf('Garmin', goalImpactIndex);
  expect(goalImpactIndex).toBeGreaterThanOrEqual(0);
  expect(garminIndex).toBeGreaterThan(goalImpactIndex);
  const goalImpactText = contractText!.slice(goalImpactIndex, garminIndex);
  expect(goalImpactText).toContain('70.3 Kraichgau: 42%');
  expect(goalImpactText).toContain('Fueling-Praxis absichern');
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

test('Home daily decision carries everyday fallback options into the safest choice', async ({ page }) => {
  const plannedWorkout = {
    id: 'planned-alltag',
    userId: 'user-1',
    plannedDate: '2026-05-01',
    activityType: 'bike',
    zone: 3,
    durationMin: 90,
    distanceKm: null,
    targetTss: 82,
    archetypeId: 'tempo_sustained',
    difficultyLevel: 4.2,
    difficultyEnergySystem: 'tempo',
    capabilityFit: 'productive',
    description: 'Tempo-Reiz, wenn Alltag und Warm-up passen.',
    steps: null,
    garminWorkoutId: 'gw-alltag',
    garminScheduledId: 'sched-alltag',
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
    home: {
      todayWorkout: plannedWorkout,
      nextWorkout: null,
    },
    planWorkouts: [plannedWorkout],
    goalProjection: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      horizonDays: 180,
      headline: 'Keine Zielprojektion fuer diesen Test.',
      projections: [],
      missingEvidence: [],
    },
    todayOptions: {
      todayOptions: {
        date: '2026-05-01',
        state: 'planned_workout',
        summary: 'Heute ist Training geplant, aber der Tag hat wenig Zeitfenster.',
        signature: 'planned-alltag-fallback',
        options: [
          {
            id: 'planned-alltag-default',
            kind: 'workout',
            priority: 'primary',
            title: 'Plan ausführen: Rad',
            detail: '90 min Z3, wenn Tagesfenster und Warm-up passen.',
            cta: 'Workout öffnen',
            targetPath: '/plan?tab=training',
            evidence: ['Planreiz Tempo'],
            activityType: 'bike',
            zone: 3,
            durationMin: 90,
            archetypeId: 'tempo_sustained',
            capabilityFit: 'productive',
            signalLabels: [{
              kind: 'productive',
              label: 'Produktiv',
              detail: 'Capability erlaubt Fortschritt',
              tone: 'accent',
            }],
          },
          {
            id: 'planned-alltag-shorter',
            kind: 'workout',
            priority: 'secondary',
            title: 'Leichtere Alternative',
            detail: '40 min Z1/Z2, falls heute nur ein kurzes Zeitfenster bleibt.',
            cta: 'Plan anpassen',
            targetPath: '/plan?tab=training&source=today-change&workoutId=planned-alltag&alternative=easier#workout-decision',
            evidence: ['Alltag: kurzes Zeitfenster'],
            activityType: 'bike',
            zone: 1,
            durationMin: 40,
            archetypeId: 'recovery_spin',
            capabilityFit: 'maintenance',
            signalLabels: [{
              kind: 'fit_maintenance',
              label: 'Erhalten',
              detail: 'Zielreiz kleiner halten, Routine bleibt',
              tone: 'green',
            }],
          },
        ],
      },
    },
  });

  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  const safestOption = decision.getByTestId('daily-decision-safest-option');
  await expect(safestOption).toContainText('Alltagsoption');
  await expect(safestOption).toContainText('Leichtere Alternative');
  await expect(safestOption).toContainText('40 min Z1/Z2');

  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();
  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Alltag');
  await expect(contract).toContainText('kurzes Zeitfenster');
  await expect(contract).toContainText('Routine bleibt');
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
  await expect(safestOption).toContainText('Schutzmodus zuerst respektieren');
  await expect(safestOption).toContainText('Heute kleinere Schritte, klare Grenze und kein Zusatzdruck.');
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
