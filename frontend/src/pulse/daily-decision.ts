import type { PulseHomeScreenData, PulseNextBestAction } from '@coaching-os/shared/pulse';

export type DailyDecisionEvidence = string | { label: string; targetPath: string };

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
  supportCta?: string;
  supportPath?: string;
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
  return `${workout.activityType} · Z${workout.zone} · ${workout.durationMin} min`;
}

function completedTodayWorkout(home: PulseHomeScreenData) {
  const workout = home.todayWorkout;
  if (!workout || workout.plannedDate !== home.date) return null;
  if (workout.status === 'completed' || workout.completedActivityId || workout.executionStatus === 'completed_matched') return workout;
  return null;
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
  const todayWorkout = workoutLabel(home);
  const boundary = readinessBoundary(home.readiness?.score, home.fitnessLoad?.tsb);
  if (completedWorkout) {
    const completedLabel = `${completedWorkout.activityType} · Z${completedWorkout.zone} · ${completedWorkout.durationMin} min`;
    const evidence: DailyDecisionEvidence[] = [
      { label: `Erledigt: ${completedLabel}`, targetPath: '/plan?tab=training' },
      { label: `Readiness ${home.readiness.score}/100`, targetPath: '/data#data-recovery' },
      { label: `TSB ${home.fitnessLoad.tsb.toFixed(1)}`, targetPath: '/data?tab=analysen#data-plan-trace' },
    ];
    const reason = 'Die geplante Einheit ist abgeschlossen. Jetzt zählen Feedback, Versorgung und Regeneration stärker als eine weitere Trainingsentscheidung.';
    const alternative = 'Kein Zusatztraining nachschieben; wenn noch etwas offen ist, nur Feedback oder Planabgleich erledigen.';
    const completionCriterion = 'RPE/Feedback prüfen und den Rest des Tages bewusst ohne Ersatz- oder Zusatztraining schließen.';
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
      cta: 'Plan prüfen',
      targetPath: '/plan?tab=training',
      prompt,
      priority: 'normal',
      evidence,
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
