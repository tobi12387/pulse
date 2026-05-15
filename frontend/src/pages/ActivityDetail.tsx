import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { pulseApi } from '@/pulse/api-client';
import type { ActivityAnalytics, NutritionLog, NutritionLogPatch } from '@/pulse/api-client';
import { Skeleton } from '@/components/Skeleton';
import {
  useActivityFeedback,
  useAssignActivityEquipment,
  useDeleteNutritionLog,
  useEquipment,
  useFuelingDebt,
  useNutritionLogs,
  useUpdateNutritionLog,
  pulseKeys,
} from '@/pulse/hooks';
import { NutritionLogModal } from '@/components/NutritionLogModal';
import { FuelingOutcomeBaselineBlock } from '@/components/FuelingOutcomeBaseline';
import { RpeBar } from '@/components/RpeBar';
import { rpeColor } from '@/lib/rpe';
import { RPE_SORENESS_AREAS, type PulseActivityType, type PulseFuelingOutcomeBaseline, type RpeSorenessArea } from '@coaching-os/shared/pulse';

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

const SORENESS_LABELS: Record<RpeSorenessArea, string> = {
  neck: 'Nacken',
  shoulders: 'Schultern',
  upper_back: 'Oberer Rücken',
  lower_back: 'Lower Back',
  hip: 'Hüfte',
  glutes: 'Gesäß',
  quad: 'Quad',
  hamstring: 'Hamstring',
  calf: 'Wade',
  knee_left: 'Knie L',
  knee_right: 'Knie R',
  achilles: 'Achilles',
  foot: 'Fuß',
  general_fatigue: 'Allg. Müdigkeit',
};

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

