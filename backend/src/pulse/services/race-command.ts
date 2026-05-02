import type { PulseRaceCommandRiskStatus, PulseRaceCommandSummary, PulseRaceCommandWorkout, PulseRaceCommandReadinessStatus, RaceContext, RacePhase } from '@coaching-os/shared/pulse';

export type RaceCommandReadinessStatus = PulseRaceCommandReadinessStatus;
export type RaceCommandRiskStatus = PulseRaceCommandRiskStatus;
export type RaceCommandWorkout = PulseRaceCommandWorkout;

export interface RaceCommandHealthState {
  type: string;
  severity: string;
  startDate: string;
  notes: string | null;
}

export interface RaceCommandRiskSignal {
  severity: string;
  title: string;
  recommendation: string | null;
}

export interface RaceCommandInput {
  today: string;
  races: RaceContext[];
  fitnessLoad: { ctl: number; atl: number; tsb: number };
  plannedWorkouts: Array<{
    id: string;
    plannedDate: string;
    activityType: string;
    zone: number;
    durationMin: number;
    targetTss: number | null;
    description: string | null;
  }>;
  healthStates: RaceCommandHealthState[];
  riskSignals: RaceCommandRiskSignal[];
}

export type RaceCommandSummary = PulseRaceCommandSummary;

const PHASE_LABELS: Record<RacePhase, string> = {
  base: 'Base',
  build: 'Build',
  peak: 'Peak',
  taper: 'Taper',
  race_week: 'Race Week',
  race_day: 'Race Day',
  past: 'Nachlauf',
};

const PRIORITY_WEIGHT: Record<RaceContext['priority'], number> = {
  A: 0,
  B: 1,
  C: 2,
};

function chooseRace(races: RaceContext[]): RaceContext | null {
  const active = races.filter(race => race.phase !== 'past' && race.daysUntil >= 0);
  active.sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] || a.daysUntil - b.daysUntil);
  return active[0] ?? null;
}

function phaseDescription(phase: RacePhase): string {
  if (phase === 'race_day') return 'Heute zählt Ausführung, keine neue Fitness.';
  if (phase === 'race_week') return 'Race Week: Frische schützen und nur kurze Aktivierung setzen.';
  if (phase === 'taper') return 'Taper: Fitness halten, Müdigkeit abbauen.';
  if (phase === 'peak') return 'Peak: letzte spezifische Reize mit klaren Erholungsfenstern.';
  if (phase === 'build') return 'Build: solide Spezifität aufbauen.';
  if (phase === 'base') return 'Base: robuste Grundlage und Routine.';
  return 'Rennen liegt hinter dem aktuellen Planfenster.';
}

function isKeyWorkout(workout: RaceCommandInput['plannedWorkouts'][number]): boolean {
  const text = workout.description?.toLowerCase() ?? '';
  return workout.zone >= 3 || (workout.targetTss ?? 0) >= 70 || /interval|race|schwelle|tempo|vo2|max/.test(text);
}

function nextKeyWorkout(input: RaceCommandInput, race: RaceContext): RaceCommandWorkout | null {
  const workout = input.plannedWorkouts
    .filter(row => row.plannedDate >= input.today && row.plannedDate <= race.date)
    .filter(isKeyWorkout)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))[0];
  if (!workout) return null;

  const reason = workout.zone >= 4
    ? 'Nächster Schlüsselreiz vor dem Rennen.'
    : (workout.targetTss ?? 0) >= 70
      ? 'Nächste umfangreiche Einheit mit Race-Relevanz.'
      : 'Nächste spezifische Einheit im Rennaufbau.';

  return { ...workout, reason };
}

