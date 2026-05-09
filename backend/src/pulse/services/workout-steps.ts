import type { PulseTrainingCapabilitySummary } from '@coaching-os/shared/pulse';
import type { WorkoutStep } from '../../db/pulse-schema.js';
import { hrTargetRangeForZone } from '@coaching-os/shared/pulse-thresholds';
import { buildWorkoutLibraryPrescription, type WorkoutLibraryMetadata } from './workout-library.js';

type WorkoutStepWorkout = {
  id?: string;
  activityType: string;
  zone: number;
  durationMin: number;
  targetTss?: number | null;
  description: string | null;
};

type WorkoutStepProfile = {
  ftpWatts?: number | null;
  maxHrBpm: number | null;
  lthrBpm: number | null;
};

function supportsHrStepTargets(activityType: string): boolean {
  return activityType === 'run' || activityType === 'bike' || activityType === 'hike';
}

function addHrTargetToStep(step: WorkoutStep, profile: WorkoutStepProfile | undefined): WorkoutStep {
  const maxHr = profile?.maxHrBpm ?? 185;
  const target = hrTargetRangeForZone(step.zone, maxHr, profile?.lthrBpm ?? null);
  const description = step.description?.includes('bpm')
    ? step.description
    : `${step.description ? `${step.description} ` : ''}HR ${target.label}.`.trim();
  const next: WorkoutStep = {
    ...step,
    description,
    targetLabel: target.label,
  };
  if (target.minBpm != null) next.targetHrMinBpm = target.minBpm;
  if (target.maxBpm != null) next.targetHrMaxBpm = target.maxBpm;
  return next;
}

export async function buildWorkoutSteps(
  workout: WorkoutStepWorkout,
  profile: WorkoutStepProfile | undefined,
  capabilitySummary?: PulseTrainingCapabilitySummary | null,
): Promise<{ steps: WorkoutStep[]; updatedDescription: string | null; metadata: WorkoutLibraryMetadata }> {
  const library = buildWorkoutLibraryPrescription(workout, capabilitySummary);
  return {
    steps: library.steps.map(step => supportsHrStepTargets(workout.activityType) ? addHrTargetToStep(step, profile) : step),
    updatedDescription: library.description,
    metadata: library.metadata,
  };
}