function RpeFeedbackSheet({
  activity,
  onClose,
}: {
  activity: {
    id: string;
    rpe: number | null;
    rpeNote: string | null;
    sorenessAreas: RpeSorenessArea[] | null;
  };
  onClose: () => void;
}) {
  const save = useActivityFeedback(activity.id);
  const [rpe, setRpe] = useState(activity.rpe ?? 5);
  const [note, setNote] = useState(activity.rpeNote ?? '');
  const [areas, setAreas] = useState<RpeSorenessArea[]>(activity.sorenessAreas ?? []);

  function toggleArea(area: RpeSorenessArea) {
    setAreas((cur) => cur.includes(area) ? cur.filter(a => a !== area) : [...cur, area]);
  }

  async function handleSave() {
    await save.mutateAsync({
      rpe,
      rpeNote: note.trim() ? note.trim() : null,
      sorenessAreas: areas.length > 0 ? areas : null,
    });
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'flex-end',
        background: 'rgba(0,0,0,0.42)',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 760,
          margin: '0 auto',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          borderRadius: '10px 10px 0 0',
          padding: 16,
          boxShadow: '0 -20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 4 }}>
              Post-Workout
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>
              Wie hat sich's angefühlt?
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RpeBar value={rpe} onChange={setRpe} />

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="label-mono">Notiz optional</span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value.slice(0, 500))}
              placeholder="z.B. Beine zäh, Hitze, Rücken ok..."
              rows={3}
              style={{
                width: '100%',
                resize: 'vertical',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                padding: 10,
                color: 'var(--text)',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            />
          </label>

          <div>
            <div className="label-mono" style={{ marginBottom: 8 }}>Wo zwickt's? optional</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {RPE_SORENESS_AREAS.map(area => {
                const active = areas.includes(area);
                return (
                  <button
                    key={area}
                    onClick={() => toggleArea(area)}
                    style={{
                      padding: '6px 9px',
                      borderRadius: 5,
                      border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
                      background: active ? 'rgba(245, 158, 11, 0.14)' : 'transparent',
                      color: active ? 'var(--amber)' : 'var(--text-2)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      cursor: 'pointer',
                    }}
                  >
                    {SORENESS_LABELS[area]}
                  </button>
                );
              })}
            </div>
          </div>

          {save.error && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rose)' }}>
              {save.error.message}
            </div>
          )}

          <button
            onClick={() => void handleSave()}
            disabled={save.isPending}
            style={{
              width: '100%',
              padding: '12px',
              background: save.isPending ? 'var(--surface-2)' : 'var(--accent)',
              color: save.isPending ? 'var(--text-3)' : 'var(--bg)',
              border: 'none',
              borderRadius: 5,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '.16em',
              fontWeight: 600,
              cursor: save.isPending ? 'default' : 'pointer',
            }}
          >
            {save.isPending ? 'SPEICHERT...' : 'SPEICHERN'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RpeFeedbackCard({
  activity,
  nowMs,
  onOpen,
}: {
  activity: {
    startTime: string;
    rpe: number | null;
    rpeNote: string | null;
    sorenessAreas: RpeSorenessArea[] | null;
  };
  nowMs: number;
  onOpen: () => void;
}) {
  const hasRpe = activity.rpe != null;
  const isRecent = nowMs - new Date(activity.startTime).getTime() < 24 * 60 * 60 * 1000;
  const color = hasRpe ? rpeColor(activity.rpe!) : 'var(--accent)';

  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 5 }}>
            RPE Feedback
          </div>
          {hasRpe ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: activity.rpeNote ? 5 : 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color }}>{activity.rpe}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>/ 10</span>
              </div>
              {activity.rpeNote && (
                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{activity.rpeNote}</div>
              )}
              {activity.sorenessAreas?.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  {activity.sorenessAreas.map(area => (
                    <span key={area} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--amber)' }}>
                      {SORENESS_LABELS[area]}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {isRecent ? 'Kurzer Check nach der Einheit: subjektive Belastung eintragen.' : 'Noch kein subjektives Feedback für diese Einheit.'}
            </div>
          )}
        </div>
        <button
          onClick={onOpen}
          style={{
            flexShrink: 0,
            padding: '8px 10px',
            background: hasRpe ? 'transparent' : 'var(--accent)',
            color: hasRpe ? 'var(--accent)' : 'var(--bg)',
            border: `1px solid ${hasRpe ? 'var(--border)' : 'var(--accent)'}`,
            borderRadius: 5,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.12em',
            cursor: 'pointer',
          }}
        >
          {hasRpe ? 'BEARBEITEN' : 'EINTRAGEN'}
        </button>
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

// ─── Analytics: Aerobic Decoupling ───────────────────────────────────────────

function DecouplingCard({ decoupling }: { decoupling: NonNullable<ActivityAnalytics['decoupling']> }) {
  const ratingColor =
    decoupling.rating === 'excellent' ? 'var(--green)' :
    decoupling.rating === 'good'      ? 'var(--accent)' :
    decoupling.rating === 'fair'      ? 'var(--amber)' :
    'var(--rose)';

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
        AEROBIC DECOUPLING
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, color: ratingColor }}>
          {decoupling.decouplingPct.toFixed(1)}%
        </span>
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: ratingColor }}>
        {decoupling.rating}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
          Erste Hälfte: {decoupling.firstHalfRatio.toFixed(3)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
          Zweite Hälfte: {decoupling.secondHalfRatio.toFixed(3)}
        </span>
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
        &lt;3% excellent · &lt;5% good · &lt;7% fair · ≥7% poor
      </span>
    </div>
  );
}

// ─── Analytics: Efficiency Factor ────────────────────────────────────────────

function EfCard({ ef, comparable }: {
  ef: NonNullable<ActivityAnalytics['ef']>;
  comparable: ActivityAnalytics['comparable'];
}) {
  let deltaEl: React.ReactNode = null;
  if (comparable && comparable.avgEf != null && comparable.countLast30d >= 2) {
    const deltaPct = ((ef.ef - comparable.avgEf) / comparable.avgEf) * 100;
    const absPct = Math.abs(deltaPct);
    const deltaColor =
      absPct <= 2   ? 'var(--amber)' :
      deltaPct > 0  ? 'var(--green)' :
      'var(--rose)';
    const sign = deltaPct >= 0 ? '+' : '';
    deltaEl = (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: deltaColor }}>
        Δ vs 30d-Schnitt {sign}{deltaPct.toFixed(1)}%
      </span>
    );
  }

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
        EFFICIENCY FACTOR
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, color: 'var(--text)' }}>
          {ef.ef.toFixed(2)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
          {ef.unit}
        </span>
      </div>
      {deltaEl}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
        Höhere Werte = besser. Pace/HR-Verhältnis bei Lauf, NP/HR bei Rad.
      </span>
    </div>
  );
}

