import { useMemo, useState } from 'react';
import { useGarminCalendarSync, useGarminExecutionDiff, useSyncWorkoutToGarmin } from '@/pulse/hooks';
import { InlineFeedback, errorMessage } from '@/components/Feedback';
import { Skeleton } from '@/components/Skeleton';
import type {
  PulseGarminExecutionDiffRow,
  PulseGarminExecutionDiffStatus,
  PulseGarminExecutionRepairAction,
} from '@coaching-os/shared/pulse';

const STATUS_UI: Record<PulseGarminExecutionDiffStatus, { label: string; tone: string; group: 'ready' | 'attention' | 'info' }> = {
  ready: { label: 'Auf Garmin bereit', tone: 'var(--green)', group: 'ready' },
  completed: { label: 'Erledigt', tone: 'var(--green)', group: 'ready' },
  missing_calendar: { label: 'Fehlt im Garmin-Kalender', tone: 'var(--amber)', group: 'attention' },
  missing_template: { label: 'Vorlage fehlt', tone: 'var(--amber)', group: 'attention' },
  broken_repeat: { label: 'Wiederholungen prüfen', tone: 'var(--rose)', group: 'attention' },
  stale: { label: 'Kalender abweichend', tone: 'var(--amber)', group: 'attention' },
  degraded_expected: { label: 'Support-Blockliste', tone: 'var(--accent)', group: 'info' },
  unknown: { label: 'Readback unbekannt', tone: 'var(--text-3)', group: 'info' },
};

const ACTION_LABEL: Record<PulseGarminExecutionRepairAction, string> = {
  upload_template: 'Vorlage hochladen',
  schedule_calendar: 'Kalender syncen',
  repair_repeat: 'Wiederholungen reparieren',
  delete_stale_remote: 'Alttermin entfernen',
};

function statusPill(status: PulseGarminExecutionDiffStatus) {
  const ui = STATUS_UI[status];
  return (
    <span
      style={{
        border: `1px solid ${ui.tone}`,
        borderRadius: 4,
        color: ui.tone,
        flex: '0 0 auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        padding: '2px 6px',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {ui.label}
    </span>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 6,
        minWidth: 108,
        padding: '8px 10px',
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ color, fontSize: 20, fontWeight: 500, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <Skeleton height={12} width="36%" />
          <div style={{ height: 6 }} />
          <Skeleton height={10} width="72%" />
        </div>
      ))}
    </div>
  );
}

