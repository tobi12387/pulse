import type {
  PulseGarminExecutionDiffRow,
  PulseGarminExecutionRepairAction,
} from '@coaching-os/shared/pulse';

export type GarminExecutionChainStageId = 'template' | 'calendar' | 'readback' | 'repeats' | 'execution';
export type GarminExecutionChainState = 'ok' | 'attention' | 'info';

export interface GarminExecutionChainStage {
  id: GarminExecutionChainStageId;
  label: string;
  value: string;
  state: GarminExecutionChainState;
  summary: string;
}

export interface GarminExecutionChainNextAction {
  title: string;
  summary: string;
  workoutId: string | null;
  workoutTitle: string | null;
  action: PulseGarminExecutionRepairAction | null;
}

export interface GarminExecutionChain {
  overallState: GarminExecutionChainState;
  stages: GarminExecutionChainStage[];
  nextAction: GarminExecutionChainNextAction;
}

const ACTION_PRIORITY: PulseGarminExecutionRepairAction[] = [
  'upload_template',
  'schedule_calendar',
  'repair_repeat',
  'delete_stale_remote',
];

const ATTENTION_STATUSES = new Set(['missing_template', 'missing_calendar', 'broken_repeat', 'stale']);

function rankAction(action: PulseGarminExecutionRepairAction): number {
  const rank = ACTION_PRIORITY.indexOf(action);
  return rank >= 0 ? rank : ACTION_PRIORITY.length;
}

function firstRepairAction(row: PulseGarminExecutionDiffRow): PulseGarminExecutionRepairAction | null {
  return row.repairActions.slice().sort((a, b) => rankAction(a) - rankAction(b))[0] ?? null;
}

function nextActionTitle(action: PulseGarminExecutionRepairAction): string {
  if (action === 'upload_template') return 'Vorlage zuerst hochladen';
  if (action === 'schedule_calendar') return 'Kalendertermin schließen';
  if (action === 'repair_repeat') return 'Wiederholungen reparieren';
  return 'Abweichenden Alttermin entfernen';
}

export function buildGarminExecutionChain(rows: PulseGarminExecutionDiffRow[]): GarminExecutionChain {
  const total = rows.length;
  const templateReady = rows.filter(row => row.local.garminWorkoutId || row.remote.workoutId).length;
  const calendarReady = rows.filter(row => (
    row.local.garminScheduledId
    || row.remote.scheduledId
    || row.status === 'ready'
    || row.status === 'completed'
  )).length;
  const readbackKnown = rows.filter(row => row.remote.workoutId || row.remote.scheduledId || row.status === 'completed').length;
  const repeatAttention = rows.filter(row => row.status === 'broken_repeat' || row.repeatAudit?.status === 'repair_needed').length;
  const repeatUnknown = rows.filter(row => row.repeatAudit?.status === 'unverified').length;
  const completed = rows.filter(row => row.status === 'completed').length;
  const attentionRows = rows.filter(row => row.repairActions.length > 0 || ATTENTION_STATUSES.has(row.status));

  const nextRow = attentionRows
    .slice()
    .sort((a, b) => rankAction(firstRepairAction(a) ?? 'delete_stale_remote') - rankAction(firstRepairAction(b) ?? 'delete_stale_remote'))[0] ?? null;
  const nextAction = nextRow ? firstRepairAction(nextRow) : null;

  return {
    overallState: attentionRows.length > 0 ? 'attention' : total > 0 ? 'ok' : 'info',
    stages: [
      {
        id: 'template',
        label: 'Vorlage',
        value: total > 0 ? `${templateReady}/${total}` : '0',
        state: rows.some(row => row.status === 'missing_template') ? 'attention' : total > 0 ? 'ok' : 'info',
        summary: rows.some(row => row.status === 'missing_template')
          ? 'Mindestens eine Garmin-Workout-Vorlage fehlt.'
          : 'Garmin-Workout-Vorlagen sind für den sichtbaren Check vorhanden.',
      },
      {
        id: 'calendar',
        label: 'Kalender',
        value: total > 0 ? `${calendarReady}/${total}` : '0',
        state: rows.some(row => row.status === 'missing_calendar' || row.status === 'stale') ? 'attention' : total > 0 ? 'ok' : 'info',
        summary: rows.some(row => row.status === 'missing_calendar' || row.status === 'stale')
          ? 'Mindestens ein Garmin-Kalendertermin fehlt oder weicht ab.'
          : 'Kalendertermine sind im Readback schlüssig.',
      },
      {
        id: 'readback',
        label: 'Readback',
        value: total > 0 ? `${readbackKnown}/${total}` : '0',
        state: rows.some(row => row.status === 'unknown') ? 'info' : total > 0 ? 'ok' : 'info',
        summary: rows.some(row => row.status === 'unknown')
          ? 'Garmin konnte einzelne Einheiten nicht eindeutig zurückmelden.'
          : 'Pulse kann die Garmin-Zuordnung lesend nachvollziehen.',
      },
      {
        id: 'repeats',
        label: 'Repeats',
        value: repeatAttention > 0 ? `${repeatAttention} offen` : repeatUnknown > 0 ? `${repeatUnknown} offen` : 'ok',
        state: repeatAttention > 0 ? 'attention' : repeatUnknown > 0 ? 'info' : total > 0 ? 'ok' : 'info',
        summary: repeatAttention > 0
          ? 'Wiederholungen brauchen Reparatur, bevor die Einheit sauber ausgeführt werden kann.'
          : repeatUnknown > 0
            ? 'Wiederholungen sind noch nicht vollständig verifiziert.'
            : 'Wiederholungen sind unauffällig oder nicht relevant.',
      },
      {
        id: 'execution',
        label: 'Ausführung',
        value: total > 0 ? `${completed}/${total}` : '0',
        state: completed > 0 ? 'ok' : 'info',
        summary: completed > 0
          ? 'Mindestens eine geplante Einheit wurde bereits mit Garmin-Ausführung abgeglichen.'
          : 'Noch keine abgeschlossene Ausführung im geprüften Fenster.',
      },
    ],
    nextAction: nextRow
      ? {
          title: nextAction ? nextActionTitle(nextAction) : 'Garmin-Abweichung prüfen',
          summary: `${nextRow.title}: ${nextRow.summary}`,
          workoutId: nextRow.workoutId,
          workoutTitle: nextRow.title,
          action: nextAction,
        }
      : {
        title: total > 0 ? 'Garmin-Pfad bereit' : 'Keine offenen Garmin-Prüfungen',
        summary: total > 0
          ? 'Vorlage, Kalender, Readback und Wiederholungsstruktur sind für den sichtbaren Zeitraum schlüssig.'
          : 'Im geprüften Fenster gibt es keine geplanten Pulse-Workouts, die auf Garmin kontrolliert werden müssen.',
        workoutId: null,
        workoutTitle: null,
        action: null,
      },
  };
}