// ─── Analytics: Weather ───────────────────────────────────────────────────────

const WEATHER_EMOJI: Record<string, string> = {
  clear: '☀️',
  clouds: '⛅',
  rain: '🌧️',
  snow: '❄️',
  thunderstorm: '⛈️',
  fog: '🌫️',
  other: '🌡️',
};

function WeatherCard({ weather }: { weather: NonNullable<ActivityAnalytics['weather']> }) {
  const emoji = WEATHER_EMOJI[weather.conditions] ?? WEATHER_EMOJI['other'];

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
        WETTER
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 24 }}>{emoji}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', textTransform: 'capitalize' }}>
          {weather.conditions}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, color: 'var(--text)' }}>
          {weather.tempC.toFixed(0)}°C
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
          gefühlt {weather.feelsC.toFixed(0)}°C
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
          Wind: {weather.windKmh.toFixed(0)} km/h
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
          Luftfeuchte: {weather.humidityPct.toFixed(0)}%
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
          Niederschlag: {weather.precipMm.toFixed(1)} mm
        </span>
      </div>
      {weather.feelsC > 28 && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--amber)' }}>
          Hitze: HR-Drift erwartbar erhöht
        </span>
      )}
      {weather.feelsC < 0 && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--blue)' }}>
          Frost: lockerer Auftakt zur Vermeidung von Atemwegsstress
        </span>
      )}
    </div>
  );
}

// ─── Fueling Section ─────────────────────────────────────────────────────────

const POWER_CARB_ID = 'mnstry-power-carb-sour-cherry-1-0-8';

const FUELING_PRODUCT_LABELS: Record<string, string> = {
  [POWER_CARB_ID]: 'POWER CARB',
  'mnstry-bicarb-gel-40-lemon-1-0-8': 'BICARB GEL',
  'mnstry-porridge-bar-sour-cherry': 'PORRIDGE BAR',
  'mnstry-protein-bar-8-peanut-cranberry': 'PROTEIN BAR 8',
  mars: 'Mars',
};

type FuelingEvidenceCompletion = {
  label: string;
  patch: NutritionLogPatch;
};

function isLongFuelingActivity(activityType: string, durationMin: number): boolean {
  return ['bike', 'run', 'hike'].includes(activityType) && durationMin >= 75;
}

function hasFuelingCarbEvidence(log: NutritionLog): boolean {
  return log.carbsG != null;
}

function fuelingTrendEvidenceLabel(baseline: PulseFuelingOutcomeBaseline | null): string {
  const learningReadiness = baseline?.learningReadiness ?? null;
  if (!learningReadiness) return 'Trend-Evidenz offen';
  return `Trend-Evidenz ${learningReadiness.comparableCompleteLogs}/${learningReadiness.requiredComparableCompleteLogs}`;
}

function parseGermanNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function fuelingLogText(log: NutritionLog): string {
  return [log.description, log.notes].filter((item): item is string => Boolean(item)).join(' ');
}

function inferBottles750Ml(log: NutritionLog): number | null {
  if (log.bottles750Ml != null || log.drinksMl == null || log.drinksMl <= 0) return null;
  const bottles = log.drinksMl / 750;
  return Number.isInteger(bottles) && bottles > 0 && bottles <= 40 ? bottles : null;
}

