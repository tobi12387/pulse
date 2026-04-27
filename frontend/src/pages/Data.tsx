import { useState } from 'react';
import {
  usePulseSleep, usePulseCheckin, usePulseHome, useCheckinToday,
  usePulseMetrics, usePulseWeight, useLogWeight,
} from '@/pulse/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SparkLine, SparkBar } from '@/components/SparkChart';

type Tab = 'schlaf' | 'metriken' | 'gewicht' | 'mental';

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  if (v == null) return '–';
  return `${v.toFixed(decimals)}${suffix}`;
}

// ─── Schlaf ───────────────────────────────────────────────────────────────────

function SleepBar({ deepSleepH, remSleepH, lightSleepH, awakeH, durationH }: {
  deepSleepH: number | null; remSleepH: number | null;
  lightSleepH: number | null; awakeH: number | null; durationH: number | null;
}) {
  if (!durationH || durationH <= 0) return <div className="h-3 bg-muted rounded-full" />;
  const pct = (h: number | null) => Math.round(((h ?? 0) / durationH) * 100);
  return (
    <div className="flex h-3 rounded-full overflow-hidden gap-px">
      <div style={{ width: `${pct(deepSleepH)}%` }} className="bg-indigo-600" />
      <div style={{ width: `${pct(remSleepH)}%` }} className="bg-violet-500" />
      <div style={{ width: `${pct(lightSleepH)}%` }} className="bg-blue-400" />
      <div style={{ width: `${pct(awakeH)}%` }} className="bg-muted-foreground/30" />
    </div>
  );
}

