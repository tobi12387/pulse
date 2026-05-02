import type { PulseActionDecisionStatus, PulseDailyOutcomeLearningItem } from '@coaching-os/shared/pulse';

type OutcomeStatus = PulseDailyOutcomeLearningItem['status'];

export interface DailyOutcomeLearningActionDecision {
  id: string;
  source: string;
  sourceId: string | null;
  kind: string;
  title: string;
  status: PulseActionDecisionStatus;
  targetRoute: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolutionReason: string | null;
}

export interface DailyOutcomeLearningCheckin {
  date: string;
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
}

export interface DailyOutcomeLearningWorkout {
  id: string;
  plannedDate: string;
  activityType: string;
  zone: number;
  durationMin: number;
  status: string;
  completedActivityId: string | null;
  executionStatus: string | null;
}

export interface DailyOutcomeLearningActivity {
  id: string;
  source: string;
  startTime: string;
  activityType: string;
  durationSec: number | null;
}

export interface DailyOutcomeLearningMetric {
  date: string;
  sleepHours: number | null;
  hrvStatus: string | null;
  bodyBatteryMax: number | null;
  stressAvg: number | null;
}

export interface DailyOutcomeLearningInput {
  today: string;
  days: number;
  actionDecisions: DailyOutcomeLearningActionDecision[];
  checkins: DailyOutcomeLearningCheckin[];
  plannedWorkouts: DailyOutcomeLearningWorkout[];
  activities: DailyOutcomeLearningActivity[];
  dailyMetrics: DailyOutcomeLearningMetric[];
}

function dateFromTimestamp(value: string | null): string | null {
  return value?.slice(0, 10) ?? null;
}

function actionDate(action: DailyOutcomeLearningActionDecision): string {
  return dateFromTimestamp(action.resolvedAt) ?? dateFromTimestamp(action.createdAt) ?? '';
}

function activityDate(activity: DailyOutcomeLearningActivity): string {
  return activity.startTime.slice(0, 10);
}

function isCheckinAction(action: DailyOutcomeLearningActionDecision): boolean {
  const haystack = `${action.kind} ${action.sourceId ?? ''} ${action.title} ${action.targetRoute ?? ''}`.toLowerCase();
  return haystack.includes('checkin') || haystack.includes('check-in') || haystack.includes('/data');
}

function isWorkoutAction(action: DailyOutcomeLearningActionDecision): boolean {
  const haystack = `${action.kind} ${action.sourceId ?? ''} ${action.title} ${action.targetRoute ?? ''}`.toLowerCase();
  return haystack.includes('workout') || haystack.includes('training') || haystack.includes('einheit') || haystack.includes('/plan');
}

function sameDayCheckin(input: DailyOutcomeLearningInput, date: string): DailyOutcomeLearningCheckin | null {
  return input.checkins.find(checkin => checkin.date === date) ?? null;
}

function sameDayWorkout(input: DailyOutcomeLearningInput, date: string): DailyOutcomeLearningWorkout | null {
  return input.plannedWorkouts.find(workout =>
    workout.plannedDate === date
    && (workout.status === 'completed' || workout.completedActivityId != null || workout.executionStatus === 'completed_matched'),
  ) ?? null;
}

function sameDayActivity(input: DailyOutcomeLearningInput, date: string): DailyOutcomeLearningActivity | null {
  return input.activities.find(activity => activityDate(activity) === date) ?? null;
}

function sameDayMetrics(input: DailyOutcomeLearningInput, date: string): DailyOutcomeLearningMetric | null {
  return input.dailyMetrics.find(metric => metric.date === date) ?? null;
}

function actionKey(action: DailyOutcomeLearningActionDecision): string {
  return `${action.source}:${action.sourceId ?? action.kind}:${action.title.toLowerCase()}`;
}

function staleCount(input: DailyOutcomeLearningInput, action: DailyOutcomeLearningActionDecision): number {
  const key = actionKey(action);
  return input.actionDecisions.filter(candidate =>
    candidate.status === 'deferred'
    && actionKey(candidate) === key,
  ).length;
}

