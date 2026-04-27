import { useState } from 'react';
import {
  usePulseSleep, usePulseCheckin, usePulseHome, useCheckinToday,
  usePulseMetrics, usePulseWeight, useLogWeight,
} from '@/pulse/hooks';
import { SparkLine, SparkBar } from '@/components/SparkChart';

type Tab = 'schlaf' | 'metriken' | 'gewicht' | 'mental';

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
    <div className="flex gap-4 border-b" style={{ borderColor: 'var(--border)' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            paddingBottom: 10,
            color: active === t.id ? 'var(--text)' : 'var(--text-3)',
            background: 'none',
            border: 'none',
            borderBottom: active === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em' }}
      className="py-10 text-center uppercase">
      Loading…
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

function SchlafTab() {
  const { data, isLoading, error } = usePulseSleep(28);
  if (isLoading) return <Loading />;
  if (error) return <Empty msg={error.message} />;
  const sessions = data?.sessions ?? [];
  if (sessions.length === 0) return <Empty msg="Keine Schlafdaten — Garmin sync." />;

  const durations = [...sessions].reverse().map(s => s.durationH);
  const avg = sessions.reduce((s, x) => s + (x.durationH ?? 0), 0) / sessions.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Overview sparkbar */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="label-mono">28 Tage — Dauer</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
            Ø {avg.toFixed(1)}h
          </span>
        </div>
        <SparkBar values={durations} height={36} color="var(--blue)" />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {[['deep','Tief'],['rem','REM'],['light','Leicht']] .map(([k,l]) => (
            <SleepStagePill key={k} color={STAGE_COLORS[k as keyof typeof STAGE_COLORS]} label={l} value="" />
          ))}
        </div>
      </div>

      {/* Per-night rows */}
      {sessions.map((s, i) => (
        <div
          key={s.date}
          className="card"
          style={{ padding: '10px 14px', borderTop: i > 0 ? undefined : undefined }}
        >
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

function MetricRow({ label, values, latest, suffix, color }: {
  label: string; values: (number | null)[]; latest: number | null; suffix?: string; color: string;
}) {
  return (
    <div className="card" style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span className="label-mono">{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>
          {fmt(latest, 0, suffix)}
        </span>
      </div>
      <SparkLine values={values} height={28} color={color} fillOpacity={0.1} />
    </div>
  );
}

function MetrikenTab() {
  const { data, isLoading } = usePulseMetrics(28);
  if (isLoading) return <Loading />;
  const rows = data?.metrics ?? [];
  if (rows.length === 0) return <Empty msg="Noch keine Daten — Garmin sync." />;

  const last = rows[rows.length - 1];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <MetricRow label="HRV (ms)"          values={rows.map(r => r.hrvRmssd)}           latest={last?.hrvRmssd ?? null}       color="var(--accent)" />
      <MetricRow label="Ruhepuls (bpm)"    values={rows.map(r => r.restingHr)}           latest={last?.restingHr ?? null}      color="var(--rose)"   />
      <MetricRow label="Body Battery (%)"  values={rows.map(r => r.bodyBatteryMax)}      latest={last?.bodyBatteryMax ?? null}  suffix="%" color="var(--green)" />
      <MetricRow label="Stress"            values={rows.map(r => r.stressAvg)}           latest={last?.stressAvg ?? null}      color="var(--amber)"  />
      <MetricRow label="Schritte (k)"      values={rows.map(r => r.steps != null ? r.steps / 1000 : null)}
                                            latest={last?.steps != null ? last.steps / 1000 : null} suffix="k" color="var(--blue)" />

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
            {[...rows].reverse().slice(0, 14).map((r, i) => (
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

function GewichtTab() {
  const { data, isLoading } = usePulseWeight(90);
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
  const weights = [...entries].reverse().map(e => e.weightKg);
  const latest  = entries[0];
  const prev7   = entries.find((_, i) => {
    if (!latest) return false;
    const d = new Date(latest.date);
    d.setDate(d.getDate() - 7);
    return entries[i]?.date <= d.toISOString().split('T')[0]!;
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
              flex: 1,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '7px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={logWeight.isPending || !kg}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '7px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: kg ? 'var(--accent)' : 'var(--text-3)',
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="card">
            <span className="label-mono">Aktuell</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 500, color: 'var(--text)', marginTop: 4 }}>
              {latest.weightKg.toFixed(1)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em' }}>KG</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{latest.date}</div>
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
      )}

      {/* 90d sparkline */}
      {weights.length >= 3 && (
        <div className="card">
          <span className="label-mono" style={{ display: 'block', marginBottom: 8 }}>Verlauf 90 Tage</span>
          <SparkLine values={weights} height={48} color="var(--accent)" fillOpacity={0.08} />
        </div>
      )}

      {isLoading && <Loading />}

      {/* Log table */}
      {entries.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="label-mono" style={{ padding: '10px 14px 6px' }}>Einträge</div>
          {entries.slice(0, 20).map((e, i) => (
            <div
              key={e.id}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 14px',
                borderTop: i === 0 ? '1px solid var(--border)' : '1px solid var(--border)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{e.date}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)' }}>{e.weightKg.toFixed(1)} kg</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mental ───────────────────────────────────────────────────────────────────

function ScoreSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const pct = ((value - 1) / 9) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>{value}</span>
      </div>
      <div style={{ position: 'relative', height: 4, background: 'var(--surface-2)', borderRadius: 2 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2 }} />
        <input
          type="range" min={1} max={10} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />
      </div>
    </div>
  );
}

function MentalTab() {
  const home            = usePulseHome();
  const { data: today } = useCheckinToday();
  const checkin         = usePulseCheckin();
  const [form, setForm] = useState({ mood: 7, energy: 7, stress: 3, motivation: 7, notes: '' });
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await checkin.mutateAsync({ ...form, notes: form.notes || undefined });
    setSubmitted(true);
  }

  const readiness   = home.data?.readiness;
  const alreadyDone = today?.checkin != null;

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
            <ScoreSlider label="Stimmung"   value={form.mood}       onChange={(v) => setForm(f => ({ ...f, mood: v }))} />
            <ScoreSlider label="Energie"    value={form.energy}     onChange={(v) => setForm(f => ({ ...f, energy: v }))} />
            <ScoreSlider label="Stress"     value={form.stress}     onChange={(v) => setForm(f => ({ ...f, stress: v }))} />
            <ScoreSlider label="Motivation" value={form.motivation} onChange={(v) => setForm(f => ({ ...f, motivation: v }))} />
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
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'schlaf',   label: 'Schlaf'   },
  { id: 'metriken', label: 'Metriken' },
  { id: 'gewicht',  label: 'Gewicht'  },
  { id: 'mental',   label: 'Mental'   },
];

export default function Data() {
  const [tab, setTab] = useState<Tab>('schlaf');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>Data</h1>
      <TabBar tabs={TABS} active={tab} onChange={id => setTab(id as Tab)} />
      {tab === 'schlaf'   && <SchlafTab />}
      {tab === 'metriken' && <MetrikenTab />}
      {tab === 'gewicht'  && <GewichtTab />}
      {tab === 'mental'   && <MentalTab />}
    </div>
  );
}
