import { useState } from 'react';
import { usePulseHome, usePulseMetrics, usePulseBriefing } from '@/pulse/hooks';
import { useNavigate } from 'react-router-dom';
import { SparkLine } from '@/components/SparkChart';
import { HealthStateBanner } from '@/components/HealthStateBanner';
import { AdjustTodayCard } from '@/components/AdjustTodayCard';
import { RaceCard } from '@/components/RaceCard';

function fmt(v: number | null | undefined, dec = 0): string {
  return v == null ? '–' : v.toFixed(dec);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen, Tobi';
  if (h < 18) return 'Guten Tag, Tobi';
  return 'Guten Abend, Tobi';
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.toLocaleDateString('de-DE', { weekday: 'short' }).toUpperCase();
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${date} · ${day}`;
}

const ZONE_COLOR: Record<number, string> = {
  1: '#3F4854',
  2: 'var(--blue)',
  3: 'var(--green)',
  4: 'var(--amber)',
  5: 'var(--rose)',
};

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipDef {
  title: string;
  what: string;
  good: string;
  bad: string;
}

const TOOLTIPS: Record<string, TooltipDef> = {
  HRV: {
    title: 'Heart Rate Variability',
    what: 'Variabilität zwischen Herzschlägen — Indikator für Erholungszustand des Nervensystems.',
    good: 'Hohe Werte (>50 ms) = gut erholt, bereit für intensive Belastung.',
    bad:  'Fallender Trend oder <40 ms = Überbelastung, mehr Ruhe nötig.',
  },
  RHR: {
    title: 'Resting Heart Rate',
    what: 'Ruhepuls morgens — steigt bei Müdigkeit, Krankheit oder Übertraining.',
    good: 'Nah am persönlichen Minimum = gute Erholung.',
    bad:  '+5–7 bpm über Baseline = Warnsignal, Belastung reduzieren.',
  },
  SCHLAF: {
    title: 'Schlafdauer',
    what: 'Tatsächliche Schlafdauer aus Garmin-Daten.',
    good: '7–9 h = optimal für Regeneration und Leistung.',
    bad:  '<6 h = deutlich reduzierte Erholung, kein Hochintensitätstraining.',
  },
  CTL: {
    title: 'Chronic Training Load',
    what: 'Fitness: exponentieller Durchschnitt der Trainingsbelastung (TSS) der letzten 42 Tage.',
    good: 'Langsam steigend = Aufbauphase. Typisch 40–80 für Amateure.',
    bad:  'Zu schnell steigend (>5–7/Woche) = Verletzungsrisiko.',
  },
  ATL: {
    title: 'Acute Training Load',
    what: 'Ermüdung: Durchschnitt der letzten 7 Tage — wie frisch oder müde du gerade bist.',
    good: 'Nah an CTL = ausgewogene Belastung.',
    bad:  'Deutlich über CTL (ATL >> CTL) = hohe akute Ermüdung.',
  },
  TSB: {
    title: 'Training Stress Balance',
    what: 'Form = CTL − ATL. Gibt an ob du frisch oder müde in ein Training gehst.',
    good: '−10 bis +5 = optimal für Wettkampf/Intensität. +5 bis +25 = sehr frisch.',
    bad:  'Unter −20 = übermüdet, hohes Verletzungsrisiko. Über +25 = zu wenig Training.',
  },
};

function Tooltip({ id, children }: { id: string; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const tip = TOOLTIPS[id];
  if (!tip) return <>{children}</>;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span onClick={handleClick} style={{ cursor: 'help', borderBottom: '1px dotted var(--text-3)' }}>
        {children}
      </span>
      {pos && (
        <>
          <span style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setPos(null)} />
          <div style={{
            position: 'fixed',
            left: Math.min(pos.x - 120, window.innerWidth - 256),
            top: pos.y - 8,
            transform: 'translateY(-100%)',
            width: 240, zIndex: 100,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '12px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: '.12em', marginBottom: 6 }}>
              {id} · {tip.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 8 }}>
              {tip.what}
            </div>
            <div style={{ fontSize: 10, color: 'var(--green)', lineHeight: 1.5, marginBottom: 4 }}>
              ✓ {tip.good}
            </div>
            <div style={{ fontSize: 10, color: 'var(--rose)', lineHeight: 1.5 }}>
              ✗ {tip.bad}
            </div>
          </div>
        </>
      )}
    </span>
  );
}

// ─── Zone Bar ─────────────────────────────────────────────────────────────────

function ZoneBar({ zone }: { zone: number }) {
  const segments =
    zone <= 2
      ? [{ z: 1, w: 15 }, { z: 2, w: 70 }, { z: 1, w: 15 }]
      : zone === 3
      ? [{ z: 1, w: 10 }, { z: 2, w: 15 }, { z: 3, w: 60 }, { z: 1, w: 15 }]
      : [
          { z: 1, w: 15 },
          { z: zone, w: 20 },
          { z: 1, w: 5 },
          { z: zone, w: 20 },
          { z: 1, w: 5 },
          { z: zone, w: 20 },
          { z: 1, w: 15 },
        ];

  return (
    <div style={{ display: 'flex', height: 5, gap: 1, borderRadius: 2, overflow: 'hidden', marginTop: 12 }}>
      {segments.map((s, i) => (
        <div key={i} style={{ flex: `0 0 ${s.w}%`, background: ZONE_COLOR[s.z] ?? 'var(--text-3)' }} />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { data, isLoading, error } = usePulseHome();
  const { data: metricsData } = usePulseMetrics(14);
  const { data: briefingData } = usePulseBriefing();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 0' }}>
        <div style={{ height: 20, width: '40%', background: 'var(--surface-2)', borderRadius: 3 }} />
        <div style={{ height: 28, width: '70%', background: 'var(--surface-2)', borderRadius: 3 }} />
        <div style={{ height: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
        <div style={{ height: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} />
        <div style={{ height: 80,  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ color: 'var(--rose)', fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'center', padding: '32px 0' }}>
        {error?.message ?? 'Keine Daten'}
      </div>
    );
  }

  const m  = data.todayMetrics;
  const fl = data.fitnessLoad;
  const nw = data.nextWorkout;

  const metrics  = metricsData?.metrics ?? [];
  const hrvSpark = metrics.map(d => d.hrvRmssd ?? null);

  const readinessColor =
    data.readiness.score >= 80 ? 'var(--green)' :
    data.readiness.score >= 60 ? 'var(--accent)' :
    data.readiness.score >= 40 ? 'var(--amber)' : 'var(--rose)';

  const readinessLabel =
    data.readiness.score >= 80 ? 'OPTIMAL' :
    data.readiness.score >= 60 ? 'GUT' :
    data.readiness.score >= 40 ? 'MÄSSIG' : 'ERHOLEN';

  const tsbColor =
    fl.tsb > 25    ? 'var(--amber)' :
    fl.tsb >= -10  ? 'var(--green)' : 'var(--rose)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80 }}>

      {/* ── Date + Greeting ── */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.18em', marginBottom: 4 }}>
          {fmtDate(data.date)}
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>
          {greeting()}
        </div>
      </div>

      {/* ── Health State Banner (active illness/injury/fatigue) ── */}
      <HealthStateBanner />

      {/* ── Adjust-Today Proposal (if readiness/health requires) ── */}
      <AdjustTodayCard />

      {/* ── Race Card (next/current race) ── */}
      <RaceCard />

      {/* ── Hero: Readiness ── */}
      <div style={{
        padding: '18px',
        background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.16em' }}>
            READINESS · TODAY
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: readinessColor }}>
            ● {readinessLabel}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 500, color: readinessColor, letterSpacing: '-.02em', lineHeight: 1 }}>
            {data.readiness.score}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-3)' }}>/ 100</span>
          {data.prognosis.alert && (
            <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--amber)', letterSpacing: '.1em' }}>
              HINWEIS
            </span>
          )}
        </div>

        {hrvSpark.some(v => v !== null) && (
          <SparkLine values={hrvSpark} height={28} color={readinessColor} fillOpacity={0.12} />
        )}

        {/* 3-up: HRV / RHR / Sleep */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 1, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginTop: 14,
        }}>
          {[
            { id: 'HRV',    v: fmt(m?.hrvRmssd),       u: 'ms',  d: m?.hrvStatus ?? null,                          dc: 'var(--green)' },
            { id: 'RHR',    v: fmt(m?.restingHr),       u: 'bpm', d: m?.restingHr ? '↓ gut' : null,                dc: 'var(--green)' },
            { id: 'SCHLAF', v: fmt(m?.sleepHours, 1),   u: 'h',   d: m?.sleepScore ? `Score ${m.sleepScore}` : null, dc: 'var(--blue)'  },
          ].map(s => (
            <div key={s.id} style={{ padding: '10px', background: 'var(--surface)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', letterSpacing: '.14em' }}>
                <Tooltip id={s.id}>{s.id}</Tooltip>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--text)' }}>{s.v}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>{s.u}</span>
              </div>
              {s.d && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: s.dc, marginTop: 2 }}>{s.d}</div>}
            </div>
          ))}
        </div>

        {data.prognosis.factors.length > 0 && (
          <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', lineHeight: 1.6 }}>
            {data.prognosis.factors.map((f, i) => (
              <span key={i}>
                <span style={{ color: 'var(--green)', marginRight: 4 }}>+</span>{f}
                {i < data.prognosis.factors.length - 1 && ' · '}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Today's workout ── */}
      {nw && (
        <div style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.14em' }}>
              NÄCHSTES TRAINING
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-2)' }}>
              {new Date(nw.plannedDate + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{nw.activityType}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', marginTop: 3 }}>
            Zone {nw.zone} · {nw.durationMin} min{nw.targetTss ? ` · TSS ${nw.targetTss}` : ''}
          </div>
          <ZoneBar zone={nw.zone} />
          {nw.description && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.55 }}>
              {nw.description.split('\n')[0]}
            </div>
          )}
          <button
            onClick={() => navigate('/plan')}
            style={{
              width: '100%', marginTop: 14, padding: '11px',
              background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 5,
              fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.16em', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ZUM PLAN →
          </button>
        </div>
      )}

      {/* ── Form: CTL / ATL / TSB ── */}
      <div style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.14em' }}>FORM · FITNESS</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-2)' }}>
            {fl.tsb > 10 ? 'frisch' : fl.tsb >= -10 ? 'optimal' : fl.tsb >= -20 ? 'aufbauend' : 'müde'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { id: 'CTL', v: fmt(fl.ctl, 1), sub: 'Fitness',   color: 'var(--accent)' },
            { id: 'ATL', v: fmt(fl.atl, 1), sub: 'Ermüdung',  color: 'var(--amber)'  },
            { id: 'TSB', v: (fl.tsb >= 0 ? '+' : '') + fmt(fl.tsb, 1), sub: 'Form', color: tsbColor },
          ].map(s => (
            <div key={s.id}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.14em' }}>
                <Tooltip id={s.id}>{s.id}</Tooltip>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: s.color, marginTop: 3 }}>{s.v}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Coach Briefing ── */}
      {briefingData?.briefing && (
        <div style={{
          padding: '14px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: '4px 6px 6px 4px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '.14em' }}>
              COACH · DAILY BRIEF
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
              {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)' }}>
            {briefingData.briefing}
          </div>
        </div>
      )}

      {/* ── Recent Activities ── */}
      {data.recentActivities.length > 0 && (
        <div style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.14em', marginBottom: 10 }}>
            RECENT
          </div>
          {data.recentActivities.slice(0, 5).map((a, i) => {
            const dayLabel = new Date(a.startTime).toLocaleDateString('de-DE', { weekday: 'short' });
            return (
              <div
                key={a.id}
                onClick={() => navigate(`/activity/${a.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                  borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <div style={{ width: 28, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textAlign: 'center', flexShrink: 0 }}>
                  {dayLabel.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name ?? a.activityType}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                    {a.distanceM ? `${(a.distanceM / 1000).toFixed(1)} km · ` : ''}
                    {a.durationSec ? `${Math.round(a.durationSec / 60)}'` : ''}
                    {a.tss ? ` · TSS ${a.tss.toFixed(0)}` : ''}
                  </div>
                </div>
                {a.tss != null && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', flexShrink: 0 }}>
                    {a.tss.toFixed(0)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
