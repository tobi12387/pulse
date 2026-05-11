import type {
  GoalCategory,
  PulseCapabilityConfidence,
  PulseFuelingOutcomeBaseline,
  PulseGoalLimiter,
  PulseGoalProjection,
  PulseGoalProjectionIntervention,
  PulseGoalProjectionResponse,
  PulseGoalProjectionStatus,
  PulsePersonalResponseSummary,
  PulseSeasonStrategy,
  PulseTrainingCapabilitySummary,
  PulseTrainingEnergySystem,
  PulseWorkoutFitLabel,
  RaceDiscipline,
  RacePriority,
} from '@coaching-os/shared/pulse';

export interface GoalProjectionGoal {
  id: string;
  title: string;
  category: GoalCategory | null;
  targetDate: string | null;
  progress: number | null;
  metrics: Record<string, unknown> | null;
  raceDiscipline: RaceDiscipline | null;
  raceDistanceKm: number | null;
  raceTargetTimeSec: number | null;
  racePriority: RacePriority | null;
}

export interface GoalProjectionRiskSignal {
  severity: string;
  title: string;
}

export interface GoalProjectionHealthState {
  type: string;
  severity: string;
  bodyPart?: string | null;
}

export interface GoalProjectionWeightTrendPoint {
  date: string;
  weightKg: number;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
}

export interface GoalProjectionPlannedWorkout {
  plannedDate: string;
  zone: number;
  durationMin: number;
  targetTss: number | null;
  capabilityFit?: PulseWorkoutFitLabel | null;
  status?: string | null;
}

export interface BuildGoalProjectionInput {
  today: string;
  horizonDays: number;
  goals: GoalProjectionGoal[];
  fitnessLoad: { ctl: number; atl: number; tsb: number };
  trainingCapabilities: PulseTrainingCapabilitySummary | null;
  goalLimiter: PulseGoalLimiter | null;
  seasonStrategy: PulseSeasonStrategy | null;
  personalResponse: PulsePersonalResponseSummary | null;
  fuelingBaseline: PulseFuelingOutcomeBaseline | null;
  riskSignals: GoalProjectionRiskSignal[];
  healthStates: GoalProjectionHealthState[];
  weightTrend: GoalProjectionWeightTrendPoint[];
  plannedWorkouts: GoalProjectionPlannedWorkout[];
}

