import type {
  PulseAdaptationEvent,
  PulseActivityType,
  PulsePlanGarminApplyImpact,
  PulsePlanRefreshComparison,
  PulsePlanRefreshPreview,
  PulsePlanRefreshTrigger,
  PulsePlanRefreshTriggerKind,
  PulsePlanRefreshWorkoutSnapshot,
} from '@coaching-os/shared/pulse';
import { PLAN_ENGINE_VERSION } from './plan-engine-version.js';

export { PLAN_ENGINE_VERSION };

type RefreshWorkoutInput = {
  id: string;
  plannedDate: string;
  activityType: PulseActivityType;
  zone: number;
  durationMin: number;
  targetTss: number | null;
  userLocked: boolean;
  status: string;
  description?: string | null;
  archetypeId?: string | null;
};

type RefreshTraceInput = {
  createdAt: string;
  engineVersion?: string | null;
} | null;

export interface PlanRefreshPreviewInput {
  today: string;
  weekStart: string;
  currentWorkouts: RefreshWorkoutInput[];
  adaptationEvents: PulseAdaptationEvent[];
  latestTrace: RefreshTraceInput;
  latestCapabilityUpdatedAt: string | null;
  generatedAt?: string;
}

const TRIGGER_LABELS: Record<PulsePlanRefreshTriggerKind, string> = {
  new_activity: 'Neue Aktivität',
  high_rpe: 'RPE-Schutz',
  gi_issue: 'Fueling/GI',
  mental_protect: 'Mental schützen',
  capability_update: 'Capability-Update',
  missed_or_replaced: 'Ausführung abweichend',
  stale_engine: 'Planlogik aktualisiert',
};

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function roundToFive(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}

function estimateTss(workout: Pick<PulsePlanRefreshWorkoutSnapshot, 'durationMin' | 'zone' | 'targetTss'>): number {
  if (workout.targetTss != null) return Math.round(workout.targetTss);
  const factor = [0, 0.35, 0.7, 0.9, 1.12, 1.3][Math.max(1, Math.min(5, workout.zone))] ?? 0.7;
  return Math.round(workout.durationMin * factor);
}

function extractWhy(description: string | null | undefined): string | null {
  if (!description) return null;
  const line = description.split(/\r?\n/).find(part => part.trim().length > 0)?.trim() ?? '';
  const prefix = 'Warum diese Einheit:';
  if (!line.startsWith(prefix)) return null;
  const why = line.slice(prefix.length).trim();
  return why.length > 0 ? why : null;
}

function toSnapshot(workout: RefreshWorkoutInput): PulsePlanRefreshWorkoutSnapshot {
  return {
    id: workout.id,
    plannedDate: workout.plannedDate,
    activityType: workout.activityType,
    zone: workout.zone,
    durationMin: workout.durationMin,
    targetTss: workout.targetTss,
    archetypeId: workout.archetypeId ?? null,
    why: extractWhy(workout.description),
    userLocked: workout.userLocked,
  };
}

function eventTrigger(event: PulseAdaptationEvent): PulsePlanRefreshTrigger | null {
  const kindByEvent: Partial<Record<PulseAdaptationEvent['kind'], PulsePlanRefreshTriggerKind>> = {
    activity_completed: 'new_activity',
    high_rpe: 'high_rpe',
    fueling_limiter: 'gi_issue',
    mental_load: 'mental_protect',
    planned_workout_missed: 'missed_or_replaced',
    workout_replaced: 'missed_or_replaced',
  };
  const kind = kindByEvent[event.kind];
  if (!kind) return null;
  return {
    kind,
    label: TRIGGER_LABELS[kind],
    detail: event.summary,
    severity: event.severity,
    evidence: event.evidence,
  };
}

function uniqueTriggers(triggers: PulsePlanRefreshTrigger[]): PulsePlanRefreshTrigger[] {
  const seen = new Set<PulsePlanRefreshTriggerKind>();
  const result: PulsePlanRefreshTrigger[] = [];
  for (const trigger of triggers) {
    if (seen.has(trigger.kind)) continue;
    seen.add(trigger.kind);
    result.push(trigger);
  }
  return result;
}

function latestTraceDate(trace: RefreshTraceInput): number | null {
  if (!trace?.createdAt) return null;
  const time = Date.parse(trace.createdAt);
  return Number.isFinite(time) ? time : null;
}

