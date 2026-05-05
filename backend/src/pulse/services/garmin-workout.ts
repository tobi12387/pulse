import type { WorkoutStep } from '../../db/pulse-schema.js';

const GARMIN_SPORT_TYPES: Record<string, { sportTypeId: number; sportTypeKey: string }> = {
  run:      { sportTypeId: 1,  sportTypeKey: 'running' },
  bike:     { sportTypeId: 2,  sportTypeKey: 'cycling' },
  swim:     { sportTypeId: 5,  sportTypeKey: 'swimming' },
  strength: { sportTypeId: 13, sportTypeKey: 'strength_training' },
  hike:     { sportTypeId: 1,  sportTypeKey: 'running' },
  other:    { sportTypeId: 1,  sportTypeKey: 'running' },
};

const GARMIN_STEP_TYPES: Record<string, { stepTypeId: number; stepTypeKey: string }> = {
  warmup:   { stepTypeId: 1, stepTypeKey: 'warmup' },
  cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown' },
  interval: { stepTypeId: 3, stepTypeKey: 'interval' },
  steady:   { stepTypeId: 3, stepTypeKey: 'interval' },
  rest:     { stepTypeId: 4, stepTypeKey: 'recovery' },
};

const GARMIN_TIME_COND = { conditionTypeId: 2, conditionTypeKey: 'time', displayOrder: 0, displayable: true };
const GARMIN_ITERATIONS_COND = { conditionTypeId: 7, conditionTypeKey: 'iterations', displayOrder: 7, displayable: false };
const GARMIN_NO_TARGET = { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target', displayOrder: 0 };
const GARMIN_HR_ZONE_TARGET = { workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone', displayOrder: 0 };
const GARMIN_NULL_FIELDS = {
  childStepId: null,
  endConditionCompare: null,
  targetValueOne: null,
  targetValueTwo: null,
  targetValueUnit: null,
  zoneNumber: null,
  secondaryTargetType: null,
  secondaryTargetValueOne: null,
  secondaryTargetValueTwo: null,
  secondaryTargetValueUnit: null,
  secondaryZoneNumber: null,
  endConditionZone: null,
  preferredEndConditionUnit: null,
  strokeType: { strokeTypeId: 0, strokeTypeKey: null, displayOrder: 0 },
  equipmentType: { equipmentTypeId: 0, equipmentTypeKey: null, displayOrder: 0 },
  category: null,
  exerciseName: null,
  workoutProvider: null,
  providerExerciseSourceId: null,
};
const GARMIN_ACTIVITY_NAMES: Record<string, string> = {
  run: 'Laufen',
  bike: 'Radfahren',
  swim: 'Schwimmen',
  strength: 'Kraft',
};

type GarminWorkoutStepType = { stepTypeId: number; stepTypeKey: string; displayOrder?: number };
type GarminEndCondition = { conditionTypeId: number; conditionTypeKey: string; displayOrder: number; displayable: boolean };

export type GarminExecutableStep = {
  type: 'ExecutableStepDTO';
  stepOrder: number;
  stepType: GarminWorkoutStepType;
  description: string | null;
  endCondition: GarminEndCondition;
  endConditionValue: number;
  targetType: typeof GARMIN_NO_TARGET | typeof GARMIN_HR_ZONE_TARGET;
  zoneNumber: number | null;
};

export type GarminRepeatGroup = {
  type: 'RepeatGroupDTO';
  stepOrder: number;
  stepType: { stepTypeId: 6; stepTypeKey: 'repeat'; displayOrder: 0 };
  childStepId: number;
  numberOfIterations: number;
  endCondition: typeof GARMIN_ITERATIONS_COND;
  endConditionValue: number;
  workoutSteps: GarminExecutableStep[];
  preferredEndConditionUnit: null;
  endConditionCompare: null;
  skipLastRestStep: null;
  smartRepeat: false;
};

export type GarminWorkoutStep = GarminExecutableStep | GarminRepeatGroup;

function supportsGarminHrTargets(activityType: string): boolean {
  return activityType === 'run' || activityType === 'bike' || activityType === 'hike';
}

function garminTargetFields(activityType: string, step: WorkoutStep) {
  if (!supportsGarminHrTargets(activityType)) {
    return { ...GARMIN_NULL_FIELDS, targetType: GARMIN_NO_TARGET };
  }
  return {
    ...GARMIN_NULL_FIELDS,
    targetType: GARMIN_HR_ZONE_TARGET,
    zoneNumber: Math.max(1, Math.min(5, step.zone)),
  };
}

export function buildGarminWorkoutJson(workout: {
  activityType: string;
  zone: number;
  durationMin: number;
  description: string | null;
  steps: WorkoutStep[] | null;
}) {
  const sportType = GARMIN_SPORT_TYPES[workout.activityType] ?? GARMIN_SPORT_TYPES.run!;
  let stepOrder = 0;
  const garminSteps: GarminWorkoutStep[] = [];

  for (const step of workout.steps ?? []) {
    const stepType = (GARMIN_STEP_TYPES[step.type] ?? GARMIN_STEP_TYPES.interval)!;
    const durationSecs = step.durationMin * 60;

    if (step.type === 'interval' && step.reps && step.reps > 1) {
      const restSecs = (step.restMin ?? 2) * 60;
      const innerSteps: GarminExecutableStep[] = [
        {
          type: 'ExecutableStepDTO',
          stepOrder: 1,
          stepType: { ...GARMIN_STEP_TYPES.interval!, displayOrder: 0 },
          description: step.description ?? `Zone ${step.zone}`,
          endCondition: GARMIN_TIME_COND,
          endConditionValue: durationSecs,
          ...garminTargetFields(workout.activityType, step),
        },
      ];
      if (step.restMin) {
        const restStep: WorkoutStep = { type: 'rest', durationMin: step.restMin, zone: 1 };
        innerSteps.push({
          type: 'ExecutableStepDTO',
          stepOrder: 2,
          stepType: { ...GARMIN_STEP_TYPES.rest!, displayOrder: 0 },
          description: 'Erholung',
          endCondition: GARMIN_TIME_COND,
          endConditionValue: restSecs,
          ...garminTargetFields(workout.activityType, restStep),
        });
      }
      stepOrder++;
      garminSteps.push({
        type: 'RepeatGroupDTO',
        stepOrder,
        stepType: { stepTypeId: 6, stepTypeKey: 'repeat', displayOrder: 0 },
        childStepId: 1,
        numberOfIterations: step.reps,
        endCondition: GARMIN_ITERATIONS_COND,
        endConditionValue: step.reps,
        workoutSteps: innerSteps,
        preferredEndConditionUnit: null,
        endConditionCompare: null,
        skipLastRestStep: null,
        smartRepeat: false,
      });
    } else {
      stepOrder++;
      garminSteps.push({
        type: 'ExecutableStepDTO',
        stepOrder,
        stepType: { ...stepType, displayOrder: 0 },
        description: step.description ?? null,
        endCondition: GARMIN_TIME_COND,
        endConditionValue: durationSecs,
        ...garminTargetFields(workout.activityType, step),
      });
    }
  }

  return {
    workoutName: `${GARMIN_ACTIVITY_NAMES[workout.activityType] ?? workout.activityType} – Z${workout.zone} · ${workout.durationMin}min`,
    description: workout.description ?? `Zone ${workout.zone} Training`,
    sportType,
    estimatedDurationInSecs: workout.durationMin * 60,
    estimatedDistanceInMeters: null,
    workoutSegments: [{ segmentOrder: 1, sportType, workoutSteps: garminSteps }],
  };
}

export function workoutHasRepeatSteps(steps: WorkoutStep[] | null | undefined): boolean {
  return (steps ?? []).some(step => step.type === 'interval' && (step.reps ?? 0) > 1);
}

export function garminWorkoutHasBrokenRepeatIterations(workout: unknown): boolean {
  const segments = typeof workout === 'object' && workout != null && Array.isArray((workout as { workoutSegments?: unknown }).workoutSegments)
    ? (workout as { workoutSegments: Array<{ workoutSteps?: unknown }> }).workoutSegments
    : [];

  return segments.some(segment => {
    const steps = Array.isArray(segment.workoutSteps) ? segment.workoutSteps : [];
    return steps.some(step => {
      if (typeof step !== 'object' || step == null) return false;
      const repeat = step as {
        type?: string;
        numberOfIterations?: number | null;
        endConditionValue?: number | null;
        endCondition?: { conditionTypeKey?: string | null } | null;
      };
      if (repeat.type !== 'RepeatGroupDTO') return false;
      return (
        repeat.numberOfIterations == null ||
        repeat.numberOfIterations <= 0 ||
        repeat.endConditionValue == null ||
        repeat.endConditionValue <= 0 ||
        repeat.endCondition?.conditionTypeKey !== 'iterations'
      );
    });
  });
}