function inferPowerCarbPowderG(log: NutritionLog): number | null {
  if (log.powderG != null) return null;
  const text = fuelingLogText(log);
  const match = text.match(/(\d+(?:[,.]\d+)?)\s*g\s+power\s*carb\s+pulver/i)
    ?? text.match(/power\s*carb\s+(\d+(?:[,.]\d+)?)\s*g\s+pulver/i)
    ?? text.match(/(\d+(?:[,.]\d+)?)\s*g\s+power\s*carb/i);
  if (!match?.[1]) return null;
  const powderG = parseGermanNumber(match[1]);
  return powderG != null && powderG > 0 && powderG <= 3000 ? Math.round(powderG) : null;
}

function uniqueFuelingProducts(products: string[], productId: string): string[] {
  return products.includes(productId) ? products : [...products, productId];
}

function fuelingEvidenceCompletions(log: NutritionLog): FuelingEvidenceCompletion[] {
  const completions: FuelingEvidenceCompletion[] = [];
  const bottles750Ml = inferBottles750Ml(log);
  if (bottles750Ml != null) {
    completions.push({
      label: `${bottles750Ml} x 750 ml übernehmen`,
      patch: { bottles750Ml },
    });
  }

  const powderG = inferPowerCarbPowderG(log);
  if (powderG != null) {
    completions.push({
      label: `${powderG} g Pulver übernehmen`,
      patch: {
        powderG,
        fuelingProducts: fuelingLogText(log).toLocaleLowerCase('de-DE').includes('power carb')
          ? uniqueFuelingProducts(log.fuelingProducts, POWER_CARB_ID)
          : undefined,
      },
    });
  }

  return completions;
}

function fuelingEvidenceQuality({
  logs,
  activityType,
  durationMin,
  trendEvidence,
}: {
  logs: NutritionLog[];
  activityType: string;
  durationMin: number;
  trendEvidence: string;
}): {
  label: string;
  detail: string;
  items: string[];
  tone: 'green' | 'amber';
  giComfortCompletionLogId: string | null;
  detailCompletionLogId: string | null;
  detailCompletions: FuelingEvidenceCompletion[];
} | null {
  if (!isLongFuelingActivity(activityType, durationMin)) return null;

  const duringLogs = logs.filter(log => log.context === 'during' || log.context == null);
  const latest = duringLogs[0] ?? null;
  if (!latest) {
    return {
      label: 'Lernevidenz offen',
      detail: 'Für diese lange Einheit fehlt noch ein During-Log mit Carbs und GI-Komfort.',
      items: ['During-Log fehlt', trendEvidence],
      tone: 'amber',
      giComfortCompletionLogId: null,
      detailCompletionLogId: null,
      detailCompletions: [],
    };
  }

  const hasCarbs = hasFuelingCarbEvidence(latest);
  const hasGiComfort = latest.giComfort != null;
  const detailCompletions = fuelingEvidenceCompletions(latest);
  if (!hasCarbs || !hasGiComfort) {
    return {
      label: 'Lernevidenz unvollständig',
      detail: 'Dieser lange Log hilft erst dann für Trends, wenn Carbs und GI-Komfort zusammen vorliegen.',
      items: [
        hasCarbs ? 'Carbs erfasst' : 'Carbs fehlen',
        hasGiComfort ? 'GI-Komfort erfasst' : 'GI-Komfort fehlt',
        trendEvidence,
      ],
      tone: 'amber',
      giComfortCompletionLogId: hasCarbs && !hasGiComfort ? latest.id : null,
      detailCompletionLogId: detailCompletions.length > 0 ? latest.id : null,
      detailCompletions,
    };
  }

  return {
    label: 'Lernevidenz vollständig',
    detail: 'Dieser During-Log hat Carbs und GI-Komfort und kann in die Fueling-Baseline einfließen.',
    items: ['Carbs erfasst', 'GI-Komfort erfasst', trendEvidence],
    tone: 'green',
    giComfortCompletionLogId: null,
    detailCompletionLogId: detailCompletions.length > 0 ? latest.id : null,
    detailCompletions,
  };
}