function daysBetween(from: string, to: string | null): number | null {
  if (!to) return null;
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const value = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
  return Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isLongRace(goal: GoalProjectionGoal): boolean {
  return goal.category === 'race'
    && ((goal.raceDistanceKm ?? 0) >= 100
      || goal.raceDiscipline === 'triathlon_70_3'
      || goal.raceDiscipline === 'triathlon_140_6');
}

function relevantSystems(goal: GoalProjectionGoal, limiter: PulseGoalLimiter | null): PulseTrainingEnergySystem[] {
  if (limiter?.workoutFocus.length) return limiter.workoutFocus;
  if (isLongRace(goal)) return ['long_endurance', 'endurance'];
  if (goal.category === 'race') return ['endurance', 'tempo', 'threshold'];
  if (goal.category === 'ftp') return ['threshold', 'vo2'];
  if (goal.category === 'vo2max') return ['vo2', 'anaerobic'];
  if (goal.category === 'volume') return ['endurance', 'long_endurance'];
  if (goal.category === 'weight') return ['endurance', 'recovery'];
  return ['endurance'];
}

function capabilityLevel(
  summary: PulseTrainingCapabilitySummary | null,
  system: PulseTrainingEnergySystem,
): PulseTrainingCapabilitySummary['levels'][number] | null {
  return summary?.levels.find(level => level.energySystem === system) ?? null;
}

function averageCapability(summary: PulseTrainingCapabilitySummary | null, systems: PulseTrainingEnergySystem[]): number | null {
  const levels = systems
    .map(system => capabilityLevel(summary, system)?.level ?? null)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (levels.length === 0) return null;
  return levels.reduce((sum, value) => sum + value, 0) / levels.length;
}

function weakestConfidence(summary: PulseTrainingCapabilitySummary | null, systems: PulseTrainingEnergySystem[]): PulseCapabilityConfidence {
  const order: Record<PulseCapabilityConfidence, number> = { low: 0, medium: 1, high: 2 };
  const confidences = systems
    .map(system => capabilityLevel(summary, system)?.confidence ?? null)
    .filter((value): value is PulseCapabilityConfidence => value != null);
  if (confidences.length === 0) return 'low';
  return confidences.sort((a, b) => order[a] - order[b])[0]!;
}

function confidenceFor(params: {
  status: PulseGoalProjectionStatus;
  capabilityConfidence: PulseCapabilityConfidence;
  personalResponse: PulsePersonalResponseSummary | null;
  missingEvidence: string[];
}): PulseCapabilityConfidence {
  if (params.status === 'insufficient_evidence' || params.missingEvidence.length >= 3) return 'low';
  if (params.capabilityConfidence === 'high' && params.personalResponse?.strength === 'useful' && params.missingEvidence.length === 0) return 'high';
  if (params.capabilityConfidence === 'low' || params.missingEvidence.length >= 2) return 'low';
  return 'medium';
}

function targetCtl(goal: GoalProjectionGoal): number {
  if (isLongRace(goal)) return 62;
  if (goal.category === 'race') return 50;
  if (goal.category === 'ftp' || goal.category === 'vo2max') return 52;
  if (goal.category === 'volume') return 48;
  if (goal.category === 'weight') return 36;
  return 45;
}

function daysScore(daysUntil: number | null): number {
  if (daysUntil == null) return -2;
  if (daysUntil < 0) return -20;
  if (daysUntil <= 7) return -2;
  if (daysUntil <= 28) return 1;
  if (daysUntil <= 120) return 4;
  return 2;
}

function loadScore(input: BuildGoalProjectionInput, goal: GoalProjectionGoal): number {
  const ctlDelta = clamp((input.fitnessLoad.ctl - targetCtl(goal)) * 0.45, -14, 12);
  const tsb = input.fitnessLoad.tsb;
  const tsbScore = tsb <= -20 ? -12 : tsb <= -12 ? -6 : tsb <= -8 ? -2 : tsb <= 12 ? 4 : tsb <= 25 ? 1 : -3;
  return ctlDelta + tsbScore;
}

function capabilityScore(level: number | null): number {
  if (level == null) return -6;
  if (level >= 4.0) return 12;
  if (level >= 3.5) return 7;
  if (level >= 3.0) return 2;
  if (level >= 2.5) return -4;
  return -10;
}

function responseScore(response: PulsePersonalResponseSummary | null): number {
  if (response?.strength === 'useful') return 5;
  if (response?.strength === 'learning') return 1;
  return -5;
}

function riskScore(input: BuildGoalProjectionInput): number {
  const criticalRisk = input.riskSignals.some(signal => ['critical', 'severe'].includes(signal.severity));
  const watchRisk = input.riskSignals.some(signal => ['warn', 'warning', 'high', 'action'].includes(signal.severity));
  const hardHealth = input.healthStates.some(state => ['severe', 'moderate'].includes(state.severity));
  if (criticalRisk || input.healthStates.some(state => state.severity === 'severe')) return -20;
  if (watchRisk || hardHealth) return -10;
  return 2;
}

function limiterScore(limiter: PulseGoalLimiter | null): number {
  if (!limiter) return 4;
  if (limiter.confidence === 'high') return -10;
  if (limiter.confidence === 'medium') return -8;
  return -5;
}

function fuelingScore(goal: GoalProjectionGoal, baseline: PulseFuelingOutcomeBaseline | null): number {
  if (!isLongRace(goal)) return 0;
  if (!baseline || baseline.status === 'insufficient_data') return -8;
  if (baseline.status === 'caution') return -8;
  if (baseline.status === 'learning') return -4;
  return 4;
}

function plannedWorkoutScore(goal: GoalProjectionGoal, workouts: GoalProjectionPlannedWorkout[]): number {
  const future = workouts.filter(workout => workout.status !== 'completed');
  if (future.length === 0) return goal.targetDate ? -2 : 0;
  if (future.some(workout => workout.capabilityFit === 'productive' || workout.capabilityFit === 'maintenance')) return 3;
  if (future.some(workout => workout.capabilityFit === 'too_hard_today')) return -4;
  return 1;
}

function weightEvidenceMissing(input: BuildGoalProjectionInput, goal: GoalProjectionGoal): boolean {
  return goal.category === 'weight' && input.weightTrend.length < 3;
}

function evidenceForSystems(summary: PulseTrainingCapabilitySummary | null, systems: PulseTrainingEnergySystem[]): string[] {
  return systems
    .map(system => capabilityLevel(summary, system))
    .filter((level): level is PulseTrainingCapabilitySummary['levels'][number] => level != null)
    .map(level => `${level.label}: Level ${level.level.toFixed(1)} (${level.confidence})`);
}

function limiterRisk(input: BuildGoalProjectionInput, status: PulseGoalProjectionStatus): PulseGoalProjection['limiterRisk'] {
  const criticalRisk = input.riskSignals.filter(signal => ['critical', 'severe'].includes(signal.severity));
  const hardHealth = input.healthStates.filter(state => ['severe', 'moderate'].includes(state.severity));
  if (criticalRisk.length > 0 || hardHealth.some(state => state.severity === 'severe')) {
    return {
      status: 'blocked',
      label: 'Recovery/Risk',
      summary: 'Aktive Risiko- oder Health-State-Signale begrenzen das Ziel stärker als Training.',
      evidence: [
        ...criticalRisk.map(signal => signal.title),
        ...hardHealth.map(state => `${state.type} ${state.severity}`),
      ],
    };
  }
  if (input.goalLimiter) {
    return {
      status: status === 'at_risk' ? 'blocked' : 'watch',
      label: input.goalLimiter.label,
      summary: input.goalLimiter.planBias,
      evidence: input.goalLimiter.evidence,
    };
  }
  return {
    status: status === 'insufficient_evidence' ? 'unknown' : 'clear',
    label: status === 'insufficient_evidence' ? 'Evidenz offen' : 'Kein dominanter Limiter',
    summary: status === 'insufficient_evidence'
      ? 'Pulse braucht mehr belastbare Daten, bevor ein Limiter fair bewertet werden kann.'
      : 'Aktuell begrenzt kein einzelner Goal-Limiter die Projektion.',
    evidence: status === 'insufficient_evidence' ? ['Projektionsdaten unvollständig'] : ['Kein aktiver Goal-Limiter im aktuellen Plan-Trace'],
  };
}

function intervention(params: {
  input: BuildGoalProjectionInput;
  goal: GoalProjectionGoal;
  status: PulseGoalProjectionStatus;
  missingEvidence: string[];
}): PulseGoalProjectionIntervention {
  const { input, goal, status } = params;
  const dataQuality: PulseGoalProjectionIntervention = {
    kind: 'data_quality',
    title: 'Evidenz vervollständigen',
    summary: params.missingEvidence[0] ?? 'Mehr Folgeevidenz macht die Zielprojektion belastbarer.',
    actionLabel: 'Daten prüfen',
    targetPath: goal.category === 'weight' ? '/data?tab=weight#data-weight' : '/data?tab=quality#data-garmin-quality',
    evidence: params.missingEvidence.slice(0, 3),
  };

  if (status === 'insufficient_evidence') return dataQuality;
  if (input.riskSignals.length > 0 || input.healthStates.length > 0 || input.fitnessLoad.tsb <= -15) {
    return {
      kind: 'protect_recovery',
      title: 'Erholung schützen',
      summary: 'Das Ziel profitiert gerade mehr von stabiler Ausführung als von zusätzlicher Last.',
      actionLabel: 'Heute prüfen',
      targetPath: '/',
      evidence: [`TSB ${input.fitnessLoad.tsb.toFixed(1)}`, `${input.riskSignals.length} Risiko-Signal(e)`],
    };
  }
  if (input.goalLimiter?.kind === 'long_endurance_fueling') {
    const fuelingIsOpen = input.fuelingBaseline == null || input.fuelingBaseline.status !== 'stable';
    return {
      kind: fuelingIsOpen ? 'fueling_practice' : 'build_long_endurance',
      title: fuelingIsOpen ? 'Fueling-Praxis absichern' : 'Lange Ausdauer aufbauen',
      summary: fuelingIsOpen
        ? 'Die nächste lange Einheit sollte kontrolliert Fueling und GI-Verträglichkeit schließen.'
        : 'Der nächste Fortschritt liegt in ruhiger, progressiver langer Ausdauer.',
      actionLabel: 'Plan prüfen',
      targetPath: '/plan?tab=training',
      evidence: input.goalLimiter.evidence.slice(0, 3),
    };
  }
  if (goal.category === 'ftp' || goal.category === 'vo2max' || input.goalLimiter?.kind === 'threshold_vo2') {
    return {
      kind: 'threshold_vo2',
      title: 'Schlüsselreiz gezielt setzen',
      summary: 'Ein kontrollierter Schwellen-/VO2-Reiz bringt das Ziel weiter, ohne die Hard-Day-Caps zu erhöhen.',
      actionLabel: 'Nächste Einheit prüfen',
      targetPath: '/plan?tab=training',
      evidence: evidenceForSystems(input.trainingCapabilities, ['threshold', 'vo2']).slice(0, 3),
    };
  }
  if (goal.category === 'weight') {
    return {
      kind: 'body_composition_consistency',
      title: 'Konsistenz vor Zusatzlast',
      summary: 'Körperkomposition profitiert von regelmäßiger Erfassung, ruhiger Ausdauer und stabiler Recovery.',
      actionLabel: 'Trends prüfen',
      targetPath: '/data?tab=weight#data-weight',
      evidence: [`${input.weightTrend.length} Gewichtseintrag/-einträge im Fenster`],
    };
  }
  return {
    kind: 'consistency',
    title: 'Nächsten Plan sauber ausführen',
    summary: 'Die stärkste Intervention ist aktuell konsistente Ausführung mit Feedback nach Schlüsselreizen.',
    actionLabel: 'Plan öffnen',
    targetPath: '/plan?tab=training',
    evidence: input.personalResponse?.signals[0]?.evidence.slice(0, 2) ?? ['Personal Response wird weiter gelernt'],
  };
}

function statusFor(probabilityPct: number | null): PulseGoalProjectionStatus {
  if (probabilityPct == null) return 'insufficient_evidence';
  if (probabilityPct < 35) return 'at_risk';
  if (probabilityPct < 70) return 'watch';
  return 'on_track';
}

function statusLabel(status: PulseGoalProjectionStatus): string {
  if (status === 'on_track') return 'auf Kurs';
  if (status === 'watch') return 'beobachten';
  if (status === 'at_risk') return 'gefährdet';
  return 'Evidenz offen';
}

function missingEvidence(input: BuildGoalProjectionInput, goal: GoalProjectionGoal, systems: PulseTrainingEnergySystem[]): string[] {
  return [
    !goal.targetDate ? 'Zieldatum fehlt.' : null,
    !input.trainingCapabilities ? 'Training-Capability-Evidenz fehlt.' : null,
    input.personalResponse == null || input.personalResponse.strength === 'insufficient' ? 'Persönliche Reaktionsdaten sind noch nicht belastbar.' : null,
    isLongRace(goal) && (!input.fuelingBaseline || input.fuelingBaseline.status !== 'stable')
      ? 'Wiederholte stabile Fueling-/GI-Logs für lange Einheiten fehlen.'
      : null,
    ...systems
      .map(system => capabilityLevel(input.trainingCapabilities, system))
      .filter(level => level?.staleReason)
      .map(level => `${level!.label}: ${level!.staleReason}`),
    weightEvidenceMissing(input, goal) ? 'Mindestens drei aktuelle Gewichts- oder Körperdatenpunkte fehlen.' : null,
  ].filter((item): item is string => item != null);
}

function priority(goal: GoalProjectionGoal): number {
  if (goal.racePriority === 'A') return 0;
  if (goal.racePriority === 'B') return 1;
  if (goal.racePriority === 'C') return 2;
  return 3;
}

function buildProjection(input: BuildGoalProjectionInput, goal: GoalProjectionGoal): PulseGoalProjection {
  const daysUntil = daysBetween(input.today, goal.targetDate);
  const systems = relevantSystems(goal, input.goalLimiter);
  const missing = missingEvidence(input, goal, systems);
  const forcedInsufficient = daysUntil != null && daysUntil < 0 || weightEvidenceMissing(input, goal);
  const capabilityAvg = averageCapability(input.trainingCapabilities, systems);
  const rawScore = 55
    + daysScore(daysUntil)
    + loadScore(input, goal)
    + capabilityScore(capabilityAvg)
    + responseScore(input.personalResponse)
    + riskScore(input)
    + limiterScore(input.goalLimiter)
    + fuelingScore(goal, input.fuelingBaseline)
    + plannedWorkoutScore(goal, input.plannedWorkouts);
  const probabilityPct = forcedInsufficient ? null : Math.round(clamp(rawScore, 15, 92));
  const status = statusFor(probabilityPct);
  const confidence = confidenceFor({
    status,
    capabilityConfidence: weakestConfidence(input.trainingCapabilities, systems),
    personalResponse: input.personalResponse,
    missingEvidence: missing,
  });
  const risk = limiterRisk(input, status);
  const nextBestIntervention = intervention({ input, goal, status, missingEvidence: missing });
  const evidence = [
    `CTL ${input.fitnessLoad.ctl.toFixed(1)} / TSB ${input.fitnessLoad.tsb.toFixed(1)}`,
    capabilityAvg != null ? `Capability ${systems.join('/')} Ø ${capabilityAvg.toFixed(1)}` : 'Capability offen',
    input.personalResponse ? `Response ${input.personalResponse.strength}` : 'Response offen',
    input.fuelingBaseline && isLongRace(goal) ? `Fueling ${input.fuelingBaseline.status}` : null,
    ...evidenceForSystems(input.trainingCapabilities, systems).slice(0, 2),
    ...risk.evidence.slice(0, 2),
  ].filter((item): item is string => item != null);

  return {
    goalId: goal.id,
    title: goal.title,
    category: goal.category,
    targetDate: goal.targetDate,
    daysUntil,
    probabilityPct,
    status,
    confidence,
    summary: probabilityPct == null
      ? `${goal.title}: ${statusLabel(status)}. Pulse braucht mehr Evidenz, bevor eine faire Zielwahrscheinlichkeit möglich ist.`
      : `${goal.title}: ${statusLabel(status)} bei ca. ${probabilityPct}% mit ${confidence}-Konfidenz.`,
    limiterRisk: risk,
    nextBestIntervention,
    evidence,
    missingEvidence: missing,
  };
}

function headline(projections: PulseGoalProjection[]): string {
  if (projections.length === 0) return 'Noch keine aktiven Ziele für eine Projektion.';
  const top = projections[0]!;
  if (top.status === 'on_track') return `Top-Ziel ist auf Kurs: ${top.title}.`;
  if (top.status === 'watch') return `Top-Ziel braucht Aufmerksamkeit: ${top.title}.`;
  if (top.status === 'at_risk') return `Top-Ziel ist gefährdet: ${top.title}.`;
  return `Top-Ziel braucht mehr Evidenz: ${top.title}.`;
}

export function buildGoalProjectionSummary(input: BuildGoalProjectionInput): PulseGoalProjectionResponse {
  const horizonDays = clamp(Math.round(input.horizonDays || 180), 30, 365);
  const goals = input.goals
    .filter(goal => {
      const days = daysBetween(input.today, goal.targetDate);
      return days == null || (days >= 0 && days <= horizonDays);
    })
    .sort((a, b) => priority(a) - priority(b)
      || (daysBetween(input.today, a.targetDate) ?? Number.MAX_SAFE_INTEGER)
        - (daysBetween(input.today, b.targetDate) ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 3);
  const projections = goals.map(goal => buildProjection({ ...input, horizonDays }, goal));
  const missing = [...new Set(projections.flatMap(item => item.missingEvidence))];

  return {
    generatedAt: `${input.today}T00:00:00.000Z`,
    horizonDays,
    headline: headline(projections),
    projections,
    missingEvidence: missing,
  };
}
