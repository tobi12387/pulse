import type {
  PulseActivityType,
  PulseTodayOption,
  PulseTodayOptionsResponse,
  PulseTrainingCapabilitySummary,
  PulseWorkoutFitLabel,
} from '@coaching-os/shared/pulse';

type RecentSportMix = Partial<Record<PulseActivityType, number>>;

export interface TodayOptionsInput {
  date: string;
  readinessScore: number;
  tsb: number;
  plannedToday: {
    id: string;
    activityType: PulseActivityType;
    zone: number;
    durationMin: number;
    targetTss: number | null;
    capabilityFit: PulseWorkoutFitLabel | null;
    archetypeId?: string | null;
  } | null;
  completedTodayActivities: Array<{
    id: string;
    activityType: PulseActivityType;
    durationMin: number;
    distanceKm: number | null;
    tss: number | null;
    rpe: number | null;
    feedbackLoggedAt: string | null;
  }>;
  recentSportMix: RecentSportMix;
  riskSignals: Array<{ severity: 'info' | 'warn' | 'critical' | string; title: string }>;
  mental: { mood: number; energy: number; stress: number; motivation: number } | null;
  fueling: { recentGiIssue: boolean; loggedToday: boolean };
  goals?: { activeCount: number; preferredSports: PulseActivityType[] };
  capabilitySummary: PulseTrainingCapabilitySummary | null;
}

const SPORT_LABEL: Record<PulseActivityType, string> = {
  bike: 'Rad',
  run: 'Lauf',
  swim: 'Schwimmen',
  strength: 'Kraft',
  hike: 'Hike',
  other: 'Training',
};

function fixed(value: number): string {
  return value.toFixed(1);
}

function highRecoveryRisk(input: TodayOptionsInput): boolean {
  return input.readinessScore < 55
    || input.tsb <= -10
    || input.riskSignals.some(signal => signal.severity === 'critical' || signal.severity === 'warn')
    || (input.mental != null && input.mental.energy <= 3 && input.mental.stress >= 7)
    || (input.fueling.recentGiIssue && (input.plannedToday?.zone ?? 0) >= 4)
    || (input.capabilitySummary?.signals.includes('protect_recovery') ?? false)
    || input.plannedToday?.capabilityFit === 'too_hard_today';
}

function baseEvidence(input: TodayOptionsInput): string[] {
  const evidence = [
    `Readiness ${input.readinessScore}/100`,
    `TSB ${fixed(input.tsb)}`,
  ];
  if (input.mental) {
    evidence.push(`Mental: Energie ${input.mental.energy}/10, Stress ${input.mental.stress}/10`);
  }
  if (input.fueling.recentGiIssue) {
    evidence.push('Fueling: letzte Einheit mit GI-Hinweis');
  }
  return evidence;
}

function riskEvidence(input: TodayOptionsInput): string[] {
  return input.riskSignals
    .filter(signal => signal.severity === 'critical' || signal.severity === 'warn')
    .slice(0, 2)
    .map(signal => `Risiko: ${signal.title}`);
}

function mostUsefulEnduranceSport(recentSportMix: RecentSportMix, goals?: TodayOptionsInput['goals']): PulseActivityType {
  const goalSport = goals?.preferredSports.find(sport => sport === 'bike' || sport === 'run');
  if (goalSport) return goalSport;
  const bikeCount = recentSportMix.bike ?? 0;
  const runCount = recentSportMix.run ?? 0;
  if (bikeCount <= runCount) return 'bike';
  return 'run';
}

function enduranceCapability(input: TodayOptionsInput) {
  return input.capabilitySummary?.levels.find(level => level.energySystem === 'endurance') ?? null;
}

function enduranceCapabilityEvidence(input: TodayOptionsInput): string[] {
  const capability = enduranceCapability(input);
  if (!capability) return [];
  return [`Capability: Endurance ${capability.level.toFixed(1)} -> ${capability.nextRecommendedWorkoutLevel.toFixed(1)}`];
}

function enduranceOptionFit(input: TodayOptionsInput): PulseWorkoutFitLabel {
  const capability = enduranceCapability(input);
  if (!capability) return 'maintenance';
  if (capability.confidence !== 'low' && capability.staleReason == null && capability.nextRecommendedWorkoutLevel > capability.level) {
    return 'productive';
  }
  return 'maintenance';
}

