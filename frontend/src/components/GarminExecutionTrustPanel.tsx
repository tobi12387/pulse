import { useMemo } from 'react';
import { useGarminExecutionDiff } from '@/pulse/hooks';
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
  broken_repeat: { label: 'Repeat reparieren', tone: 'var(--rose)', group: 'attention' },
  stale: { label: 'Kalender abweichend', tone: 'var(--amber)', group: 'attention' },
  degraded_expected: { label: 'Support-Blockliste', tone: 'var(--accent)', group: 'info' },
  unknown: { label: 'Readback unbekannt', tone: 'var(--text-3)', group: 'info' },
};

const ACTION_LABEL: Record<PulseGarminExecutionRepairAction, string> = {
  upload_template: 'Vorlage hochladen',
  schedule_calendar: 'Kalender syncen',
  repair_repeat: 'Repeat reparieren',
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

function GarminExecutionRow({
  row,
  onNavigate,
}: {
  row: PulseGarminExecutionDiffRow;
  onNavigate?: (path: string) => void;
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
            Vorlage {row.local.garminWorkoutId ?? 'fehlt'}
          </span>
          <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
            Kalender {row.remote.scheduledId ?? row.local.garminScheduledId ?? 'fehlt'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {statusPill(row.status)}
        {row.repairActions.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap', maxWidth: 180 }}>
            {row.repairActions.map(action => (
              <button
                key={action}
                type="button"
                onClick={() => onNavigate?.('/settings?section=garmin')}
                style={{
                  minHeight: 36,
                  border: `1px solid ${ui.tone}`,
                  borderRadius: 4,
                  background: 'transparent',
                  color: ui.tone,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: 0,
                  padding: '7px 9px',
                  textTransform: 'uppercase',
                }}
              >
                {ACTION_LABEL[action]}
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
  onNavigate,
}: {
  days?: number;
  onNavigate?: (path: string) => void;
}) {
  const query = useGarminExecutionDiff(days);
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
            Kalender-Readback für die nächsten {days} Tage
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: 11.5, lineHeight: 1.45, margin: '6px 0 0', maxWidth: 660 }}>
            Pulse prüft hier nur lesend, ob geplante Einheiten als Garmin-Vorlage und Kalendertermin wiedergefunden werden.
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <SummaryStat label="Bereit" value={counts.ready} color="var(--green)" />
        <SummaryStat label="Handeln" value={counts.attention} color="var(--amber)" />
        <SummaryStat label="Hinweis" value={counts.info} color="var(--accent)" />
      </div>

      {query.isLoading && <LoadingRows />}
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
            <GarminExecutionRow key={row.workoutId} row={row} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </section>
  );
}
