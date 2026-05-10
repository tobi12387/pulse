import type {
  PulseGoalLimiterKind,
  PulseTrainingCapabilitySummary,
  PulseTrainingEnergySystem,
  PulseWorkoutFitLabel,
  WorkoutStep,
} from '@coaching-os/shared/pulse';
import {
  computeWorkoutDifficulty,
  trainingArchetypes,
  type TrainingArchetype,
  type WorkoutDifficultyInput,
} from './training-intelligence.js';
import { fitWorkoutToCapabilities } from './training-capabilities.js';
import { buildSupportSession, type SupportSession } from './support-session-library.js';

export interface WorkoutLibraryInput extends WorkoutDifficultyInput {
  description?: string | null;
  preferredFamily?: TrainingArchetype['progressionFamily'] | null;
  avoidRepeatArchetypeIds?: string[];
  goalLimiterKind?: PulseGoalLimiterKind | null;
}

export interface WorkoutLibraryMetadata {
  archetypeId: string;
  difficultyLevel: number;
  difficultyEnergySystem: PulseTrainingEnergySystem;
  capabilityFit: PulseWorkoutFitLabel | null;
}

export interface WorkoutLibraryPrescription {
  archetype: TrainingArchetype;
  metadata: WorkoutLibraryMetadata;
  description: string;
  steps: WorkoutStep[];
}

const SPORT_LABEL: Record<string, string> = {
  run: 'Lauf',
  bike: 'Radeinheit',
  swim: 'Schwimmen',
  strength: 'Krafttraining',
  hike: 'Hike',
  other: 'Training',
};

function byId(id: string | null | undefined): TrainingArchetype | null {
  if (!id) return null;
  return trainingArchetypes.find(archetype => archetype.id === id) ?? null;
}

function inferredEnergySystem(workout: Pick<WorkoutLibraryInput, 'activityType' | 'zone' | 'durationMin'>): TrainingArchetype['energySystem'] {
  if (workout.activityType === 'strength') return 'strength';
  const zone = clampZone(workout.zone);
  if (zone <= 1) return 'recovery';
  if (workout.durationMin >= 150 && zone <= 3) return 'long_endurance';
  if (zone === 2) return 'endurance';
  if (zone === 3) return 'tempo';
  if (zone === 4) return 'threshold';
  if (workout.durationMin <= 35) return 'anaerobic';
  return 'vo2';
}

function inferredFamily(workout: Pick<WorkoutLibraryInput, 'activityType' | 'zone' | 'durationMin'>): TrainingArchetype['progressionFamily'] {
  const energySystem = inferredEnergySystem(workout);
  if (energySystem === 'long_endurance') return 'long';
  if (energySystem === 'anaerobic') return 'vo2';
  return energySystem;
}

function scoreArchetype(candidate: TrainingArchetype, workout: WorkoutLibraryInput): number {
  const zone = clampZone(workout.zone);
  const inferredSystem = inferredEnergySystem(workout);
  const preferredFamily = workout.preferredFamily ?? inferredFamily(workout);
  let score = 0;

  if (candidate.energySystem === inferredSystem) score += 5;
  if (candidate.defaultZone === zone) score += 4;
  if (workout.durationMin >= candidate.durationRangeMin[0] && workout.durationMin <= candidate.durationRangeMin[1]) score += 4;
  if (candidate.progressionFamily === preferredFamily) score += 3;
  if (workout.goalLimiterKind === 'long_endurance_fueling' && candidate.id === 'long_endurance_fueling_practice') score += 6;
  if (workout.goalLimiterKind === 'long_endurance_fueling' && candidate.progressionFamily === 'long') score += 2;
  if (workout.goalLimiterKind === 'threshold_vo2' && ['threshold', 'vo2'].includes(candidate.progressionFamily)) score += 3;
  if (workout.activityType === 'bike' && candidate.suitableFor.some(item => item === 'road' || item === 'century')) score += 1;
  if (workout.activityType === 'run' && candidate.suitableFor.includes('fitness')) score += 1;
  if (workout.activityType !== 'bike' && ['endurance_cadence', 'endurance_hills', 'gravel_specificity'].includes(candidate.id)) score -= 8;
  if (workout.avoidRepeatArchetypeIds?.includes(candidate.id)) score -= 8;

  return score;
}