function planScenarioTargetPath(input: {
  activityType: PulseActivityType;
  zone: number;
  durationMin: number;
  description: string;
  archetypeId?: string | null;
}): string {
  const params = new URLSearchParams({
    tab: 'training',
    source: 'today-options',
    scenario: 'workout',
    activityType: input.activityType,
    zone: String(input.zone),
    durationMin: String(input.durationMin),
    description: input.description,
  });
  if (input.archetypeId) params.set('archetypeId', input.archetypeId);
  return `/plan?${params.toString()}#plan-scenario-preview`;
}

function primaryEnduranceOption(input: TodayOptionsInput): PulseTodayOption {
  const activityType = mostUsefulEnduranceSport(input.recentSportMix, input.goals);
  const durationMin = input.readinessScore >= 75 && input.tsb >= -2 ? 60 : 45;
  const capabilityFit = enduranceOptionFit(input);
  const detail = capabilityFit === 'productive'
    ? `${durationMin} min Z2 als produktiver aerober Reiz. Sinnvoll, weil aktuelle Endurance-Evidenz einen kleinen Fortschritt erlaubt, ohne den Plan vollzustopfen.`
    : `${durationMin} min Z2. Sinnvoll, wenn du heute spontan trainieren willst, ohne den Plan vollzustopfen.`;
  const archetypeId = activityType === 'bike' && input.fueling.recentGiIssue && durationMin >= 150
    ? 'long_endurance_fueling_practice'
    : activityType === 'bike'
    ? 'endurance_cadence'
    : 'endurance_steady';
  const evidence = [
    ...baseEvidence(input),
    ...enduranceCapabilityEvidence(input),
    `Sportmix zuletzt: Bike ${input.recentSportMix.bike ?? 0}, Run ${input.recentSportMix.run ?? 0}`,
    ...(input.goals?.activeCount ? [`Ziele aktiv: ${input.goals.activeCount}`] : []),
  ];
  return {
    id: `workout-${activityType}-z2-${durationMin}`,
    kind: 'workout',
    priority: 'primary',
    title: `${SPORT_LABEL[activityType]} locker`,
    detail,
    cta: 'Einheit planen',
    targetPath: planScenarioTargetPath({ activityType, zone: 2, durationMin, description: detail, archetypeId }),
    evidence,
    activityType,
    zone: 2,
    durationMin,
    archetypeId,
    capabilityFit,
  };
}

function skillsOption(input: TodayOptionsInput): PulseTodayOption {
  const light = input.readinessScore < 60;
  const detail = light
    ? '15-20 min Beweglichkeit und Atmung, ohne Trainingsstress.'
    : '25 min Core, Mobility und Glutes als Unterstuetzung fuer Rad/Lauf.';
  const durationMin = light ? 20 : 25;
  return {
    id: light ? 'mobility-light-20' : 'strength-support-25',
    kind: 'skills',
    priority: 'secondary',
    title: light ? 'Mobility leicht' : 'Strength Support',
    detail,
    cta: 'Im Plan ergänzen',
    targetPath: planScenarioTargetPath({ activityType: 'strength', zone: 1, durationMin, description: detail, archetypeId: 'strength_prehab' }),
    evidence: [
      ...baseEvidence(input),
      'Nicht jeder freie Tag muss mit Ausdauer gefüllt werden.',
    ],
    activityType: 'strength',
    zone: 1,
    durationMin,
    archetypeId: 'strength_prehab',
    capabilityFit: 'recovery',
  };
}

function restOption(input: TodayOptionsInput, priority: PulseTodayOption['priority'] = 'support'): PulseTodayOption {
  const evidence = [
    ...baseEvidence(input),
    ...riskEvidence(input),
  ];
  return {
    id: 'rest-protect-recovery',
    kind: 'rest',
    priority,
    title: priority === 'primary' ? 'Heute bewusst pausieren' : 'Bewusst frei lassen',
    detail: priority === 'primary'
      ? 'Erholung ist heute die bessere Trainingsentscheidung. Keine Intensität nachschieben.'
      : 'Wenn Training nur aus Gewohnheit entsteht, ist ein sauber geschlossener Ruhetag wertvoller.',
    cta: 'Tagesentscheidung prüfen',
    targetPath: '/',
    evidence,
  };
}