function riskImpact(
  healthStates: RaceCommandHealthState[],
  riskSignals: RaceCommandRiskSignal[],
): RaceCommandSummary['riskImpact'] {
  const criticalRisks = riskSignals.filter(signal => signal.severity === 'critical');
  const highRisks = riskSignals.filter(signal => signal.severity === 'high');
  const hardHealth = healthStates.filter(state => state.severity === 'moderate' || state.severity === 'severe');
  const reasons = [
    ...criticalRisks.map(signal => signal.title),
    ...highRisks.map(signal => signal.title),
    ...hardHealth.map(state => `${state.type} ${state.severity}`),
  ];

  if (criticalRisks.length > 0 || hardHealth.length > 0) {
    return { status: 'blocked', label: 'Blockiert', reasons };
  }
  if (highRisks.length > 0 || riskSignals.length > 0 || healthStates.length > 0) {
    return {
      status: 'watch',
      label: 'Beobachten',
      reasons: reasons.length > 0 ? reasons : [
        ...riskSignals.map(signal => signal.title),
        ...healthStates.map(state => `${state.type} ${state.severity}`),
      ],
    };
  }
  return { status: 'clear', label: 'Klar', reasons: ['Keine aktiven Risk- oder Health-State-Blocker.'] };
}

function readinessStatus(input: RaceCommandInput, impact: RaceCommandSummary['riskImpact']): RaceCommandReadinessStatus {
  if (impact.status === 'blocked') return 'compromised';
  if (input.fitnessLoad.tsb <= -10 || impact.status === 'watch') return 'watch';
  return 'ready';
}

function readinessLabel(status: RaceCommandReadinessStatus): string {
  if (status === 'compromised') return 'Gefährdet';
  if (status === 'watch') return 'Beobachten';
  return 'Bereit';
}

function recoveryBoundary(input: RaceCommandInput, race: RaceContext, readiness: RaceCommandReadinessStatus): RaceCommandSummary['recoveryBoundary'] {
  if (readiness === 'compromised') {
    return {
      label: 'Gesundheit zuerst',
      detail: 'Keine rennspezifische Intensität, bis Health-State oder kritisches Risiko geklärt ist.',
      severity: 'hard_stop',
    };
  }
  if (race.phase === 'taper' || race.phase === 'race_week' || race.phase === 'race_day') {
    return {
      label: 'Taper-Grenze',
      detail: 'Keine zusätzliche harte Einheit ohne klaren Planbezug; Frische hat Vorrang vor Volumen.',
      severity: input.fitnessLoad.tsb < 0 ? 'caution' : 'normal',
    };
  }
  if (input.fitnessLoad.tsb <= -10) {
    return {
      label: 'Erholungsfenster sichern',
      detail: 'TSB ist deutlich negativ; nächste harte Einheit nur mit stabilem Check-in und Schlaf.',
      severity: 'caution',
    };
  }
  return {
    label: 'Belastung dosieren',
    detail: 'Nächsten Schlüsselreiz ausführen, aber Folgetag als echte Erholung schützen.',
    severity: 'normal',
  };
}

export function buildRaceCommandSummary(input: RaceCommandInput): RaceCommandSummary | null {
  const race = chooseRace(input.races);
  if (!race) return null;

  const impact = riskImpact(input.healthStates, input.riskSignals);
  const status = readinessStatus(input, impact);
  const keyWorkout = nextKeyWorkout(input, race);

  return {
    race,
    phase: {
      key: race.phase,
      label: PHASE_LABELS[race.phase],
      daysUntil: race.daysUntil,
      description: phaseDescription(race.phase),
    },
    readinessStatus: status,
    readinessLabel: readinessLabel(status),
    nextKeyWorkout: keyWorkout,
    recoveryBoundary: recoveryBoundary(input, race, status),
    riskImpact: impact,
    evidence: [
      `CTL ${input.fitnessLoad.ctl.toFixed(1)}`,
      `ATL ${input.fitnessLoad.atl.toFixed(1)}`,
      `TSB ${input.fitnessLoad.tsb.toFixed(1)}`,
      `Risiken ${input.riskSignals.length}`,
      `Health-States ${input.healthStates.length}`,
    ],
  };
}
