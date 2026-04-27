import { useState } from 'react';
import {
  usePulseSleep, usePulseCheckin, usePulseHome, useCheckinToday,
  usePulseMetrics, usePulseWeight, useLogWeight, useCheckinHistory, useCorrelations,
} from '@/pulse/hooks';
import { LineChart, ScatterPlot } from '@/components/SparkChart';
import { Skeleton } from '@/components/Skeleton';

type Tab = 'schlaf' | 'metriken' | 'gewicht' | 'mental' | 'korrelation';

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  return v == null ? '–' : `${v.toFixed(decimals)}${suffix}`;
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 1, padding: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, alignSelf: 'flex-start' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.1em',
          background: active === t.id ? 'var(--surface-2)' : 'transparent',
          color: active === t.id ? 'var(--accent)' : 'var(--text-2)',
          borderRadius: 3, textTransform: 'uppercase', border: 'none', cursor: 'pointer',
          transition: 'background 0.12s, color 0.12s',
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function RangePicker({ value, onChange, options }: {
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px',
            borderRadius: 4, letterSpacing: '0.1em',
            background: value === o.value ? 'var(--surface-2)' : 'transparent',
            color: value === o.value ? 'var(--text)' : 'var(--text-3)',
            border: '1px solid ' + (value === o.value ? 'var(--border)' : 'transparent'),
            cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton height={10} width="40%" />
          <Skeleton height={20} width="60%" />
          <Skeleton height={64} />
        </div>
      ))}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <p style={{ color: 'var(--text-3)', fontSize: 12 }} className="py-6 text-center">{msg}</p>
  );
}

// ─── Schlaf ───────────────────────────────────────────────────────────────────

const STAGE_COLORS = {
  deep:  '#6366f1',
  rem:   '#a78bfa',
  light: '#60a5fa',
  awake: 'rgba(139,149,163,0.3)',
};

function SleepStagePill({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
        {label} {value}
      </span>
    </span>
  );
}

function SleepStageBar({ deepH, remH, lightH, awakeH, totalH }: {
  deepH: number | null; remH: number | null; lightH: number | null;
  awakeH: number | null; totalH: number | null;
}) {
  if (!totalH || totalH <= 0) {
    return <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2 }} />;
  }
  const pct = (h: number | null) => Math.max(0, Math.round(((h ?? 0) / totalH) * 100));
  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 1 }}>
      <div style={{ width: `${pct(deepH)}%`,  background: STAGE_COLORS.deep  }} />
      <div style={{ width: `${pct(remH)}%`,   background: STAGE_COLORS.rem   }} />
      <div style={{ width: `${pct(lightH)}%`, background: STAGE_COLORS.light }} />
      <div style={{ width: `${pct(awakeH)}%`, background: STAGE_COLORS.awake }} />
    </div>
  );
}

const RANGE_OPTS = [
  { value: 7,  label: '7T'  },
  { value: 30, label: '30T' },
  { value: 90, label: '90T' },
];

