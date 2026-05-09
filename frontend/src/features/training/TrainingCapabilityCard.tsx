import { Skeleton } from '@/components/Skeleton';
import type {
  PulseCapabilityConfidence,
  PulseTrainingCapabilitySummary,
  PulseWorkoutFitLabel,
} from '@coaching-os/shared/pulse';

const FIT_TONE: Record<PulseWorkoutFitLabel, string> = {
  recovery: 'var(--blue)',
  maintenance: 'var(--text-3)',
  productive: 'var(--green)',
  stretch: 'var(--amber)',
  too_hard_today: 'var(--rose)',
};

const CONFIDENCE_LABEL: Record<PulseCapabilityConfidence, string> = {
  low: 'niedrig',
  medium: 'mittel',
  high: 'hoch',
};

function levelColor(level: number): string {
  if (level >= 6) return 'var(--green)';
  if (level >= 4) return 'var(--accent)';
  if (level >= 2.8) return 'var(--amber)';
  return 'var(--text-3)';
}

export function TrainingCapabilityCard({
  summary,
  loading = false,
  framed = true,
}: {
  summary: PulseTrainingCapabilitySummary | null | undefined;
  loading?: boolean;
  framed?: boolean;
}) {
  const shellClass = framed ? 'card' : undefined;
  const shellStyle = framed
    ? { borderColor: 'rgba(94,230,207,0.16)' }
    : { border: '1px solid var(--border)', borderRadius: 5, padding: '10px', background: 'var(--surface)' };

  if (loading && !summary) {
    return (
      <div className={shellClass} style={shellStyle}>
        <Skeleton height={10} width="38%" />
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          <Skeleton height={46} />
          <Skeleton height={46} />
          <Skeleton height={46} />
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const shownLevels = summary.levels
    .filter(level => !['recovery', 'strength'].includes(level.energySystem))
    .slice(0, 6);
  const primarySignals = summary.signals.slice(0, 3);

  return (
    <div className={shellClass} style={shellStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <span className="label-mono" style={{ color: 'var(--accent)' }}>Capability Levels</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
          {summary.lookbackDays} Tage
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(152px, 1fr))', gap: 8 }}>
        {shownLevels.map(level => (
          <div key={level.energySystem} style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '8px 9px', background: framed ? 'var(--surface)' : 'var(--bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase' }}>
                {level.label}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: levelColor(level.level) }}>
                {level.level.toFixed(1)}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 7 }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.max(8, level.level * 10))}%`, background: levelColor(level.level) }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-3)' }}>
              Vertrauen {CONFIDENCE_LABEL[level.confidence]}
            </div>
          </div>
        ))}
      </div>

      {(primarySignals.length > 0 || summary.recommendations.length > 0) && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {primarySignals.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {primarySignals.map(signal => (
                <span key={signal} style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: signal.includes('protect') || signal.includes('reduce') ? 'var(--amber)' : 'var(--green)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '3px 7px',
                }}>
                  {signal.replaceAll('_', ' ')}
                </span>
              ))}
            </div>
          )}
          {summary.recommendations[0] && (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>
              {summary.recommendations[0]}
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(Object.entries(summary.fitLegend) as Array<[PulseWorkoutFitLabel, string]>).map(([key, label]) => (
          <span key={key} style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: FIT_TONE[key],
            border: `1px solid color-mix(in srgb, ${FIT_TONE[key]} 28%, transparent)`,
            borderRadius: 4,
            padding: '3px 7px',
          }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
