import type { PulseAdaptationEvent, PulseDailyDecisionQualityResponse, PulseDailyDeltaItem, PulseFuelingOutcomeBaseline, PulseGoalProjectionResponse, PulseHomeScreenData, PulseNextBestAction, PulseTodayOptionsResponse, PulseTrainingAnalyticsResponse } from '@coaching-os/shared/pulse';
import { activityLabel } from '@/pulse/activity-labels';

export type DailyDecisionEvidence = string | { label: string; targetPath: string };
export type DailyDecisionSignalTone = 'green' | 'amber' | 'rose' | 'accent' | 'muted';

export interface DailyDecisionSignal {
  label: string;
  detail: string;
  tone: DailyDecisionSignalTone;
  targetPath?: string;
}

export interface DailyDecisionContract {
  leadingFactor: string;
  goalImpact: string;
  garminExecution: string;
  continuity: string;
  safestAlternative: string;
  signals: DailyDecisionSignal[];
}

export interface DailyDecisionMentalBoundary {
  level: 'steady' | 'protect';
  label: string;
  detail: string;
  targetPath?: string;
}

export type DailyDecisionStepStatus = 'done' | 'open' | 'note';

export interface DailyDecisionStep {
  status: DailyDecisionStepStatus;
  label: string;
  detail: string;
  cta?: string;
  targetPath?: string;
}

export interface DailyDecision {
  title: string;
  reason: string;
  boundary: string;
  alternative: string;
  completionCriterion: string;
  resultPreview?: string;
  cta: string;
  targetPath: string;
  prompt: string;
  priority: PulseNextBestAction['priority'];
  evidence: DailyDecisionEvidence[];
  contract: DailyDecisionContract;
  steps?: DailyDecisionStep[];
  emptyState?: string;
  supportCta?: string;
  supportPath?: string;
}

type DailyDecisionPrimaryAction = Pick<DailyDecision, 'cta' | 'targetPath' | 'resultPreview'>;

export interface DailyDecisionContext {
  dailyDelta?: PulseDailyDeltaItem | null;
  decisionQuality?: PulseDailyDecisionQualityResponse | null;
  goalProjection?: PulseGoalProjectionResponse | null;
  mentalBoundary?: DailyDecisionMentalBoundary | null;
  todayOptions?: PulseTodayOptionsResponse | null;
  adaptationEvent?: PulseAdaptationEvent | null;
  trainingAnalytics?: PulseTrainingAnalyticsResponse | null;
  fuelingOutcomeBaseline?: PulseFuelingOutcomeBaseline | null;
}

type HomeWorkout = NonNullable<PulseHomeScreenData['todayWorkout']>;
type HomeActivity = PulseHomeScreenData['recentActivities'][number];
type GoalProjection = PulseGoalProjectionResponse['projections'][number];
type HomeDataStatus = PulseHomeScreenData['dataStatus'];
type HomeRecovery = PulseHomeScreenData['recovery'];

function activityDetailPath(activityId: string): string {
  return `/plan/activity/${activityId}`;
}

function readinessBoundary(score: number | null | undefined, tsb: number | null | undefined): string {
  if (score != null && score < 55) return 'Heute defensiv bleiben: keine harte Intensität erzwingen.';
  if (score != null && score < 70) return 'Belastung sauber dosieren und harte Spitzen nur bewusst setzen.';
  if (tsb != null && tsb < -10) return 'Form ist belastet: Umfang oder Intensität nicht zusätzlich ausweiten.';
  return 'Normal planen, aber nicht über die heutige Entscheidung hinaus verlängern.';
}

function workoutLabel(home: PulseHomeScreenData): string | null {
  const workout = home.todayWorkout?.plannedDate === home.date ? home.todayWorkout : home.nextWorkout;
  if (!workout || workout.plannedDate !== home.date) return null;
  return `${activityLabel(workout.activityType)} · Z${workout.zone} · ${workout.durationMin} min`;
}

function completedTodayWorkout(home: PulseHomeScreenData) {
  const workout = home.todayWorkout;
  if (!workout || workout.plannedDate !== home.date) return null;
  if (workout.status === 'completed' || workout.completedActivityId || workout.executionStatus === 'completed_matched') return workout;
  return null;
}

function todayActivityCandidates(home: PulseHomeScreenData): HomeActivity[] {
  const todayActivities = home.todayActivities ?? [];
  if (todayActivities.length > 0) return todayActivities;
  return home.recentActivities.filter(activity => activity.startTime.slice(0, 10) === home.date);
}

function completedOffPlanActivity(home: PulseHomeScreenData): HomeActivity | null {
  if (home.todayWorkout?.plannedDate === home.date) return null;
  const activity = todayActivityCandidates(home).find(item => (item.durationSec ?? 0) >= 10 * 60);
  return activity ?? null;
}

function completedActivityFor(home: PulseHomeScreenData, workout: HomeWorkout) {
  if (!workout.completedActivityId) return null;
  return home.recentActivities.find(activity => activity.id === workout.completedActivityId) ?? null;
}

function completedActivityLabel(activity: HomeActivity): string {
  const typeLabel: Record<string, string> = {
    bike: 'Rad',
    run: 'Lauf',
    swim: 'Schwimmen',
    strength: 'Kraft',
    hike: 'Hike',
    other: 'Training',
  };
  const type = typeLabel[activity.activityType] ?? 'Training';
  const minutes = activity.durationSec != null ? Math.round(activity.durationSec / 60) : null;
  const distanceKm = activity.distanceM != null ? activity.distanceM / 1000 : null;
  const distanceLabel = distanceKm != null
    ? `${distanceKm >= 10 ? Math.round(distanceKm) : distanceKm.toFixed(1)} km`
    : null;
  return [
    activity.name?.trim() || type,
    minutes != null ? `${minutes} min` : null,
    distanceLabel,
  ].filter(Boolean).join(' · ');
}