function completedActivityOptions(input: TodayOptionsInput): PulseTodayOptionsResponse {
  const activity = input.completedTodayActivities[0]!;
  const sport = SPORT_LABEL[activity.activityType];
  const distance = activity.distanceKm != null ? ` · ${activity.distanceKm >= 10 ? Math.round(activity.distanceKm) : activity.distanceKm.toFixed(1)} km` : '';
  const activityLine = `${sport} ${activity.durationMin} min${distance}`;
  const plannedLine = input.plannedToday
    ? `${SPORT_LABEL[input.plannedToday.activityType]} ${input.plannedToday.durationMin} min Z${input.plannedToday.zone}`
    : null;
  const feedbackDone = activity.rpe != null || activity.feedbackLoggedAt != null;
  const evidence = [
    ...(plannedLine ? [`Geplant: ${plannedLine}`] : []),
    `Abgeschlossen: ${activityLine}`,
    ...baseEvidence(input),
  ];
  const options: PulseTodayOption[] = [
    {
      id: 'feedback-completed-activity',
      kind: 'feedback',
      priority: 'primary',
      title: feedbackDone ? 'Feedback ist erledigt' : 'RPE und Notiz erfassen',
      detail: feedbackDone
        ? 'Die Einheit hat bereits Feedback. Pulse kann die Belastung fuer die naechste Planung einordnen.'
        : 'Kurz RPE, Beine und Magen notieren. Das ist heute wertvoller als ein weiteres Training.',
      cta: feedbackDone ? 'Aktivität ansehen' : 'Feedback erfassen',
      targetPath: `/activity/${activity.id}`,
      evidence,
    },
    {
      id: 'fueling-after-activity',
      kind: 'fueling',
      priority: 'secondary',
      title: input.fueling.loggedToday ? 'Fueling-Log prüfen' : 'Fueling nachtragen',
      detail: activity.durationMin >= 120 || (activity.tss ?? 0) >= 100
        ? 'Lange Belastung: Flaschen, Pulver, Snacks und GI-Komfort festhalten.'
        : 'Kurz festhalten, ob Versorgung und Magen gepasst haben.',
      cta: 'Fueling öffnen',
      targetPath: `/activity/${activity.id}`,
      evidence: [
        ...evidence,
        input.fueling.loggedToday ? 'Fueling heute bereits geloggt' : 'Fueling heute noch offen',
      ],
    },
    {
      id: 'recovery-after-activity',
      kind: 'recovery',
      priority: 'support',
      title: 'Resttag schützen',
      detail: 'Heute nicht nachlegen. Essen, Trinken, lockere Bewegung und Schlaf bestimmen den Nutzen der Einheit.',
      cta: 'Recovery ansehen',
      targetPath: '/data#data-recovery',
      evidence,
    },
  ];

  return {
    date: input.date,
    state: 'completed_activity',
    summary: plannedLine
      ? `Geplantes Training erledigt: ${activityLine}. Pulse schliesst die Trainingsentscheidung und priorisiert Feedback, Fueling und Regeneration.`
      : `${activityLine} abgeschlossen. Pulse priorisiert jetzt Feedback, Fueling und Regeneration statt weiterer Trainingsvorschläge.`,
    options,
    signature: signature(input, options),
  };
}

function recoveryProtectOptions(input: TodayOptionsInput): PulseTodayOptionsResponse {
  const recoveryDetail = 'Nur wenn du dich nach Bewegung besser fühlst: sehr locker, keine Intervalle, kein Zusatzumfang.';
  const options: PulseTodayOption[] = [
    restOption(input, 'primary'),
    {
      id: 'recovery-z1-20',
      kind: 'recovery',
      priority: 'secondary',
      title: 'Optional 20 min Z1',
      detail: recoveryDetail,
      cta: 'Leichte Option planen',
      targetPath: planScenarioTargetPath({
        activityType: input.plannedToday?.activityType ?? 'bike',
        zone: 1,
        durationMin: 20,
        description: recoveryDetail,
        archetypeId: 'recovery_spin',
      }),
      evidence: [
        ...baseEvidence(input),
        ...riskEvidence(input),
      ],
      activityType: input.plannedToday?.activityType ?? 'bike',
      zone: 1,
      durationMin: 20,
      archetypeId: 'recovery_spin',
      capabilityFit: 'recovery',
    },
    {
      id: 'fueling-recovery-check',
      kind: 'fueling',
      priority: 'support',
      title: 'Versorgung und Schlaf schließen',
      detail: input.fueling.recentGiIssue
        ? 'Magenhinweis berücksichtigen: heute simpel essen/trinken und keine harte Einheit erzwingen.'
        : 'Heute Versorgung, Hydration und Schlaf absichern, damit morgen wieder entschieden werden kann.',
      cta: 'Daten ansehen',
      targetPath: '/data#data-recovery',
      evidence: baseEvidence(input),
    },
  ];
  return {
    date: input.date,
    state: 'recovery_protect',
    summary: 'Heute spricht die Evidenz fuer Erholung. Rest ist hier eine aktive Trainingsentscheidung.',
    options,
    signature: signature(input, options),
  };
}

