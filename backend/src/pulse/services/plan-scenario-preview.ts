import type {
  PulsePlanGarminApplyImpact,
  PulseActivityType,
  PulsePlanScenarioChangedDay,
  PulsePlanScenarioPreview,
  PulsePlanScenarioProjectedWorkout,
  PulsePlanScenarioRequest,
  PulseTrainingCapabilitySummary,
} from '@coaching-os/shared/pulse';
import { fitWorkoutToCapabilities } from './training-capabilities.js';
import { buildWorkoutLibraryPrescription } from './workout-library.js';

export interface PlanScenarioPreviewInput {
  today: string;
  workouts: PulsePlanScenarioProjectedWorkout[];
  scenario: PulsePlanScenarioRequest;
  capabilitySummary?: PulseTrainingCapabilitySummary | null;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function roundToFive(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}

function estimateTss(workout: Pick<PulsePlanScenarioProjectedWorkout, 'durationMin' | 'zone' | 'targetTss'>): number {
  if (workout.targetTss != null) return Math.round(workout.targetTss);
  const factor = [0, 0.35, 0.7, 0.9, 1.12, 1.3][Math.max(1, Math.min(5, workout.zone))] ?? 0.7;
  return Math.round(workout.durationMin * factor);
}

function durationFromTour(workout: PulsePlanScenarioRequest & { type: 'add_custom_tour' }): number {
  if (workout.workout.durationMin != null) return workout.workout.durationMin;
  const distance = workout.workout.distanceKm ?? 0;
  const speed = workout.workout.expectedSpeedKmh ?? 22;
  return Math.max(30, Math.round((distance / Math.max(1, speed)) * 60));
}

function project(input: PlanScenarioPreviewInput): PulsePlanScenarioProjectedWorkout[] {
  const workouts = input.workouts
    .filter(workout => workout.status !== 'skipped')
    .map(workout => ({ ...workout }));
  const scenario = input.scenario;

  if (scenario.type === 'add_custom_tour') {
    const durationMin = durationFromTour(scenario);
    workouts.push({
      id: 'preview-custom-tour',
      plannedDate: scenario.workout.plannedDate,
      activityType: scenario.workout.activityType,
      zone: scenario.workout.zone ?? 2,
      durationMin,
      targetTss: null,
      userLocked: true,
      status: 'planned',
      synthetic: true,
      description: scenario.workout.description ?? null,
      distanceKm: scenario.workout.distanceKm ?? null,
      expectedSpeedKmh: scenario.workout.expectedSpeedKmh ?? null,
      archetypeId: scenario.workout.archetypeId ?? null,
    });
  }

  if (scenario.type === 'move_workout') {
    return workouts.map(workout => workout.id === scenario.workoutId
      ? { ...workout, plannedDate: scenario.targetDate }
      : workout);
  }

  if (scenario.type === 'reduce_volume') {
    return workouts.map(workout => {
      if (workout.userLocked || workout.plannedDate < input.today) return workout;
      const durationMin = roundToFive(workout.durationMin * scenario.factor);
      return {
        ...workout,
        durationMin,
        targetTss: workout.targetTss != null ? Math.round(workout.targetTss * scenario.factor) : null,
      };
    });
  }

  return workouts;
}

function annotateCapabilityFit(
  workout: PulsePlanScenarioProjectedWorkout,
  capabilitySummary: PulseTrainingCapabilitySummary | null | undefined,
): PulsePlanScenarioProjectedWorkout {
  if (!capabilitySummary) return workout;

  const prescription = buildWorkoutLibraryPrescription({
    activityType: workout.activityType,
    zone: workout.zone,
    durationMin: workout.durationMin,
    targetTss: workout.targetTss,
    description: workout.description ?? null,
  }, capabilitySummary, { forcedArchetypeId: workout.archetypeId ?? null });
  const fitDetail = fitWorkoutToCapabilities({
    activityType: workout.activityType,
    zone: workout.zone,
    durationMin: workout.durationMin,
    targetTss: workout.targetTss,
    steps: prescription.steps,
  }, capabilitySummary);

  return {
    ...workout,
    archetypeId: workout.archetypeId ?? prescription.metadata.archetypeId,
    archetypeLabel: prescription.archetype.label,
    difficultyLevel: prescription.metadata.difficultyLevel,
    difficultyEnergySystem: prescription.metadata.difficultyEnergySystem,
    capabilityFit: fitDetail.label,
    capabilityFitDetail: fitDetail,
  };
}

function byDate(workouts: PulsePlanScenarioProjectedWorkout[]): Map<string, { sessions: number; durationMin: number; tss: number }> {
  const map = new Map<string, { sessions: number; durationMin: number; tss: number }>();
  for (const workout of workouts) {
    const current = map.get(workout.plannedDate) ?? { sessions: 0, durationMin: 0, tss: 0 };
    current.sessions += 1;
    current.durationMin += workout.durationMin;
    current.tss += estimateTss(workout);
    map.set(workout.plannedDate, current);
  }
  return map;
}

function emptyDay() {
  return { sessions: 0, durationMin: 0, tss: 0 };
}

function dayLabel(before: ReturnType<typeof emptyDay>, after: ReturnType<typeof emptyDay>): string {
  const sessionDelta = after.sessions - before.sessions;
  const tssDelta = after.tss - before.tss;
  if (sessionDelta > 0) return `+${sessionDelta} Einheit, +${tssDelta} TSS`;
  if (sessionDelta < 0) return `${sessionDelta} Einheit, ${tssDelta} TSS`;
  if (tssDelta !== 0) return `${tssDelta > 0 ? '+' : ''}${tssDelta} TSS`;
  return 'Recovery-Hinweis';
}

function changedDays(
  beforeWorkouts: PulsePlanScenarioProjectedWorkout[],
  afterWorkouts: PulsePlanScenarioProjectedWorkout[],
  extraDates: string[] = [],
): PulsePlanScenarioChangedDay[] {
  const before = byDate(beforeWorkouts);
  const after = byDate(afterWorkouts);
  const dates = new Set([...before.keys(), ...after.keys(), ...extraDates]);
  return [...dates]
    .sort()
    .map(date => {
      const beforeDay = before.get(date) ?? emptyDay();
      const afterDay = after.get(date) ?? emptyDay();
      return {
        date,
        before: beforeDay,
        after: afterDay,
        label: dayLabel(beforeDay, afterDay),
      };
    })
    .filter(day =>
      day.before.sessions !== day.after.sessions
      || day.before.durationMin !== day.after.durationMin
      || day.before.tss !== day.after.tss
      || extraDates.includes(day.date),
    );
}

function summarize(type: PulsePlanScenarioRequest['type']): string {
  if (type === 'add_custom_tour') return 'Eigene Einheit wird als user-locked Workout simuliert, ohne den Plan oder Garmin zu verändern.';
  if (type === 'move_workout') return 'Workout wird im Preview verschoben; andere Einheiten bleiben unverändert.';
  if (type === 'reduce_volume') return 'Offene, nicht gesperrte Workouts werden im Preview reduziert.';
  if (type === 'change_availability') return 'Verfügbarkeitsänderung wird als Planungsannahme vorgemerkt; bestehende Workouts bleiben im Preview erhalten.';
  return 'Event wird als Planungsannahme geprüft; der Kalender bleibt unverändert.';
}

function workoutChanged(before: PulsePlanScenarioProjectedWorkout | null, after: PulsePlanScenarioProjectedWorkout): boolean {
  if (!before) return true;
  return before.plannedDate !== after.plannedDate
    || before.activityType !== after.activityType
    || before.zone !== after.zone
    || before.durationMin !== after.durationMin
    || before.targetTss !== after.targetTss
    || before.archetypeId !== after.archetypeId
    || before.description !== after.description;
}

function garminImpact(input: PlanScenarioPreviewInput, projectedWorkouts: PulsePlanScenarioProjectedWorkout[]): PulsePlanGarminApplyImpact {
  const beforeById = new Map(input.workouts.map(workout => [workout.id, workout]));
  let creates = 0;
  let updates = 0;
  let unchanged = 0;

  for (const workout of projectedWorkouts) {
    const before = beforeById.get(workout.id) ?? null;
    if (!before || workout.synthetic) {
      creates += 1;
    } else if (workoutChanged(before, workout)) {
      updates += 1;
    } else {
      unchanged += 1;
    }
  }

  const deleted = input.workouts.filter(workout => !projectedWorkouts.some(projected => projected.id === workout.id)).length;
  const parts = [
    creates > 0 ? `${creates} neu` : null,
    updates > 0 ? `${updates} Update` : null,
    deleted > 0 ? `${deleted} entfernen` : null,
  ].filter(Boolean);

  return {
    creates,
    updates,
    deletes: deleted,
    unchanged,
    summary: parts.length > 0
      ? `Garmin nach Apply: ${parts.join(', ')}.`
      : 'Garmin nach Apply: keine Remote-Aenderung erwartet.',
  };
}

export function buildPlanScenarioPreview(input: PlanScenarioPreviewInput): PulsePlanScenarioPreview {
  const projectedWorkouts = project(input)
    .map(workout => annotateCapabilityFit(workout, input.capabilitySummary))
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const beforeTss = input.workouts.reduce((sum, workout) => sum + estimateTss(workout), 0);
  const afterTss = projectedWorkouts.reduce((sum, workout) => sum + estimateTss(workout), 0);
  const beforeDuration = input.workouts.reduce((sum, workout) => sum + workout.durationMin, 0);
  const afterDuration = projectedWorkouts.reduce((sum, workout) => sum + workout.durationMin, 0);

  const reasons: string[] = [];
  const warnings: string[] = [];
  let nextDayRecoveryDate: string | null = null;
  const extraDates: string[] = [];

  if (input.scenario.type === 'add_custom_tour') {
    const durationMin = durationFromTour(input.scenario);
    const distanceKm = input.scenario.workout.distanceKm ?? null;
    reasons.push('Eigene Einheit bleibt user-locked und wird nicht von der Wochenlogik ueberschrieben.');
    if (durationMin >= 240 || (distanceKm ?? 0) >= 100) {
      nextDayRecoveryDate = addDays(input.scenario.workout.plannedDate, 1);
      extraDates.push(nextDayRecoveryDate);
      reasons.push('Lange Tour: Fueling und GI-Komfort werden zur Akzeptanzbedingung.');
      reasons.push('Folgetag als Recovery/Feedback-Fenster schützen.');
      warnings.push(`${distanceKm != null ? Math.round(distanceKm) + ' km' : Math.round(durationMin / 60) + ' h'} simuliert: danach keine harte Einheit erzwingen.`);
    }
  }

  if (input.scenario.type === 'move_workout') {
    reasons.push('Preview verschiebt nur das gewaehlte Workout; Apply kann den bestehenden Garmin-Remote-Stand ueber die normale Workout-Aenderung bereinigen.');
  }

  if (input.scenario.type === 'reduce_volume') {
    reasons.push('User-locked Workouts bleiben unverändert.');
    reasons.push(`Offene Planlast wird auf ${Math.round(input.scenario.factor * 100)}% reduziert.`);
  }

  if (input.scenario.type === 'change_availability') {
    reasons.push('Verfuegbarkeit wird als Planungsannahme gezeigt, ohne bestehende Workouts zu loeschen.');
  }

  if (input.scenario.type === 'add_event') {
    reasons.push('Event wird als Zielkontext bewertet; eine dauerhafte Zielanlage erfolgt separat.');
  }

  return {
    type: input.scenario.type,
    summary: summarize(input.scenario.type),
    projectedWorkouts,
    changedDays: changedDays(input.workouts, projectedWorkouts, extraDates),
    loadImpact: {
      tssDelta: afterTss - beforeTss,
      durationDeltaMin: afterDuration - beforeDuration,
      nextDayRecoveryDate,
    },
    reasons,
    warnings,
    applySupported: input.scenario.type === 'add_custom_tour'
      || input.scenario.type === 'move_workout'
      || input.scenario.type === 'reduce_volume',
    garminImpact: garminImpact(input, projectedWorkouts),
  };
}