function SchlafTab() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = usePulseSleep(days);
  if (isLoading) return <Loading />;
  if (error) return <Empty msg={error.message} />;
  const sessions = data?.sessions ?? [];
  if (sessions.length === 0) return <Empty msg="Keine Schlafdaten — Garmin sync." />;

  const chronological = [...sessions].reverse();
  const durations = chronological.map(s => s.durationH);
  const labels    = chronological.map(s => s.date);
  const avg = sessions.reduce((s, x) => s + (x.durationH ?? 0), 0) / sessions.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Range selector + overview chart */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <span className="label-mono">Schlafdauer</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', marginLeft: 8 }}>
              Ø {avg.toFixed(1)}h
            </span>
          </div>
          <RangePicker value={days} onChange={setDays} options={RANGE_OPTS} />
        </div>
        <LineChart values={durations} labels={labels} height={80} color="var(--blue)" fillOpacity={0.12} />
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          {[['deep','Tief'],['rem','REM'],['light','Leicht']] .map(([k,l]) => (
            <SleepStagePill key={k} color={STAGE_COLORS[k as keyof typeof STAGE_COLORS]} label={l} value="" />
          ))}
        </div>
      </div>

      {/* Per-night rows */}
      {sessions.map((s) => (
        <div key={s.date} className="card" style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{s.date}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
              {fmt(s.durationH, 1, 'h')}
            </span>
          </div>
          <SleepStageBar deepH={s.deepSleepH} remH={s.remSleepH} lightH={s.lightSleepH} awakeH={s.awakeH} totalH={s.durationH} />
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <SleepStagePill color={STAGE_COLORS.deep}  label="Tief"  value={fmt(s.deepSleepH,  1, 'h')} />
            <SleepStagePill color={STAGE_COLORS.rem}   label="REM"   value={fmt(s.remSleepH,   1, 'h')} />
            <SleepStagePill color={STAGE_COLORS.light} label="Leicht" value={fmt(s.lightSleepH, 1, 'h')} />
            {s.sleepScore != null && (
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                Score {s.sleepScore}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Metriken ─────────────────────────────────────────────────────────────────


function MetricCard({ label, values, labels, latest, suffix, color }: {
  label: string; values: (number | null)[]; labels: string[];
  latest: number | null; suffix?: string; color: string;
}) {
  return (
    <div className="card" style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span className="label-mono">{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>
          {fmt(latest, 0, suffix ?? '')}
        </span>
      </div>
      <LineChart values={values} labels={labels} height={72} color={color} fillOpacity={0.1} />
    </div>
  );
}

function MetrikenTab() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = usePulseMetrics(days);
  if (isLoading) return <Loading />;
  const rows = data?.metrics ?? [];
  if (rows.length === 0) return <Empty msg="Noch keine Daten — Garmin sync." />;

  const last = rows[rows.length - 1];
  const labels = rows.map(r => r.date);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Range selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <RangePicker value={days} onChange={setDays} options={RANGE_OPTS} />
      </div>

      <MetricCard label="HRV (ms)"         values={rows.map(r => r.hrvRmssd)}      labels={labels} latest={last?.hrvRmssd ?? null}      color="var(--accent)" />
      <MetricCard label="Ruhepuls (bpm)"   values={rows.map(r => r.restingHr)}     labels={labels} latest={last?.restingHr ?? null}     color="var(--rose)" />
      <MetricCard label="Body Battery"     values={rows.map(r => r.bodyBatteryMax)} labels={labels} latest={last?.bodyBatteryMax ?? null} suffix="%" color="var(--green)" />
      <MetricCard label="Stress"           values={rows.map(r => r.stressAvg)}     labels={labels} latest={last?.stressAvg ?? null}     color="var(--amber)" />
      <MetricCard label="Schritte"
        values={rows.map(r => r.steps != null ? Math.round(r.steps / 100) / 10 : null)}
        labels={labels}
        latest={last?.steps != null ? Math.round(last.steps / 100) / 10 : null}
        suffix="k"
        color="var(--blue)"
      />

      {/* Daily table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 4 }}>
        <div className="label-mono" style={{ padding: '10px 14px 6px' }}>Tageswerte</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {['Datum','HRV','Puls','Bat.','Stress'].map(h => (
                <th key={h} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: 'var(--text-3)', fontWeight: 400, padding: '5px 14px',
                  textAlign: h === 'Datum' ? 'left' : 'right',
                  borderTop: '1px solid var(--border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().slice(0, Math.min(days, 14)).map((r, i) => (
              <tr key={r.date} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                <td style={{ padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{r.date}</td>
                <td style={{ padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', textAlign: 'right' }}>{fmt(r.hrvRmssd, 0)}</td>
                <td style={{ padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>{fmt(r.restingHr, 0)}</td>
                <td style={{ padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>{fmt(r.bodyBatteryMax, 0, '%')}</td>
                <td style={{ padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', textAlign: 'right' }}>{fmt(r.stressAvg, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Gewicht ──────────────────────────────────────────────────────────────────

const WEIGHT_RANGE_OPTS = [
  { value: 30,  label: '30T' },
  { value: 90,  label: '90T' },
  { value: 180, label: '180T' },
];

function GewichtTab() {
  const [days, setDays] = useState(90);
  const { data, isLoading } = usePulseWeight(days);
  const logWeight = useLogWeight();
  const [kg, setKg] = useState('');
  const [inputError, setInputError] = useState('');

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(kg);
    if (isNaN(w) || w < 30 || w > 300) { setInputError('Gültiger Wert: 30–300 kg'); return; }
    await logWeight.mutateAsync({ weightKg: w });
    setKg('');
    setInputError('');
  }

  const entries = data?.entries ?? [];
  const chronological = [...entries].reverse();
  const weights = chronological.map(e => e.weightKg);
  const weightLabels = chronological.map(e => e.date);
  const latest  = entries[0];
  const prev7   = entries.find((e) => {
    if (!latest) return false;
    const cutoff = new Date(latest.date);
    cutoff.setDate(cutoff.getDate() - 7);
    const y = cutoff.getFullYear(), m = String(cutoff.getMonth()+1).padStart(2,'0'), d = String(cutoff.getDate()).padStart(2,'0');
    return e.date <= `${y}-${m}-${d}`;
  });
  const trend7d = latest && prev7 ? latest.weightKg - prev7.weightKg : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Input form */}
      <div className="card">
        <form onSubmit={(e) => void handleLog(e)} style={{ display: 'flex', gap: 8 }}>
          <input
            type="number" step="0.1" min="30" max="300"
            value={kg}
            onChange={e => { setKg(e.target.value); setInputError(''); }}
            placeholder="kg"
            style={{
              flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '7px 12px',
              fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={logWeight.isPending || !kg}
            style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '7px 14px',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: kg ? 'var(--accent)' : 'var(--text-3)',
              cursor: kg ? 'pointer' : 'default',
            }}
          >
            {logWeight.isPending ? '…' : 'Log'}
          </button>
        </form>
        {inputError && <p style={{ fontSize: 11, color: 'var(--rose)', marginTop: 6 }}>{inputError}</p>}
      </div>

      {/* KPI cards */}
      {latest && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="card">
              <span className="label-mono">Aktuell</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 500, color: 'var(--text)', marginTop: 4 }}>
                {latest.weightKg.toFixed(1)}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em' }}>KG</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                {latest.date}
                {latest.source === 'garmin' && (
                  <span style={{ marginLeft: 6, color: 'var(--accent)', fontSize: 9 }}>GARMIN</span>
                )}
              </div>
            </div>
            <div className="card">
              <span className="label-mono">7-Tage-Trend</span>
              {trend7d !== null ? (
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 500, marginTop: 4,
                  color: trend7d < -0.1 ? 'var(--green)' : trend7d > 0.1 ? 'var(--rose)' : 'var(--text)',
                }}>
                  {trend7d > 0 ? '+' : ''}{trend7d.toFixed(1)}
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--text-3)', marginTop: 4 }}>–</div>
              )}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em' }}>KG</div>
            </div>
          </div>

          {(latest.bodyFatPct != null || latest.muscleMassKg != null || latest.bmi != null) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {latest.bodyFatPct != null && (
                <div className="card" style={{ padding: '10px 12px' }}>
                  <span className="label-mono">Körperfett</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--amber)', marginTop: 4 }}>
                    {latest.bodyFatPct.toFixed(1)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em' }}>%</div>
                </div>
              )}
              {latest.muscleMassKg != null && (
                <div className="card" style={{ padding: '10px 12px' }}>
                  <span className="label-mono">Muskeln</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--green)', marginTop: 4 }}>
                    {latest.muscleMassKg.toFixed(1)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em' }}>KG</div>
                </div>
              )}
              {latest.bmi != null && (
                <div className="card" style={{ padding: '10px 12px' }}>
                  <span className="label-mono">BMI</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--blue)', marginTop: 4 }}>
                    {latest.bmi.toFixed(1)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em' }}>&nbsp;</div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Verlauf chart */}
      {weights.length >= 3 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="label-mono">Verlauf</span>
            <RangePicker value={days} onChange={setDays} options={WEIGHT_RANGE_OPTS} />
          </div>
          <LineChart values={weights} labels={weightLabels} height={80} color="var(--accent)" fillOpacity={0.08} />
        </div>
      )}

      {isLoading && <Loading />}

      {/* Log table */}
      {entries.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="label-mono" style={{ padding: '10px 14px 6px' }}>Einträge</div>
          {entries.slice(0, 20).map((e) => (
            <div key={e.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 14px', borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                {e.date}
                {e.source === 'garmin' && (
                  <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--accent)' }}>G</span>
                )}
              </span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                {e.bodyFatPct != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--amber)' }}>
                    {e.bodyFatPct.toFixed(1)}%
                  </span>
                )}
                {e.muscleMassKg != null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)' }}>
                    {e.muscleMassKg.toFixed(1)}kg M
                  </span>
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)' }}>
                  {e.weightKg.toFixed(1)} kg
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mental ───────────────────────────────────────────────────────────────────

function SegmentedBar({ label, value, onChange, color = 'var(--accent)' }: {
  label: string; value: number; onChange: (v: number) => void; color?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color }}>{value}/10</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} onClick={() => onChange(i + 1)} style={{
            flex: 1, height: 6, borderRadius: 1, cursor: 'pointer',
            background: i < value ? color : 'var(--bg)',
            border: '1px solid var(--border)',
            transition: 'background 0.1s',
          }} />
        ))}
      </div>
    </div>
  );
}

