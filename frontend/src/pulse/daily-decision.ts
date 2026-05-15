import type { PulseDailyDeltaItem, PulseHomeScreenData, PulseNextBestAction, PulseTodayOptionsResponse } from '@coaching-os/shared/pulse';
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
  goalImpact: string;
  garminExecution: string;
  continuity: string;
  safestAlternative: string;
  signals: DailyDecisionSignal[];
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

export interface DailyDecisionContext {
  dailyDelta?: PulseDailyDeltaItem | null;
  todayOptions?: PulseTodayOptionsResponse | null;
}

type HomeWorkout = NonNullable<PulseHomeScreenData['todayWorkout']>;
type HomeActivity = PulseHomeScreenData['recentActivities'][number];

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

function goalImpactSummary(home: PulseHomeScreenData, workout: HomeWorkout | null, completedActivity: HomeActivity | null): string {
  if (workout?.status === 'completed' || workout?.completedActivityId) {
    return 'Zielwirkung: Reiz als erledigt behandeln; Feedback macht die naechste Planung genauer.';
  }
  if (completedActivity) {
    return 'Zielwirkung: ungeplante Belastung in die naechste Planentscheidung einrechnen.';
  }
  if (workout) {
    if (workout.capabilityFit === 'too_hard_today') return 'Zielwirkung: Fortschritt schuetzen, aber heute keine zu harte Einheit erzwingen.';
    if (workout.capabilityFit === 'stretch') return 'Zielwirkung: kontrollierter Reiz, solange Readiness und Grenze passen.';
    if (workout.capabilityFit === 'productive') return 'Zielwirkung: produktiver Trainingsreiz im Wochenziel.';
    return 'Zielwirkung: Wochenstruktur halten, ohne Zusatzumfang zu erzwingen.';
  }
  if (home.nextWorkout) {
    return 'Zielwirkung: Erholung heute verbessert die Qualitaet der naechsten Einheit.';
  }
  return 'Zielwirkung: Erholung und mentaler Check-in halten die Routine stabil.';
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
  todayOptions: PulseTodayOptionsResponse | null,
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

  if (fuelingDebt) {
    const protectDetail = fuelingProtectDetail(todayOptions);
    signals.push({
      label: 'Fueling',
      detail: `${fuelingDebt.label}: ${protectDetail ?? fuelingDebt.summary}`,
      tone: 'amber',
      targetPath: fuelingDebt.followUpActivityId ? activityDetailPath(fuelingDebt.followUpActivityId) : '/data?tab=trends#data-recovery',
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

  if (action?.source === 'checkin' || action?.source === 'mental') {
    signals.push({
      label: 'Mental',
      detail: action.source === 'checkin' ? 'Check-in offen' : action.title,
      tone: action.priority === 'critical' ? 'rose' : action.priority === 'high' ? 'amber' : 'accent',
      targetPath: action.targetPath,
    });
  }

  return signals.slice(0, 4);
}

function buildContract({
  home,
  action,
  workout,
  completedActivity,
  alternative,
  dailyDelta,
  todayOptions,
}: {
  home: PulseHomeScreenData;
  action: PulseNextBestAction | null;
  workout: HomeWorkout | null;
  completedActivity: HomeActivity | null;
  alternative: string;
  dailyDelta: PulseDailyDeltaItem | null;
  todayOptions: PulseTodayOptionsResponse | null;
}): DailyDecisionContract {
  return {
    goalImpact: goalImpactSummary(home, workout, completedActivity),
    garminExecution: executionSummary(workout, completedActivity),
    continuity: continuitySummary({ home, action, workout, completedActivity, dailyDelta }),
    safestAlternative: alternative,
    signals: topSignals(home, workout, completedActivity, action, todayOptions),
  };
}

export function deriveDailyDecision(home: PulseHomeScreenData | null | undefined, context: DailyDecisionContext = {}): DailyDecision | null {
  if (!home) return null;

  const action = home.nextBestActions?.[0] ?? null;
  const dailyDelta = context.dailyDelta?.date === home.date ? context.dailyDelta : null;
  const todayOptions = context.todayOptions?.date === home.date ? context.todayOptions : null;
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
      todayOptions,
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
      todayOptions,
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
    todayOptions,
  });
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
    resultPreview,
    cta,
    targetPath,
    prompt,
    priority: action?.priority ?? 'normal',
    evidence,
    contract,
    supportCta,
    supportPath,
  };
}