function FuelingSection({
  activityId, workoutId, durationMin, activityType,
}: {
  activityId: string; workoutId: string | null;
  durationMin: number; activityType: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const { data } = useNutritionLogs(null, activityId);
  const fuelingDebtQuery = useFuelingDebt();
  const deleteMut = useDeleteNutritionLog();
  const updateNutrition = useUpdateNutritionLog();
  const logs = data?.logs ?? [];
  const fuelingDebt = fuelingDebtQuery.data?.fuelingDebt ?? null;
  const fuelingOutcomeBaseline = fuelingDebtQuery.data?.outcomeBaseline ?? null;
  const evidenceQuality = fuelingEvidenceQuality({
    logs,
    activityType,
    durationMin,
    trendEvidence: fuelingTrendEvidenceLabel(fuelingOutcomeBaseline),
  });
  const giComfortCompletionLogId = evidenceQuality?.giComfortCompletionLogId ?? null;
  const detailCompletionLogId = evidenceQuality?.detailCompletionLogId ?? null;

  const safeType = ['run','bike','swim','strength','hike'].includes(activityType)
    ? (activityType as 'run'|'bike'|'swim'|'strength'|'hike')
    : 'other';
  const giLabels: Record<string, string> = {
    ok: 'Magen ok',
    mild_issue: 'Magen leicht unruhig',
    issue: 'Magenprobleme',
  };
  const giComfortOptions: Array<{ value: NonNullable<NutritionLog['giComfort']>; label: string }> = [
    { value: 'ok', label: giLabels.ok },
    { value: 'mild_issue', label: giLabels.mild_issue },
    { value: 'issue', label: giLabels.issue },
  ];

  return (
    <>
      <div id="activity-fueling-log" className="card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
            Fueling
          </span>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 4, padding: '4px 10px',
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)',
              letterSpacing: '.12em', cursor: 'pointer',
            }}
          >
            + Fueling-Log
          </button>
        </div>

        {logs.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '8px 0' }}>
            Noch kein Fueling geloggt.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {logs.map(log => (
              <div key={log.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 0', borderTop: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {log.gelsCount != null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
                      {log.gelsCount} Gel{log.gelsCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {log.drinksMl != null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--blue)' }}>
                      {log.drinksMl} ml
                    </span>
                  )}
                  {log.bottles750Ml != null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--blue)' }}>
                      {log.bottles750Ml} x 750 ml
                    </span>
                  )}
                  {log.powderG != null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--amber)' }}>
                      {log.powderG}g Pulver
                    </span>
                  )}
                  {log.carbsG != null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--amber)' }}>
                      {log.carbsG}g CH
                    </span>
                  )}
                  {log.fuelingProducts?.length > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)' }}>
                      {log.fuelingProducts.map(id => FUELING_PRODUCT_LABELS[id] ?? id).join(', ')}
                    </span>
                  )}
                  {log.giComfort && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: log.giComfort === 'ok' ? 'var(--green)' : 'var(--amber)' }}>
                      {giLabels[log.giComfort] ?? log.giComfort}
                    </span>
                  )}
                  {log.sodiumMg != null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                      {log.sodiumMg}mg Na
                    </span>
                  )}
                  {log.notes && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', fontStyle: 'italic' }}>
                      {log.notes}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteMut.mutate(log.id)}
                  disabled={deleteMut.isPending}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)',
                    padding: '0 4px', flexShrink: 0,
                  }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {evidenceQuality && (
          <div
            data-testid="activity-fueling-evidence-quality"
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 'var(--radius)',
              border: `1px solid ${evidenceQuality.tone === 'green' ? 'rgba(74,222,128,0.32)' : 'rgba(251,191,36,0.34)'}`,
              background: evidenceQuality.tone === 'green' ? 'rgba(74,222,128,0.06)' : 'rgba(251,191,36,0.06)',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 700,
              color: evidenceQuality.tone === 'green' ? 'var(--green)' : 'var(--amber)',
              letterSpacing: 0,
              textTransform: 'uppercase',
              marginBottom: 5,
            }}>
              {evidenceQuality.label}
            </div>
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-2)' }}>
              {evidenceQuality.detail}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {evidenceQuality.items.map(item => (
                <span
                  key={item}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '3px 6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: item.includes('fehlt') || item.includes('offen') ? 'var(--amber)' : 'var(--text-2)',
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
            {giComfortCompletionLogId && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--text-3)',
                  letterSpacing: 0,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}>
                  GI-Komfort ergänzen
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {giComfortOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateNutrition.mutate({
                        id: giComfortCompletionLogId,
                        data: { giComfort: option.value },
                      })}
                      disabled={updateNutrition.isPending}
                      style={{
                        minHeight: 44,
                        background: 'rgba(0,0,0,0.18)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        padding: '6px 9px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--text-2)',
                        cursor: updateNutrition.isPending ? 'wait' : 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {detailCompletionLogId && evidenceQuality.detailCompletions.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--text-3)',
                  letterSpacing: 0,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}>
                  Praxisdetails strukturieren
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {evidenceQuality.detailCompletions.map(completion => (
                    <button
                      key={completion.label}
                      type="button"
                      onClick={() => updateNutrition.mutate({
                        id: detailCompletionLogId,
                        data: completion.patch,
                      })}
                      disabled={updateNutrition.isPending}
                      style={{
                        minHeight: 44,
                        background: 'rgba(0,0,0,0.18)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        padding: '6px 9px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--text-2)',
                        cursor: updateNutrition.isPending ? 'wait' : 'pointer',
                      }}
                    >
                      {completion.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <FuelingOutcomeBaselineBlock baseline={fuelingOutcomeBaseline} testId="activity-fueling-baseline" />

        {fuelingDebt && (fuelingDebt.hasOpenDebt || fuelingDebt.status === 'tolerated_follow_up') && (
          <div
            data-testid="activity-fueling-debt"
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 'var(--radius)',
              border: `1px solid ${fuelingDebt.hasOpenDebt ? 'rgba(251,191,36,0.34)' : 'rgba(74,222,128,0.32)'}`,
              background: fuelingDebt.hasOpenDebt ? 'rgba(251,191,36,0.06)' : 'rgba(74,222,128,0.06)',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 700,
              color: fuelingDebt.hasOpenDebt ? 'var(--amber)' : 'var(--green)',
              letterSpacing: 0,
              textTransform: 'uppercase',
              marginBottom: 5,
            }}>
              {fuelingDebt.label}
            </div>
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-2)' }}>
              {fuelingDebt.summary}
            </p>
            <p style={{ margin: '5px 0 0', fontSize: 11, lineHeight: 1.45, color: fuelingDebt.hasOpenDebt ? 'var(--amber)' : 'var(--text-3)' }}>
              {fuelingDebt.closureCondition}
            </p>
          </div>
        )}
      </div>

      {modalOpen && (
        <NutritionLogModal
          activityId={activityId}
          workoutId={workoutId}
          durationMin={durationMin}
          activityType={safeType}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

const ACTIVITY_LABEL: Record<PulseActivityType, string> = {
  run: 'Laufen',
  bike: 'Rad',
  swim: 'Schwimmen',
  strength: 'Kraft',
  hike: 'Wandern',
  other: 'Sonstiges',
};

const PULSE_ACTIVITY_TYPES: PulseActivityType[] = ['run', 'bike', 'swim', 'strength', 'hike', 'other'];

function asPulseActivityType(value: string): PulseActivityType {
  return PULSE_ACTIVITY_TYPES.includes(value as PulseActivityType) ? value as PulseActivityType : 'other';
}

function ActivityEquipmentSection({
  activity,
}: {
  activity: {
    id: string;
    activityType: string;
    distanceM: number | null;
    equipmentIds: string[];
  };
}) {
  const equipmentQuery = useEquipment();
  const assign = useAssignActivityEquipment(activity.id);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const activityType = asPulseActivityType(activity.activityType);
  const assignedIds = activity.equipmentIds ?? [];
  const equipment = equipmentQuery.data?.equipment ?? [];
  const defaults = equipmentQuery.data?.defaults ?? [];
  const matching = equipment.filter(item => !item.retiredAt && !item.parentEquipmentId && item.activityTypes.includes(activityType));
  const defaultId = defaults.find(row => row.activityType === activityType)?.equipmentId ?? null;
  const selectedTopLevelId =
    assignedIds.find(id => matching.some(item => item.id === id))
    ?? equipment.find(item => assignedIds.includes(item.id) && item.parentEquipmentId)?.parentEquipmentId
    ?? '';
  const selectedNames = equipment
    .filter(item => assignedIds.includes(item.id))
    .map(item => item.name);
  const defaultName = equipment.find(item => item.id === defaultId)?.name ?? null;

  async function handleChange(equipmentId: string) {
    setMessage(null);
    try {
      await assign.mutateAsync(equipmentId ? [equipmentId] : []);
      setMessage({ text: 'Equipment-Zuordnung gespeichert.', ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Zuordnung fehlgeschlagen.', ok: false });
    }
  }

  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <span className="label-mono">Equipment</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          {activity.distanceM ? `${(activity.distanceM / 1000).toFixed(1)} km` : ACTIVITY_LABEL[activityType]}
        </span>
      </div>

      <select
        value={selectedTopLevelId}
        disabled={equipmentQuery.isLoading || assign.isPending || matching.length === 0}
        onChange={e => void handleChange(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '7px 9px',
          fontSize: 12,
          color: 'var(--text)',
          outline: 'none',
        }}
      >
        <option value="">Kein Equipment</option>
        {matching.map(item => (
          <option key={item.id} value={item.id}>
            {item.name}{item.id === defaultId ? ' (Default)' : ''}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
        {selectedNames.length > 0
          ? `Aktiv: ${selectedNames.join(', ')}.`
          : defaultName
            ? `Default für ${ACTIVITY_LABEL[activityType]}: ${defaultName}.`
            : matching.length === 0
              ? `Noch kein ${ACTIVITY_LABEL[activityType]}-Equipment in Settings angelegt.`
              : 'Keine Zuordnung für diese Aktivität.'}
      </div>

      {message && (
        <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: message.ok ? 'var(--green)' : 'var(--rose)' }}>
          {message.text}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: pulseKeys.activityDetail(id!),
    queryFn: () => pulseApi.activities.detail(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
  const [rpeOpen, setRpeOpen] = useState(false);
  const [dismissedAutoRpeActivityId, setDismissedAutoRpeActivityId] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const loadedActivity = data?.activity ?? null;
  const shouldAutoOpenRpe = loadedActivity != null
    && loadedActivity.rpe == null
    && dismissedAutoRpeActivityId !== loadedActivity.id
    && nowMs - new Date(loadedActivity.startTime).getTime() < 24 * 60 * 60 * 1000;
  const isRpeSheetOpen = rpeOpen || shouldAutoOpenRpe;

  function closeRpeSheet() {
    if (loadedActivity && shouldAutoOpenRpe) {
      setDismissedAutoRpeActivityId(loadedActivity.id);
    }
    setRpeOpen(false);
  }

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

  const { activity: a, laps, hrZones, analytics } = data;

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

      <RpeFeedbackCard activity={a} nowMs={nowMs} onOpen={() => setRpeOpen(true)} />

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

      <ActivityEquipmentSection activity={a} />

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

      {/* Fueling Section */}
      <FuelingSection
        activityId={a.id}
        workoutId={null}
        durationMin={a.durationSec ? Math.round(a.durationSec / 60) : 60}
        activityType={a.activityType}
      />

      {/* Analytics Cards */}
      {analytics?.decoupling != null && (
        <DecouplingCard decoupling={analytics.decoupling} />
      )}
      {analytics?.ef != null && (
        <EfCard ef={analytics.ef} comparable={analytics.comparable ?? null} />
      )}
      {analytics?.weather != null && (
        <WeatherCard weather={analytics.weather} />
      )}

      {isRpeSheetOpen && (
        <RpeFeedbackSheet activity={a} onClose={closeRpeSheet} />
      )}
    </div>
  );
}
