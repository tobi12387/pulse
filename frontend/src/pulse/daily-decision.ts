import type { PulseHomeScreenData, PulseNextBestAction } from '@coaching-os/shared/pulse';

export type DailyDecisionEvidence = string | { label: string; targetPath: string };
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
  cta: string;
  targetPath: string;
  prompt: string;
  priority: PulseNextBestAction['priority'];
  evidence: DailyDecisionEvidence[];
  steps?: DailyDecisionStep[];
  emptyState?: string;
  supportCta?: string;
  supportPath?: string;
}

type HomeWorkout = NonNullable<PulseHomeScreenData['todayWorkout']>;
type HomeActivity = PulseHomeScreenData['recentActivities'][number];

function readinessBoundary(score: number | null | undefined, tsb: number | null | undefined): string {
  if (score != null && score < 55) return 'Heute defensiv bleiben: keine harte Intensität erzwingen.';
  if (score != null && score < 70) return 'Belastung sauber dosieren und harte Spitzen nur bewusst setzen.';
  if (tsb != null && tsb < -10) return 'Form ist belastet: Umfang oder Intensität nicht zusätzlich ausweiten.';
  return 'Normal planen, aber nicht über die heutige Entscheidung hinaus verlängern.';
}

function workoutLabel(home: PulseHomeScreenData): string | null {
  const workout = home.todayWorkout?.plannedDate === home.date ? home.todayWorkout : home.nextWorkout;
  if (!workout || workout.plannedDate !== home.date) return null;
  return `${workout.activityType} · Z${workout.zone} · ${workout.durationMin} min`;
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

function activityLabel(activity: HomeActivity): string {
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

function alternativeFor(home: PulseHomeScreenData, action: PulseNextBestAction | null): string {
  const workout = home.todayWorkout?.plannedDate === home.date ? home.todayWorkout : home.nextWorkout;
  const todayWorkout = workout?.plannedDate === home.date ? workout : null;

  if (action?.source === 'checkin') {
    return 'Kurz in Coach oder Data einchecken; wenn wenig Zeit ist, nur Kopf, Energie und Stress notieren.';
  }
  if (action?.source === 'risk') {
    return 'Training heute aktiv entschärfen oder pausieren, bis das Risk-Signal geprüft ist.';
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
    return { label: item, targetPath: '/data?tab=mental#data-mental' };
  }
  if (normalized.includes('garmin') || normalized.includes('abdeckung') || normalized.includes('coverage')) {
    return { label: item, targetPath: '/data?tab=coverage#data-garmin-quality' };
  }
  if (
    normalized.includes('tsb') ||
    normalized.includes('ctl') ||
    normalized.includes('atl') ||
    normalized.includes('load') ||
    normalized.includes('risiko') ||
    normalized.includes('risk')
  ) {
    return { label: item, targetPath: '/data?tab=analysen#data-plan-trace' };
  }
  return item;
}

export function deriveDailyDecision(home: PulseHomeScreenData | null | undefined): DailyDecision | null {
  if (!home) return null;

  const action = home.nextBestActions?.[0] ?? null;
  const completedWorkout = completedTodayWorkout(home);
  const offPlanActivity = completedOffPlanActivity(home);
  const todayWorkout = workoutLabel(home);
  const boundary = readinessBoundary(home.readiness?.score, home.fitnessLoad?.tsb);
  if (completedWorkout) {
    const completedLabel = `${completedWorkout.activityType} · Z${completedWorkout.zone} · ${completedWorkout.durationMin} min`;
    const feedbackDone = hasCompletedWorkoutFeedback(home, completedWorkout);
    const feedbackTargetPath = completedWorkout.completedActivityId
      ? `/activity/${completedWorkout.completedActivityId}`
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
      { label: `Readiness ${home.readiness.score}/100`, targetPath: '/data#data-recovery' },
      { label: `TSB ${home.fitnessLoad.tsb.toFixed(1)}`, targetPath: '/data?tab=analysen#data-plan-trace' },
    ];
    const reason = 'Die geplante Einheit ist abgeschlossen. Jetzt zählen Feedback, Versorgung und Regeneration stärker als eine weitere Trainingsentscheidung.';
    const alternative = 'Kein Zusatztraining nachschieben; Regeneration, Essen/Trinken und Schlaf schützen.';
    const completionCriterion = emptyState
      ?? 'Feedback erfassen, damit Pulse die Belastung und den nächsten Plan sauber einordnen kann.';
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
      steps,
      emptyState,
      supportCta: 'Coach fragen',
      supportPath: '/coach?focus=daily',
    };
  }

  if (offPlanActivity && !todayWorkout) {
    const completedLabel = activityLabel(offPlanActivity);
    const feedbackDone = offPlanActivity.feedbackLoggedAt != null || offPlanActivity.rpe != null;
    const feedbackTargetPath = `/activity/${offPlanActivity.id}`;
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
      { label: `Readiness ${home.readiness.score}/100`, targetPath: '/data#data-recovery' },
      { label: `TSB ${home.fitnessLoad.tsb.toFixed(1)}`, targetPath: '/data?tab=analysen#data-plan-trace' },
    ];
    const reason = 'Garmin hat heute bereits Training erfasst, obwohl kein Pulse-Workout geplant war. Für heute zählt jetzt Feedback, Versorgung und Regeneration statt eine weitere Einheit zu suchen.';
    const alternative = 'Kein Zusatztraining nachschieben; wenn die Aktivität anders geplant war, danach den Plan neu abgleichen.';
    const completionCriterion = emptyState
      ?? 'Feedback erfassen, damit Pulse die ungeplante Belastung in den nächsten Plan einbeziehen kann.';
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
      ? 'Entscheidung zur Einheit treffen und bei Anpassung den Plan aktualisieren.'
      : 'Check-in abschließen und einen klaren Erholungsanker für heute setzen.');
  const alternative = alternativeFor(home, action);
  const cta = action?.cta ?? (todayWorkout ? 'Plan prüfen' : 'Erholungstag abschliessen');
  const targetPath = action?.targetPath ?? (todayWorkout ? '/plan?tab=training' : '/');
  const supportCta = !action && !todayWorkout ? 'Coach fragen' : undefined;
  const supportPath = !action && !todayWorkout ? '/coach?focus=daily' : undefined;
  const evidence: DailyDecisionEvidence[] = [
    { label: `Readiness ${home.readiness.score}/100`, targetPath: '/data#data-recovery' },
    { label: `TSB ${home.fitnessLoad.tsb.toFixed(1)}`, targetPath: '/data?tab=analysen#data-plan-trace' },
    ...(todayWorkout ? [`Training ${todayWorkout}`] : []),
    ...(action?.evidence?.map(mapEvidence) ?? []),
  ];
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
    cta,
    targetPath,
    prompt,
    priority: action?.priority ?? 'normal',
    evidence,
    supportCta,
    supportPath,
  };
}