function RepeatAudit({ row }: { row: PulseGarminExecutionDiffRow }) {
  if (!row.repeatAudit) return null;
  const tone = row.repeatAudit.status === 'ok'
    ? 'var(--green)'
    : row.repeatAudit.status === 'repair_needed'
      ? 'var(--rose)'
      : 'var(--amber)';

  return (
    <div
      data-testid={`garmin-repeat-audit-${row.workoutId}`}
      style={{
        border: `1px solid ${tone}`,
        borderRadius: 4,
        color: 'var(--text-2)',
        fontSize: 10.5,
        lineHeight: 1.45,
        marginTop: 7,
        padding: '6px 8px',
      }}
    >
      <span style={{ color: tone, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase' }}>
        Wiederholungen
      </span>
      <span style={{ marginLeft: 6 }}>{row.repeatAudit.summary}</span>
    </div>
  );
}

function MetadataLine({
  label,
  workoutId,
  scheduledId,
}: {
  label: string;
  workoutId: string | null;
  scheduledId: string | null;
}) {
  return (
    <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
      {label}: Vorlage {workoutId ?? 'fehlt'} · Kalender {scheduledId ?? 'fehlt'}
    </span>
  );
}

function GarminExecutionRow({
  row,
  onRepair,
  pendingAction,
}: {
  row: PulseGarminExecutionDiffRow;
  onRepair: (row: PulseGarminExecutionDiffRow, action: PulseGarminExecutionRepairAction) => void;
  pendingAction: string | null;
}) {
  const ui = STATUS_UI[row.status];
  return (
    <div
      data-testid={`garmin-execution-row-${row.workoutId}`}
      style={{
        display: 'grid',
        gap: 10,
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'start',
        borderTop: '1px solid var(--border)',
        paddingTop: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{row.title}</span>
          <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{row.plannedDate}</span>
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: 11.5, lineHeight: 1.45, margin: '5px 0 0' }}>
          {row.summary}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
          <MetadataLine
            label="Pulse bekannt"
            workoutId={row.local.garminWorkoutId}
            scheduledId={row.local.garminScheduledId}
          />
          <MetadataLine
            label="Garmin Readback"
            workoutId={row.remote.workoutId}
            scheduledId={row.remote.scheduledId}
          />
        </div>
        <RepeatAudit row={row} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {statusPill(row.status)}
        {row.repairActions.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap', maxWidth: 180 }}>
            {row.repairActions.map(action => (
              <button
                key={action}
                type="button"
                onClick={() => onRepair(row, action)}
                disabled={pendingAction != null}
                style={{
                  minHeight: 36,
                  border: `1px solid ${ui.tone}`,
                  borderRadius: 4,
                  background: 'transparent',
                  color: pendingAction === `${row.workoutId}:${action}` ? 'var(--text-3)' : ui.tone,
                  cursor: pendingAction == null ? 'pointer' : 'default',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: 0,
                  padding: '7px 9px',
                  textTransform: 'uppercase',
                }}
              >
                {pendingAction === `${row.workoutId}:${action}` ? 'Läuft' : ACTION_LABEL[action]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function GarminExecutionTrustPanel({
  days = 15,
}: {
  days?: number;
}) {
  const query = useGarminExecutionDiff(days);
  const syncWorkout = useSyncWorkoutToGarmin();
  const calendarSync = useGarminCalendarSync();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [repairNotice, setRepairNotice] = useState<{ tone: 'info' | 'warning'; title: string; message: string } | null>(null);
  const rows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);
  const counts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc[STATUS_UI[row.status].group] += 1;
        return acc;
      },
      { total: 0, ready: 0, attention: 0, info: 0 },
    );
  }, [rows]);

  async function handleRepair(row: PulseGarminExecutionDiffRow, action: PulseGarminExecutionRepairAction) {
    const actionKey = `${row.workoutId}:${action}`;
    setPendingAction(actionKey);
    setRepairNotice(null);
    try {
      if (action === 'upload_template' || action === 'repair_repeat') {
        await syncWorkout.mutateAsync(row.workoutId);
      } else {
        await calendarSync.mutateAsync();
      }
      await query.refetch();
      setRepairNotice({
        tone: 'info',
        title: 'Reparatur ausgeführt',
        message: `${ACTION_LABEL[action]} wurde gestartet. Pulse prüft den Garmin-Readback erneut.`,
      });
    } catch (err) {
      setRepairNotice({
        tone: 'warning',
        title: 'Reparatur fehlgeschlagen',
        message: errorMessage(err, 'Garmin konnte gerade nicht repariert werden.'),
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section
      data-testid="garmin-execution-trust-panel"
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="label-mono" style={{ marginBottom: 5 }}>Garmin Ausführung</div>
          <h2 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 500, margin: 0 }}>
            Geräte-Check abschließen
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: 11.5, lineHeight: 1.45, margin: '6px 0 0', maxWidth: 660 }}>
            Kalender-Readback für die nächsten {days} Tage: Pulse prüft lesend, ob geplante Einheiten als Garmin-Vorlage,
            Kalendertermin und Wiederholungsstruktur wiedergefunden werden.
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          style={{
            minHeight: 40,
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'var(--surface-2)',
            color: query.isFetching ? 'var(--text-3)' : 'var(--text)',
            cursor: query.isFetching ? 'default' : 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: 0,
            padding: '8px 10px',
            textTransform: 'uppercase',
          }}
        >
          {query.isFetching ? 'Prüft' : 'Neu prüfen'}
        </button>
      </div>

      <div
        data-testid="garmin-execution-contract"
        style={{
          display: 'grid',
          gap: 8,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '9px 10px' }}>
          <div className="label-mono" style={{ color: 'var(--text-3)', marginBottom: 4 }}>Warum jetzt</div>
          <p style={{ color: 'var(--text-2)', fontSize: 11.5, lineHeight: 1.45, margin: 0 }}>
            Planänderungen sind erst fertig, wenn Uhr oder Edge Vorlage, Kalender und Wiederholungen sauber sehen.
          </p>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '9px 10px' }}>
          <div className="label-mono" style={{ color: 'var(--text-3)', marginBottom: 4 }}>Nach dem Klick</div>
          <p style={{ color: 'var(--text-2)', fontSize: 11.5, lineHeight: 1.45, margin: 0 }}>
            Neu prüfen liest Garmin nur. Reparatur-Buttons schreiben erst nach deinem Klick die betroffene Einheit neu.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <SummaryStat label="Bereit" value={counts.ready} color="var(--green)" />
        <SummaryStat label="Handeln" value={counts.attention} color="var(--amber)" />
        <SummaryStat label="Hinweis" value={counts.info} color="var(--accent)" />
      </div>

      {query.isLoading && <LoadingRows />}
      {repairNotice && (
        <InlineFeedback
          tone={repairNotice.tone}
          title={repairNotice.title}
          message={repairNotice.message}
        />
      )}
      {query.isError && (
        <InlineFeedback
          tone="warning"
          title="Readback nicht möglich"
          message={errorMessage(query.error, 'Garmin-Ausführung konnte gerade nicht geprüft werden.')}
          actionLabel="Erneut"
          onAction={() => query.refetch()}
          actionPending={query.isFetching}
        />
      )}
      {!query.isLoading && !query.isError && rows.length === 0 && (
        <InlineFeedback
          tone="info"
          title="Keine offenen Einheiten"
          message="Im geprüften Fenster gibt es keine geplanten Pulse-Workouts, die auf Garmin kontrolliert werden müssen."
        />
      )}
      {!query.isLoading && !query.isError && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(row => (
            <GarminExecutionRow key={row.workoutId} row={row} onRepair={handleRepair} pendingAction={pendingAction} />
          ))}
        </div>
      )}
    </section>
  );
}