function deriveTriggers(input: PlanRefreshPreviewInput): PulsePlanRefreshTrigger[] {
  const triggers = input.adaptationEvents
    .map(eventTrigger)
    .filter((trigger): trigger is PulsePlanRefreshTrigger => trigger != null);
  const hasVisiblePlan = input.currentWorkouts.some(workout => workout.status === 'planned');
  const traceTime = latestTraceDate(input.latestTrace);
  const capabilityTime = input.latestCapabilityUpdatedAt ? Date.parse(input.latestCapabilityUpdatedAt) : Number.NaN;

  if (hasVisiblePlan && traceTime != null && Number.isFinite(capabilityTime) && capabilityTime > traceTime) {
    triggers.push({
      kind: 'capability_update',
      label: TRIGGER_LABELS.capability_update,
      detail: 'Trainingsfähigkeiten wurden nach der letzten Planerstellung aktualisiert.',
      severity: 'info',
      evidence: [`Capability ${input.latestCapabilityUpdatedAt}`],
    });
  }

  if (hasVisiblePlan && (!input.latestTrace || input.latestTrace.engineVersion !== PLAN_ENGINE_VERSION)) {
    triggers.push({
      kind: 'stale_engine',
      label: TRIGGER_LABELS.stale_engine,
      detail: 'Die Planlogik ist neuer als der zuletzt gespeicherte Wochenplan.',
      severity: 'info',
      evidence: [input.latestTrace?.engineVersion ? `Plan ${input.latestTrace.engineVersion}` : 'Kein Engine-Marker im Plan'],
    });
  }

  return uniqueTriggers(triggers);
}

function hasTrigger(triggers: PulsePlanRefreshTrigger[], kind: PulsePlanRefreshTriggerKind): boolean {
  return triggers.some(trigger => trigger.kind === kind);
}

function proposalForWorkout(
  current: PulsePlanRefreshWorkoutSnapshot,
  triggers: PulsePlanRefreshTrigger[],
  today: string,
): { proposed: PulsePlanRefreshWorkoutSnapshot; reason: string } {
  let proposed = { ...current };
  let reason = 'Kein belastbarer Anpassungsgrund fuer diese Einheit.';
  if (current.userLocked || current.plannedDate < today) {
    return {
      proposed,
      reason: current.userLocked
        ? 'User-locked: Refresh wuerde diese Einheit nicht automatisch veraendern.'
        : 'Vergangene Einheiten bleiben unangetastet.',
    };
  }

  const protectHard = hasTrigger(triggers, 'high_rpe')
    || hasTrigger(triggers, 'mental_protect')
    || hasTrigger(triggers, 'missed_or_replaced');
  const giProtect = hasTrigger(triggers, 'gi_issue');
  const nextDayRecovery = hasTrigger(triggers, 'new_activity') && current.plannedDate <= addDays(today, 1);

  if ((protectHard || nextDayRecovery) && current.zone >= 4) {
    const durationMin = roundToFive(Math.max(30, Math.min(60, current.durationMin * 0.65)));
    proposed = {
      ...proposed,
      zone: 2,
      durationMin,
      targetTss: Math.round(durationMin * 0.7),
      why: 'Schutzsignal aktiv: harte Reize erst wieder nach Feedback, Readiness und Verdauung stabilisieren.',
    };
    reason = 'Harte Einheit wuerde im Refresh zu kontrollierter Endurance werden.';
  } else if (giProtect && current.durationMin >= 120) {
    const durationMin = roundToFive(Math.min(current.durationMin, 90));
    proposed = {
      ...proposed,
      zone: Math.min(current.zone, 2),
      durationMin,
      targetTss: Math.round(durationMin * 0.7),
      why: 'GI-Schutz offen: erst kontrollierte Fueling-Praxis, bevor lange oder harte Arbeit steigt.',
    };
    reason = 'Lange Einheit wuerde bis zur Fueling-Klaerung gedeckelt.';
  } else if (hasTrigger(triggers, 'capability_update') && current.zone <= 2 && current.durationMin < 150) {
    const durationMin = roundToFive(Math.min(150, current.durationMin + 10));
    proposed = {
      ...proposed,
      durationMin,
      targetTss: Math.round(durationMin * 0.7),
      why: 'Capability-Update erlaubt einen kleinen produktiven Endurance-Reiz.',
    };
    reason = 'Capability-Fortschritt wuerde die lockere Einheit leicht progressiver machen.';
  }

  return { proposed, reason };
}