function MentalTab() {
  const [days, setDays] = useState(30);
  const home               = usePulseHome();
  const { data: today }    = useCheckinToday();
  const checkin            = usePulseCheckin();
  const { data: histData, isLoading: histLoading } = useCheckinHistory(days);
  const [form, setForm]    = useState({ mood: 7, energy: 7, stress: 3, motivation: 7, notes: '' });
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await checkin.mutateAsync({ ...form, notes: form.notes || undefined });
    setSubmitted(true);
  }

  const readiness   = home.data?.readiness;
  const alreadyDone = today?.checkin != null;
  const checkins    = histData?.checkins ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {readiness && (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Readiness heute</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: 'var(--text)' }}>
              {readiness.score}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {readiness.label}
            </div>
          </div>
        </div>
      )}

      {/* Check-in form */}
      {alreadyDone || submitted ? (
        <div className="card" style={{ borderColor: 'rgba(74,222,128,0.3)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', letterSpacing: '0.12em' }}>
            CHECK-IN HEUTE ERLEDIGT ✓
          </span>
        </div>
      ) : (
        <div className="card">
          <div className="label-mono" style={{ marginBottom: 16 }}>Täglicher Check-in</div>
          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SegmentedBar label="Stimmung"   value={form.mood}       onChange={(v) => setForm(f => ({ ...f, mood: v }))}       color="var(--accent)" />
            <SegmentedBar label="Energie"    value={form.energy}     onChange={(v) => setForm(f => ({ ...f, energy: v }))}     color="var(--green)"  />
            <SegmentedBar label="Stress"     value={form.stress}     onChange={(v) => setForm(f => ({ ...f, stress: v }))}     color="var(--amber)"  />
            <SegmentedBar label="Motivation" value={form.motivation} onChange={(v) => setForm(f => ({ ...f, motivation: v }))} color="var(--blue)"   />
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Notizen (optional)"
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '8px 12px',
                fontSize: 12, color: 'var(--text)', resize: 'none', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={checkin.isPending}
              style={{
                background: 'var(--surface-2)', border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)', padding: '9px 16px',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--accent)', cursor: 'pointer',
              }}
            >
              {checkin.isPending ? 'Speichern…' : 'Check-in senden'}
            </button>
          </form>
        </div>
      )}

      {/* History chart — multi-line SVG */}
      {checkins.length >= 3 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="label-mono">Mental Trend</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                <span style={{ color: 'var(--accent)' }}>━</span>{' '}
                <span style={{ color: 'var(--text-2)' }}>Mood</span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                <span style={{ color: 'var(--green)' }}>━</span>{' '}
                <span style={{ color: 'var(--text-2)' }}>Energy</span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                <span style={{ color: 'var(--amber)' }}>━</span>{' '}
                <span style={{ color: 'var(--text-2)' }}>Stress</span>
              </span>
            </div>
            <RangePicker value={days} onChange={setDays} options={RANGE_OPTS} />
          </div>
          {histLoading ? <Skeleton height={100} /> : (() => {
            const N = checkins.length;
            const W = 400, H = 100, P = 10;
            const yMin = 0, yMax = 10;
            const xs = (i: number) => P + (i / (N - 1)) * (W - P * 2);
            const ys = (v: number) => H - P - ((v - yMin) / (yMax - yMin)) * (H - P * 2);
            const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i)} ${ys(v)}`).join(' ');
            return (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 100 }}>
                {[2, 4, 6, 8].map(t => (
                  <line key={t} x1={P} x2={W - P} y1={ys(t)} y2={ys(t)} stroke="var(--border)" strokeWidth={0.5} />
                ))}
                <path d={path(checkins.map(c => c.mood))}       fill="none" stroke="var(--accent)" strokeWidth={1.6} />
                <path d={path(checkins.map(c => c.energy))}     fill="none" stroke="var(--green)"  strokeWidth={1.6} />
                <path d={path(checkins.map(c => c.stress))}     fill="none" stroke="var(--amber)"  strokeWidth={1.4} opacity={0.85} />
              </svg>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Korrelation ──────────────────────────────────────────────────────────────

const CORR_RANGE_OPTS = [
  { value: 30, label: '30T' },
  { value: 90, label: '90T' },
];

function rLabel(r: number): { text: string; color: string } {
  const abs = Math.abs(r);
  if (abs >= 0.6) return { text: abs >= 0.8 ? 'sehr stark' : 'stark',   color: r > 0 ? 'var(--green)' : 'var(--rose)'  };
  if (abs >= 0.3) return { text: 'mittel',  color: 'var(--amber)' };
  return            { text: 'schwach', color: 'var(--text-3)' };
}

function KorrelationTab() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useCorrelations(days);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, maxWidth: 240 }}>
          Zusammenhang zwischen Metriken. Punkte: heller = aktueller.
        </p>
        <RangePicker value={days} onChange={setDays} options={CORR_RANGE_OPTS} />
      </div>

      {isLoading && <Loading rows={3} />}

      {(data?.correlations ?? []).map(c => {
        const rl = rLabel(c.r);
        const sign = c.r > 0 ? '+' : '';
        return (
          <div key={c.id} className="card" style={{ padding: '12px 14px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {c.labelX} → {c.labelY}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: rl.color }}>
                  r = {sign}{c.r.toFixed(2)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: rl.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {rl.text}
                </span>
              </div>
            </div>

            {/* Scatter plot */}
            <ScatterPlot points={c.points} height={100} color={c.r >= 0 ? 'var(--accent)' : 'var(--rose)'} />

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)' }}>
                X: {c.labelX}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)' }}>
                n = {c.n} Tage
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)' }}>
                Y: {c.labelY}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'schlaf',     label: 'Schlaf'   },
  { id: 'metriken',   label: 'Metriken' },
  { id: 'gewicht',    label: 'Gewicht'  },
  { id: 'mental',     label: 'Mental'   },
  { id: 'korrelation', label: 'Korrel.' },
];

export default function Data() {
  const [tab, setTab] = useState<Tab>('schlaf');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '.18em', marginBottom: 3 }}>DATA</div>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Schlaf, Metriken & Mental</h1>
      </div>
      <TabBar tabs={TABS} active={tab} onChange={id => setTab(id as Tab)} />
      {tab === 'schlaf'      && <SchlafTab />}
      {tab === 'metriken'    && <MetrikenTab />}
      {tab === 'gewicht'     && <GewichtTab />}
      {tab === 'mental'      && <MentalTab />}
      {tab === 'korrelation' && <KorrelationTab />}
    </div>
  );
}
