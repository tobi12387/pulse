import type {
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

export interface WorkoutLibraryInput extends WorkoutDifficultyInput {
  description?: string | null;
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

function byId(id: string): TrainingArchetype {
  return trainingArchetypes.find(archetype => archetype.id === id) ?? trainingArchetypes[0]!;
}

export function selectWorkoutArchetype(workout: Pick<WorkoutLibraryInput, 'activityType' | 'zone' | 'durationMin'>): TrainingArchetype {
  if (workout.activityType === 'strength') return byId('strength_support');
  if (workout.zone <= 1) return byId('recovery_spin');
  if (workout.durationMin >= 180 && workout.zone <= 3) return byId('long_endurance');
  if (workout.zone === 2) return byId('endurance_steady');
  if (workout.zone === 3 && workout.durationMin >= 90 && workout.activityType === 'bike') return byId('gravel_specificity');
  if (workout.zone === 3) return byId('tempo_sustained');
  if (workout.zone === 4) return byId('threshold_intervals');
  if (workout.zone >= 5 && workout.durationMin <= 35) return byId('anaerobic_sharpening');
  return byId('vo2_repeats');
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

export function buildWorkoutLibrarySteps(workout: WorkoutLibraryInput, archetype = selectWorkoutArchetype(workout)): WorkoutStep[] {
  const duration = Math.max(5, workout.durationMin);
  const zone = clampZone(workout.zone);
  let steps: WorkoutStep[];

  if (duration <= 20) {
    steps = [{ type: 'steady', durationMin: duration, zone, description: 'Kurze Aktivierung kontrolliert ausfuehren; keine zusaetzlichen Bloecke erzwingen.' }];
  } else if (archetype.id === 'strength_support') {
    steps = [{ type: 'steady', durationMin: duration, zone: 1, description: 'Kraft, Core und Stabilitaet kontrolliert ausfuehren.' }];
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
  return base
    ? `${purpose} ${prescription}${fit}\n\n${base}`
    : `${purpose} ${prescription}${fit}`;
}

export function buildWorkoutLibraryPrescription(
  input: WorkoutLibraryInput,
  capabilitySummary?: PulseTrainingCapabilitySummary | null,
): WorkoutLibraryPrescription {
  const archetype = selectWorkoutArchetype(input);
  const difficulty = computeWorkoutDifficulty(input);
  const fit = capabilitySummary ? fitWorkoutToCapabilities(input, capabilitySummary) : null;
  const steps = buildWorkoutLibrarySteps(input, archetype);

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
