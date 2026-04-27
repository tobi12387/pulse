import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { pulseApi } from '@/pulse/api-client';
import { Skeleton } from '@/components/Skeleton';

function fmt(v: number | null | undefined, decimals = 0, suffix = ''): string {
  return v == null ? '–' : `${v.toFixed(decimals)}${suffix}`;
}

function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return '–';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtPace(speedMs: number | null | undefined): string {
  if (!speedMs || speedMs <= 0) return '–';
  const secPerKm = 1000 / speedMs;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KpiItem({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span className="label-mono">{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

// ─── HR Zones Bar ─────────────────────────────────────────────────────────────

const ZONE_COLORS = [
  'var(--blue)',    // Z1
  'var(--blue)',    // Z2  (slightly different shade in mock, using same blue)
  'var(--green)',   // Z3
  'var(--amber)',   // Z4
  'var(--rose)',    // Z5
];

function HrZonesBar({ zones }: {
  zones: { zone: number; secsInZone: number; zoneLowBoundary: number }[];
}) {
  if (zones.length === 0) return null;
  const total = zones.reduce((s, z) => s + z.secsInZone, 0);
  if (total <= 0) return null;

  return (
    <div className="card">
      <div className="label-mono" style={{ marginBottom: 10 }}>HR-Zonen</div>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
        {zones.map(z => {
          const pct = (z.secsInZone / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={z.zone}
              style={{ width: `${pct}%`, background: ZONE_COLORS[z.zone - 1] ?? 'var(--text-3)', transition: 'width 0.3s' }}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {zones.filter(z => z.secsInZone > 1).map(z => (
          <div key={z.zone} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ZONE_COLORS[z.zone - 1] ?? 'var(--text-3)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
              Z{z.zone} {fmtDuration(z.secsInZone)}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
              ({Math.round((z.secsInZone / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Laps Chart (SVG sparkline per lap) ──────────────────────────────────────

function LapsHrChart({ laps }: {
  laps: { index: number; avgHr: number | null; avgPowerW: number | null; durationSec: number | null }[];
}) {
  const hrValues  = laps.map(l => l.avgHr);
  const pwrValues = laps.map(l => l.avgPowerW);

  const hasHr  = hrValues.some(v => v != null);
  const hasPwr = pwrValues.some(v => v != null);
  if (!hasHr && !hasPwr) return null;

  const H = 64;
  const W = 100;
  const pad = 2;

  function toPoints(values: (number | null)[]): string {
    const valid = values.filter((v): v is number => v != null);
    if (valid.length < 2) return '';
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;
    const pts: string[] = [];
    values.forEach((v, i) => {
      if (v == null) return;
      const x = pad + (i / (values.length - 1)) * (W - pad * 2);
      const y = pad + (H - pad * 2) - ((v - min) / range) * (H - pad * 2);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });
    return pts.length > 0 ? `M${pts.join(' L')}` : '';
  }

  const hrPath  = toPoints(hrValues);
  const pwrPath = toPoints(pwrValues);

  return (
    <div className="card">
      <div className="label-mono" style={{ marginBottom: 8 }}>HR / Power pro Lap</div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H}>
        {hrPath  && <path d={hrPath}  fill="none" stroke="var(--rose)"   strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}
        {pwrPath && <path d={pwrPath} fill="none" stroke="var(--amber)"  strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
        {hasHr  && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: 'var(--rose)',  borderRadius: 1 }} /><span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>HR</span></span>}
        {hasPwr && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: 'var(--amber)', borderRadius: 1 }} /><span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>Power</span></span>}
      </div>
    </div>
  );
}

// ─── Laps Table ───────────────────────────────────────────────────────────────

function LapsTable({ laps, activityType }: {
  laps: {
    index: number; distanceM: number | null; durationSec: number | null;
    avgHr: number | null; maxHr: number | null; avgPowerW: number | null;
    avgSpeedMs: number | null; elevationGainM: number | null;
  }[];
  activityType: string;
}) {
  if (laps.length === 0) return null;
  const isRun = activityType === 'run';

  const cols = [
    { key: 'lap',  label: '#',     align: 'left'  },
    { key: 'dist', label: 'km',    align: 'right' },
    { key: 'dur',  label: 'Zeit',  align: 'right' },
    { key: 'hr',   label: 'HR',    align: 'right' },
    ...(isRun
      ? [{ key: 'pace',  label: 'Pace',  align: 'right' }]
      : [{ key: 'power', label: 'Watt',  align: 'right' }]),
    { key: 'elev', label: 'Hm',    align: 'right' },
  ];

  const maxHr = Math.max(...laps.map(l => l.avgHr ?? 0));

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="label-mono" style={{ padding: '12px 14px 8px' }}>Laps</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
            {cols.map(c => (
              <th key={c.key} style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 400,
                padding: '5px 12px', textAlign: c.align as 'left' | 'right',
                borderBottom: '1px solid var(--border)',
              }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {laps.map((lap, i) => (
            <tr key={lap.index} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
              <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                {lap.index}
              </td>
              <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>
                {lap.distanceM ? (lap.distanceM / 1000).toFixed(2) : '–'}
              </td>
              <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>
                {fmtDuration(lap.durationSec)}
              </td>
              <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: lap.avgHr && maxHr > 0 && lap.avgHr / maxHr > 0.9 ? 'var(--rose)' :
                         lap.avgHr && maxHr > 0 && lap.avgHr / maxHr > 0.75 ? 'var(--amber)' : 'var(--text-2)',
                }}>
                  {fmt(lap.avgHr)}
                </span>
              </td>
              {isRun ? (
                <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>
                  {fmtPace(lap.avgSpeedMs)}
                </td>
              ) : (
                <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>
                  {fmt(lap.avgPowerW)}
                </td>
              )}
              <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
                {fmt(lap.elevationGainM)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['activity-detail', id],
    queryFn: () => pulseApi.activities.detail(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton height={22} width="60%" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[0,1,2,3,4,5].map(i => <Skeleton key={i} height={60} />)}
        </div>
        <Skeleton height={80} />
        <Skeleton height={120} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ color: 'var(--rose)', fontFamily: 'var(--font-mono)', fontSize: 11 }} className="py-8 text-center">
        {(error as Error)?.message ?? 'Nicht gefunden'}
      </div>
    );
  }

  const { activity: a, laps, hrZones } = data;

  const date = new Date(a.startTime);
  const dateStr = date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Back + Title */}
      <div>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
            color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8, padding: 0,
          }}
        >
          ← Zurück
        </button>
        <div className="label-mono" style={{ marginBottom: 4 }}>{dateStr}</div>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>
          {a.name ?? a.activityType}
        </h1>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <KpiItem label="Dauer" value={fmtDuration(a.durationSec)} />
        <KpiItem label="Distanz" value={a.distanceM ? (a.distanceM / 1000).toFixed(1) : '–'} unit="km" />
        <KpiItem label="TSS" value={fmt(a.tss, 0)} />
        <KpiItem label="Ø HR" value={fmt(a.avgHr)} unit="bpm" />
        <KpiItem label="Max HR" value={fmt(a.maxHr)} unit="bpm" />
        <KpiItem label="Elevation" value={fmt(a.elevationGainM, 0)} unit="m" />
        {a.avgPowerW && <KpiItem label="Ø Watt" value={fmt(a.avgPowerW)} unit="W" />}
        {a.normalizedPowerW && <KpiItem label="NP" value={fmt(a.normalizedPowerW)} unit="W" />}
        {a.calories && <KpiItem label="kcal" value={fmt(a.calories, 0)} />}
      </div>

      {/* Training Effect */}
      {(a.trainingEffectAerobic || a.trainingEffectAnaerobic) && (
        <div className="card" style={{ display: 'flex', gap: 24 }}>
          {a.trainingEffectAerobic && (
            <div>
              <span className="label-mono" style={{ display: 'block', marginBottom: 2 }}>Aerob TE</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--accent)' }}>
                {a.trainingEffectAerobic.toFixed(1)}
              </span>
            </div>
          )}
          {a.trainingEffectAnaerobic && (
            <div>
              <span className="label-mono" style={{ display: 'block', marginBottom: 2 }}>Anaerob TE</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--amber)' }}>
                {a.trainingEffectAnaerobic.toFixed(1)}
              </span>
            </div>
          )}
          {a.vo2maxEstimate && (
            <div>
              <span className="label-mono" style={{ display: 'block', marginBottom: 2 }}>VO2max</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--green)' }}>
                {a.vo2maxEstimate.toFixed(0)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* HR Zones */}
      <HrZonesBar zones={hrZones} />

      {/* Lap HR/Power Chart */}
      {laps.length > 1 && <LapsHrChart laps={laps} />}

      {/* Laps Table */}
      <LapsTable laps={laps} activityType={a.activityType} />

    </div>
  );
}