function hasCompletedWorkoutFeedback(home: PulseHomeScreenData, workout: HomeWorkout): boolean {
  const activity = completedActivityFor(home, workout);
  return Boolean(workout.workoutFeedback?.trim())
    || activity?.feedbackLoggedAt != null
    || activity?.rpe != null;
}

function openFuelingDebt(todayOptions: PulseTodayOptionsResponse | null | undefined) {
  const debt = todayOptions?.fuelingDebt;
  return debt?.hasOpenDebt ? debt : null;
}

function fuelingProtectDetail(todayOptions: PulseTodayOptionsResponse | null | undefined): string | null {
  const label = todayOptions?.options
    .flatMap(option => option.signalLabels ?? [])
    .find(signal => signal.kind === 'fueling_protect');
  return label?.detail ?? null;
}

function topGoalProjection(goalProjection: PulseGoalProjectionResponse | null | undefined): GoalProjection | null {
  return goalProjection?.projections[0] ?? null;
}

function goalSignalTone(goal: GoalProjection): DailyDecisionSignalTone {
  if (goal.status === 'at_risk') return 'rose';
  if (goal.status === 'watch') return 'amber';
  if (goal.status === 'on_track') return 'green';
  return 'muted';
}

function goalProbabilityLabel(goal: GoalProjection): string {
  return goal.probabilityPct == null ? 'Evidenz offen' : `${goal.probabilityPct}%`;
}

function mentalSignalTone(boundary: DailyDecisionMentalBoundary): DailyDecisionSignalTone {
  return boundary.level === 'protect' ? 'rose' : 'amber';
}

function dataConfidenceSignal(dataStatus: HomeDataStatus): DailyDecisionSignal | null {
  if (!dataStatus.userReady) {
    return {
      label: 'Daten',
      detail: 'Setup offen: Nutzerprofil fehlt, Empfehlungen bleiben vorsichtig.',
      tone: 'rose',
      targetPath: '/settings',
    };
  }
  if (!dataStatus.profileReady) {
    return {
      label: 'Daten',
      detail: 'Profil offen: Settings prüfen, bevor Planlogik voll vertraut wird.',
      tone: 'amber',
      targetPath: '/settings',
    };
  }
  if (dataStatus.garmin.status === 'empty') {
    return {
      label: 'Daten',
      detail: 'Garmin leer: Readiness und Plan arbeiten mit Basiswerten.',
      tone: 'amber',
      targetPath: '/data?tab=quality#data-garmin-quality',
    };
  }
  if (dataStatus.garmin.status === 'stale') {
    return {
      label: 'Daten',
      detail: `Garmin alt: Letzte Tagesdaten: ${dataStatus.garmin.lastMetricDate ?? 'unbekannt'}. Heute fehlen frische Signale.`,
      tone: 'amber',
      targetPath: '/data?tab=quality#data-garmin-quality',
    };
  }
  if (dataStatus.garmin.status === 'partial') {
    return {
      label: 'Daten',
      detail: 'Garmin teilweise: Einige Empfehlungen bleiben vorsichtig.',
      tone: 'amber',
      targetPath: '/data?tab=quality#data-garmin-quality',
    };
  }
  return null;
}

function alternativeFor(
  home: PulseHomeScreenData,
  action: PulseNextBestAction | null,
  todayOptions: PulseTodayOptionsResponse | null,
): string {
  const workout = home.todayWorkout?.plannedDate === home.date ? home.todayWorkout : home.nextWorkout;
  const todayWorkout = workout?.plannedDate === home.date ? workout : null;
  const fuelingDebt = openFuelingDebt(todayOptions);

  if (action?.source === 'checkin') {
    return 'Kurz in Coach oder Data einchecken; wenn wenig Zeit ist, nur Kopf, Energie und Stress notieren.';
  }
  if (action?.source === 'risk') {
    return 'Training heute aktiv entschärfen oder pausieren, bis das Risk-Signal geprüft ist.';
  }
  if (fuelingDebt) {
    return `Fueling-Schutz zuerst schließen: ${fuelingDebt.closureCondition}`;
  }
  if (todayWorkout && todayWorkout.zone >= 3) {
    return `Auf Z2 senken oder im Plan eine kürzere Alternative wählen, falls die Grenze nicht passt.`;
  }
  if (todayWorkout) {
    return 'Einheit locker halten oder bewusst verschieben, wenn Check-in oder Readiness dagegen sprechen.';
  }
  if (workout) {
    return 'Freien Tag als Vorbereitung nutzen: Schlaf, Mobility, mentale Entlastung und kurze Planprüfung.';
  }
  return 'Erholungstag bewusst schließen oder im Plan neue Verfügbarkeit setzen, falls Training doch geplant werden soll.';
}

function mapEvidence(item: string): DailyDecisionEvidence {
  const normalized = item.toLowerCase();
  if (
    normalized.includes('check-in') ||
    normalized.includes('stimmung') ||
    normalized.includes('energie') ||
    normalized.includes('stress') ||
    normalized.includes('motivation') ||
    normalized.includes('mental')
  ) {
    return { label: item, targetPath: '/data?tab=today#data-mental' };
  }
  if (normalized.includes('garmin') || normalized.includes('abdeckung') || normalized.includes('coverage')) {
    return { label: item, targetPath: '/data?tab=quality#data-garmin-quality' };
  }
  if (
    normalized.includes('tsb') ||
    normalized.includes('ctl') ||
    normalized.includes('atl') ||
    normalized.includes('load') ||
    normalized.includes('risiko') ||
    normalized.includes('risk')
  ) {
    return { label: item, targetPath: '/data?tab=analysis#data-plan-trace' };
  }
  return item;
}

