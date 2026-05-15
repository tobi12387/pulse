import type { PulseAdaptationEvent, PulseDailyDecisionQualityResponse, PulseDailyDeltaItem, PulseFuelingOutcomeBaseline, PulseGoalProjectionResponse, PulseHomeScreenData, PulseNextBestAction, PulsePersonalResponseResponse, PulsePersonalResponseSignal, PulseTodayOptionsResponse, PulseTrainingAnalyticsResponse } from '@coaching-os/shared/pulse';
import { activityLabel } from '@/pulse/activity-labels';

export type DailyDecisionEvidence = string | { label: string; targetPath: string };
export type DailyDecisionSignalTone = 'green' | 'amber' | 'rose' | 'accent' | 'muted';

export interface DailyDecisionSignal {
  label: string;
  detail: string;
  tone: DailyDecisionSignalTone;
  targetPath?: string;
  actionLabel?: string;
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
  personalResponse?: PulsePersonalResponseResponse | null;
}

type HomeWorkout = NonNullable<PulseHomeScreenData['todayWorkout']>;
type HomeActivity = PulseHomeScreenData['recentActivities'][number];
type GoalProjection = PulseGoalProjectionResponse['projections'][number];
type HomeDataStatus = PulseHomeScreenData['dataStatus'];
type HomeRecovery = PulseHomeScreenData['recovery'];
type TodayOption = PulseTodayOptionsResponse['options'][number];

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

const fuelingLearningContext = 'Sodium, Hitze und Schweißrate nur notieren, wenn du sie wirklich gemessen hast.';

function sentenceWithoutTrailingPeriod(text: string): string {
  return text.replace(/[.\s]+$/u, '');
}

function fuelingHydrationContext(baseline: PulseFuelingOutcomeBaseline | null | undefined): string {
  const gaps = baseline?.hydrationEvidenceGaps?.filter(Boolean) ?? [];
  const measuredContext = sentenceWithoutTrailingPeriod(baseline?.hydrationContextSummary?.trim() ?? '');
  if (gaps.length === 0) return measuredContext ? `${measuredContext}.` : fuelingLearningContext;
  const gapsText = `Kontextlücken: ${gaps.join(' · ')} ${fuelingLearningContext}`;
  return measuredContext ? `${measuredContext}. ${gapsText}` : gapsText;
}

function fuelingProtectDetail(todayOptions: PulseTodayOptionsResponse | null | undefined): string | null {
  const label = todayOptions?.options
    .flatMap(option => option.signalLabels ?? [])
    .find(signal => signal.kind === 'fueling_protect');
  return label?.detail ?? null;
}

function todayOptionsAdaptiveOption(todayOptions: PulseTodayOptionsResponse | null | undefined): TodayOption | null {
  if (!todayOptions || todayOptions.state !== 'planned_workout') return null;

  return todayOptions.options.find(option => option.priority === 'secondary')
    ?? todayOptions.options.find(option => option.kind === 'rest' || option.kind === 'recovery')
    ?? null;
}

function todayOptionsAdaptiveDetail(todayOptions: PulseTodayOptionsResponse, option: TodayOption): string {
  const signalDetail = option.signalLabels?.[0]?.detail ?? null;
  return [
    todayOptions.summary,
    `${option.title}: ${option.detail}`,
    signalDetail,
  ].filter(Boolean).join(' · ');
}

function everydaySignal(
  todayOptions: PulseTodayOptionsResponse | null | undefined,
  workout: HomeWorkout | null,
  completedActivity: HomeActivity | null,
): DailyDecisionSignal | null {
  if (completedActivity) return null;
  const option = todayOptionsAdaptiveOption(todayOptions);
  if (!todayOptions || !option) return null;
  const openWorkoutDecision = Boolean(workout && workout.status !== 'completed' && !workout.completedActivityId);
  if (!openWorkoutDecision) return null;

  return {
    label: 'Alltag',
    detail: todayOptionsAdaptiveDetail(todayOptions, option),
    tone: option.kind === 'rest' || option.kind === 'recovery' ? 'green' : 'accent',
    targetPath: option.targetPath,
  };
}

function workoutFitLabel(workout: HomeWorkout): string | null {
  if (workout.capabilityFit === 'too_hard_today') return 'Zu hart heute';
  if (workout.capabilityFit === 'stretch') return 'Stretch';
  if (workout.capabilityFit === 'productive') return 'Produktiv';
  if (workout.capabilityFit === 'maintenance') return 'Machbar';
  if (workout.capabilityFit === 'recovery') return 'Recovery';
  return null;
}

