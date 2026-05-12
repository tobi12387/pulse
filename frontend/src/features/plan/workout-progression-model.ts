import type { PulsePlannedWorkout } from '@coaching-os/shared/pulse';
import { workoutArchetypeCopy } from '../../pulse/activity-labels';

export interface WorkoutProgressionInsight {
  label: string;
  tone: 'green' | 'amber' | 'rose' | 'text';
  role: string;
  calibration: string;
  repetition: string;
  changeTrigger: string;
  evidence: string[];
}

const FIT_COPY: Record<NonNullable<PulsePlannedWorkout['capabilityFit']>, {
  label: string;
  display: string;
  tone: WorkoutProgressionInsight['tone'];
}> = {
  recovery: { label: 'Recovery schuetzen', display: 'Recovery', tone: 'green' },
  maintenance: { label: 'Stabiler Erhaltungsreiz', display: 'Machbar', tone: 'text' },
  productive: { label: 'Produktiver Fortschrittsreiz', display: 'Produktiv', tone: 'green' },
  stretch: { label: 'Grenzreiz kontrollieren', display: 'Stretch', tone: 'amber' },
  too_hard_today: { label: 'Heute entschaerfen', display: 'Zu hart heute', tone: 'rose' },
};

function sameProgressionGroup(a: PulsePlannedWorkout, b: PulsePlannedWorkout): boolean {
  if (a.status !== 'planned' || b.status !== 'planned') return false;
  if (a.archetypeId && b.archetypeId && a.archetypeId === b.archetypeId) return true;
  if (a.difficultyEnergySystem && b.difficultyEnergySystem) return a.difficultyEnergySystem === b.difficultyEnergySystem;
  return a.activityType === b.activityType && a.zone === b.zone;
}

function visibleFutureWorkouts(workouts: PulsePlannedWorkout[], today: string): PulsePlannedWorkout[] {
  return workouts.filter(workout => workout.status === 'planned' && workout.plannedDate >= today);
}

function calibrationCopy(workout: PulsePlannedWorkout, fitDisplay: string | null): string {
  const level = workout.difficultyLevel != null
    ? `Workout-Level ${workout.difficultyLevel.toFixed(1)}`
    : 'Workout-Level offen';
  if (fitDisplay) return `${level}: ${fitDisplay} fuer deine aktuelle Capability.`;
  return `${level}: noch nicht genug Ausfuehrungsdaten fuer eine belastbare Capability-Einschaetzung.`;
}

function roleCopy(workout: PulsePlannedWorkout): string {
  const archetype = workoutArchetypeCopy(workout.archetypeId);
  if (archetype) return `${archetype.label}: ${archetype.purpose}`;
  const system = workout.difficultyEnergySystem
    ? workout.difficultyEnergySystem.replaceAll('_', ' ')
    : `Zone ${workout.zone}`;
  return `Trainingsrolle: ${system}; ${workout.durationMin} min ${workout.activityType}.`;
}

function repetitionCopy(workout: PulsePlannedWorkout, repeatedCount: number): string {
  if (repeatedCount <= 1) {
    return 'einzeln im sichtbaren Plan: kein generisches Wiederholen, sondern ein isolierter Reiz.';
  }
  if (workout.capabilityFit === 'maintenance' || workout.zone <= 2) {
    return `${repeatedCount}x im sichtbaren Plan: bewusst wiederholbar, um Grundlage zu konsolidieren statt jedes Mal einen neuen Reiz zu erzwingen.`;
  }
  return `${repeatedCount}x im sichtbaren Plan: gleicher Reiz bleibt nur sinnvoll, wenn die letzte Ausfuehrung sauber war.`;
}

function changeTriggerCopy(workout: PulsePlannedWorkout, repeatedCount: number): string {
  if (workout.capabilityFit === 'too_hard_today') {
    return 'Aendern wenn: heute entschaerfen, verschieben oder frei lassen, bevor daraus ein erzwungener harter Tag wird.';
  }
  if (workout.capabilityFit === 'stretch') {
    return 'Aendern wenn: Warm-up, Fueling oder Kopf nicht passen; dann kuerzen, entschaerfen oder verschieben.';
  }
  if (workout.capabilityFit === 'productive') {
    return 'Aendern wenn: Warm-up auffaellig, Fueling unsicher oder Tagesstress deutlich hoeher ist als geplant.';
  }
  if (repeatedCount > 1) {
    return 'Aendern wenn: es sich langweilig, zu leicht oder durch Ermuedung nicht mehr sauber anfuehlt.';
  }
  return 'Aendern wenn: Tagesform, Zeitfenster oder Garmin-Handoff nicht zur Ausfuehrung passen.';
}

function labelFor(workout: PulsePlannedWorkout, repeatedCount: number): { label: string; tone: WorkoutProgressionInsight['tone'] } {
  if (workout.capabilityFit === 'maintenance' && repeatedCount > 1) {
    return { label: 'Bewusste Konsolidierung', tone: 'text' };
  }
  const fit = workout.capabilityFit ? FIT_COPY[workout.capabilityFit] : null;
  return {
    label: fit?.label ?? 'Progression offen',
    tone: fit?.tone ?? 'text',
  };
}

export function buildWorkoutProgressionInsight(input: {
  workout: PulsePlannedWorkout;
  workouts: PulsePlannedWorkout[];
  today: string;
}): WorkoutProgressionInsight {
  const future = visibleFutureWorkouts(input.workouts, input.today);
  const repeatedCount = Math.max(1, future.filter(workout => sameProgressionGroup(input.workout, workout)).length);
  const fitDisplay = input.workout.capabilityFit ? FIT_COPY[input.workout.capabilityFit].display : null;
  const label = labelFor(input.workout, repeatedCount);

  return {
    ...label,
    role: roleCopy(input.workout),
    calibration: calibrationCopy(input.workout, fitDisplay),
    repetition: repetitionCopy(input.workout, repeatedCount),
    changeTrigger: changeTriggerCopy(input.workout, repeatedCount),
    evidence: [
      input.workout.difficultyEnergySystem ? `System: ${input.workout.difficultyEnergySystem}` : null,
      input.workout.difficultyLevel != null ? `Level ${input.workout.difficultyLevel.toFixed(1)}` : null,
      fitDisplay ? `Fit: ${fitDisplay}` : null,
      repeatedCount > 1 ? `${repeatedCount}x gleicher Reiz` : 'einzeln im Plan',
    ].filter((item): item is string => item != null),
  };
}
