import type { PulseNextBestAction } from '@coaching-os/shared/pulse';

export type ActionDecisionStatus = 'open' | 'completed' | 'deferred' | 'dismissed' | 'superseded';
export type ActionDecisionKind = 'checkin' | 'workout' | 'rpe' | 'risk' | 'plan' | 'push' | 'equipment' | 'manual';

export type ActionDecisionRawContext = Record<string, unknown>;

export interface ActionDecisionRecord {
  id: string;
  userId: string;
  source: string;
  sourceId: string | null;
  kind: ActionDecisionKind | string;
  title: string;
  status: ActionDecisionStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolutionReason: string | null;
  targetRoute: string | null;
  rawContext: ActionDecisionRawContext | null;
}

export interface DecisionTransition {
  status: Exclude<ActionDecisionStatus, 'open'>;
  at?: string;
  reason?: string | null;
}

export interface DecisionClosureSignals {
  today?: string;
  now?: string;
  checkinDates?: string[];
  matchedWorkoutActivity?: {
    plannedWorkoutId: string;
    activityId: string;
    matchedAt?: string;
  } | null;
  replacementActivity?: {
    plannedWorkoutId: string;
    activityId: string;
    matchedAt?: string;
  } | null;
}

export interface DecisionClosureOptions {
  transition?: DecisionTransition;
  signals?: DecisionClosureSignals;
}

export interface DerivedDecisionStatus {
  status: ActionDecisionStatus;
  resolvedAt: string | null;
  resolutionReason: string | null;
}

const SUPPRESSED_STATUSES = new Set<ActionDecisionStatus>([
  'completed',
  'deferred',
  'dismissed',
  'superseded',
]);

function resolutionAt(options: DecisionClosureOptions): string {
  return options.transition?.at ?? options.signals?.now ?? new Date().toISOString();
}

function stringFromContext(context: ActionDecisionRawContext | null, key: string): string | null {
  const value = context?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function plannedWorkoutId(decision: ActionDecisionRecord): string | null {
  return stringFromContext(decision.rawContext, 'plannedWorkoutId') ?? decision.sourceId;
}

function checkinDate(decision: ActionDecisionRecord, signals: DecisionClosureSignals | undefined): string | null {
  return stringFromContext(decision.rawContext, 'checkinDate') ?? signals?.today ?? null;
}

function isCheckinDecision(decision: ActionDecisionRecord): boolean {
  return decision.kind === 'checkin' || decision.source === 'checkin';
}

function isWorkoutDecision(decision: ActionDecisionRecord): boolean {
  return decision.kind === 'workout' || decision.source === 'planned_workout';
}

function closedDecision(decision: ActionDecisionRecord): DerivedDecisionStatus {
  return {
    status: decision.status,
    resolvedAt: decision.resolvedAt,
    resolutionReason: decision.resolutionReason,
  };
}

export function deriveDecisionStatus(
  decision: ActionDecisionRecord,
  options: DecisionClosureOptions = {},
): DerivedDecisionStatus {
  if (decision.status !== 'open') {
    return closedDecision(decision);
  }

  if (options.transition) {
    return {
      status: options.transition.status,
      resolvedAt: resolutionAt(options),
      resolutionReason: options.transition.reason ?? null,
    };
  }

  const signals = options.signals;
  if (isWorkoutDecision(decision)) {
    const workoutId = plannedWorkoutId(decision);
    if (workoutId && signals?.matchedWorkoutActivity?.plannedWorkoutId === workoutId) {
      return {
        status: 'completed',
        resolvedAt: signals.matchedWorkoutActivity.matchedAt ?? resolutionAt(options),
        resolutionReason: `Garmin-Aktivität ${signals.matchedWorkoutActivity.activityId} wurde dem geplanten Workout zugeordnet.`,
      };
    }

    if (workoutId && signals?.replacementActivity?.plannedWorkoutId === workoutId) {
      return {
        status: 'superseded',
        resolvedAt: signals.replacementActivity.matchedAt ?? resolutionAt(options),
        resolutionReason: `Garmin-Aktivität ${signals.replacementActivity.activityId} hat die Empfehlung ersetzt.`,
      };
    }
  }

  if (isCheckinDecision(decision)) {
    const date = checkinDate(decision, signals);
    if (date && signals?.checkinDates?.includes(date)) {
      return {
        status: 'completed',
        resolvedAt: resolutionAt(options),
        resolutionReason: `Check-in für ${date} wurde gespeichert.`,
      };
    }
  }

  return {
    status: 'open',
    resolvedAt: null,
    resolutionReason: null,
  };
}

function actionMatchesDecision(action: PulseNextBestAction, decision: ActionDecisionRecord): boolean {
  const rawContext = decision.rawContext ?? {};
  if (decision.sourceId === action.id || rawContext.actionId === action.id) {
    return true;
  }

  const sameKind = decision.kind === action.source || decision.source === action.source;
  if (!sameKind) {
    return false;
  }

  return decision.targetRoute === action.targetPath || decision.title === action.title;
}

export function shouldSuppressAction(
  action: PulseNextBestAction,
  decisions: ActionDecisionRecord[] = [],
  signals: DecisionClosureSignals = {},
): boolean {
  if (action.source === 'checkin' && signals.today && signals.checkinDates?.includes(signals.today)) {
    return true;
  }

  const decision = decisions.find(candidate => actionMatchesDecision(action, candidate));
  if (!decision) {
    return false;
  }

  const derived = deriveDecisionStatus(decision, { signals });
  return SUPPRESSED_STATUSES.has(derived.status);
}
