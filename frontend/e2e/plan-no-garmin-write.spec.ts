import { expect, test, type Page } from '@playwright/test';
import { mockPulseApi } from './fixtures/pulse-api';

type RequestLog = { method: string; pathname: string };

const FORBIDDEN_READ_ONLY_WRITES = [
  { method: 'POST', pattern: /^\/api\/pulse\/garmin\/calendar\/sync$/, label: 'Garmin calendar sync' },
  { method: 'POST', pattern: /^\/api\/pulse\/plan\/workout\/[^/]+\/sync-garmin$/, label: 'Garmin workout sync' },
  { method: 'POST', pattern: /^\/api\/pulse\/plan\/generate$/, label: 'plan generation/apply' },
  { method: 'POST', pattern: /^\/api\/pulse\/plan\/workout$/, label: 'workout create' },
  { method: 'PATCH', pattern: /^\/api\/pulse\/plan\/workout\//, label: 'workout update' },
  { method: 'DELETE', pattern: /^\/api\/pulse\/plan\/workout\//, label: 'workout delete' },
];

function isForbiddenReadOnlyWrite(request: RequestLog): boolean {
  return FORBIDDEN_READ_ONLY_WRITES.some(rule => request.method === rule.method && rule.pattern.test(request.pathname));
}

function assertNoForbiddenWrites(requests: RequestLog[]) {
  const forbidden = requests
    .filter(isForbiddenReadOnlyWrite)
    .map(request => `${request.method} ${request.pathname}`);
  expect(forbidden, 'read-only Plan QA must not call Garmin or plan mutation endpoints').toEqual([]);
}

async function authenticate(page: Page) {
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

test.beforeEach(async ({ page }) => {
  await authenticate(page);
  await page.clock.setFixedTime(new Date('2026-05-01T08:00:00+02:00'));
});

test('Plan no-Garmin-write harness exercises preview, today labels and execution readback', async ({ page }) => {
  const requests: RequestLog[] = [];
  await mockPulseApi(page, {
    onRequest: (pathname, method) => requests.push({ pathname, method }),
    planWorkouts: [{
      id: 'qa-plan-bike',
      userId: 'user-1',
      plannedDate: '2026-05-03',
      activityType: 'bike',
      zone: 4,
      durationMin: 75,
      distanceKm: null,
      targetTss: 92,
      archetypeId: 'bike_vo2_4x4',
      capabilityFit: 'stretch',
      description: 'Warum diese Einheit: VO2 4x4, Limiter Schwelle + VO2, Qualitaetsreiz passt nur mit freien Schutzsignalen. Garmin-readback bleibt read-only.',
      steps: [],
      garminWorkoutId: 'gw-qa-plan-bike',
      garminScheduledId: 'sched-qa-plan-bike',
      status: 'planned',
      workoutFeedback: null,
      complianceScore: null,
      origin: 'generated',
      userLocked: false,
      completedActivityId: null,
      executionStatus: 'garmin_scheduled',
      executionMatchedAt: null,
      executionMatchConfidence: null,
      executionNotes: 'Workout ist auf Garmin im Kalender geplant.',
    }],
    todayOptions: {
      todayOptions: {
        date: '2026-05-01',
        state: 'recovery_protect',
        summary: 'Fueling- und Recovery-Schutz bleiben sichtbar, ohne automatisch Garmin zu schreiben.',
        signature: 'qa-no-garmin-write',
        options: [{
          id: 'qa-rest-protect',
          kind: 'rest',
          priority: 'primary',
          title: 'Heute bewusst schützen',
          detail: 'Kein Apply und kein Garmin Sync in dieser QA-Strecke.',
          cta: 'Tagesentscheidung prüfen',
          targetPath: '/plan?tab=training',
          evidence: ['Read-only Harness'],
          signalLabels: [
            { kind: 'fueling_protect', label: 'Fueling schützen', detail: 'GI-Schutz aktiv', tone: 'amber' },
            { kind: 'recovery', label: 'Recovery', detail: 'Erholung priorisieren', tone: 'green' },
          ],
        }],
      },
    },
    planRefreshPreview: {
      preview: {
        weekStart: '2026-04-27',
        generatedAt: '2026-05-01T08:00:00.000Z',
        stale: true,
        summary: 'QA: neue Daten wuerden eine read-only Planpruefung ausloesen.',
        triggers: [
          { kind: 'new_activity', label: 'Neue Garmin-Aktivität', detail: 'Neue Ausführung liegt vor.', severity: 'info', evidence: ['activity-qa'] },
          { kind: 'mental_protect', label: 'Mental Protect', detail: 'Mentale Lage schützt harte Reize.', severity: 'watch', evidence: ['Check-in niedrig'] },
        ],
        comparisons: [{
          date: '2026-05-03',
          current: {
            id: 'qa-plan-bike',
            plannedDate: '2026-05-03',
            activityType: 'bike',
            zone: 4,
            durationMin: 75,
            targetTss: 92,
            archetypeId: 'bike_vo2_4x4',
            why: 'Limiter Schwelle + VO2.',
            userLocked: false,
          },
          proposed: {
            id: 'qa-plan-bike',
            plannedDate: '2026-05-03',
            activityType: 'bike',
            zone: 2,
            durationMin: 55,
            targetTss: 38,
            archetypeId: 'endurance_steady',
            why: 'Schutzsignal aktiv: kontrollierte Endurance statt VO2.',
            userLocked: false,
          },
          changes: ['zone', 'duration', 'archetype', 'why'],
          reason: 'Read-only Vergleich fuer Plan und Garmin.',
        }],
        loadImpact: { tssDelta: -54, durationDeltaMin: -20 },
        garminImpact: { creates: 0, updates: 1, deletes: 0, unchanged: 0, summary: 'Garmin nach Apply: 1 Workout-Update erwartet.' },
        applySupported: false,
        mutationBoundary: 'Read-only: diese Vorschau fuehrt keine DB- oder Garmin-Schreibaktion aus.',
      },
    },
    garminExecutionDiff: {
      generatedAt: '2026-05-01T08:00:00.000Z',
      window: { from: '2026-05-01', to: '2026-05-15', days: 15 },
      rows: [
        {
          workoutId: 'qa-plan-bike',
          plannedDate: '2026-05-03',
          title: 'Rad · Z4 · 75 min',
          status: 'ready',
          summary: 'Auf Garmin bereit: Vorlage und Kalendertermin wurden im Readback gefunden.',
          local: { garminWorkoutId: 'gw-qa-plan-bike', garminScheduledId: 'sched-qa-plan-bike' },
          remote: { workoutId: 'gw-qa-plan-bike', scheduledId: 'sched-qa-plan-bike', lastSeenAt: '2026-05-01T08:00:00.000Z' },
          repairActions: [],
        },
        {
          workoutId: 'qa-repeat',
          plannedDate: '2026-05-04',
          title: 'Rad · Z4 · 35 min',
          status: 'broken_repeat',
          summary: 'Remote-Workout hat defekte Wiederholungen; Button bleibt in dieser QA ungeklickt.',
          local: { garminWorkoutId: 'gw-qa-repeat', garminScheduledId: 'sched-qa-repeat' },
          remote: { workoutId: 'gw-qa-repeat', scheduledId: 'sched-qa-repeat', lastSeenAt: '2026-05-01T08:00:00.000Z' },
          repairActions: ['repair_repeat'],
        },
      ],
    },
  });

  await page.goto('/plan?tab=training');

  const todayOptions = page.getByTestId('today-options-card-full');
  await expect(todayOptions).toContainText('Fueling schützen');
  await expect(todayOptions).toContainText('Recovery');

  const refreshCard = page.getByTestId('plan-refresh-preview-card');
  await expect(refreshCard).toContainText('Plan prüfen');
  await expect(refreshCard).toContainText('Neue Garmin-Aktivität');
  await expect(refreshCard).toContainText('Mental Protect');
  await expect(refreshCard).toContainText('Garmin nach Apply: 1 Workout-Update erwartet.');
  await expect(refreshCard.getByRole('button', { name: 'Vorschau anwenden' })).toBeDisabled();
  await refreshCard.getByRole('button', { name: 'Refresh Preview' }).click();

  await page.getByRole('tab', { name: 'Ausführung' }).click();
  const executionPanel = page.getByTestId('garmin-execution-trust-panel');
  await expect(executionPanel).toContainText('Auf Garmin bereit');
  await expect(executionPanel).toContainText('Repeat reparieren');
  await expect(executionPanel).toContainText('Neu prüfen');

  expect(requests.some(request => request.method === 'GET' && request.pathname.startsWith('/api/pulse/plan/refresh-preview/'))).toBe(true);
  expect(requests).toContainEqual({ method: 'GET', pathname: '/api/pulse/garmin/execution-diff' });
  assertNoForbiddenWrites(requests);
});