function completedEvidence(input: DailyOutcomeLearningInput, action: DailyOutcomeLearningActionDecision, date: string): string[] {
  const evidence: string[] = [];
  const checkin = sameDayCheckin(input, date);
  const workout = sameDayWorkout(input, date);
  const activity = sameDayActivity(input, date);
  const metrics = sameDayMetrics(input, date);

  if (isCheckinAction(action) && checkin) {
    evidence.push('Check-in am selben Tag vorhanden');
    evidence.push(`Stimmung ${checkin.mood}/10, Energie ${checkin.energy}/10`);
  }
  if (isWorkoutAction(action) && workout) {
    evidence.push(`Geplante Einheit ${workout.activityType} abgeschlossen`);
  }
  if (isWorkoutAction(action) && activity) {
    evidence.push(`Garmin-Aktivität ${activity.activityType} vorhanden`);
  }
  if (metrics?.sleepHours != null) evidence.push(`Schlaf ${metrics.sleepHours.toFixed(1)} h`);
  if (metrics?.bodyBatteryMax != null) evidence.push(`Body Battery max ${metrics.bodyBatteryMax}`);

  return evidence;
}

function statusForAction(input: DailyOutcomeLearningInput, action: DailyOutcomeLearningActionDecision, date: string): {
  status: OutcomeStatus;
  evidence: string[];
} {
  const deferredCount = staleCount(input, action);
  if (action.status === 'deferred' && deferredCount >= 3) {
    return { status: 'stale_pattern', evidence: [`${deferredCount}x verschoben`] };
  }

  const activity = sameDayActivity(input, date);
  if ((action.status === 'dismissed' || action.status === 'superseded') && isWorkoutAction(action) && activity) {
    return {
      status: 'superseded_by_data',
      evidence: [`Garmin-Aktivität ${activity.activityType} am selben Tag gefunden`],
    };
  }

  const evidence = completedEvidence(input, action, date);
  if (action.status === 'completed' && evidence.length > 0) {
    return { status: 'reinforced', evidence };
  }

  return {
    status: 'insufficient_evidence',
    evidence: ['Keine belastbare Folge- oder Ausführungsdaten gefunden'],
  };
}

function titleFor(status: OutcomeStatus, action: DailyOutcomeLearningActionDecision): string {
  if (status === 'reinforced') return 'Empfehlung wurde durch Daten bestätigt';
  if (status === 'superseded_by_data') return 'Garmin-Daten haben die Entscheidung ersetzt';
  if (status === 'stale_pattern') return 'Wiederholte Empfehlung wird angepasst';
  return `Noch kein klares Ergebnis: ${action.title}`;
}

function reasonFor(status: OutcomeStatus, action: DailyOutcomeLearningActionDecision): string {
  if (status === 'reinforced') return `Die Aktion "${action.title}" passt zu den erfassten Tagesdaten.`;
  if (status === 'superseded_by_data') return `Die Aktion "${action.title}" wurde verworfen, aber echte Ausführungsdaten zeigen bereits, was passiert ist.`;
  if (status === 'stale_pattern') return `Die Aktion "${action.title}" wurde mindestens dreimal verschoben und sollte nicht unverändert wieder auftauchen.`;
  return `Pulse hat für "${action.title}" noch nicht genug Folge-Daten, um daraus eine harte Anpassung abzuleiten.`;
}

function adjustmentFor(status: OutcomeStatus, action: DailyOutcomeLearningActionDecision): string {
  if (status === 'reinforced' && isCheckinAction(action)) return 'Check-in Kontext weiter nutzen und die nächste Frage konkreter machen.';
  if (status === 'reinforced') return 'Diesen Handlungstyp beibehalten, aber mit aktueller Evidenz begründen.';
  if (status === 'superseded_by_data') return 'Garmin-Ausführung höher gewichten als die manuelle Aktion.';
  if (status === 'stale_pattern') return 'Empfehlung kleiner, anders getaktet oder vorerst unterdrückt anbieten.';
  return 'Diese Empfehlung nicht wiederholen, ohne neue Daten oder eine bessere Begründung zu zeigen.';
}

export function buildDailyOutcomeLearning(input: DailyOutcomeLearningInput): PulseDailyOutcomeLearningItem[] {
  const cutoff = new Date(`${input.today}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(1, input.days));
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  return input.actionDecisions
    .filter(action => action.status !== 'open')
    .map(action => ({ action, date: actionDate(action) }))
    .filter(({ date }) => date !== '' && date < input.today && date >= cutoffDate)
    .sort((a, b) => b.date.localeCompare(a.date) || b.action.createdAt.localeCompare(a.action.createdAt))
    .map(({ action, date }) => {
      const outcome = statusForAction(input, action, date);
      return {
        date,
        actionId: action.id,
        actionTitle: action.title,
        actionStatus: action.status,
        status: outcome.status,
        title: titleFor(outcome.status, action),
        reason: reasonFor(outcome.status, action),
        evidence: outcome.evidence,
        suggestedAdjustment: adjustmentFor(outcome.status, action),
      };
    });
}