function plannedWorkoutOptions(input: TodayOptionsInput): PulseTodayOptionsResponse {
  const planned = input.plannedToday!;
  const easierDuration = Math.round(planned.durationMin * 0.75);
  const easierZone = Math.max(1, Math.min(2, planned.zone - 1));
  const easierDetail = `${easierDuration} min Z${easierZone}, falls Warm-up oder Kopf nicht passen.`;
  const options: PulseTodayOption[] = [
    {
      id: `planned-${planned.id}`,
      kind: 'workout',
      priority: 'primary',
      title: `Plan ausführen: ${SPORT_LABEL[planned.activityType]}`,
      detail: `${planned.durationMin} min Z${planned.zone}. Passt heute, solange Check-in und Warm-up unauffällig bleiben.`,
      cta: 'Workout öffnen',
      targetPath: '/plan?tab=training',
      evidence: [
        ...baseEvidence(input),
        planned.capabilityFit ? `Level-Fit: ${planned.capabilityFit}` : 'Level-Fit: noch nicht bewertet',
      ],
      activityType: planned.activityType,
      zone: planned.zone,
      durationMin: planned.durationMin,
      archetypeId: planned.archetypeId ?? null,
      capabilityFit: planned.capabilityFit,
    },
    {
      id: `planned-easier-${planned.id}`,
      kind: 'workout',
      priority: 'secondary',
      title: 'Leichtere Alternative',
      detail: easierDetail,
      cta: 'Plan anpassen',
      targetPath: planScenarioTargetPath({
        activityType: planned.activityType,
        zone: easierZone,
        durationMin: easierDuration,
        description: easierDetail,
        archetypeId: easierZone <= 1 ? 'recovery_spin' : planned.activityType === 'bike' ? 'endurance_cadence' : 'endurance_steady',
      }),
      evidence: baseEvidence(input),
      activityType: planned.activityType,
      zone: easierZone,
      durationMin: easierDuration,
      archetypeId: easierZone <= 1 ? 'recovery_spin' : planned.activityType === 'bike' ? 'endurance_cadence' : 'endurance_steady',
      capabilityFit: 'maintenance',
    },
    restOption(input),
  ];
  return {
    date: input.date,
    state: 'planned_workout',
    summary: 'Heute ist Training geplant; Pulse zeigt den Plan plus sinnvolle Ausweichoptionen.',
    options,
    signature: signature(input, options),
  };
}

function unplannedTrainableOptions(input: TodayOptionsInput): PulseTodayOptionsResponse {
  const options = [
    primaryEnduranceOption(input),
    skillsOption(input),
    restOption(input),
  ];
  return {
    date: input.date,
    state: 'unplanned_trainable',
    summary: 'Kein Pflichttraining heute. Wenn du trainierst, dann gezielt und ohne den Tag automatisch zu fuellen.',
    options,
    signature: signature(input, options),
  };
}

function signature(input: TodayOptionsInput, options: PulseTodayOption[]): string {
  return [
    input.date,
    input.readinessScore,
    fixed(input.tsb),
    input.plannedToday?.id ?? 'none',
    input.completedTodayActivities.map(activity => activity.id).join(',') || 'no-activity',
    input.riskSignals.map(signal => `${signal.severity}:${signal.title}`).join(',') || 'no-risk',
    options.map(option => option.id).join(','),
  ].join('|');
}

export function buildTodayOptions(input: TodayOptionsInput): PulseTodayOptionsResponse {
  if (input.completedTodayActivities.length > 0) {
    return completedActivityOptions(input);
  }

  if (highRecoveryRisk(input)) {
    return recoveryProtectOptions(input);
  }

  if (input.plannedToday) {
    return plannedWorkoutOptions(input);
  }

  return unplannedTrainableOptions(input);
}
