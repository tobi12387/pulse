import type { PulseHomeScreenData, PulseNextBestAction } from '@coaching-os/shared/pulse';

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
  evidence: string[];
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
  const workout = home.nextWorkout;
  if (!workout || workout.plannedDate !== home.date) return null;
  return `${workout.activityType} · Z${workout.zone} · ${workout.durationMin} min`;
}

function alternativeFor(home: PulseHomeScreenData, action: PulseNextBestAction | null): string {
  const workout = home.nextWorkout;
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

export function deriveDailyDecision(home: PulseHomeScreenData | null | undefined): DailyDecision | null {
  if (!home) return null;

  const action = home.nextBestActions?.[0] ?? null;
  const todayWorkout = workoutLabel(home);
  const boundary = readinessBoundary(home.readiness?.score, home.fitnessLoad?.tsb);
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
  const evidence = [
    `Readiness ${home.readiness.score}/100`,
    `TSB ${home.fitnessLoad.tsb.toFixed(1)}`,
    ...(todayWorkout ? [`Training ${todayWorkout}`] : []),
    ...(action?.evidence ?? []),
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