function actionResultPreview(action: PulseNextBestAction | null, fallbackPath: string): string {
  const targetPath = action?.targetPath ?? fallbackPath;
  if (targetPath.startsWith('/coach')) {
    return 'Pulse öffnet Coach mit vorbereiteter Tagesfrage; Plan und Garmin bleiben unverändert.';
  }
  if (targetPath.startsWith('/data')) {
    return 'Nach dem Speichern nutzen Home, Plan und Coach dasselbe mentale Tagessignal.';
  }
  if (targetPath.startsWith('/plan')) {
    return 'Pulse öffnet die passende Planentscheidung; Änderungen bleiben bewusst, bevor Garmin betroffen ist.';
  }
  return 'Pulse öffnet den passenden Schritt, ohne automatisch Plan oder Garmin zu verändern.';
}

function signalToneForReadiness(score: number): DailyDecisionSignalTone {
  if (score < 55) return 'rose';
  if (score < 70) return 'amber';
  if (score >= 85) return 'accent';
  return 'green';
}

function signalToneForTsb(tsb: number): DailyDecisionSignalTone {
  if (tsb < -12) return 'amber';
  if (tsb > 8) return 'green';
  return 'muted';
}

const signalTonePriority: Record<DailyDecisionSignalTone, number> = {
  rose: 0,
  amber: 1,
  accent: 2,
  green: 3,
  muted: 4,
};

const signalLabelPriority: Record<string, number> = {
  Mental: 0,
  Lernen: 0,
  Recovery: 0,
  Anpassung: 0,
  Daten: 1,
  Analyse: 1,
  Fueling: 2,
  'Fueling-Lernen': 2,
  Ziel: 3,
  Training: 4,
  Garmin: 5,
  Koerper: 6,
  Belastung: 7,
};

function prioritizeSignals(signals: DailyDecisionSignal[]): DailyDecisionSignal[] {
  return [...signals].sort((a, b) => (
    signalTonePriority[a.tone] - signalTonePriority[b.tone]
    || (signalLabelPriority[a.label] ?? 99) - (signalLabelPriority[b.label] ?? 99)
  ));
}

function leadingFactorSummary(signals: DailyDecisionSignal[]): string {
  const leading = signals[0];
  if (!leading) return 'Keine harte Begrenzung: Entscheidung aus Zielwirkung, Garmin-Zustand und sicherster Option ableiten.';
  return `${leading.label}: ${leading.detail}`;
}

function signalActionCta(signal: DailyDecisionSignal): string | null {
  if (signal.label === 'Anpassung') return signal.detail.split(':')[0]?.trim() || 'Anpassung prüfen';
  if (signal.label === 'Daten') return 'Daten prüfen';
  if (signal.label === 'Fueling') return 'Fueling schließen';
  if (signal.label === 'Mental') return 'Check-in öffnen';
  if (signal.label === 'Recovery') return 'Recovery ansehen';
  if (signal.label === 'Lernen') return 'Lernen prüfen';
  if (signal.label === 'Analyse') return 'Analyse prüfen';
  if (signal.label === 'Fueling-Lernen') return 'Fueling vorbereiten';
  if (signal.label === 'Garmin') return 'Garmin prüfen';
  return null;
}

function signalActionResultPreview(targetPath: string): string {
  if (targetPath.startsWith('/settings?section=garmin')) {
    return 'Pulse öffnet Garmin in Settings; Sync oder Reparatur passiert erst nach deinem Klick.';
  }
  if (targetPath.startsWith('/plan/activity/')) {
    return 'Pulse öffnet die Aktivität; Feedback verbessert die nächste Planentscheidung.';
  }
  if (targetPath.startsWith('/plan')) {
    return 'Pulse öffnet die passende Planprüfung; Plan oder Garmin ändern sich erst nach einem bewussten Klick.';
  }
  if (targetPath.startsWith('/data')) {
    return 'Pulse öffnet die Evidenz; Plan und Garmin bleiben unverändert.';
  }
  if (targetPath.startsWith('/settings')) {
    return 'Pulse öffnet Settings; Änderungen passieren erst nach deinem Klick.';
  }
  return 'Pulse öffnet den passenden Schritt, ohne automatisch Plan oder Garmin zu verändern.';
}

function primaryActionForLeadingSignal(
  signals: DailyDecisionSignal[],
  fallback: DailyDecisionPrimaryAction,
  options: { canOverride: boolean },
): DailyDecisionPrimaryAction {
  if (!options.canOverride) return fallback;

  const leading = signals[0];
  if (!leading?.targetPath) return fallback;

  const cta = signalActionCta(leading);
  if (!cta) return fallback;

  return {
    cta,
    targetPath: leading.targetPath,
    resultPreview: signalActionResultPreview(leading.targetPath),
  };
}

function decisionQualitySignal(quality: PulseDailyDecisionQualityResponse | null | undefined): DailyDecisionSignal | null {
  if (!quality) return null;

  const primaryEvidence = quality.bestEvidence[0];
  const detail = quality.status === 'helpful' && primaryEvidence
    ? `${quality.statusLabel}: ${primaryEvidence}`
    : `${quality.statusLabel}: ${primaryEvidence ? `${primaryEvidence}. ` : ''}${quality.suggestedAdjustment}`;
  const tone: DailyDecisionSignalTone = quality.status === 'needs_strategy_change'
    ? 'rose'
    : quality.status === 'stale' || quality.status === 'watch'
      ? 'amber'
      : quality.status === 'helpful'
        ? 'green'
        : 'muted';

  return {
    label: 'Lernen',
    detail,
    tone,
    targetPath: '/data?tab=analyse#data-plan-trace',
  };
}

