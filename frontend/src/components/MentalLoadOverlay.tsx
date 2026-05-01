import { MultiSparkLine } from './SparkChart';
import { Skeleton } from './Skeleton';
import { useMentalLoadOverlay } from '@/pulse/hooks';

const OVERLAY_DAYS = 56;

function fmt(value: number | null, suffix = ''): string {
  return value == null ? 'n/a' : `${value.toFixed(1)}${suffix}`;
}

function fmtCorr(value: number | null): string {
  if (value == null) return 'n/a';
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

function latest<T>(values: T[]): T | null {
  return values.at(-1) ?? null;
}

export function MentalLoadOverlay() {
  const { data, isLoading, error } = useMentalLoadOverlay(OVERLAY_DAYS);
  const points = data?.points ?? [];
  const latestPoint = latest(points);

  if (isLoading) {
    return (
      <div className="card">
        <div className="label-mono" style={{ marginBottom: 12 }}>Stimmung vs Belastung · 8 Wochen</div>
        <Skeleton height={120} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="label-mono" style={{ marginBottom: 8 }}>Stimmung vs Belastung · 8 Wochen</div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--rose)' }}>{error.message}</p>
      </div>
    );
  }

  if (!data || points.length < 2) {
    return (
      <div className="card">
        <div className="label-mono" style={{ marginBottom: 8 }}>Stimmung vs Belastung · 8 Wochen</div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)' }}>Noch zu wenig Daten.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span className="label-mono">Stimmung vs Belastung · 8 Wochen</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          CTL {fmt(latestPoint?.ctl ?? null)} · TSB {fmt(latestPoint?.tsb ?? null)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          ['Mood Ø', fmt(data.stats.avgMood)],
          ['Stress Ø', fmt(data.stats.avgStress)],
          ['Mood/TSB r', fmtCorr(data.stats.moodTsbCorrelation)],
          ['TSB<-10', String(data.stats.lowTsbCheckins)],
        ].map(([label, value]) => (
          <span key={label} style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--text-2)',
            background: 'var(--surface-2)',
            borderRadius: 4,
            padding: '4px 7px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {label}: {value}
          </span>
        ))}
      </div>

      <MultiSparkLine
        ariaLabel="Stimmung, Stress, CTL und TSB ueber acht Wochen"
        width={100}
        height={128}
        yAxes={{ primary: [0, 10], secondary: [0, Math.max(80, ...points.map((point) => point.ctl))], tertiary: [-35, 35] }}
        series={[
          { label: 'Stimmung', values: points.map((point) => point.mood), color: 'var(--rose)', yAxis: 'primary' },
          { label: 'Stress', values: points.map((point) => point.stress), color: 'var(--amber)', yAxis: 'primary' },
          { label: 'CTL', values: points.map((point) => point.ctl), color: 'var(--blue)', yAxis: 'secondary' },
          { label: 'TSB', values: points.map((point) => point.tsb), color: 'var(--green)', yAxis: 'tertiary' },
        ]}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          ['var(--rose)', 'Stimmung'],
          ['var(--amber)', 'Stress'],
          ['var(--blue)', 'CTL'],
          ['var(--green)', 'TSB'],
        ].map(([color, label]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)' }}>
            <span style={{ width: 18, height: 2, background: color, borderRadius: 2 }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
