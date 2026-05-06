import type {
  PulseActionDecisionStatus,
  PulseDailyDecisionQualityEvidence,
  PulseDailyDecisionQualityResponse,
  PulseDailyDecisionQualityStatus,
  PulseDailyDecisionQualityTheme,
  PulseDailyOutcomeLearningItem,
} from '@coaching-os/shared/pulse';

export interface DailyDecisionQualityActionDecision {
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

export interface DailyDecisionQualityCheckin {
  date: string;
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
}

export interface DailyDecisionQualityWorkout {
  id: string;
  plannedDate: string;
  activityType: string;
  zone: number;
  durationMin: number;
  status: string;
  completedActivityId: string | null;
  executionStatus: string | null;
}

export interface DailyDecisionQualityActivity {
  id: string;
  startTime: string;
  activityType: string;
  durationSec: number | null;
  rpe: number | null;
}

export interface DailyDecisionQualityMetric {
  date: string;
  sleepHours: number | null;
  hrvStatus: string | null;
  bodyBatteryMax: number | null;
  bodyBatteryAtWake: number | null;
  stressAvg: number | null;
  highStressSec: number | null;
  avgWakingRespiration: number | null;
  latestSpo2: number | null;
}

export interface DailyDecisionQualityPlanGeneration {
  weekStart: string;
  createdAt: string;
  targetSessionCount: number;
  skippedAvailableDays: number[];
  reasons: string[];
}

export interface DailyDecisionQualityInput {
  today: string;
  days: number;
  actionDecisions: DailyDecisionQualityActionDecision[];
  outcomes: PulseDailyOutcomeLearningItem[];
  checkins: DailyDecisionQualityCheckin[];
  plannedWorkouts: DailyDecisionQualityWorkout[];
  activities: DailyDecisionQualityActivity[];
  dailyMetrics: DailyDecisionQualityMetric[];
  planGenerations: DailyDecisionQualityPlanGeneration[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dateFromTimestamp(value: string | null): string | null {
  return value?.slice(0, 10) ?? null;
}

function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function actionDate(action: DailyDecisionQualityActionDecision): string | null {
  return dateFromTimestamp(action.resolvedAt) ?? dateFromTimestamp(action.createdAt);
}

function actionTheme(action: DailyDecisionQualityActionDecision): string {
  return action.title.trim().replace(/\s+/g, ' ') || action.kind || action.source;
}

function metricLooksPoor(metric: DailyDecisionQualityMetric): boolean {
  return (metric.sleepHours != null && metric.sleepHours < 6)
    || metric.hrvStatus === 'poor'
    || metric.hrvStatus === 'below_normal'
    || (metric.bodyBatteryMax != null && metric.bodyBatteryMax < 40)
    || (metric.stressAvg != null && metric.stressAvg >= 60)
    || (metric.highStressSec != null && metric.highStressSec >= 3_600)
    || (metric.latestSpo2 != null && metric.latestSpo2 < 95);
}

function recoveryStableOrImproved(input: DailyDecisionQualityInput): boolean {
  const metrics = [...input.dailyMetrics].sort((a, b) => a.date.localeCompare(b.date));
  if (metrics.length < 2) return false;
  const previous = metrics[metrics.length - 2]!;
  const latest = metrics[metrics.length - 1]!;

  const sleepOk = previous.sleepHours == null || latest.sleepHours == null || latest.sleepHours >= previous.sleepHours - 0.4;
  const batteryOk = previous.bodyBatteryMax == null || latest.bodyBatteryMax == null || latest.bodyBatteryMax >= previous.bodyBatteryMax - 5;
  const stressOk = previous.stressAvg == null || latest.stressAvg == null || latest.stressAvg <= previous.stressAvg + 8;
  const hrvOk = latest.hrvStatus !== 'poor';

  return sleepOk && batteryOk && stressOk && hrvOk;
}

function toneForStatus(status: PulseDailyOutcomeLearningItem['status']): PulseDailyDecisionQualityEvidence['tone'] {
  if (status === 'reinforced') return 'positive';
  if (status === 'stale_pattern') return 'negative';
  return 'neutral';
}

function statusLabel(status: PulseDailyDecisionQualityStatus): string {
  if (status === 'helpful') return 'Hilfreich';
  if (status === 'watch') return 'Beobachten';
  if (status === 'stale') return 'Wiederholung prüfen';
  if (status === 'needs_strategy_change') return 'Strategie ändern';
  return 'Evidenz fehlt';
}

function suggestedAdjustment(status: PulseDailyDecisionQualityStatus): string {
  if (status === 'helpful') return 'Diesen Entscheidungstyp beibehalten und weiter mit aktueller Evidenz begründen.';
  if (status === 'watch') return 'Empfehlung weiter zeigen, aber mit klarer Begründung und engerem Tagesbezug.';
  if (status === 'stale') return 'Wiederkehrende Empfehlung kleiner, anders getaktet oder vorerst unterdrückt anbieten.';
  if (status === 'needs_strategy_change') return 'Strategie anpassen: weniger Zwangstage, niedrigere Intensität oder andere Reihenfolge vorschlagen.';
  return 'Erst Datenlage verbessern: Check-in, Garmin-Sync oder Ausführung abwarten, bevor Pulse harte Schlüsse zieht.';
}

function buildRepeatedThemes(
  input: DailyDecisionQualityInput,
  reinforcedIds: Set<string>,
): PulseDailyDecisionQualityTheme[] {
  const byTheme = new Map<string, {
    theme: string;
    count: number;
    lastSeen: string | null;
    openOrDeferred: number;
    reinforced: number;
  }>();

  for (const action of input.actionDecisions) {
    const theme = actionTheme(action);
    const key = theme.toLowerCase();
    const seen = actionDate(action);
    const current = byTheme.get(key) ?? { theme, count: 0, lastSeen: null, openOrDeferred: 0, reinforced: 0 };
    current.count += 1;
    if (action.status === 'open' || action.status === 'deferred') current.openOrDeferred += 1;
    if (reinforcedIds.has(action.id)) current.reinforced += 1;
    if (seen && (!current.lastSeen || seen > current.lastSeen)) current.lastSeen = seen;
    byTheme.set(key, current);
  }

  return [...byTheme.values()]
    .filter(theme => theme.count >= 2)
    .map((theme): PulseDailyDecisionQualityTheme => {
      const stale = theme.count >= 3 && theme.openOrDeferred >= 2 && theme.reinforced === 0;
      const useful = theme.reinforced > 0 && theme.openOrDeferred === 0;
      return {
        theme: theme.theme,
        count: theme.count,
        lastSeen: theme.lastSeen,
        status: stale ? 'stale' : useful ? 'useful_repetition' : 'watch',
        evidence: stale
          ? [`${theme.count}x wiederholt ohne Abschluss-/Outcome-Evidenz`]
          : useful
          ? [`${theme.reinforced}x durch Outcome-Evidenz bestätigt`]
          : [`${theme.count}x wiederholt, Qualität weiter beobachten`],
      };
    })
    .sort((a, b) => {
      const staleDelta = Number(b.status === 'stale') - Number(a.status === 'stale');
      if (staleDelta !== 0) return staleDelta;
      return b.count - a.count || (b.lastSeen ?? '').localeCompare(a.lastSeen ?? '');
    });
}

function evidenceTargetRoute(route: string | null): PulseDailyDecisionQualityEvidence['targetRoute'] {
  if (route?.startsWith('/data')) return '/data';
  if (route?.startsWith('/plan')) return '/plan';
  if (route?.startsWith('/coach')) return '/coach';
  if (route?.startsWith('/insights')) return '/insights';
  return undefined;
}

export function buildDailyDecisionQuality(input: DailyDecisionQualityInput): PulseDailyDecisionQualityResponse {
  const from = daysBefore(input.today, Math.max(1, input.days) - 1);
  const reinforcedOutcomes = input.outcomes.filter(outcome => outcome.status === 'reinforced');
  const staleOutcomes = input.outcomes.filter(outcome => outcome.status === 'stale_pattern');
  const reinforcedIds = new Set(reinforcedOutcomes.map(outcome => outcome.actionId));
  const repeatedThemes = buildRepeatedThemes(input, reinforcedIds);
  const staleThemes = repeatedThemes.filter(theme => theme.status === 'stale');

  const completedDecisions = input.actionDecisions.filter(action => action.status === 'completed').length;
  const unresolvedDecisions = input.actionDecisions.filter(action => action.status === 'open' || action.status === 'deferred').length;
  const missedWorkouts = input.plannedWorkouts.filter(workout =>
    workout.status === 'skipped' || workout.executionStatus === 'missed',
  ).length;
  const highRpeActivities = input.activities.filter(activity => (activity.rpe ?? 0) >= 8).length;
  const poorRecoveryDays = input.dailyMetrics.filter(metricLooksPoor).length;
  const stableRecovery = recoveryStableOrImproved(input);
  const checkinCoverage = input.checkins.length;
  const hasFollowUpEvidence = input.outcomes.length > 0
    || input.checkins.length > 0
    || input.dailyMetrics.length > 0
    || input.activities.length > 0
    || input.plannedWorkouts.length > 0;

  const evidence: PulseDailyDecisionQualityEvidence[] = [];

  for (const outcome of input.outcomes.slice(0, 5)) {
    const item: PulseDailyDecisionQualityEvidence = {
      label: outcome.status === 'reinforced' ? 'Outcome bestätigt' : outcome.status === 'stale_pattern' ? 'Stale Outcome' : 'Outcome beobachtet',
      detail: `${outcome.actionTitle}: ${outcome.evidence[0] ?? outcome.reason}`,
      source: 'outcome_learning',
      tone: toneForStatus(outcome.status),
      date: outcome.date,
    };
    const targetRoute = evidenceTargetRoute(input.actionDecisions.find(action => action.id === outcome.actionId)?.targetRoute ?? null);
    if (targetRoute) item.targetRoute = targetRoute;
    evidence.push(item);
  }

  if (stableRecovery) {
    evidence.push({
      label: 'Recovery stabil',
      detail: 'Schlaf, Stress oder Body Battery haben sich nach der Entscheidung nicht verschlechtert.',
      source: 'garmin',
      tone: 'positive',
      date: input.dailyMetrics[input.dailyMetrics.length - 1]?.date ?? null,
      targetRoute: '/data',
    });
  }
  if (missedWorkouts > 0) {
    evidence.push({
      label: 'Workouts verpasst',
      detail: `${missedWorkouts} geplante Einheit(en) verpasst oder nicht gematcht.`,
      source: 'plan_trace',
      tone: 'negative',
      date: null,
      targetRoute: '/plan',
    });
  }
  if (highRpeActivities > 0) {
    evidence.push({
      label: 'Hohe RPE',
      detail: `${highRpeActivities} Aktivität(en) mit RPE 8+ im Fenster.`,
      source: 'garmin',
      tone: 'negative',
      date: null,
      targetRoute: '/data',
    });
  }
  if (poorRecoveryDays > 0) {
    evidence.push({
      label: 'Recovery-Druck',
      detail: `${poorRecoveryDays} Tag(e) mit Schlaf-, HRV-, Stress- oder Body-Battery-Warnzeichen.`,
      source: 'garmin',
      tone: 'negative',
      date: null,
      targetRoute: '/data',
    });
  }
  if (checkinCoverage > 0) {
    evidence.push({
      label: 'Check-in-Abdeckung',
      detail: `${checkinCoverage} Check-in(s) im Entscheidungsfenster.`,
      source: 'checkin',
      tone: 'neutral',
      date: input.checkins[input.checkins.length - 1]?.date ?? null,
      targetRoute: '/data',
    });
  }
  if (input.planGenerations.length > 0) {
    const latestPlan = [...input.planGenerations].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;
    evidence.push({
      label: 'Plan-Trace',
      detail: `${latestPlan.targetSessionCount} Ziel-Einheiten; ${latestPlan.skippedAvailableDays.length} freie verfügbare Tage.`,
      source: 'plan_trace',
      tone: 'neutral',
      date: latestPlan.weekStart,
      targetRoute: '/plan',
    });
  }

  let score = 50
    + reinforcedOutcomes.length * 13
    + completedDecisions * 3
    + (stableRecovery ? 12 : 0)
    + Math.min(checkinCoverage, 4) * 2
    - staleOutcomes.length * 13
    - staleThemes.length * 16
    - missedWorkouts * 10
    - highRpeActivities * 6
    - poorRecoveryDays * 5
    - unresolvedDecisions * 2;

  if (!hasFollowUpEvidence) score -= 18;
  score = clamp(Math.round(score), 0, 100);

  const needsStrategyChange = missedWorkouts >= 2
    && poorRecoveryDays >= 2
    && (highRpeActivities >= 1 || staleOutcomes.length > 0 || staleThemes.length > 0);
  const insufficientEvidence = input.actionDecisions.length === 0
    || (!hasFollowUpEvidence && reinforcedOutcomes.length === 0)
    || (input.outcomes.length === 0 && input.checkins.length === 0 && input.dailyMetrics.length === 0 && input.activities.length === 0);

  let status: PulseDailyDecisionQualityStatus;
  if (needsStrategyChange) status = 'needs_strategy_change';
  else if (staleThemes.length > 0 || staleOutcomes.length >= 2) status = 'stale';
  else if (insufficientEvidence) status = 'insufficient_evidence';
  else if (reinforcedOutcomes.length > 0 && score >= 70) status = 'helpful';
  else status = 'watch';

  if (status === 'insufficient_evidence') score = Math.min(score, 55);
  if (status === 'needs_strategy_change') score = Math.min(score, 49);

  const bestEvidence = evidence
    .slice()
    .sort((a, b) => {
      const priority = { negative: 3, positive: 2, missing: 1, neutral: 0 };
      return priority[b.tone] - priority[a.tone];
    })
    .slice(0, 4)
    .map(item => `${item.label}: ${item.detail}`);

  if (bestEvidence.length === 0) {
    bestEvidence.push('Noch zu wenig Folge-Daten für eine belastbare Qualitätsbewertung.');
  }

  return {
    range: { from, to: input.today, days: Math.max(1, input.days) },
    qualityScore: score,
    status,
    statusLabel: statusLabel(status),
    repeatedThemes,
    bestEvidence,
    evidence,
    suggestedAdjustment: suggestedAdjustment(status),
  };
}