function adaptationSignalTarget(event: PulseAdaptationEvent): string {
  if (event.recommendation === 'sync_garmin') return '/settings?section=garmin';
  if (event.recommendation === 'log_feedback') return event.sourceId ? activityDetailPath(event.sourceId) : '/data?tab=analysis';
  if (event.recommendation === 'keep_plan') return '/plan';
  return '/plan#plan-adaptation-review';
}

function adaptationSignalLabel(event: PulseAdaptationEvent): string {
  if (event.recommendation === 'sync_garmin') return 'Garmin prüfen';
  if (event.recommendation === 'log_feedback') return 'Feedback öffnen';
  if (event.recommendation === 'protect_recovery') return 'Recovery schützen';
  if (event.recommendation === 'move_workout') return 'Einheit verschieben';
  if (event.recommendation === 'reduce_intensity') return 'Intensität reduzieren';
  if (event.recommendation === 'reduce_volume') return 'Umfang reduzieren';
  if (event.recommendation === 'regenerate_week') return 'Woche neu prüfen';
  return 'Plan beibehalten';
}

function adaptationSignal(event: PulseAdaptationEvent | null | undefined): DailyDecisionSignal | null {
  if (!event || event.resolvedAt || event.severity === 'info') return null;

  return {
    label: 'Anpassung',
    detail: [
      `${adaptationSignalLabel(event)}: ${event.summary}`,
      event.evidence[0] ?? null,
    ].filter(Boolean).join(' · '),
    tone: event.severity === 'action' ? 'amber' : 'accent',
    targetPath: adaptationSignalTarget(event),
  };
}

function analysisSignal(
  trainingAnalytics: PulseTrainingAnalyticsResponse | null | undefined,
  workout: HomeWorkout | null,
  completedActivity: HomeActivity | null,
): DailyDecisionSignal | null {
  const openWorkoutDecision = Boolean(workout && !completedActivity && workout.status !== 'completed' && !workout.completedActivityId);
  if (!openWorkoutDecision) return null;

  const durability = trainingAnalytics?.powerDuration?.durability ?? null;
  if (!durability || durability.rating === 'strong') return null;

  return {
    label: 'Analyse',
    detail: trainingAnalytics?.powerDuration?.durabilityLine
      ?? `Durability ${durability.rating}: ${durability.evidence.join(' · ')}`,
    tone: durability.rating === 'limited' ? 'rose' : 'amber',
    targetPath: '/data?tab=analysis#data-plan-trace',
  };
}

function isFuelingLearningWorkout(workout: HomeWorkout | null): boolean {
  if (!workout) return false;
  const isFuelingSport = workout.activityType === 'bike' || workout.activityType === 'run' || workout.activityType === 'hike';
  if (!isFuelingSport) return false;
  return workout.durationMin >= 75
    || /fueling|verpflegung|magen|gi/i.test(workout.description ?? '')
    || /fueling/i.test(workout.archetypeId ?? '');
}

function fuelingLearningSignal(
  baseline: PulseFuelingOutcomeBaseline | null | undefined,
  workout: HomeWorkout | null,
  completedActivity: HomeActivity | null,
): DailyDecisionSignal | null {
  const openWorkoutDecision = Boolean(workout && !completedActivity && workout.status !== 'completed' && !workout.completedActivityId);
  if (!openWorkoutDecision || !isFuelingLearningWorkout(workout)) return null;

  const readiness = baseline?.learningReadiness ?? null;
  if (!readiness || readiness.readyForTrendSummary) return null;

  const missing = readiness.missingEvidence[0] ?? 'Vergleichbare During-Logs fehlen noch.';
  return {
    label: 'Fueling-Lernen',
    detail: `Trend-Evidenz ${readiness.comparableCompleteLogs}/${readiness.requiredComparableCompleteLogs}: ${missing}`,
    tone: 'amber',
    targetPath: `/plan?tab=training&source=fueling-learning&workoutId=${encodeURIComponent(workout!.id)}#workout-fueling-baseline`,
  };
}

function garminExecutionSignal(
  workout: HomeWorkout | null,
  completedActivity: HomeActivity | null,
): DailyDecisionSignal | null {
  const openWorkoutDecision = Boolean(workout && !completedActivity && workout.status !== 'completed' && !workout.completedActivityId);
  if (!openWorkoutDecision || !workout) return null;

  const targetPath = `/plan?tab=execution&source=daily-garmin&workoutId=${encodeURIComponent(workout.id)}`;
  const syncContract = workout.garminSyncContract;
  if (syncContract?.status === 'blocked') {
    return {
      label: 'Garmin',
      detail: `Sync blockiert: ${syncContract.summary}`,
      tone: 'rose',
      targetPath,
    };
  }
  if (syncContract?.status === 'degraded') {
    return {
      label: 'Garmin',
      detail: `Sync eingeschränkt: ${syncContract.summary}`,
      tone: 'amber',
      targetPath,
    };
  }

  if (workout.executionStatus === 'local_planned' || (!workout.garminWorkoutId && !workout.garminScheduledId)) {
    return {
      label: 'Garmin',
      detail: 'Nur lokal geplant: noch keine Garmin-Vorlage oder Kalenderprüfung.',
      tone: 'amber',
      targetPath,
    };
  }
  if (workout.executionStatus === 'garmin_template') {
    return {
      label: 'Garmin',
      detail: 'Vorlage bereit, Kalenderstatus noch offen.',
      tone: 'amber',
      targetPath,
    };
  }

  return null;
}

