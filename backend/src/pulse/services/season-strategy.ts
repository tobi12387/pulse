import type { PulseSeasonStrategy, PulseSeasonStrategyBlock, PulseSeasonStrategyBlockKind, PulseSeasonStrategyGuardrails, RaceContext, RacePriority } from '@coaching-os/shared/pulse';

export interface SeasonStrategyGoal {
  id: string | null;
  title: string;
  category: string | null;
  targetDate: string | null;
  racePriority: RacePriority | null;
}

export interface SeasonStrategyInput {
  today: string;
  weekStart: string;
  races: RaceContext[];
  goals: SeasonStrategyGoal[];
  fitnessLoad: { ctl: number; atl: number; tsb: number };
  availability: { availableDays: number[]; weeklyHours: number };
  coachPreferences: {
    preferredLongDays: number[];
    dislikedWorkoutPatterns: string[];
  };
}

const PRIORITY_WEIGHT: Record<RacePriority, number> = { A: 0, B: 1, C: 2 };

function addWeeks(weekStart: string, weeks: number): string {
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().split('T')[0]!;
}

function weeksUntilRace(daysUntil: number): number {
  return Math.max(0, Math.ceil(daysUntil / 7));
}

function chooseRace(races: RaceContext[]): RaceContext | null {
  return races
    .filter(race => race.daysUntil >= 0 && race.phase !== 'past')
    .sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] || a.daysUntil - b.daysUntil)[0] ?? null;
}

function choosePrimaryGoal(input: SeasonStrategyInput, race: RaceContext | null): PulseSeasonStrategy['primaryGoal'] {
  if (race) {
    return {
      id: race.goalId,
      title: race.title,
      category: 'race',
      targetDate: race.date,
      priority: race.priority,
    };
  }
  const goal = input.goals[0] ?? null;
  if (!goal) return null;
  return {
    id: goal.id,
    title: goal.title,
    category: goal.category,
    targetDate: goal.targetDate,
    priority: goal.racePriority,
  };
}

function labelFor(kind: PulseSeasonStrategyBlockKind): string {
  if (kind === 'race_week') return 'Race Week';
  if (kind === 'consolidation') return 'Konsolidierung';
  if (kind === 'maintenance') return 'Maintenance';
  if (kind === 'taper') return 'Taper';
  if (kind === 'peak') return 'Peak';
  if (kind === 'build') return 'Build';
  return 'Base';
}

function focusFor(kind: PulseSeasonStrategyBlockKind): string {
  if (kind === 'race_week') return 'Frische, Aktivierung und Race-Ausführung schützen.';
  if (kind === 'consolidation') return 'Akute Ermüdung abbauen, keine zusätzlichen harten Reize.';
  if (kind === 'maintenance') return 'Robuste Routine erhalten und Spielraum für Alltag lassen.';
  if (kind === 'taper') return 'Umfang reduzieren, spezifische Schärfe erhalten.';
  if (kind === 'peak') return 'Spezifische Schlüsselreize mit klaren Erholungsfenstern.';
  if (kind === 'build') return 'Spezifität und Belastbarkeit schrittweise aufbauen.';
  return 'Grundlage, Technik und Konsistenz stabilisieren.';
}

function block(kind: PulseSeasonStrategyBlockKind, weekStart: string, startOffset: number, endOffset: number): PulseSeasonStrategyBlock {
  return {
    kind,
    label: labelFor(kind),
    startWeek: addWeeks(weekStart, startOffset),
    endWeek: addWeeks(weekStart, endOffset),
    focus: focusFor(kind),
  };
}

function raceBlocks(input: SeasonStrategyInput, race: RaceContext): PulseSeasonStrategyBlock[] {
  const weeks = weeksUntilRace(race.daysUntil);
  const raceWeekOffset = Math.max(0, weeks - 1);
  const taperStart = Math.max(0, raceWeekOffset - (race.priority === 'A' ? 2 : 1));
  const peakStart = Math.max(0, taperStart - 3);

  const blocks: PulseSeasonStrategyBlock[] = [];
  if (peakStart > 0) blocks.push(block('build', input.weekStart, 0, peakStart - 1));
  if (taperStart > peakStart) blocks.push(block('peak', input.weekStart, peakStart, taperStart - 1));
  if (raceWeekOffset > taperStart) blocks.push(block('taper', input.weekStart, taperStart, raceWeekOffset - 1));
  blocks.push(block('race_week', input.weekStart, raceWeekOffset, raceWeekOffset));
  return blocks;
}

function maintenanceBlocks(input: SeasonStrategyInput): PulseSeasonStrategyBlock[] {
  return [
    block('maintenance', input.weekStart, 0, 3),
    block('base', input.weekStart, 4, 7),
  ];
}

