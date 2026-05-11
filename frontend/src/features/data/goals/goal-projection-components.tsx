import type {
  PulseCapabilityConfidence,
  PulseGoalProjection,
  PulseGoalProjectionStatus,
} from '@coaching-os/shared/pulse';
import { Link } from 'react-router-dom';
import { useGoalProjection } from '@/pulse/hooks';

function statusLabel(status: PulseGoalProjectionStatus): string {
  if (status === 'on_track') return 'auf Kurs';
  if (status === 'watch') return 'beobachten';
  if (status === 'at_risk') return 'kritisch';
  return 'offen';
}

function statusTone(status: PulseGoalProjectionStatus): string {
  if (status === 'on_track') return 'var(--green)';
  if (status === 'watch') return 'var(--amber)';
  if (status === 'at_risk') return 'var(--rose)';
  return 'var(--text-3)';
}

function confidenceLabel(confidence: PulseCapabilityConfidence): string {
  if (confidence === 'high') return 'hoch';
  if (confidence === 'medium') return 'mittel';
  return 'niedrig';
}

function probabilityLabel(projection: PulseGoalProjection): string {
  if (projection.probabilityPct == null) return 'Wahrscheinlichkeit offen';
  return `ca. ${projection.probabilityPct}%`;
}

function formatDays(daysUntil: number | null): string {
  if (daysUntil == null) return 'ohne Datum';
  if (daysUntil === 0) return 'heute';
  if (daysUntil === 1) return 'morgen';
  return `${daysUntil} Tage`;
}

function ProjectionRow({ projection }: { projection: PulseGoalProjection }) {
  const tone = statusTone(projection.status);

  return (
    <div
      data-testid={`goal-projection-row-${projection.goalId}`}
      style={{ borderTop: '1px solid var(--border)', paddingTop: 8, minWidth: 0 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--text)' }}>{projection.title}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: tone, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {statusLabel(projection.status)} · {probabilityLabel(projection)}
        </span>
      </div>
      <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
        {projection.summary}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px' }}>
          {formatDays(projection.daysUntil)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px' }}>
          Konfidenz {confidenceLabel(projection.confidence)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: statusTone(projection.limiterRisk.status === 'blocked' ? 'at_risk' : projection.limiterRisk.status === 'watch' ? 'watch' : 'on_track'), border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px' }}>
          {projection.limiterRisk.label}
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55, margin: 0 }}>
      Noch keine aktive Zielprojektion. Sobald ein Ziel aktiv ist, bewertet Pulse Zielnahe, Limiter und naechste Intervention read-only.
    </p>
  );
}

export function GoalProjectionCard({ horizonDays = 180 }: { horizonDays?: number }) {
  const query = useGoalProjection(horizonDays);
  const top = query.data?.projections[0] ?? null;
  const tone = top ? statusTone(top.status) : 'var(--text-3)';

  return (
    <section
      id="data-goal-projection"
      className="card"
      data-testid="data-goal-projection-card"
      aria-label="Zielprojektion"
      tabIndex={-1}
      style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: 'rgba(59,130,246,0.22)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--blue)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Zielprojektion
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: tone }}>
          {query.isLoading && !top ? 'berechnet' : top ? `${statusLabel(top.status)} · ${query.data?.horizonDays ?? horizonDays}T` : 'offen'}
        </span>
      </div>

      {query.isError ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55, margin: 0 }}>
          Die Zielprojektion konnte gerade nicht geladen werden. Plan, Daten und Garmin bleiben unveraendert.
        </p>
      ) : query.data ? (
        query.data.projections.length > 0 ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
              {query.data.headline}
            </p>
            <ProjectionRow projection={query.data.projections[0]!} />
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Naechste Intervention
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text)' }}>{query.data.projections[0]!.nextBestIntervention.title}</strong>
                {' '}
                {query.data.projections[0]!.nextBestIntervention.summary}
              </p>
              <Link
                to={query.data.projections[0]!.nextBestIntervention.targetPath}
                style={{
                  display: 'inline-flex',
                  marginTop: 7,
                  minHeight: 32,
                  alignItems: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--accent)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                }}
              >
                {query.data.projections[0]!.nextBestIntervention.actionLabel}
              </Link>
            </div>
            {query.data.missingEvidence.length > 0 && (
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Offen: {query.data.missingEvidence.slice(0, 2).join(' ')}
              </p>
            )}
          </>
        ) : (
          <EmptyState />
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[76, 64, 88].map((width) => (
            <div
              key={width}
              style={{ height: 10, width: `${width}%`, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