function recoverySignal(recovery: HomeRecovery): DailyDecisionSignal | null {
  if (!recovery) return null;

  const reasons: string[] = [];
  if (recovery.sleepDebt7d.status === 'severe') {
    reasons.push(`Schlafdefizit schwer: ${recovery.sleepDebt7d.hours.toFixed(1)} h offen`);
  } else if (recovery.sleepDebt7d.status === 'mild') {
    reasons.push(`Schlafdefizit: ${recovery.sleepDebt7d.hours.toFixed(1)} h`);
  }
  if (recovery.hrvDeviation7d.status === 'declining') {
    reasons.push(`HRV ${recovery.hrvDeviation7d.pct.toFixed(1)}%`);
  }
  if (recovery.rhrDrift7d.status === 'elevated') {
    reasons.push(`RHR +${recovery.rhrDrift7d.bpmAboveBaseline.toFixed(0)} bpm`);
  }

  const lowRecovery = recovery.recoveryScore < 45;
  if (!lowRecovery && reasons.length === 0) return null;

  const detail = [
    reasons.length > 0 ? reasons.join(' · ') : `Recovery ${recovery.recoveryScore}/100`,
    recovery.recommendation,
  ].filter(Boolean).join('. ');

  return {
    label: 'Recovery',
    detail,
    tone: lowRecovery || recovery.sleepDebt7d.status === 'severe' ? 'rose' : 'amber',
    targetPath: '/data?tab=trends#data-recovery',
  };
}

function executionSummary(workout: HomeWorkout | null, completedActivity: HomeActivity | null): string {
  if (completedActivity) return 'Garmin: Aktivitaet erledigt und bereit fuer Feedback/Planabgleich.';
  if (!workout) return 'Garmin: kein Schreibpfad fuer heute; Erholung und Check-in bleiben lokal.';
  if (workout.executionStatus === 'completed_matched') return 'Garmin: geplante Einheit erledigt und zugeordnet.';
  if (workout.executionStatus === 'garmin_scheduled') return 'Garmin: Kalender bereit; Ausfuehrung auf dem Geraet pruefbar.';
  if (workout.executionStatus === 'garmin_template') return 'Garmin: Workout-Template bereit, Kalenderstatus noch pruefen.';
  if (workout.executionStatus === 'missed') return 'Garmin: geplante Einheit wirkt verpasst; Planabgleich vor Nachholen.';
  if (workout.executionStatus === 'replaced_or_off_plan') return 'Garmin: echte Aktivitaet weicht vom Plan ab; Planwirkung pruefen.';
  return 'Garmin: Pulse plant lokal; kein automatischer Geraete-Write.';
}

function goalImpactSummary(
  home: PulseHomeScreenData,
  workout: HomeWorkout | null,
  completedActivity: HomeActivity | null,
  goalProjection: PulseGoalProjectionResponse | null,
): string {
  const goal = topGoalProjection(goalProjection);
  const goalContext = goal
    ? ` ${goal.title}: ${goalProbabilityLabel(goal)} · ${goal.nextBestIntervention.title}.`
    : '';

  if (workout?.status === 'completed' || workout?.completedActivityId) {
    return `Zielwirkung: Reiz als erledigt behandeln; Feedback macht die naechste Planung genauer.${goalContext}`;
  }
  if (completedActivity) {
    return `Zielwirkung: ungeplante Belastung in die naechste Planentscheidung einrechnen.${goalContext}`;
  }
  if (workout) {
    if (workout.capabilityFit === 'too_hard_today') return `Zielwirkung: Fortschritt schuetzen, aber heute keine zu harte Einheit erzwingen.${goalContext}`;
    if (workout.capabilityFit === 'stretch') return `Zielwirkung: kontrollierter Reiz, solange Readiness und Grenze passen.${goalContext}`;
    if (workout.capabilityFit === 'productive') return `Zielwirkung: produktiver Trainingsreiz im Wochenziel.${goalContext}`;
    return `Zielwirkung: Wochenstruktur halten, ohne Zusatzumfang zu erzwingen.${goalContext}`;
  }
  if (home.nextWorkout) {
    return `Zielwirkung: Erholung heute verbessert die Qualitaet der naechsten Einheit.${goalContext}`;
  }
  return `Zielwirkung: Erholung und mentaler Check-in halten die Routine stabil.${goalContext}`;
}

function continuitySummary({
  home,
  action,
  workout,
  completedActivity,
  dailyDelta,
}: {
  home: PulseHomeScreenData;
  action: PulseNextBestAction | null;
  workout: HomeWorkout | null;
  completedActivity: HomeActivity | null;
  dailyDelta: PulseDailyDeltaItem | null;
}): string {
  if (dailyDelta?.date === home.date) {
    const prefix = dailyDelta.status === 'matched' ? 'Bleibt gültig' : 'Geändert';
    return `${prefix}: ${dailyDelta.title}. ${dailyDelta.nextPlanEffect}`;
  }

  if (workout?.status === 'completed' || workout?.completedActivityId) {
    return 'Geändert: Die Einheit ist erledigt; die Entscheidung wechselt von Ausführung zu Feedback, Versorgung und Regeneration.';
  }
  if (completedActivity) {
    return 'Geändert: Garmin hat reale Belastung geliefert; Feedback und Planabgleich sind heute wichtiger als zusätzliches Training.';
  }
  if (workout) {
    return 'Bleibt gültig: Readiness, TSB und Workout-Profil bestimmen weiter Ausführen oder bewusstes Anpassen, nicht Zusatzumfang.';
  }
  if (action) {
    return 'Bleibt gültig: Der offene nächste Schritt ist noch nicht geschlossen; Pulse hält die Entscheidung auf diesem Hebel.';
  }
  return 'Bleibt gültig: Ohne geplantes Training schließen Check-in und Erholung den Tag ruhiger als eine neue Einheit.';
}