function trainingSignalDetail(workout: HomeWorkout): string {
  return [
    `${activityLabel(workout.activityType)} Z${workout.zone} · ${workout.durationMin} min`,
    workoutFitLabel(workout),
  ].filter(Boolean).join(' · ');
}

function easierTodayOption(todayOptions: PulseTodayOptionsResponse | null | undefined): TodayOption | null {
  if (!todayOptions || todayOptions.state !== 'planned_workout') return null;
  return todayOptions.options.find(option => option.priority === 'secondary') ?? null;
}

function trainingSignalTarget(workout: HomeWorkout, todayOptions: PulseTodayOptionsResponse | null | undefined): string {
  if (workout.capabilityFit !== 'too_hard_today') return '/plan?tab=training';
  return easierTodayOption(todayOptions)?.targetPath ?? '/plan?tab=training';
}

function withMentalBoundaryAlternative(
  alternative: string,
  mentalBoundary: DailyDecisionMentalBoundary | null,
): string {
  if (!mentalBoundary) return alternative;
  const label = mentalBoundary.level === 'protect'
    ? 'Schutzmodus zuerst respektieren'
    : 'Mentale Grenze zuerst respektieren';
  return `${label}: ${mentalBoundary.detail} ${alternative}`;
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

function goalPressureAlternative(goalProjection: PulseGoalProjectionResponse | null | undefined): string | null {
  const goal = topGoalProjection(goalProjection);
  if (!goal || goal.status !== 'at_risk') return null;

  const limiter = goal.limiterRisk?.summary ? ` Limiter: ${goal.limiterRisk.summary}.` : '';
  return `Zielintervention: ${goal.nextBestIntervention.title}: ${goal.nextBestIntervention.summary} ${goal.title}: ${goalProbabilityLabel(goal)}.${limiter}`;
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

function dataConfidenceAlternative(signal: DailyDecisionSignal | null): string | null {
  if (!signal) return null;
  const detail = sentenceWithoutTrailingPeriod(signal.detail);
  return `Datenvertrauen zuerst schließen: ${detail}. Empfehlung konservativ halten; frische Garmin-/Profil-Daten prüfen, bevor du Intensität oder Planänderung ableitest.`;
}

function decisionQualityAlternative(signal: DailyDecisionSignal | null): string | null {
  if (!signal || signal.tone === 'green' || signal.tone === 'muted') return null;
  const detail = sentenceWithoutTrailingPeriod(signal.detail);
  return `Lernschleife zuerst schließen: ${detail}. Heute kleiner, anders getaktet oder bewusst pausiert entscheiden, statt denselben offenen Schritt zu wiederholen.`;
}

function recoveryPressureAlternative(recovery: HomeRecovery): string | null {
  if (!recovery) return null;

  const recommendation = sentenceWithoutTrailingPeriod(recovery.recommendation.trim());
  const recommendationSuffix = recommendation ? ` ${recommendation}.` : '';

  if (recovery.sleepDebt7d.status === 'severe') {
    return `Recovery schützen: Schlafdefizit schwer (${recovery.sleepDebt7d.hours.toFixed(1)} h offen) zuerst abbauen; heute keine harte Intensität und keinen Zusatzumfang.${recommendationSuffix}`;
  }
  if (recovery.recoveryScore < 45) {
    return `Recovery schützen: Recovery ${recovery.recoveryScore}/100 respektieren; Belastung klein halten, Schlaf und Versorgung priorisieren.${recommendationSuffix}`;
  }
  if (recovery.hrvDeviation7d.status === 'declining' && recovery.rhrDrift7d.status === 'elevated') {
    return `Recovery schützen: HRV-Abfall und erhöhten Ruhepuls respektieren; nur locker bewegen und morgen neu entscheiden.${recommendationSuffix}`;
  }
  if (recovery.hrvDeviation7d.status === 'declining') {
    return `Recovery schützen: HRV-Abfall respektieren; Intensität kleiner halten und morgen neu entscheiden.${recommendationSuffix}`;
  }
  if (recovery.rhrDrift7d.status === 'elevated') {
    return `Recovery schützen: erhöhten Ruhepuls respektieren; nur locker bewegen und Schlaf/Hydration priorisieren.${recommendationSuffix}`;
  }
  if (recovery.sleepDebt7d.status === 'mild') {
    return `Recovery schützen: Schlafdefizit (${recovery.sleepDebt7d.hours.toFixed(1)} h) nicht vergrößern; lockeren Tag sauber schließen.${recommendationSuffix}`;
  }

  return null;
}

function loadPressureAlternative(tsb: number): string | null {
  if (signalToneForTsb(tsb) !== 'amber') return null;
  return `Belastung zuerst senken: TSB ${tsb.toFixed(1)} zeigt akute Last. Heute Intensität klein halten, keinen Zusatzumfang anhängen und morgen mit frischer Load-Evidenz neu entscheiden.`;
}

function readinessAlternative(score: number): string | null {
  const tone = signalToneForReadiness(score);
  if (tone !== 'rose' && tone !== 'amber') return null;
  if (tone === 'rose') {
    return `Körper zuerst schützen: Readiness ${score}/100 respektieren; heute keine harte Intensität, keinen Zusatzumfang und erst nach Warm-up entscheiden, ob locker bewegen reicht.`;
  }
  return `Körper zuerst dosieren: Readiness ${score}/100 ist nur bedingt stabil; harte Spitzen klein halten und die Einheit bewusst kürzer schließen, wenn der Warm-up nicht passt.`;
}

function garminExecutionAlternative(workout: HomeWorkout | null): string | null {
  const signal = garminExecutionSignal(workout, null);
  if (!signal) return null;
  return `Garmin zuerst schließen: ${signal.detail} vor Ausführung Plan > Ausfuehrung prüfen; Plan oder Garmin ändern sich erst nach deinem Klick.`;
}

function personalResponseAlternative(signal: DailyDecisionSignal | null): string | null {
  if (!signal) return null;
  const detail = sentenceWithoutTrailingPeriod(signal.detail);
  return `Persönliche Reaktion zuerst einplanen: ${detail}. Heute Boundary, Warm-up und Umfang bewusst klein halten; Plan oder Garmin bleiben unverändert, bis du die Reaktion geprüft hast.`;
}

function adaptationAlternative(event: PulseAdaptationEvent | null | undefined): string | null {
  const signal = adaptationSignal(event);
  if (!signal) return null;
  const detail = sentenceWithoutTrailingPeriod(signal.detail);
  return `Plananpassung zuerst prüfen: ${detail}. Heute keine Ausführung bestätigen, bis diese offene Anpassung bewusst geprüft ist.`;
}

function analysisAlternative(
  trainingAnalytics: PulseTrainingAnalyticsResponse | null | undefined,
  workout: HomeWorkout | null,
): string | null {
  const signal = analysisSignal(trainingAnalytics, workout, null);
  if (!signal) return null;
  const detail = sentenceWithoutTrailingPeriod(signal.detail);
  return `Analyse zuerst prüfen: ${detail}. Heute keine Ausführung oder Anpassung bestätigen, bis der Durability-Limiter bewusst geprüft ist.`;
}

function trainingFitAlternative(
  workout: HomeWorkout | null,
  todayOptions: PulseTodayOptionsResponse | null | undefined,
): string | null {
  if (!workout || workout.capabilityFit !== 'too_hard_today') return null;

  const easierOption = easierTodayOption(todayOptions);
  const easierText = easierOption
    ? `${easierOption.title}: ${easierOption.detail}`
    : 'Plan öffnen und Reiz leichter, kürzer oder verschoben entscheiden';

  return `Training zuerst entschärfen: ${trainingSignalDetail(workout)}. ${workoutFitLabel(workout)}. ${easierText}; heute keine Ausführung bestätigen, bis die Einheit bewusst leichter geplant ist.`;
}

function trainingStretchAlternative(workout: HomeWorkout | null): string | null {
  if (!workout || workout.capabilityFit !== 'stretch') return null;
  return `Stretch kontrolliert ausführen: ${trainingSignalDetail(workout)}. Warm-up, Fueling und Tagesform als Grenze nutzen; wenn der erste Block nicht passt, sofort auf Z2 senken, kürzer schließen oder Plan-Alternative prüfen.`;
}

function trainingExecutionAlternative(workout: HomeWorkout | null): string | null {
  if (!workout) return null;

  if (workout.capabilityFit === 'productive') {
    return `Produktiven Trainingsreiz ausführen: ${trainingSignalDetail(workout)}. Warm-up als letzte Grenze nutzen, den geplanten Reiz sauber schließen und keinen Zusatzumfang anhängen; bei auffälliger Tagesform kürzer oder Z2 fertigfahren.`;
  }

  if (workout.capabilityFit === 'recovery') {
    return `Recovery-Einheit ruhig schließen: ${trainingSignalDetail(workout)}. Beine bewegen, Atmung und Lockerheit priorisieren, keine Reizsuche und keinen Zusatzumfang anhängen; wenn es nicht erholt, Einheit kürzen.`;
  }

  if (workout.capabilityFit === 'maintenance') {
    return `Machbare Einheit ruhig ausführen: ${trainingSignalDetail(workout)}. Wochenstruktur halten, aber bewusst ohne Zusatzumfang schließen und bei schlechter Tagesform locker kürzen.`;
  }

  return null;
}

function alternativeFor(
  home: PulseHomeScreenData,
  action: PulseNextBestAction | null,
  todayOptions: PulseTodayOptionsResponse | null,
  fuelingOutcomeBaseline: PulseFuelingOutcomeBaseline | null,
  decisionQuality: PulseDailyDecisionQualityResponse | null,
  adaptationEvent: PulseAdaptationEvent | null,
  trainingAnalytics: PulseTrainingAnalyticsResponse | null,
  goalProjection: PulseGoalProjectionResponse | null,
  mentalBoundary: DailyDecisionMentalBoundary | null,
  personalResponse: PulsePersonalResponseResponse | null,
): string {
  const workout = home.todayWorkout?.plannedDate === home.date ? home.todayWorkout : home.nextWorkout;
  const todayWorkout = workout?.plannedDate === home.date ? workout : null;
  const fuelingDebt = openFuelingDebt(todayOptions);
  const fuelingLearningOpen = Boolean(fuelingOutcomeBaseline?.learningReadiness && !fuelingOutcomeBaseline.learningReadiness.readyForTrendSummary);
  const adaptiveOption = todayOptionsAdaptiveOption(todayOptions);
  const dataSignal = dataConfidenceSignal(home.dataStatus);
  const dataAlternative = dataConfidenceAlternative(dataSignal);
  const qualitySignal = decisionQualitySignal(decisionQuality);
  const qualityAlternative = decisionQualityAlternative(qualitySignal);
  const recoveryAlternative = recoveryPressureAlternative(home.recovery);
  const planAdaptationAlternative = adaptationAlternative(adaptationEvent);
  const durabilityAlternative = analysisAlternative(trainingAnalytics, todayWorkout);
  const trainingAlternative = trainingFitAlternative(todayWorkout, todayOptions);
  const stretchAlternative = trainingStretchAlternative(todayWorkout);
  const executionAlternative = trainingExecutionAlternative(todayWorkout);
  const goalAlternative = goalPressureAlternative(goalProjection);
  const garminAlternative = todayWorkout ? garminExecutionAlternative(todayWorkout) : null;
  const responseSignal = personalResponseSignal(personalResponse, todayWorkout, null, mentalBoundary);
  const responseAlternative = personalResponseAlternative(responseSignal);
  const loadAlternative = loadPressureAlternative(home.fitnessLoad.tsb);
  const bodyAlternative = readinessAlternative(home.readiness.score);
  let alternative: string;

  if (action?.source === 'checkin') {
    alternative = 'Kurz in Coach oder Data einchecken; wenn wenig Zeit ist, nur Kopf, Energie und Stress notieren.';
  } else if (action?.source === 'risk') {
    alternative = 'Training heute aktiv entschärfen oder pausieren, bis das Risk-Signal geprüft ist.';
  } else if (dataAlternative && dataSignal?.tone === 'rose') {
    alternative = dataAlternative;
  } else if (qualityAlternative && qualitySignal?.tone === 'rose') {
    alternative = qualityAlternative;
  } else if (recoveryAlternative) {
    alternative = recoveryAlternative;
  } else if (bodyAlternative && signalToneForReadiness(home.readiness.score) === 'rose') {
    alternative = bodyAlternative;
  } else if (trainingAlternative) {
    alternative = trainingAlternative;
  } else if (planAdaptationAlternative) {
    alternative = planAdaptationAlternative;
  } else if (durabilityAlternative) {
    alternative = durabilityAlternative;
  } else if (qualityAlternative) {
    alternative = qualityAlternative;
  } else if (dataAlternative) {
    alternative = dataAlternative;
  } else if (goalAlternative) {
    alternative = goalAlternative;
  } else if (fuelingDebt) {
    alternative = `Fueling-Schutz zuerst schließen: ${fuelingDebt.closureCondition}`;
  } else if (todayWorkout && fuelingLearningOpen && isFuelingLearningWorkout(todayWorkout)) {
    const target = fuelingOutcomeBaseline?.targetCarbsPerHour
      ? `${fuelingOutcomeBaseline.targetCarbsPerHour.min}-${fuelingOutcomeBaseline.targetCarbsPerHour.max} g/h kontrolliert testen, `
      : '';
    alternative = `Fueling-Lernlog vollständig erfassen: ${target}Dauer/Carbs/GI-Komfort notieren; ${fuelingHydrationContext(fuelingOutcomeBaseline)} Bei Magen- oder Readiness-Problemen locker kürzen statt Ziel-Carbs erzwingen.`;
  } else if (garminAlternative) {
    alternative = garminAlternative;
  } else if (loadAlternative) {
    alternative = loadAlternative;
  } else if (todayWorkout && adaptiveOption) {
    alternative = `Alltagsoption: ${adaptiveOption.title}: ${adaptiveOption.detail}`;
  } else if (responseAlternative) {
    alternative = responseAlternative;
  } else if (bodyAlternative) {
    alternative = bodyAlternative;
  } else if (stretchAlternative) {
    alternative = stretchAlternative;
  } else if (executionAlternative) {
    alternative = executionAlternative;
  } else if (todayWorkout && todayWorkout.zone >= 3) {
    alternative = 'Auf Z2 senken oder im Plan eine kürzere Alternative wählen, falls die Grenze nicht passt.';
  } else if (todayWorkout) {
    alternative = 'Einheit locker halten oder bewusst verschieben, wenn Check-in oder Readiness dagegen sprechen.';
  } else if (workout) {
    alternative = 'Freien Tag als Vorbereitung nutzen: Schlaf, Mobility, mentale Entlastung und kurze Planprüfung.';
  } else {
    alternative = 'Erholungstag bewusst schließen oder im Plan neue Verfügbarkeit setzen, falls Training doch geplant werden soll.';
  }

  return withMentalBoundaryAlternative(alternative, mentalBoundary);
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
    const mentalDataTarget = action?.source === 'checkin'
      || action?.source === 'mental'
      || targetPath.includes('#data-mental')
      || targetPath.includes('tab=mental');
    if (!mentalDataTarget) {
      return 'Pulse öffnet die Evidenz; Plan und Garmin bleiben unverändert.';
    }
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
  Alltag: 5,
  Garmin: 5,
  Reaktion: 6,
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
  if (signal.label === 'Mental') return signal.actionLabel ?? 'Check-in öffnen';
  if (signal.label === 'Recovery') return 'Recovery ansehen';
  if (signal.label === 'Lernen') return 'Lernen prüfen';
  if (signal.label === 'Analyse') return 'Analyse prüfen';
  if (signal.label === 'Fueling-Lernen') return 'Fueling vorbereiten';
  if (signal.label === 'Alltag') return 'Alternative prüfen';
  if (signal.label === 'Garmin') return 'Garmin prüfen';
  if (signal.label === 'Reaktion') return 'Reaktion prüfen';
  if (signal.label === 'Ziel') return signal.actionLabel ?? 'Ziel prüfen';
  if (signal.label === 'Belastung') return 'Belastung prüfen';
  if (signal.label === 'Koerper') return 'Readiness prüfen';
  if (signal.label === 'Training' && signal.tone === 'rose') return 'Training anpassen';
  if (signal.label === 'Training' && signal.tone === 'amber') return 'Training prüfen';
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
    targetPath: '/data?tab=analysis#data-plan-trace',
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

  const detail = trainingAnalytics?.powerDuration?.durabilityLine
    ?? `Durability ${durability.rating}: ${durability.evidence.join(' · ')}`;

  return {
    label: 'Analyse',
    detail: `${detail}. Nächste Handlung: Durability-Limiter prüfen, bevor du Ausführung oder Anpassung bestätigst.`,
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

function isFuelingLearningActivity(activity: HomeActivity | null): boolean {
  if (!activity) return false;
  const isFuelingSport = activity.activityType === 'bike' || activity.activityType === 'run' || activity.activityType === 'hike';
  if (!isFuelingSport) return false;
  return (activity.durationSec ?? 0) >= 75 * 60
    || /fueling|verpflegung|magen|gi/i.test(activity.name ?? '');
}

function fuelingReadinessDetail(baseline: PulseFuelingOutcomeBaseline | null | undefined): string | null {
  const readiness = baseline?.learningReadiness ?? null;
  if (!readiness || readiness.readyForTrendSummary) return null;

  const missing = readiness.missingEvidence[0] ?? 'Vergleichbare During-Logs fehlen noch.';
  const nextAction = readiness.nextAction ?? null;
  if (nextAction && nextAction.kind !== 'log_next_long_session') {
    return `Trend-Evidenz ${readiness.comparableCompleteLogs}/${readiness.requiredComparableCompleteLogs}: ${sentenceWithoutTrailingPeriod(missing)}. Nächste Evidence: ${nextAction.label}; ${sentenceWithoutTrailingPeriod(nextAction.detail)}.`;
  }

  const target = baseline?.targetCarbsPerHour
    ? ` Nächster Lernlog: ${baseline.targetCarbsPerHour.min}-${baseline.targetCarbsPerHour.max} g/h kontrolliert testen;`
    : ' Nächster Lernlog:';
  return `Trend-Evidenz ${readiness.comparableCompleteLogs}/${readiness.requiredComparableCompleteLogs}: ${sentenceWithoutTrailingPeriod(missing)}.${target} Dauer, Carbs und GI-Komfort zusammen erfassen. ${fuelingHydrationContext(baseline)}`;
}

function fuelingTrendDetail(baseline: PulseFuelingOutcomeBaseline | null | undefined): string | null {
  const readiness = baseline?.learningReadiness ?? null;
  const trendSummary = sentenceWithoutTrailingPeriod(baseline?.trendSummary?.trim() ?? '');
  if (!readiness?.readyForTrendSummary || !trendSummary) return null;
  return `${trendSummary}. Nächste Handlung: als Ausgangspunkt nutzen und nur klein verändern.`;
}

function fuelingEvidenceCompletionAction(
  baseline: PulseFuelingOutcomeBaseline | null | undefined,
): { detail: string; cta: string } {
  const nextAction = baseline?.learningReadiness?.nextAction ?? null;
  if (nextAction && nextAction.kind !== 'log_next_long_session') {
    return {
      detail: '',
      cta: nextAction.label,
    };
  }

  const missingEvidence = baseline?.learningReadiness?.missingEvidence ?? [];
  const hasStructuredGiGap = missingEvidence.some(item =>
    item.toLocaleLowerCase('de-DE').includes('gi-komfort fehlt strukturiert'));
  const hasStructuredCarbGap = missingEvidence.some(item =>
    item.toLocaleLowerCase('de-DE').includes('carbs fehlen strukturiert'));

  if (hasStructuredGiGap && !hasStructuredCarbGap) {
    return {
      detail: 'GI-Komfort am bestehenden During-Log ergänzen, damit der vorhandene Carb-Log für die Fueling-Baseline zählt.',
      cta: 'GI-Komfort ergänzen',
    };
  }

  return {
    detail: 'Carbs, Flaschen/Pulver und GI-Komfort prüfen oder nachtragen, damit Pulse die Fueling-Baseline lernt.',
    cta: 'Fueling loggen',
  };
}

function activityFuelingTargetPath(activity: HomeActivity): string {
  return `${activityDetailPath(activity.id)}#activity-fueling-log`;
}

function fuelingClosureStep(
  baseline: PulseFuelingOutcomeBaseline | null | undefined,
  activity: HomeActivity | null,
  workout: HomeWorkout | null,
): DailyDecisionStep | null {
  if (!activity || (!isFuelingLearningWorkout(workout) && !isFuelingLearningActivity(activity))) return null;

  const readinessDetail = fuelingReadinessDetail(baseline);
  if (!readinessDetail) return null;
  const completionAction = fuelingEvidenceCompletionAction(baseline);

  return {
    status: 'open',
    label: 'Fueling-Log prüfen',
    detail: [
      `${sentenceWithoutTrailingPeriod(readinessDetail)}.`,
      completionAction.detail,
    ].filter(Boolean).join(' '),
    cta: completionAction.cta,
    targetPath: activityFuelingTargetPath(activity),
  };
}

function fuelingLearningSignal(
  baseline: PulseFuelingOutcomeBaseline | null | undefined,
  workout: HomeWorkout | null,
  completedActivity: HomeActivity | null,
): DailyDecisionSignal | null {
  const openWorkoutDecision = Boolean(workout && !completedActivity && workout.status !== 'completed' && !workout.completedActivityId);
  const completedFuelingDecision = Boolean(completedActivity && (isFuelingLearningWorkout(workout) || isFuelingLearningActivity(completedActivity)));
  if ((!openWorkoutDecision || !isFuelingLearningWorkout(workout)) && !completedFuelingDecision) return null;

  const readinessDetail = fuelingReadinessDetail(baseline);
  const trendDetail = openWorkoutDecision ? fuelingTrendDetail(baseline) : null;
  const detail = readinessDetail ?? trendDetail;
  if (!detail) return null;

  return {
    label: 'Fueling-Lernen',
    detail,
    tone: readinessDetail ? 'amber' : 'accent',
    targetPath: completedActivity
      ? activityFuelingTargetPath(completedActivity)
      : `/plan?tab=training&source=fueling-learning&workoutId=${encodeURIComponent(workout!.id)}#workout-fueling-baseline`,
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

const personalResponseKindPriority: Record<PulsePersonalResponseSignal['kind'], number> = {
  mental_response: 0,
  recovery_response: 1,
  load_response: 2,
  fueling_response: 3,
  execution_response: 4,
};

function personalResponseSignalRank(signal: PulsePersonalResponseSignal): number {
  return signal.strength === 'useful' ? 0 : signal.strength === 'learning' ? 1 : 2;
}

function personalResponseSignal(
  personalResponse: PulsePersonalResponseResponse | null | undefined,
  workout: HomeWorkout | null,
  completedActivity: HomeActivity | null,
  mentalBoundary: DailyDecisionMentalBoundary | null,
): DailyDecisionSignal | null {
  const openWorkoutDecision = Boolean(workout && !completedActivity && workout.status !== 'completed' && !workout.completedActivityId);
  if (!openWorkoutDecision || mentalBoundary) return null;

  const signal = personalResponse?.summary.signals
    .filter(item => item.strength !== 'insufficient')
    .sort((a, b) => (
      personalResponseSignalRank(a) - personalResponseSignalRank(b)
      || personalResponseKindPriority[a.kind] - personalResponseKindPriority[b.kind]
    ))[0] ?? null;
  if (!signal) return null;

  return {
    label: 'Reaktion',
    detail: [
      `${signal.label}: ${signal.nextAdjustment}`,
      signal.evidence[0] ?? null,
    ].filter(Boolean).join(' · '),
    tone: 'amber',
    targetPath: '/data?tab=analysis#data-personal-response',
  };
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
  personalResponse: PulsePersonalResponseResponse | null,
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
  const responsePattern = personalResponseSignal(personalResponse, workout, completedActivity, mentalBoundary);
  const everyday = everydaySignal(todayOptions, workout, completedActivity);

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
  if (responsePattern) {
    signals.push(responsePattern);
  }
  if (everyday) {
    signals.push(everyday);
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
      actionLabel: 'Mental prüfen',
    });
  }

  if (goal) {
    signals.push({
      label: 'Ziel',
      detail: `${goal.title}: ${goalProbabilityLabel(goal)} · ${goal.nextBestIntervention.title}`,
      tone: goalSignalTone(goal),
      targetPath: goal.nextBestIntervention.targetPath,
      actionLabel: goal.nextBestIntervention.actionLabel,
    });
  }

  if (workout) {
    signals.push({
      label: 'Training',
      detail: trainingSignalDetail(workout),
      tone: workout.capabilityFit === 'too_hard_today' ? 'rose' : workout.capabilityFit === 'stretch' ? 'amber' : 'accent',
      targetPath: trainingSignalTarget(workout, todayOptions),
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
  personalResponse,
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
  personalResponse: PulsePersonalResponseResponse | null;
}): DailyDecisionContract {
  const signals = topSignals(home, workout, completedActivity, action, decisionQuality, goalProjection, mentalBoundary, todayOptions, adaptationEvent, trainingAnalytics, fuelingOutcomeBaseline, personalResponse);

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
  const personalResponse = context.personalResponse ?? null;
  const completedWorkout = completedTodayWorkout(home);
  const offPlanActivity = completedOffPlanActivity(home);
  const todayWorkout = workoutLabel(home);
  const boundary = readinessBoundary(home.readiness?.score, home.fitnessLoad?.tsb);
  if (completedWorkout) {
    const completedLabel = `${activityLabel(completedWorkout.activityType)} · Z${completedWorkout.zone} · ${completedWorkout.durationMin} min`;
    const feedbackDone = hasCompletedWorkoutFeedback(home, completedWorkout);
    const completedActivity = completedActivityFor(home, completedWorkout);
    const feedbackTargetPath = completedWorkout.completedActivityId
      ? activityDetailPath(completedWorkout.completedActivityId)
      : '/plan?tab=training';
    const fuelingStep = fuelingClosureStep(fuelingOutcomeBaseline, completedActivity, completedWorkout);
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
      ...(fuelingStep ? [fuelingStep] : []),
      {
        status: 'note',
        label: 'Heute nicht nachlegen',
        detail: 'Kein Zusatztraining nachschieben; Regeneration, Essen/Trinken und Schlaf schützen.',
      },
    ];
    const firstOpenStep = steps.find(step => step.status === 'open');
    const emptyState = feedbackDone && !firstOpenStep ? 'Für heute ist nichts mehr offen. Training und Feedback sind erledigt.' : undefined;
    const evidence: DailyDecisionEvidence[] = [
      { label: `Erledigt: ${completedLabel}`, targetPath: '/plan?tab=training' },
      ...(fuelingStep?.targetPath
        ? [{ label: fuelingReadinessDetail(fuelingOutcomeBaseline) ?? 'Fueling-Evidenz offen', targetPath: fuelingStep.targetPath }]
        : []),
      { label: `Readiness ${home.readiness.score}/100`, targetPath: '/data?tab=trends#data-recovery' },
      { label: `TSB ${home.fitnessLoad.tsb.toFixed(1)}`, targetPath: '/data?tab=analysis#data-plan-trace' },
    ];
    const reason = 'Die geplante Einheit ist abgeschlossen. Jetzt zählen Feedback, Versorgung und Regeneration stärker als eine weitere Trainingsentscheidung.';
    const alternative = 'Kein Zusatztraining nachschieben; Regeneration, Essen/Trinken und Schlaf schützen.';
    const completionCriterion = emptyState
      ?? firstOpenStep?.detail
      ?? 'Feedback erfassen, damit Pulse die Belastung und den nächsten Plan sauber einordnen kann.';
    const contract = buildContract({
      home,
      action,
      workout: completedWorkout,
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
      personalResponse,
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
      cta: firstOpenStep?.cta ?? (feedbackDone ? 'Plan ansehen' : 'Feedback erfassen'),
      targetPath: firstOpenStep?.targetPath ?? (feedbackDone ? '/plan?tab=training' : feedbackTargetPath),
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
    const fuelingStep = fuelingClosureStep(fuelingOutcomeBaseline, offPlanActivity, null);
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
      ...(fuelingStep ? [fuelingStep] : []),
      {
        status: 'note',
        label: 'Plan abgleichen',
        detail: 'Heute nicht zusätzlich trainieren; die nächste Planentscheidung sollte diese echte Garmin-Belastung berücksichtigen.',
      },
    ];
    const firstOpenStep = steps.find(step => step.status === 'open');
    const emptyState = feedbackDone && !firstOpenStep ? 'Für heute ist nichts mehr offen. Garmin-Aktivität und Feedback sind erledigt.' : undefined;
    const evidence: DailyDecisionEvidence[] = [
      { label: `Garmin: ${completedLabel}`, targetPath: feedbackTargetPath },
      ...(fuelingStep?.targetPath
        ? [{ label: fuelingReadinessDetail(fuelingOutcomeBaseline) ?? 'Fueling-Evidenz offen', targetPath: fuelingStep.targetPath }]
        : []),
      { label: `Readiness ${home.readiness.score}/100`, targetPath: '/data?tab=trends#data-recovery' },
      { label: `TSB ${home.fitnessLoad.tsb.toFixed(1)}`, targetPath: '/data?tab=analysis#data-plan-trace' },
    ];
    const reason = 'Garmin hat heute bereits Training erfasst, obwohl kein Pulse-Workout geplant war. Für heute zählt jetzt Feedback, Versorgung und Regeneration statt eine weitere Einheit zu suchen.';
    const alternative = 'Kein Zusatztraining nachschieben; wenn die Aktivität anders geplant war, danach den Plan neu abgleichen.';
    const completionCriterion = emptyState
      ?? firstOpenStep?.detail
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
      personalResponse,
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
      cta: firstOpenStep?.cta ?? (feedbackDone ? 'Aktivität ansehen' : 'Feedback erfassen'),
      targetPath: firstOpenStep?.targetPath ?? feedbackTargetPath,
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
  const alternative = alternativeFor(home, action, todayOptions, fuelingOutcomeBaseline, decisionQuality, adaptationEvent, trainingAnalytics, goalProjection, mentalBoundary, personalResponse);
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
    personalResponse,
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
