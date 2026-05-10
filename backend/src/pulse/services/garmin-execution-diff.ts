import type {
  PulseGarminExecutionDiffResponse,
  PulseGarminExecutionDiffRow,
  PulseGarminExecutionLedgerEntry,
  PulseGarminExecutionRepairAction,
  PulseGarminExecutionDiffStatus,
  PulsePlannedWorkout,
} from '@coaching-os/shared/pulse';
import { garminWorkoutHasBrokenRepeatIterations } from './garmin-workout.js';

export type NormalizedGarminCalendarWorkout = {
  id: string;
  workoutId: string;
  date: string;
  workout?: unknown | null;
  lastSeenAt?: string | null;
};

const ACTIVITY_LABEL: Record<PulsePlannedWorkout['activityType'], string> = {
  bike: 'Rad',
  run: 'Laufen',
  swim: 'Schwimmen',
  strength: 'Kraft',
  hike: 'Hike',
  other: 'Training',
};

const DAY_MS = 86_400_000;

function addIsoDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().split('T')[0]!;
}

function titleFor(workout: PulsePlannedWorkout): string {
  return `${ACTIVITY_LABEL[workout.activityType] ?? workout.activityType} · Z${workout.zone} · ${workout.durationMin} min`;
}

function isCompleted(workout: PulsePlannedWorkout): boolean {
  return workout.status === 'completed'
    || workout.completedActivityId != null
    || workout.executionStatus === 'completed_matched';
}

function isExpectedDegraded(workout: PulsePlannedWorkout): boolean {
  return workout.garminSyncContract?.status === 'degraded'
    && workout.garminSyncContract.issues.some(issue => issue.code === 'strength_notes_only');
}

function latestLedgerByWorkout(entries: PulseGarminExecutionLedgerEntry[]): Map<string, PulseGarminExecutionLedgerEntry> {
  const sorted = [...entries].sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt));
  const result = new Map<string, PulseGarminExecutionLedgerEntry>();
  for (const entry of sorted) {
    if (!result.has(entry.plannedWorkoutId)) result.set(entry.plannedWorkoutId, entry);
  }
  return result;
}

function remoteForWorkout(
  workout: PulsePlannedWorkout,
  remoteWorkouts: NormalizedGarminCalendarWorkout[],
): NormalizedGarminCalendarWorkout | null {
  const bySchedule = workout.garminScheduledId
    ? remoteWorkouts.find(remote => remote.id === workout.garminScheduledId)
    : null;
  if (bySchedule) return bySchedule;
  if (workout.garminWorkoutId) {
    return remoteWorkouts.find(remote =>
      remote.workoutId === workout.garminWorkoutId && remote.date === workout.plannedDate
    ) ?? null;
  }
  return null;
}

function statusSummary(status: PulseGarminExecutionDiffStatus, workout: PulsePlannedWorkout, latestLedger: PulseGarminExecutionLedgerEntry | null): string {
  if (status === 'completed') return 'Geplante Einheit ist erledigt; kein Garmin-Reparaturschritt nötig.';
  if (status === 'degraded_expected') return 'Support-Blockliste: Garmin nur Notiz/Handoff, keine native Intervallstruktur erwartet.';
  if (status === 'missing_template') return 'In Pulse geplant, aber es gibt noch keine Garmin-Workout-Vorlage.';
  if (status === 'missing_calendar') return 'Vorlage bekannt, aber die Einheit fehlt im Garmin-Kalenderfenster.';
  if (status === 'broken_repeat') return 'Remote-Workout hat defekte Wiederholungen und sollte neu synchronisiert werden.';
  if (status === 'stale') return 'Garmin-Kalender weicht vom Pulse-Datum ab; Kalendertermin prüfen.';
  if (status === 'unknown') {
    return latestLedger?.errorMessage
      ? `Garmin-Readback unbekannt: ${latestLedger.errorMessage}`
      : 'Garmin-Readback konnte gerade nicht verifiziert werden.';
  }
  return workout.garminScheduledId
    ? 'Auf Garmin bereit: Vorlage und Kalendertermin wurden im Readback gefunden.'
    : 'Garmin-Vorlage ist bereit.';
}

function repairActionsFor(status: PulseGarminExecutionDiffStatus): PulseGarminExecutionRepairAction[] {
  if (status === 'missing_template') return ['upload_template'];
  if (status === 'missing_calendar') return ['schedule_calendar'];
  if (status === 'broken_repeat') return ['repair_repeat'];
  if (status === 'stale') return ['schedule_calendar', 'delete_stale_remote'];
  return [];
}

function diffRow(
  workout: PulsePlannedWorkout,
  remote: NormalizedGarminCalendarWorkout | null,
  latestLedger: PulseGarminExecutionLedgerEntry | null,
  remoteUnavailable: boolean,
): PulseGarminExecutionDiffRow {
  let status: PulseGarminExecutionDiffStatus;
  if (isCompleted(workout)) status = 'completed';
  else if (isExpectedDegraded(workout)) status = 'degraded_expected';
  else if (remoteUnavailable) status = 'unknown';
  else if (!workout.garminWorkoutId) status = 'missing_template';
  else if (!remote) status = 'missing_calendar';
  else if (remote.date !== workout.plannedDate) status = 'stale';
  else if (remote.workout != null && garminWorkoutHasBrokenRepeatIterations(remote.workout)) status = 'broken_repeat';
  else status = 'ready';

  return {
    workoutId: workout.id,
    plannedDate: workout.plannedDate,
    title: titleFor(workout),
    status,
    summary: statusSummary(status, workout, latestLedger),
    local: {
      garminWorkoutId: workout.garminWorkoutId,
      garminScheduledId: workout.garminScheduledId,
    },
    remote: {
      workoutId: remote?.workoutId ?? latestLedger?.payloadSnapshot?.workoutId ?? null,
      scheduledId: remote?.id ?? latestLedger?.payloadSnapshot?.scheduledId ?? null,
      lastSeenAt: remote?.lastSeenAt ?? null,
    },
    repairActions: repairActionsFor(status),
  };
}

export function buildGarminExecutionDiff(input: {
  localWorkouts: PulsePlannedWorkout[];
  remoteWorkouts: NormalizedGarminCalendarWorkout[];
  ledgerEntries: PulseGarminExecutionLedgerEntry[];
  today: string;
  days?: number;
  generatedAt?: string;
  remoteUnavailable?: boolean;
}): PulseGarminExecutionDiffResponse {
  const days = Math.max(1, input.days ?? 15);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const latestLedger = latestLedgerByWorkout(input.ledgerEntries);
  const rows = [...input.localWorkouts]
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
    .map(workout => diffRow(
      workout,
      remoteForWorkout(workout, input.remoteWorkouts),
      latestLedger.get(workout.id) ?? null,
      input.remoteUnavailable ?? false,
    ));

  return {
    generatedAt,
    window: {
      from: input.today,
      to: addIsoDays(input.today, days - 1),
      days: Math.round((new Date(`${addIsoDays(input.today, days - 1)}T00:00:00.000Z`).getTime() - new Date(`${input.today}T00:00:00.000Z`).getTime()) / DAY_MS) + 1,
    },
    rows,
  };
}