function changes(
  current: PulsePlanRefreshWorkoutSnapshot,
  proposed: PulsePlanRefreshWorkoutSnapshot,
): PulsePlanRefreshComparison['changes'] {
  const result: PulsePlanRefreshComparison['changes'] = [];
  if (current.plannedDate !== proposed.plannedDate) result.push('date');
  if (current.activityType !== proposed.activityType) result.push('sport');
  if (current.zone !== proposed.zone) result.push('zone');
  if (current.durationMin !== proposed.durationMin) result.push('duration');
  if (current.archetypeId !== proposed.archetypeId) result.push('archetype');
  if (current.why !== proposed.why) result.push('why');
  return result;
}

function summarize(input: {
  triggers: PulsePlanRefreshTrigger[];
  comparisons: PulsePlanRefreshComparison[];
  lockedCount: number;
}): string {
  if (input.triggers.length === 0) return 'Der sichtbare Plan passt zu den aktuell bekannten Signalen.';
  const lockedSuffix = input.lockedCount > 0 ? ` ${input.lockedCount} gesperrte Einheit(en) bleiben unveraendert.` : '';
  if (input.comparisons.length === 0) {
    return `Neue Signale sind vorhanden, aber sie wuerden aktuell keine offene Einheit automatisch veraendern.${lockedSuffix}`;
  }
  return `${input.triggers.length} Signal(e) sprechen fuer eine Planpruefung; ${input.comparisons.length} offene Einheit(en) wuerden sich aendern.${lockedSuffix}`;
}

function garminImpact(totalWorkouts: number, comparisons: PulsePlanRefreshComparison[]): PulsePlanGarminApplyImpact {
  const updates = comparisons.length;
  return {
    creates: 0,
    updates,
    deletes: 0,
    unchanged: Math.max(0, totalWorkouts - updates),
    summary: updates > 0
      ? `Garmin nach Apply: ${updates} Workout-Update(s) erwartet; keine Loeschung in der Vorschau.`
      : 'Garmin nach Apply: keine Remote-Aenderung erwartet.',
  };
}

export function buildPlanRefreshPreview(input: PlanRefreshPreviewInput): PulsePlanRefreshPreview {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const triggers = deriveTriggers(input);
  const snapshots = input.currentWorkouts
    .filter(workout => workout.status === 'planned')
    .map(toSnapshot)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const comparisons: PulsePlanRefreshComparison[] = [];

  for (const current of snapshots) {
    const { proposed, reason } = proposalForWorkout(current, triggers, input.today);
    const changed = changes(current, proposed);
    if (changed.length === 0) continue;
    comparisons.push({
      date: proposed.plannedDate,
      current,
      proposed,
      changes: changed,
      reason,
    });
  }

  const beforeTss = snapshots.reduce((sum, workout) => sum + estimateTss(workout), 0);
  const afterTss = snapshots.reduce((sum, workout) => {
    const comparison = comparisons.find(item => item.current?.id === workout.id);
    return sum + estimateTss(comparison?.proposed ?? workout);
  }, 0);
  const beforeDuration = snapshots.reduce((sum, workout) => sum + workout.durationMin, 0);
  const afterDuration = snapshots.reduce((sum, workout) => {
    const comparison = comparisons.find(item => item.current?.id === workout.id);
    return sum + (comparison?.proposed?.durationMin ?? workout.durationMin);
  }, 0);
  const lockedCount = snapshots.filter(workout => workout.userLocked).length;

  return {
    weekStart: input.weekStart,
    generatedAt,
    stale: triggers.length > 0 || comparisons.length > 0,
    summary: summarize({ triggers, comparisons, lockedCount }),
    triggers,
    comparisons,
    loadImpact: {
      tssDelta: afterTss - beforeTss,
      durationDeltaMin: afterDuration - beforeDuration,
    },
    garminImpact: garminImpact(snapshots.length, comparisons),
    applySupported: false,
    mutationBoundary: 'Read-only: diese Vorschau fuehrt keine DB- oder Garmin-Schreibaktion aus.',
  };
}
