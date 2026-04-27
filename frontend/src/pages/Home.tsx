import { useState } from 'react';
import { usePulseHome, useGarminSync, usePulseMetrics } from '@/pulse/hooks';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { StatCard } from '@/components/StatCard';
import { Skeleton, StatGridSkeleton } from '@/components/Skeleton';

function fmt(v: number | null | undefined, decimals = 0): string {
  return v == null ? '–' : v.toFixed(decimals);
}


const READINESS_COLOR: Record<string, string> = {
  optimal: 'var(--green)',
  good:    'var(--green)',
  caution: 'var(--amber)',
  rest:    'var(--rose)',
};

const STATUS_LABEL: Record<string, string> = {
  excellent: 'OPTIMAL',
  good:      'GUT',
  moderate:  'VORSICHT',
  poor:      'REST',
};

export default function Home() {
  const { data, isLoading, error } = usePulseHome();
  const sync = useGarminSync();
  const { data: metricsData } = usePulseMetrics(14);
  const [dismissed, setDismissed] = useState<boolean>(() =>
    localStorage.getItem('prognosis-dismissed') === new Date().toDateString(),
  );

  const { data: briefing } = useQuery({
    queryKey: ['briefing-latest'],
    queryFn: () => api.briefing.latest(),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <Skeleton height={10} width="50%" />
            <Skeleton height={22} width="40%" />
          </div>
          <Skeleton height={72} width={88} />
        </div>
        <StatGridSkeleton cols={3} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[0,1,2,3].map(i => <Skeleton key={i} height={80} />)}
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div style={{ color: 'var(--rose)', fontFamily: 'var(--font-mono)', fontSize: 11 }} className="py-8 text-center">
        {error?.message ?? 'No data'}
      </div>
    );
  }

  const navigate = useNavigate();
  const m = data.todayMetrics;
  const fl = data.fitnessLoad;
  const msg = briefing?.briefing;

  const metrics = metricsData?.metrics ?? [];
  const hrvSpark   = metrics.map(d => d.hrvRmssd   ?? null);
  const sleepSpark = metrics.map(d => d.sleepHours ?? null);
  const batSpark   = metrics.map(d => d.bodyBatteryMax ?? null);

  const readinessStatus = data.readiness.label as string;
  const readinessColor  = READINESS_COLOR[readinessStatus] ?? READINESS_COLOR.caution;

  return (
    <div className="flex flex-col gap-3">

      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label-mono" style={{ marginBottom: 4 }}>
            {new Date(data.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>Dashboard</h1>
        </div>

        {/* Readiness pill */}
        <div
          className="card flex flex-col items-end gap-1"
          style={{ padding: '10px 14px', minWidth: 0 }}
        >
          <span
            className="label-mono"
            style={{ color: readinessColor }}
          >
            {STATUS_LABEL[readinessStatus] ?? readinessStatus.toUpperCase()}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 24,
            fontWeight: 500,
            color: readinessColor,
            lineHeight: 1,
          }}>
            {data.readiness.score}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em' }}>
            READINESS
          </span>
        </div>
      </div>

      {/* ── Streaks ── */}
      {(data.streaks.checkinStreakDays > 0 || data.streaks.workoutStreakDays > 0) && (
        <div style={{ display: 'flex', gap: 10 }}>
          {data.streaks.checkinStreakDays > 0 && (
            <div className="card" style={{ flex: 1, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🔥</span>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--amber)', lineHeight: 1 }}>
                  {data.streaks.checkinStreakDays}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>
                  Check-in
                </div>
              </div>
            </div>
          )}
          {data.streaks.workoutStreakDays > 0 && (
            <div className="card" style={{ flex: 1, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>💪</span>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--green)', lineHeight: 1 }}>
                  {data.streaks.workoutStreakDays}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>
                  Training
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Prognosis alert ── */}
      {data.prognosis.alert && !dismissed && (
        <div
          className="card relative"
          style={{ borderColor: 'var(--amber)', padding: '12px 14px' }}
        >
          <button
            onClick={() => {
              setDismissed(true);
              localStorage.setItem('prognosis-dismissed', new Date().toDateString());
            }}
            className="absolute top-2.5 right-3"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}
          >
            ✕
          </button>
          <div className="label-mono" style={{ color: 'var(--amber)', marginBottom: 6 }}>
            HINWEIS
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {data.prognosis.message}
          </p>
          {data.prognosis.factors.length > 0 && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 6 }}>
              {data.prognosis.factors.join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* ── Coach briefing ── */}
      {msg && (
        <div className="card" style={{ borderColor: 'rgba(94,230,207,0.2)', padding: '12px 14px' }}>
          <div className="label-mono" style={{ color: 'var(--accent)', marginBottom: 6 }}>COACH</div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>{msg.briefing_text}</p>
        </div>
      )}

      {/* ── CTL / ATL / TSB ── */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Fitness"
          value={fmt(fl.ctl)}
          unit="CTL"
        />
        <StatCard
          label="Ermüdung"
          value={fmt(fl.atl)}
          unit="ATL"
        />
        <StatCard
          label="Form"
          value={fmt(fl.tsb)}
          unit="TSB"
          deltaColor={
            fl.tsb == null ? 'neutral' :
            fl.tsb >= -10 && fl.tsb <= 25 ? 'green' :
            fl.tsb > 25 ? 'amber' : 'rose'
          }
          accent={fl.tsb != null && fl.tsb >= -10 && fl.tsb <= 25}
        />
      </div>

      {/* ── Vitals ── */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="HRV"
          value={fmt(m?.hrvRmssd, 0)}
          unit="ms"
          sub={m?.hrvStatus ?? undefined}
          spark={hrvSpark}
          sparkColor="var(--accent)"
          accent
        />
        <StatCard
          label="Schlaf"
          value={fmt(m?.sleepHours, 1)}
          unit="h"
          sub={m?.sleepScore ? `Score ${m.sleepScore}` : undefined}
          spark={sleepSpark}
          sparkColor="var(--blue)"
          deltaColor={
            m?.sleepHours == null ? 'neutral' :
            m.sleepHours >= 7 ? 'green' :
            m.sleepHours >= 6 ? 'amber' : 'rose'
          }
        />
        <StatCard
          label="Body Battery"
          value={fmt(m?.bodyBatteryMax, 0)}
          unit="%"
          sub={m?.bodyBatteryMin ? `Min ${m.bodyBatteryMin}%` : undefined}
          spark={batSpark}
          sparkColor="var(--amber)"
        />
        <StatCard
          label="Schritte"
          value={m?.steps ? (m.steps >= 1000 ? `${(m.steps / 1000).toFixed(1)}k` : String(m.steps)) : '–'}
          deltaColor={
            m?.steps == null ? 'neutral' :
            m.steps >= 10000 ? 'green' :
            m.steps >= 5000 ? 'amber' : 'rose'
          }
        />
      </div>

      {/* ── Next workout ── */}
      {data.nextWorkout && (
        <div className="card">
          <div className="label-mono" style={{ marginBottom: 8 }}>NÄCHSTES TRAINING</div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                {data.nextWorkout.activityType}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', marginTop: 3 }}>
                {data.nextWorkout.plannedDate} · Z{data.nextWorkout.zone} · {data.nextWorkout.durationMin} min
              </div>
              {data.nextWorkout.description && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  {data.nextWorkout.description}
                </div>
              )}
            </div>
            {/* Zone indicator dot */}
            <div
              style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: ['','var(--blue)','var(--green)','var(--amber)','var(--amber)','var(--rose)'][data.nextWorkout.zone] ?? 'var(--text-3)',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Recent activities ── */}
      {data.recentActivities.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="label-mono" style={{ padding: '12px 16px 8px' }}>LETZTE AKTIVITÄTEN</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Aktivität', 'Dauer', 'km', 'TSS'].map(h => (
                  <th
                    key={h}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
                      color: 'var(--text-3)', fontWeight: 400, textTransform: 'uppercase',
                      padding: '6px 16px', textAlign: h === 'Aktivität' ? 'left' : 'right',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentActivities.slice(0, 5).map((a, i) => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/activity/${a.id}`)}
                  style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text)' }}>
                    {a.name ?? a.activityType}
                  </td>
                  <td style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>
                    {a.durationSec ? `${Math.round(a.durationSec / 60)}m` : '–'}
                  </td>
                  <td style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>
                    {a.distanceM ? (a.distanceM / 1000).toFixed(1) : '–'}
                  </td>
                  <td style={{ padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
                    {a.tss ? a.tss.toFixed(0) : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Garmin sync ── */}
      <button
        onClick={() => sync.mutate()}
        disabled={sync.isPending}
        className="w-full transition-colors"
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: 'transparent',
          color: sync.isPending ? 'var(--text-3)' : 'var(--text-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          padding: '8px 16px',
          cursor: sync.isPending ? 'default' : 'pointer',
        }}
      >
        {sync.isPending ? '● Syncing…' : 'Garmin Sync'}
      </button>
    </div>
  );
}