function topSignals(
  home: PulseHomeScreenData,
  workout: HomeWorkout | null,
  completedActivity: HomeActivity | null,
  action: PulseNextBestAction | null,
  decisionQuality: PulseDailyDecisionQualityResponse | null,
  goalProjection: PulseGoalProjectionResponse | null,
  mentalBoundary: DailyDecisionMentalBoundary | null,
  todayOptions: PulseTodayOptionsResponse | null,
  adaptationEvent: PulseAdaptationEvent | null,
  trainingAnalytics: PulseTrainingAnalyticsResponse | null,
  fuelingOutcomeBaseline: PulseFuelingOutcomeBaseline | null,
): DailyDecisionSignal[] {
  const signals: DailyDecisionSignal[] = [
    {
      label: 'Koerper',
      detail: `Readiness ${home.readiness.score}/100`,
      tone: signalToneForReadiness(home.readiness.score),
      targetPath: '/data?tab=trends#data-recovery',
    },
    {
      label: 'Belastung',
      detail: `TSB ${home.fitnessLoad.tsb.toFixed(1)}`,
      tone: signalToneForTsb(home.fitnessLoad.tsb),
      targetPath: '/data?tab=analysis#data-plan-trace',
    },
  ];
  const fuelingDebt = openFuelingDebt(todayOptions);
  const goal = topGoalProjection(goalProjection);
  const recovery = recoverySignal(home.recovery);
  const dataSignal = dataConfidenceSignal(home.dataStatus);
  const qualitySignal = decisionQualitySignal(decisionQuality);
  const adaptation = adaptationSignal(adaptationEvent);
  const analysis = analysisSignal(trainingAnalytics, workout, completedActivity);
  const fuelingLearning = fuelingDebt ? null : fuelingLearningSignal(fuelingOutcomeBaseline, workout, completedActivity);
  const garminExecution = garminExecutionSignal(workout, completedActivity);

  if (adaptation) {
    signals.push(adaptation);
  }
  if (recovery) {
    signals.push(recovery);
  }
  if (dataSignal) {
    signals.push(dataSignal);
  }
  if (qualitySignal) {
    signals.push(qualitySignal);
  }
  if (analysis) {
    signals.push(analysis);
  }
  if (fuelingLearning) {
    signals.push(fuelingLearning);
  }
  if (garminExecution) {
    signals.push(garminExecution);
  }

  if (fuelingDebt) {
    const protectDetail = fuelingProtectDetail(todayOptions);
    signals.push({
      label: 'Fueling',
      detail: `${fuelingDebt.label}: ${protectDetail ?? fuelingDebt.summary}`,
      tone: 'amber',
      targetPath: fuelingDebt.followUpActivityId ? activityDetailPath(fuelingDebt.followUpActivityId) : '/data?tab=trends#data-recovery',
    });
  }

  if (mentalBoundary) {
    signals.push({
      label: 'Mental',
      detail: `${mentalBoundary.label}: ${mentalBoundary.detail}`,
      tone: mentalSignalTone(mentalBoundary),
      targetPath: mentalBoundary.targetPath ?? '/data?tab=today#data-mental',
    });
  }

  if (goal) {
    signals.push({
      label: 'Ziel',
      detail: `${goal.title}: ${goalProbabilityLabel(goal)} · ${goal.nextBestIntervention.title}`,
      tone: goalSignalTone(goal),
      targetPath: goal.nextBestIntervention.targetPath,
    });
  }

  if (workout) {
    signals.push({
      label: 'Training',
      detail: `${activityLabel(workout.activityType)} Z${workout.zone} · ${workout.durationMin} min`,
      tone: workout.capabilityFit === 'too_hard_today' ? 'rose' : workout.capabilityFit === 'stretch' ? 'amber' : 'accent',
      targetPath: '/plan?tab=training',
    });
  } else if (completedActivity) {
    signals.push({
      label: 'Garmin',
      detail: completedActivityLabel(completedActivity),
      tone: 'accent',
      targetPath: activityDetailPath(completedActivity.id),
    });
  }

  if (!mentalBoundary && (action?.source === 'checkin' || action?.source === 'mental')) {
    signals.push({
      label: 'Mental',
      detail: action.source === 'checkin' ? 'Check-in offen' : action.title,
      tone: action.priority === 'critical' ? 'rose' : action.priority === 'high' ? 'amber' : 'accent',
      targetPath: action.targetPath,
    });
  }

  return prioritizeSignals(signals);
}

function buildContract({
  home,
  action,
  workout,
  completedActivity,
  alternative,
  dailyDelta,
  decisionQuality,
  goalProjection,
  mentalBoundary,
  todayOptions,
  adaptationEvent,
  trainingAnalytics,
  fuelingOutcomeBaseline,
}: {
  home: PulseHomeScreenData;
  action: PulseNextBestAction | null;
  workout: HomeWorkout | null;
  completedActivity: HomeActivity | null;
  alternative: string;
  dailyDelta: PulseDailyDeltaItem | null;
  decisionQuality: PulseDailyDecisionQualityResponse | null;
  goalProjection: PulseGoalProjectionResponse | null;
  mentalBoundary: DailyDecisionMentalBoundary | null;
  todayOptions: PulseTodayOptionsResponse | null;
  adaptationEvent: PulseAdaptationEvent | null;
  trainingAnalytics: PulseTrainingAnalyticsResponse | null;
  fuelingOutcomeBaseline: PulseFuelingOutcomeBaseline | null;
}): DailyDecisionContract {
  const signals = topSignals(home, workout, completedActivity, action, decisionQuality, goalProjection, mentalBoundary, todayOptions, adaptationEvent, trainingAnalytics, fuelingOutcomeBaseline);

  return {
    leadingFactor: leadingFactorSummary(signals),
    goalImpact: goalImpactSummary(home, workout, completedActivity, goalProjection),
    garminExecution: executionSummary(workout, completedActivity),
    continuity: continuitySummary({ home, action, workout, completedActivity, dailyDelta }),
    safestAlternative: alternative,
    signals,
  };
}