function SchlafTab() {
  const { data, isLoading, error } = usePulseSleep(28);
  if (isLoading) return <div className="text-muted-foreground text-sm py-8 text-center">Lade Schlafdaten…</div>;
  if (error) return <div className="text-destructive text-sm py-4">{error.message}</div>;

  const sessions = data?.sessions ?? [];
  if (sessions.length === 0) {
    return <p className="text-muted-foreground text-sm py-4 text-center">Keine Schlafdaten — Garmin synchronisieren.</p>;
  }

  const durations = [...sessions].reverse().map(s => s.durationH);
  const avgDuration = sessions.reduce((s, x) => s + (x.durationH ?? 0), 0) / sessions.length;

  return (
    <div className="space-y-3">
      <div className="flex gap-3 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" /> Tief</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" /> REM</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Leicht</span>
        <span className="ml-auto text-muted-foreground">Ø {avgDuration.toFixed(1)}h</span>
      </div>

      <Card className="border-border">
        <CardContent className="px-4 py-3">
          <div className="text-xs text-muted-foreground mb-2">Dauer 28 Tage (h)</div>
          <SparkBar values={durations} height={36} color="var(--primary)" />
        </CardContent>
      </Card>

      <div className="space-y-2">
        {sessions.map((s) => (
          <Card key={s.date} className="border-border">
            <CardContent className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{s.date}</span>
                <span className="text-sm font-semibold text-foreground">{fmt(s.durationH, 1, 'h')}</span>
              </div>
              <SleepBar
                deepSleepH={s.deepSleepH} remSleepH={s.remSleepH}
                lightSleepH={s.lightSleepH} awakeH={s.awakeH} durationH={s.durationH}
              />
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>Tief {fmt(s.deepSleepH, 1, 'h')}</span>
                <span>REM {fmt(s.remSleepH, 1, 'h')}</span>
                {s.sleepScore != null && <span className="ml-auto">Score {s.sleepScore}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Metriken ─────────────────────────────────────────────────────────────────

function MetricRow({ label, values, latest, suffix, color }: {
  label: string; values: (number | null)[]; latest: number | null; suffix?: string; color: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-sm font-semibold text-foreground">{fmt(latest, 0, suffix)}</span>
        </div>
        <SparkLine values={values} height={28} color={color} />
      </CardContent>
    </Card>
  );
}

function MetrikenTab() {
  const { data, isLoading } = usePulseMetrics(28);

  if (isLoading) return <div className="text-muted-foreground text-sm py-8 text-center">Lade Metriken…</div>;

  const rows = data?.metrics ?? [];
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm py-4 text-center">Noch keine Daten — Garmin synchronisieren.</p>;
  }

  const hrv      = rows.map(r => r.hrvRmssd);
  const hr       = rows.map(r => r.restingHr);
  const battery  = rows.map(r => r.bodyBatteryMax);
  const stress   = rows.map(r => r.stressAvg);
  const steps    = rows.map(r => r.steps != null ? r.steps / 1000 : null);

  const last = rows[rows.length - 1];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">28 Tage · neueste rechts</p>
      <MetricRow label="HRV (ms)"          values={hrv}     latest={last?.hrvRmssd ?? null}       color="#818cf8" />
      <MetricRow label="Ruhepuls (bpm)"    values={hr}      latest={last?.restingHr ?? null}      color="#fb7185" />
      <MetricRow label="Körperbatterie (%)" values={battery} latest={last?.bodyBatteryMax ?? null} suffix="%" color="#34d399" />
      <MetricRow label="Stress"            values={stress}  latest={last?.stressAvg ?? null}      color="#fb923c" />
      <MetricRow label="Schritte (k)"      values={steps}   latest={last?.steps != null ? last.steps / 1000 : null} suffix="k" color="var(--primary)" />

      <div className="pt-2 space-y-1">
        {[...rows].reverse().slice(0, 14).map(r => (
          <div key={r.date} className="flex justify-between items-center px-1 text-xs text-muted-foreground">
            <span>{r.date}</span>
            <span className="tabular-nums">
              HRV {fmt(r.hrvRmssd, 0)} · {fmt(r.restingHr, 0, ' bpm')} · {fmt(r.bodyBatteryMax, 0, '%')}
            </span>
          </div>
        ))}
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
    if (isNaN(w) || w < 30 || w > 300) { setInputError('Bitte einen gültigen Wert eingeben (30–300 kg)'); return; }
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
    <div className="space-y-3">
      <Card className="border-border">
        <CardContent className="px-4 py-4">
          <form onSubmit={(e) => void handleLog(e)} className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="30"
              max="300"
              value={kg}
              onChange={e => { setKg(e.target.value); setInputError(''); }}
              placeholder="kg eingeben"
              className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button type="submit" disabled={logWeight.isPending || !kg}>
              {logWeight.isPending ? '…' : 'Eintragen'}
            </Button>
          </form>
          {inputError && <p className="text-xs text-destructive mt-1">{inputError}</p>}
        </CardContent>
      </Card>

      {latest && (
        <div className="grid grid-cols-2 gap-2">
          <Card className="border-border">
            <CardContent className="px-4 py-3">
              <div className="text-xs text-muted-foreground">Aktuell</div>
              <div className="text-2xl font-bold">{latest.weightKg.toFixed(1)} kg</div>
              <div className="text-xs text-muted-foreground">{latest.date}</div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="px-4 py-3">
              <div className="text-xs text-muted-foreground">7-Tage-Trend</div>
              {trend7d !== null
                ? <div className={`text-2xl font-bold ${trend7d < -0.1 ? 'text-green-400' : trend7d > 0.1 ? 'text-red-400' : 'text-foreground'}`}>
                    {trend7d > 0 ? '+' : ''}{trend7d.toFixed(1)} kg
                  </div>
                : <div className="text-2xl font-bold text-muted-foreground">–</div>
              }
            </CardContent>
          </Card>
        </div>
      )}

      {weights.length >= 3 && (
        <Card className="border-border">
          <CardContent className="px-4 py-3">
            <div className="text-xs text-muted-foreground mb-2">Verlauf 90 Tage</div>
            <SparkLine values={weights} height={52} color="var(--primary)" fillOpacity={0.1} />
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Lade…</p>}

      <div className="space-y-1">
        {entries.slice(0, 20).map(e => (
          <div key={e.id} className="flex justify-between items-center px-1 text-sm">
            <span className="text-muted-foreground">{e.date}</span>
            <span className="font-medium tabular-nums">{e.weightKg.toFixed(1)} kg</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mental / Check-in ────────────────────────────────────────────────────────

function Slider({ id, label, value, onChange }: {
  id: string; label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <Label htmlFor={id} className="text-sm text-foreground">{label}</Label>
        <span className="text-sm font-semibold text-primary">{value}/10</span>
      </div>
      <input
        id={id}
        type="range" min={1} max={10} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function MentalTab() {
  const home           = usePulseHome();
  const { data: today } = useCheckinToday();
  const checkin        = usePulseCheckin();
  const [form, setForm] = useState({ mood: 7, energy: 7, stress: 3, motivation: 7, notes: '' });
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await checkin.mutateAsync({ ...form, notes: form.notes || undefined });
    setSubmitted(true);
  }

  const readiness    = home.data?.readiness;
  const alreadyDone  = today?.checkin != null;

  return (
    <div className="space-y-4">
      {readiness && (
        <Card className="border-border">
          <CardContent className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Readiness heute</span>
            <div className="text-right">
              <div className="text-xl font-bold text-foreground">{readiness.score}/100</div>
              <div className="text-xs text-muted-foreground capitalize">{readiness.label}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {alreadyDone ? (
        <Card className="border-green-700/50 bg-green-950/20">
          <CardContent className="px-4 py-4 text-sm text-green-400">
            Check-in heute bereits abgeschlossen. ✓
          </CardContent>
        </Card>
      ) : submitted ? (
        <Card className="border-green-700/50 bg-green-950/20">
          <CardContent className="px-4 py-4 text-sm text-green-400">
            Check-in gespeichert!
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">Täglicher Check-in</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <Slider id="mood"       label="Stimmung"   value={form.mood}       onChange={(v) => setForm(f => ({ ...f, mood: v }))} />
              <Slider id="energy"     label="Energie"    value={form.energy}     onChange={(v) => setForm(f => ({ ...f, energy: v }))} />
              <Slider id="stress"     label="Stress"     value={form.stress}     onChange={(v) => setForm(f => ({ ...f, stress: v }))} />
              <Slider id="motivation" label="Motivation" value={form.motivation} onChange={(v) => setForm(f => ({ ...f, motivation: v }))} />
              <div className="space-y-1">
                <Label htmlFor="notes" className="text-sm text-foreground">Notizen (optional)</Label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Wie geht es dir heute?"
                />
              </div>
              <Button type="submit" className="w-full" disabled={checkin.isPending}>
                {checkin.isPending ? 'Speichern…' : 'Check-in senden'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'schlaf',   label: 'Schlaf' },
  { id: 'metriken', label: 'Metriken' },
  { id: 'gewicht',  label: 'Gewicht' },
  { id: 'mental',   label: 'Mental' },
];

export default function Data() {
  const [tab, setTab] = useState<Tab>('schlaf');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Daten</h1>

      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'schlaf'   && <SchlafTab />}
      {tab === 'metriken' && <MetrikenTab />}
      {tab === 'gewicht'  && <GewichtTab />}
      {tab === 'mental'   && <MentalTab />}
    </div>
  );
}