function baseTargetSessions(input: SeasonStrategyInput): number {
  const hours = input.availability.weeklyHours;
  const byHours = hours <= 3.5 ? 2 : hours <= 5.5 ? 3 : hours <= 8 ? 4 : hours <= 11 ? 5 : 6;
  const availabilityCap = Math.max(1, input.availability.availableDays.length - 1);
  return Math.min(byHours, availabilityCap, 5);
}

function guardrails(input: SeasonStrategyInput, race: RaceContext | null, currentKind: PulseSeasonStrategyBlockKind, blocks: PulseSeasonStrategyBlock[]): PulseSeasonStrategyGuardrails {
  const rationale: string[] = [];
  let targetSessions = baseTargetSessions(input);
  let maxHardDays = race?.priority === 'A' ? 2 : 1;
  let deload = false;

  if (input.availability.availableDays.length > targetSessions) {
    rationale.push('Verfuegbarkeit ist groesser als sinnvolle Trainingsdichte.');
  }

  if (currentKind === 'maintenance') {
    maxHardDays = Math.min(maxHardDays, 1);
    rationale.push('Maintenance: ein harter Reiz reicht, der Rest bleibt stabil und erholsam.');
  }

  if (currentKind === 'taper' || currentKind === 'race_week') {
    targetSessions = Math.min(targetSessions, currentKind === 'race_week' ? 2 : 3);
    maxHardDays = Math.min(maxHardDays, 1);
    rationale.push(`${labelFor(currentKind)}: Frische hat Vorrang vor Umfang.`);
  }

  if (input.fitnessLoad.tsb <= -12 || input.fitnessLoad.atl - input.fitnessLoad.ctl >= 15) {
    deload = true;
    targetSessions = Math.max(2, targetSessions - 1);
    maxHardDays = 0;
    rationale.push(`TSB ${input.fitnessLoad.tsb.toFixed(1)} / ATL-CTL ${(input.fitnessLoad.atl - input.fitnessLoad.ctl).toFixed(1)}: naechste Woche konsolidieren.`);
  }

  if (input.coachPreferences.dislikedWorkoutPatterns.length > 0) {
    rationale.push('Coach-Praeferenzen begrenzen monotone oder unerwuenschte Muster.');
  }

  const nextBoundary = blocks.find(candidate => candidate.startWeek > input.weekStart && (candidate.kind === 'taper' || candidate.kind === 'race_week'))
    ?? blocks.find(candidate => candidate.startWeek > input.weekStart && candidate.kind === 'peak')
    ?? null;
  const freeDayRationale = input.availability.availableDays.length > targetSessions
    ? 'Pulse nutzt nicht alle verfügbaren Tage: mindestens ein freier Tag bleibt fuer Erholung, Alltag und bessere Ausfuehrung geschuetzt.'
    : 'Alle verfuegbaren Tage koennen genutzt werden, aber Zusatztraining bleibt optional und datenabhaengig.';

  return {
    targetSessions,
    maxHardDays,
    deload,
    freeDayRationale,
    rationale: rationale.length > 0 ? rationale : ['Saisonlinie nutzt aktuelle Ziele, Load und Verfuegbarkeit als Guardrails.'],
    nextBoundary: nextBoundary ? { label: nextBoundary.label, date: nextBoundary.startWeek } : null,
  };
}

export function buildSeasonStrategy(input: SeasonStrategyInput): PulseSeasonStrategy {
  const race = chooseRace(input.races);
  const baseBlocks = race ? raceBlocks(input, race) : maintenanceBlocks(input);
  const baseCurrent = baseBlocks[0] ?? block('maintenance', input.weekStart, 0, 3);
  const overloaded = input.fitnessLoad.tsb <= -12 || input.fitnessLoad.atl - input.fitnessLoad.ctl >= 15;
  const currentBlock = overloaded
    ? { ...baseCurrent, kind: 'consolidation' as const, label: labelFor('consolidation'), focus: focusFor('consolidation') }
    : baseCurrent;
  const upcomingBlocks = [currentBlock, ...baseBlocks.slice(1)];
  const guard = guardrails(input, race, currentBlock.kind, upcomingBlocks);
  const horizonWeeks = race ? Math.min(16, Math.max(8, weeksUntilRace(race.daysUntil))) : 8;

  return {
    horizonWeeks,
    primaryGoal: choosePrimaryGoal(input, race),
    currentBlock,
    upcomingBlocks,
    guardrails: guard,
    evidence: [
      race ? `${race.priority}-Race in ${weeksUntilRace(race.daysUntil)} Wochen` : 'Kein aktives Race-Ziel',
      `CTL ${input.fitnessLoad.ctl.toFixed(1)}`,
      `ATL ${input.fitnessLoad.atl.toFixed(1)}`,
      `TSB ${input.fitnessLoad.tsb.toFixed(1)}`,
      `${input.availability.availableDays.length} verfuegbare Tage`,
    ],
  };
}