export function deriveDailyDecision(home: PulseHomeScreenData | null | undefined, context: DailyDecisionContext = {}): DailyDecision | null {
  if (!home) return null;

  const action = home.nextBestActions?.[0] ?? null;
  const dailyDelta = context.dailyDelta?.date === home.date ? context.dailyDelta : null;
  const decisionQuality = context.decisionQuality ?? null;
  const goalProjection = context.goalProjection ?? null;
  const mentalBoundary = context.mentalBoundary ?? null;
  const todayOptions = context.todayOptions?.date === home.date ? context.todayOptions : null;
  const adaptationEvent = context.adaptationEvent ?? null;
  const trainingAnalytics = context.trainingAnalytics ?? null;
  const fuelingOutcomeBaseline = context.fuelingOutcomeBaseline ?? null;
  const completedWorkout = completedTodayWorkout(home);
  const offPlanActivity = completedOffPlanActivity(home);
  const todayWorkout = workoutLabel(home);
  const boundary = readinessBoundary(home.readiness?.score, home.fitnessLoad?.tsb);
  if (completedWorkout) {
    const completedLabel = `${activityLabel(completedWorkout.activityType)} · Z${completedWorkout.zone} · ${completedWorkout.durationMin} min`;
    const feedbackDone = hasCompletedWorkoutFeedback(home, completedWorkout);
    const feedbackTargetPath = completedWorkout.completedActivityId
      ? activityDetailPath(completedWorkout.completedActivityId)
      : '/plan?tab=training';
    const steps: DailyDecisionStep[] = [
      { status: 'done', label: 'Training abgeschlossen', detail: completedLabel },
      ...(feedbackDone
        ? [{ status: 'done' as const, label: 'Feedback eingetragen', detail: 'RPE oder Feedback ist bereits gespeichert.' }]
        : [{
            status: 'open' as const,
            label: 'Feedback erfassen',
            detail: 'Kurz RPE und relevante Notizen nachtragen, damit Pulse die Belastung für die nächsten Einheiten sauber einordnet.',
            cta: 'Feedback erfassen',
            targetPath: feedbackTargetPath,
          }]),
      {
        status: 'note',
        label: 'Heute nicht nachlegen',
        detail: 'Kein Zusatztraining nachschieben; Regeneration, Essen/Trinken und Schlaf schützen.',
      },
    ];
    const emptyState = feedbackDone ? 'Für heute ist nichts mehr offen. Training und Feedback sind erledigt.' : undefined;
    const evidence: DailyDecisionEvidence[] = [
      { label: `Erledigt: ${completedLabel}`, targetPath: '/plan?tab=training' },
      { label: `Readiness ${home.readiness.score}/100`, targetPath: '/data?tab=trends#data-recovery' },
      { label: `TSB ${home.fitnessLoad.tsb.toFixed(1)}`, targetPath: '/data?tab=analysis#data-plan-trace' },
    ];
    const reason = 'Die geplante Einheit ist abgeschlossen. Jetzt zählen Feedback, Versorgung und Regeneration stärker als eine weitere Trainingsentscheidung.';
    const alternative = 'Kein Zusatztraining nachschieben; Regeneration, Essen/Trinken und Schlaf schützen.';
    const completionCriterion = emptyState
      ?? 'Feedback erfassen, damit Pulse die Belastung und den nächsten Plan sauber einordnen kann.';
    const contract = buildContract({
      home,
      action,
      workout: completedWorkout,
      completedActivity: completedActivityFor(home, completedWorkout),
      alternative,
      dailyDelta,
      decisionQuality,
      goalProjection,
      mentalBoundary,
      todayOptions,
      adaptationEvent,
      trainingAnalytics,
      fuelingOutcomeBaseline,
    });
    const prompt = [
      'Tagesentscheidung: Training heute erledigt.',
      `Warum: ${reason}`,
      `Grenze: ${boundary}`,
      `Alternative: ${alternative}`,
      `Abschluss: ${completionCriterion}`,
      'Hilf mir, daraus den sinnvollsten Resttag abzuleiten.',
    ].join(' ');

    return {
      title: 'Training heute erledigt',
      reason,
      boundary,
      alternative,
      completionCriterion,
      cta: feedbackDone ? 'Plan ansehen' : 'Feedback erfassen',
      targetPath: feedbackDone ? '/plan?tab=training' : feedbackTargetPath,
      prompt,
      priority: 'normal',
      evidence,
      contract,
      steps,
      emptyState,
      supportCta: 'Coach fragen',
      supportPath: '/coach?focus=daily',
    };
  }

  if (offPlanActivity && !todayWorkout) {
    const completedLabel = completedActivityLabel(offPlanActivity);
    const feedbackDone = offPlanActivity.feedbackLoggedAt != null || offPlanActivity.rpe != null;
    const feedbackTargetPath = activityDetailPath(offPlanActivity.id);
    const steps: DailyDecisionStep[] = [
      { status: 'done', label: 'Garmin-Aktivität abgeschlossen', detail: completedLabel },
      ...(feedbackDone
        ? [{ status: 'done' as const, label: 'Feedback eingetragen', detail: 'RPE oder Feedback ist bereits gespeichert.' }]
        : [{
            status: 'open' as const,
            label: 'Feedback erfassen',
            detail: 'Kurz RPE, Magen/Beine und Auffälligkeiten nachtragen, damit Pulse die ungeplante Belastung einordnet.',
            cta: 'Feedback erfassen',
            targetPath: feedbackTargetPath,
          }]),
      {
        status: 'note',
        label: 'Plan abgleichen',
        detail: 'Heute nicht zusätzlich trainieren; die nächste Planentscheidung sollte diese echte Garmin-Belastung berücksichtigen.',
      },
    ];
    const emptyState = feedbackDone ? 'Für heute ist nichts mehr offen. Garmin-Aktivität und Feedback sind erledigt.' : undefined;
    const evidence: DailyDecisionEvidence[] = [
      { label: `Garmin: ${completedLabel}`, targetPath: feedbackTargetPath },
      { label: `Readiness ${home.readiness.score}/100`, targetPath: '/data?tab=trends#data-recovery' },
      { label: `TSB ${home.fitnessLoad.tsb.toFixed(1)}`, targetPath: '/data?tab=analysis#data-plan-trace' },
    ];
    const reason = 'Garmin hat heute bereits Training erfasst, obwohl kein Pulse-Workout geplant war. Für heute zählt jetzt Feedback, Versorgung und Regeneration statt eine weitere Einheit zu suchen.';
    const alternative = 'Kein Zusatztraining nachschieben; wenn die Aktivität anders geplant war, danach den Plan neu abgleichen.';
    const completionCriterion = emptyState
      ?? 'Feedback erfassen, damit Pulse die ungeplante Belastung in den nächsten Plan einbeziehen kann.';
    const contract = buildContract({
      home,
      action,
      workout: null,
      completedActivity: offPlanActivity,
      alternative,
      dailyDelta,
      decisionQuality,
      goalProjection,
      mentalBoundary,
      todayOptions,
      adaptationEvent,
      trainingAnalytics,
      fuelingOutcomeBaseline,
    });
    const prompt = [
      'Tagesentscheidung: Garmin-Training heute erledigt.',
      `Warum: ${reason}`,
      `Grenze: ${boundary}`,
      `Alternative: ${alternative}`,
      `Abschluss: ${completionCriterion}`,
      'Hilf mir, den Resttag und den nächsten Planabgleich sinnvoll zu gestalten.',
    ].join(' ');

    return {
      title: 'Training heute erledigt',
      reason,
      boundary,
      alternative,
      completionCriterion,
      cta: feedbackDone ? 'Aktivität ansehen' : 'Feedback erfassen',
      targetPath: feedbackTargetPath,
      prompt,
      priority: 'normal',
      evidence,
      contract,
      steps,
      emptyState,
      supportCta: 'Coach fragen',
      supportPath: '/coach?focus=daily',
    };
  }

  const title = action?.title
    ?? (todayWorkout
      ? `Heute ${todayWorkout} entscheiden`
      : 'Heute ist kein Training geplant.');
  const reason = action?.reason
    ?? (todayWorkout
      ? 'Heute steht ein Training an; Readiness, Load und mentale Lage entscheiden über Ausführung oder Anpassung.'
      : 'Ohne geplantes Training zählt heute vor allem, ob Erholung, Check-in und mentale Stabilität sauber abgeschlossen werden.');
  const completionCriterion = action?.resolvedBy
    ?? (todayWorkout
      ? 'Entscheiden, ob du die Einheit ausführst, anpasst oder bewusst verschiebst.'
      : 'Kurz Stimmung, Energie, Stress und Motivation eintragen; danach bleibt Erholung der Default.');
  const alternative = alternativeFor(home, action, todayOptions);
  const fallbackPath = todayWorkout ? '/plan?tab=training' : '/data?tab=today#data-mental';
  const cta = action?.cta ?? (todayWorkout ? 'Workout öffnen' : 'Check-in öffnen');
  const targetPath = action?.targetPath ?? fallbackPath;
  const resultPreview = actionResultPreview(action, fallbackPath);
  const supportCta = !action && !todayWorkout ? 'Coach fragen' : undefined;
  const supportPath = !action && !todayWorkout ? '/coach?focus=daily' : undefined;
  const evidence: DailyDecisionEvidence[] = [
    { label: `Readiness ${home.readiness.score}/100`, targetPath: '/data?tab=trends#data-recovery' },
    { label: `TSB ${home.fitnessLoad.tsb.toFixed(1)}`, targetPath: '/data?tab=analysis#data-plan-trace' },
    ...(todayWorkout ? [`Training ${todayWorkout}`] : []),
    ...(action?.evidence?.map(mapEvidence) ?? []),
  ];
  const decisionWorkout = home.todayWorkout?.plannedDate === home.date ? home.todayWorkout : null;
  const contract = buildContract({
    home,
    action,
    workout: decisionWorkout,
    completedActivity: null,
    alternative,
    dailyDelta,
    decisionQuality,
    goalProjection,
    mentalBoundary,
    todayOptions,
    adaptationEvent,
    trainingAnalytics,
    fuelingOutcomeBaseline,
  });
  const primaryAction = primaryActionForLeadingSignal(contract.signals, { cta, targetPath, resultPreview }, { canOverride: action == null });
  const prompt = [
    `Tagesentscheidung: ${title}.`,
    `Warum: ${reason}`,
    `Grenze: ${boundary}`,
    `Alternative: ${alternative}`,
    `Abschluss: ${completionCriterion}`,
    'Hilf mir, das jetzt konkret für heute zu entscheiden.',
  ].join(' ');

  return {
    title,
    reason,
    boundary,
    alternative,
    completionCriterion,
    resultPreview: primaryAction.resultPreview,
    cta: primaryAction.cta,
    targetPath: primaryAction.targetPath,
    prompt,
    priority: action?.priority ?? 'normal',
    evidence,
    contract,
    supportCta,
    supportPath,
  };
}