export function selectWorkoutArchetype(workout: WorkoutLibraryInput): TrainingArchetype {
  const system = inferredEnergySystem(workout);
  const broadCandidates = trainingArchetypes.filter(archetype => {
    if (system === 'anaerobic') return archetype.energySystem === 'anaerobic' || archetype.energySystem === 'vo2';
    return archetype.energySystem === system;
  });
  const candidates = broadCandidates.length > 0 ? broadCandidates : trainingArchetypes;
  return candidates
    .map((candidate, index) => ({ candidate, index, score: scoreArchetype(candidate, workout) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.candidate
    ?? trainingArchetypes[0]!;
}

function clampZone(zone: number): number {
  return Math.max(1, Math.min(5, Math.round(zone)));
}

function totalIntervalMinutes(step: WorkoutStep): number {
  const reps = Math.max(1, step.reps ?? 1);
  return reps * step.durationMin + Math.max(0, reps - 1) * (step.restMin ?? 0);
}

function normalizeStepDurations(steps: WorkoutStep[], targetDurationMin: number): WorkoutStep[] {
  const total = steps.reduce((sum, step) => sum + (step.type === 'interval' ? totalIntervalMinutes(step) : step.durationMin), 0);
  const delta = Math.round(targetDurationMin - total);
  if (Math.abs(delta) <= 2) return steps;
  const steadyIndex = steps.findIndex(step => step.type === 'steady');
  const targetIndex = steadyIndex >= 0 ? steadyIndex : Math.max(0, steps.findIndex(step => step.type === 'cooldown'));
  return steps.map((step, index) => index === targetIndex
    ? { ...step, durationMin: Math.max(3, step.durationMin + delta) }
    : step);
}

function buildCadenceSteps(duration: number): WorkoutStep[] {
  return normalizeStepDurations([
    { type: 'warmup', durationMin: 10, zone: 1, description: 'Locker einrollen.' },
    { type: 'interval', durationMin: 4, reps: 4, restMin: 6, zone: 2, description: 'Kadenzfenster: locker schnell treten, Druck niedrig halten.' },
    { type: 'steady', durationMin: Math.max(10, duration - 54), zone: 2, description: 'Ruhig aerob fortsetzen.' },
    { type: 'cooldown', durationMin: 10, zone: 1, description: 'Locker ausrollen.' },
  ], duration);
}

function buildLongFuelingSteps(duration: number): WorkoutStep[] {
  const warmup = Math.min(15, Math.max(10, Math.round(duration * 0.08)));
  const cooldown = Math.min(15, Math.max(8, Math.round(duration * 0.06)));
  const middle = Math.max(20, duration - warmup - cooldown);
  return normalizeStepDurations([
    { type: 'warmup', durationMin: warmup, zone: 1, description: 'Locker starten; erste Flasche und Fueling frueh vorbereiten.' },
    { type: 'steady', durationMin: Math.round(middle * 0.45), zone: 2, description: 'Z2 ruhig halten. Fueling gleichmaessig starten, nicht erst bei Hunger.' },
    { type: 'steady', durationMin: Math.round(middle * 0.35), zone: 2, description: 'Fueling-Praxis: kleine Portionen regelmaessig, Magen ruhig beobachten.' },
    { type: 'steady', durationMin: Math.max(10, Math.round(middle * 0.2)), zone: 2, description: 'Letzter Ausdauerblock: Druck kontrolliert, keine Tempojagd.' },
    { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Ruhig ausrollen und Recovery vorbereiten.' },
  ], duration);
}

function buildThresholdCruiseSteps(duration: number): WorkoutStep[] {
  const warmup = Math.min(15, Math.max(10, Math.round(duration * 0.18)));
  const cooldown = Math.min(12, Math.max(8, Math.round(duration * 0.14)));
  const restMin = 4;
  const reps = duration >= 85 ? 4 : 3;
  const workBudget = Math.max(24, duration - warmup - cooldown - restMin * (reps - 1));
  return normalizeStepDurations([
    { type: 'warmup', durationMin: warmup, zone: 1, description: 'Progressiv aufwaermen, Schwelle nicht vorwegnehmen.' },
    { type: 'interval', durationMin: Math.max(7, Math.floor(workBudget / reps)), reps, restMin, zone: 4, description: 'Cruise-Intervalle: knapp unter/um Schwelle, gleichmaessig bleiben.' },
    { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Locker runterfahren.' },
  ], duration);
}

function buildSweetSpotSteps(duration: number): WorkoutStep[] {
  const warmup = Math.min(12, Math.max(8, Math.round(duration * 0.16)));
  const cooldown = Math.min(10, Math.max(6, Math.round(duration * 0.12)));
  const restMin = 4;
  const reps = duration >= 75 ? 3 : 2;
  const workBudget = Math.max(18, duration - warmup - cooldown - restMin * (reps - 1));
  return normalizeStepDurations([
    { type: 'warmup', durationMin: warmup, zone: 1, description: 'Locker starten, dann an oberen Z3-Bereich heranfuehren.' },
    { type: 'interval', durationMin: Math.max(8, Math.floor(workBudget / reps)), reps, restMin, zone: 3, description: 'Sweet Spot kontrolliert: fordernd, aber nicht schwellenhart.' },
    { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Locker beenden.' },
  ], duration);
}

function supportSessionForArchetype(archetype: TrainingArchetype, durationMin: number): SupportSession | null {
  if (archetype.id !== 'strength_support' && archetype.id !== 'strength_prehab') return null;
  return buildSupportSession({
    focus: 'cycling_prehab',
    durationMin,
    fatigue: 'normal',
  });
}

function supportSessionSteps(session: SupportSession): WorkoutStep[] {
  return session.blocks.map(block => ({
    type: 'steady',
    durationMin: block.minutes,
    zone: 1,
    description: `${block.label}: ${block.examples.join(', ')}`,
  }));
}

export function buildWorkoutLibrarySteps(workout: WorkoutLibraryInput, archetype = selectWorkoutArchetype(workout)): WorkoutStep[] {
  const duration = Math.max(5, workout.durationMin);
  const zone = clampZone(workout.zone);
  const supportSession = supportSessionForArchetype(archetype, duration);
  let steps: WorkoutStep[];

  if (supportSession) {
    steps = supportSessionSteps(supportSession);
  } else if (duration <= 20) {
    steps = [{ type: 'steady', durationMin: duration, zone, description: 'Kurze Aktivierung kontrolliert ausfuehren; keine zusaetzlichen Bloecke erzwingen.' }];
  } else if (archetype.id === 'endurance_cadence') {
    steps = buildCadenceSteps(duration);
  } else if (archetype.id === 'long_endurance_fueling_practice') {
    steps = buildLongFuelingSteps(duration);
  } else if (archetype.id === 'threshold_cruise') {
    steps = buildThresholdCruiseSteps(duration);
  } else if (archetype.id === 'sweet_spot_builder') {
    steps = buildSweetSpotSteps(duration);
  } else if (archetype.id === 'recovery_spin') {
    steps = [{ type: 'steady', durationMin: duration, zone: 1, description: 'Sehr locker, keine Druckphasen.' }];
  } else if (archetype.id === 'long_endurance') {
    const warmup = Math.min(15, Math.max(10, Math.round(duration * 0.08)));
    const cooldown = Math.min(15, Math.max(8, Math.round(duration * 0.06)));
    steps = [
      { type: 'warmup', durationMin: warmup, zone: 1, description: 'Locker starten und Fueling frueh vorbereiten.' },
      { type: 'steady', durationMin: Math.max(20, duration - warmup - cooldown), zone: Math.min(zone, 2), description: 'Ruhiger Ausdauerblock mit gleichmaessiger Verpflegung.' },
      { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Ruhig ausrollen und Erholung einleiten.' },
    ];
  } else if (['threshold', 'vo2', 'anaerobic'].includes(archetype.energySystem) && duration <= 35) {
    const warmup = Math.min(8, Math.max(6, Math.round(duration * 0.3)));
    const cooldown = Math.min(6, Math.max(4, Math.round(duration * 0.18)));
    const reps = archetype.energySystem === 'anaerobic' ? 3 : 2;
    const restMin = archetype.energySystem === 'anaerobic' ? 1 : 2;
    const workBudget = Math.max(reps, duration - warmup - cooldown - restMin * (reps - 1));
    steps = [
      { type: 'warmup', durationMin: warmup, zone: 1, description: 'Kurz, aber sauber aufwaermen.' },
      { type: 'interval', durationMin: Math.max(1, Math.floor(workBudget / reps)), reps, restMin, zone: Math.max(4, zone), description: 'Kompakter Qualitaetsreiz ohne Zusatzumfang.' },
      { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Locker beenden.' },
    ];
  } else if (archetype.energySystem === 'threshold') {
    const warmup = Math.min(15, Math.max(10, Math.round(duration * 0.2)));
    const cooldown = Math.min(12, Math.max(8, Math.round(duration * 0.15)));
    const workBudget = Math.max(16, duration - warmup - cooldown);
    const reps = Math.max(2, Math.min(5, Math.floor(workBudget / 11)));
    const restMin = 3;
    const intervalMin = Math.max(5, Math.floor((workBudget - restMin * (reps - 1)) / reps));
    steps = [
      { type: 'warmup', durationMin: warmup, zone: 1, description: 'Progressiv aufwaermen, Kadenz/Schritt locker halten.' },
      { type: 'interval', durationMin: intervalMin, reps, restMin, zone: 4, description: 'Schwellenarbeit kontrolliert, nicht sprinten.' },
      { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Sauber runterfahren.' },
    ];
  } else if (archetype.energySystem === 'vo2' || archetype.energySystem === 'anaerobic') {
    const warmup = Math.min(15, Math.max(10, Math.round(duration * 0.28)));
    const cooldown = Math.min(10, Math.max(6, Math.round(duration * 0.16)));
    const restMin = archetype.energySystem === 'anaerobic' ? 3 : 2;
    const reps = Math.max(3, Math.min(archetype.energySystem === 'anaerobic' ? 5 : 6, Math.floor((duration - warmup - cooldown) / 6)));
    const intervalMin = archetype.energySystem === 'anaerobic' ? 2 : 4;
    steps = [
      { type: 'warmup', durationMin: warmup, zone: 1, description: 'Gruendlich aufwaermen, erst dann hart.' },
      { type: 'interval', durationMin: intervalMin, reps, restMin, zone: 5, description: 'Kurze harte Wiederholungen mit sauberer Technik.' },
      { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Locker beenden.' },
    ];
  } else if (archetype.energySystem === 'tempo') {
    const warmup = Math.min(12, Math.max(8, Math.round(duration * 0.15)));
    const cooldown = Math.min(10, Math.max(6, Math.round(duration * 0.12)));
    steps = [
      { type: 'warmup', durationMin: warmup, zone: 1, description: 'Locker in den Rhythmus kommen.' },
      { type: 'steady', durationMin: Math.max(10, duration - warmup - cooldown), zone: 3, description: 'Tempo stabil halten, keine Z4-Spitzen jagen.' },
      { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Ruhig beenden.' },
    ];
  } else {
    const warmup = duration >= 45 ? 10 : 5;
    const cooldown = duration >= 45 ? 10 : 5;
    steps = [
      { type: 'warmup', durationMin: warmup, zone: 1, description: 'Locker starten.' },
      { type: 'steady', durationMin: Math.max(5, duration - warmup - cooldown), zone: Math.min(zone, 2), description: 'Aerob gleichmaessig bleiben.' },
      { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Ruhig beenden.' },
    ];
  }

  return normalizeStepDurations(steps, duration);
}

function buildLibraryDescription(input: WorkoutLibraryInput, archetype: TrainingArchetype, fitLabel: string | null): string {
  const sport = SPORT_LABEL[input.activityType] ?? 'Training';
  const base = input.description?.trim();
  const purpose = `${sport}: Archetyp ${archetype.label}. ${archetype.description}`;
  const prescription = `${input.durationMin} min in Z${clampZone(input.zone)}; Trainingszweck bleibt ${archetype.energySystem}.`;
  const fit = fitLabel ? ` Fit: ${fitLabel}.` : '';
  const supportNote = supportSessionForArchetype(archetype, Math.max(5, input.durationMin))?.planNote;
  const note = supportNote ? ` ${supportNote}` : '';
  return base
    ? `${purpose} ${prescription}${fit}${note}\n\n${base}`
    : `${purpose} ${prescription}${fit}${note}`;
}

export function buildWorkoutLibraryPrescription(
  input: WorkoutLibraryInput,
  capabilitySummary?: PulseTrainingCapabilitySummary | null,
  options: { forcedArchetypeId?: string | null } = {},
): WorkoutLibraryPrescription {
  const archetype = byId(options.forcedArchetypeId) ?? selectWorkoutArchetype(input);
  const fit = capabilitySummary ? fitWorkoutToCapabilities(input, capabilitySummary) : null;
  const steps = buildWorkoutLibrarySteps(input, archetype);
  const difficulty = computeWorkoutDifficulty({ ...input, steps });

  return {
    archetype,
    metadata: {
      archetypeId: archetype.id,
      difficultyLevel: difficulty.level,
      difficultyEnergySystem: difficulty.energySystem as PulseTrainingEnergySystem,
      capabilityFit: fit?.label ?? null,
    },
    description: buildLibraryDescription(input, archetype, fit?.displayLabel ?? null),
    steps,
  };
}
