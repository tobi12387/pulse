import type { WorkoutStep } from '../../db/pulse-schema.js';
import type {
  PulseFuelingRecoveryGuidanceResponse,
  PulseGarminPayloadSnapshot,
  PulseGarminSyncContract,
  PulseGarminSyncContractIssue,
} from '@coaching-os/shared/pulse';

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
const GARMIN_FUELING_HEADER = 'Pulse Fueling:';

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

function stripGarminFuelingBlock(description: string): string {
  const index = description.indexOf(GARMIN_FUELING_HEADER);
  if (index < 0) return description.trim();

  const before = description.slice(0, index).replace(/\s+$/, '');
  return before.trim();
}

function conciseGarminText(text: string, maxLength = 130): string {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/; .+$/, '')
    .replace(/, an .+$/, '')
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function firstGuidanceText(
  items: PulseFuelingRecoveryGuidanceResponse['during'],
  idPart: string,
): string | null {
  const item = items.find(candidate => candidate.id.includes(idPart)) ?? items[0];
  return item ? conciseGarminText(item.text) : null;
}

export function appendGarminFuelingDescription(
  description: string | null,
  guidance: PulseFuelingRecoveryGuidanceResponse | null | undefined,
): string {
  const base = stripGarminFuelingBlock(description ?? '');
  if (!guidance?.shouldShow || guidance.preferenceStatus !== 'ready') {
    return base || 'Fueling nach Gefühl und Verträglichkeit.';
  }

  const lines: string[] = [];
  const carbs = firstGuidanceText(guidance.during, 'carbs');
  const sodium = firstGuidanceText(guidance.during.filter(item => item.id.includes('sodium')), 'sodium');
  const after = guidance.after[0]?.text ? conciseGarminText(guidance.after[0].text) : null;
  const caution = guidance.recoveryCautions[0] ? conciseGarminText(guidance.recoveryCautions[0]) : null;

  if (carbs) lines.push(`- Während: ${carbs}`);
  if (sodium) lines.push(`- Sodium: ${sodium}`);
  if (after) lines.push(`- Danach: ${after}`);
  if (caution) lines.push(`- Achtung: ${caution}`);

  if (lines.length === 0) return base || 'Fueling nach Gefühl und Verträglichkeit.';
  return `${base ? `${base}\n\n` : ''}${GARMIN_FUELING_HEADER}\n${lines.join('\n')}`;
}

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
}, options: { fuelingGuidance?: PulseFuelingRecoveryGuidanceResponse | null } = {}) {
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
    description: appendGarminFuelingDescription(
      workout.description ?? `Zone ${workout.zone} Training`,
      options.fuelingGuidance,
    ),
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

function contractIssue(issue: PulseGarminSyncContractIssue): PulseGarminSyncContractIssue {
  return issue;
}

function payloadWorkoutSteps(payload: unknown): unknown[] {
  const segments = typeof payload === 'object' && payload != null && Array.isArray((payload as { workoutSegments?: unknown }).workoutSegments)
    ? (payload as { workoutSegments: Array<{ workoutSteps?: unknown }> }).workoutSegments
    : [];
  return segments.flatMap(segment => Array.isArray(segment.workoutSteps) ? segment.workoutSteps : []);
}

function isGarminRepeatGroup(step: unknown): step is Partial<GarminRepeatGroup> {
  return typeof step === 'object' && step != null && (step as { type?: unknown }).type === 'RepeatGroupDTO';
}

function flattenGarminWorkoutSteps(steps: unknown[]): unknown[] {
  return steps.flatMap(step => {
    if (isGarminRepeatGroup(step)) {
      const childSteps = Array.isArray(step.workoutSteps) ? step.workoutSteps : [];
      return [step, ...flattenGarminWorkoutSteps(childSteps)];
    }
    return [step];
  });
}

export function summarizeGarminPayloadSnapshot(
  payload: unknown,
  ids: {
    workoutId?: string | null;
    scheduledId?: string | null;
    checkedAt?: string;
  } = {},
): PulseGarminPayloadSnapshot {
  const steps = flattenGarminWorkoutSteps(payloadWorkoutSteps(payload));
  const repeatGroups = steps.filter(isGarminRepeatGroup);
  const executable = steps.filter(step => typeof step === 'object' && step != null && (step as { type?: string }).type === 'ExecutableStepDTO');
  const invalidRepeatCount = repeatGroups.filter(step => {
    const repeat = step as Partial<GarminRepeatGroup>;
    return (repeat.numberOfIterations ?? 0) <= 0
      || (repeat.endConditionValue ?? 0) <= 0
      || repeat.endCondition?.conditionTypeKey !== 'iterations';
  }).length;
  const hrTargetStepCount = executable.filter(step =>
    (step as { targetType?: { workoutTargetTypeKey?: string } }).targetType?.workoutTargetTypeKey === 'heart.rate.zone'
  ).length;

  return {
    workoutId: ids.workoutId ?? null,
    scheduledId: ids.scheduledId ?? null,
    stepCount: steps.length,
    repeatGroupCount: repeatGroups.length,
    invalidRepeatCount,
    hrTargetStepCount,
    durationSec: typeof payload === 'object' && payload != null
      ? ((payload as { estimatedDurationInSecs?: number }).estimatedDurationInSecs ?? null)
      : null,
    checkedAt: ids.checkedAt ?? new Date().toISOString(),
  };
}

function summarizeGarminContract(status: PulseGarminSyncContract['status'], issues: PulseGarminSyncContractIssue[]): string {
  if (status === 'blocked') {
    const first = issues.find(issue => issue.severity === 'error') ?? issues[0];
    return first ? `Garmin-Sync blockiert: ${first.message}` : 'Garmin-Sync blockiert: Payload pruefen.';
  }
  if (status === 'degraded') {
    const warnings = issues.filter(issue => issue.severity === 'warning');
    const first = warnings[0] ?? issues[0];
    return first ? `Garmin-Upload mit Einschränkung: ${first.message}` : 'Garmin-Upload mit Einschränkung.';
  }
  return 'Garmin-Payload bereit: Wiederholungen und Ziele sind pruefbar.';
}

export function buildGarminSyncContract(
  workout: {
    activityType: string;
    steps: WorkoutStep[] | null;
  },
  payload: unknown,
  options: { checkedAt?: string } = {},
): PulseGarminSyncContract {
  const issues: PulseGarminSyncContractIssue[] = [];
  const steps = workout.steps ?? [];
  if (steps.length === 0) {
    issues.push(contractIssue({
      code: 'empty_steps',
      severity: 'error',
      message: 'Workout hat keine strukturierten Schritte fuer Garmin.',
    }));
  }

  steps.forEach((step, index) => {
    if (step.durationMin <= 0) {
      issues.push(contractIssue({
        code: 'invalid_step_duration',
        severity: 'error',
        message: `Schritt ${index + 1} hat keine gueltige Dauer.`,
        stepIndex: index,
      }));
    }
  });

  const repeatGroups = payloadWorkoutSteps(payload).filter(isGarminRepeatGroup);
  const localRepeats = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.type === 'interval' && (step.reps ?? 0) > 1);

  localRepeats.forEach(({ step, index }, repeatIndex) => {
    const repeat = repeatGroups[repeatIndex];
    if (!repeat) {
      issues.push(contractIssue({
        code: 'repeat_group_missing',
        severity: 'error',
        message: `Intervall-Schritt ${index + 1} hat Wiederholungen, aber keine Garmin-Repeat-Gruppe.`,
        stepIndex: index,
      }));
      return;
    }

    const expected = step.reps ?? 0;
    const numberOfIterations = repeat.numberOfIterations ?? null;
    const endConditionValue = repeat.endConditionValue ?? null;
    if (
      numberOfIterations == null ||
      numberOfIterations <= 0 ||
      endConditionValue == null ||
      endConditionValue <= 0 ||
      numberOfIterations !== expected ||
      endConditionValue !== expected ||
      repeat.endCondition?.conditionTypeKey !== 'iterations'
    ) {
      issues.push(contractIssue({
        code: 'repeat_iterations_invalid',
        severity: 'error',
        message: `Intervall-Schritt ${index + 1} wuerde mit ungueltiger Wiederholungszahl zu Garmin gehen.`,
        stepIndex: index,
      }));
    }
  });

  if (!supportsGarminHrTargets(workout.activityType) && steps.some(step => step.zone > 1)) {
    issues.push(contractIssue({
      code: 'unsupported_hr_target',
      severity: 'warning',
      message: `${GARMIN_ACTIVITY_NAMES[workout.activityType] ?? workout.activityType} wird auf Garmin ohne HR-Zielzonen hochgeladen.`,
    }));
  }

  const status: PulseGarminSyncContract['status'] = issues.some(issue => issue.severity === 'error')
    ? 'blocked'
    : issues.some(issue => issue.severity === 'warning')
      ? 'degraded'
      : 'ready';

  return {
    version: 1,
    status,
    payloadReady: status !== 'blocked',
    checkedAt: options.checkedAt ?? new Date().toISOString(),
    summary: summarizeGarminContract(status, issues),
    issues,
  };
}

export function previewGarminSyncContract(workout: {
  activityType: string;
  zone: number;
  durationMin: number;
  description: string | null;
  steps: WorkoutStep[] | null;
}): PulseGarminSyncContract {
  return buildGarminSyncContract(workout, buildGarminWorkoutJson(workout));
}

export function buildGarminRemoteRepeatRepairContract(options: { checkedAt?: string } = {}): PulseGarminSyncContract {
  const issues = [contractIssue({
    code: 'remote_repeat_repair',
    severity: 'warning',
    message: 'Remote-Garmin-Workout hatte ungueltige Wiederholungen und wird neu aufgebaut.',
  })];
  return {
    version: 1,
    status: 'degraded',
    payloadReady: true,
    checkedAt: options.checkedAt ?? new Date().toISOString(),
    summary: summarizeGarminContract('degraded', issues),
    issues,
  };
}
