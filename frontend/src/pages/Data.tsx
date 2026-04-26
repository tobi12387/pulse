import { useState } from 'react';
import { usePulseSleep, usePulseCheckin, usePulseHome } from '@/pulse/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

type Tab = 'schlaf' | 'mental';

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  if (v == null) return '–';
  return `${v.toFixed(decimals)}${suffix}`;
}

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

function SleepTab() {
  const { data, isLoading, error } = usePulseSleep(14);
  if (isLoading) return <div className="text-muted-foreground text-sm py-8 text-center">Lade Schlafdaten…</div>;
  if (error) return <div className="text-destructive text-sm py-4">{error.message}</div>;

  const sessions = data?.sessions ?? [];
  if (sessions.length === 0) {
    return <p className="text-muted-foreground text-sm py-4 text-center">Keine Schlafdaten vorhanden.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-xs text-muted-foreground px-1 mb-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" /> Tief</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" /> REM</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Leicht</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" /> Wach</span>
      </div>
      {sessions.map((s) => (
        <Card key={s.date} className="border-border">
          <CardContent className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{s.date}</span>
              <span className="text-sm font-semibold text-foreground">{fmt(s.durationH, 1, 'h')}</span>
            </div>
            <SleepBar deepSleepH={s.deepSleepH} remSleepH={s.remSleepH} lightSleepH={s.lightSleepH} awakeH={s.awakeH} durationH={s.durationH} />
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>Tief {fmt(s.deepSleepH, 1, 'h')}</span>
              <span>REM {fmt(s.remSleepH, 1, 'h')}</span>
              {s.sleepScore && <span className="ml-auto">Score {s.sleepScore}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

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
  const home = usePulseHome();
  const checkin = usePulseCheckin();
  const [form, setForm] = useState({ mood: 7, energy: 7, stress: 3, motivation: 7, notes: '' });
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await checkin.mutateAsync({ ...form, notes: form.notes || undefined });
    setSubmitted(true);
  }

  const readiness = home.data?.readiness;

  return (
    <div className="space-y-4">
      {readiness && (
        <Card className="border-border">
          <CardContent className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Readiness</span>
            <div className="text-right">
              <div className="text-xl font-bold text-foreground">{readiness.score}/100</div>
              <div className="text-xs text-muted-foreground capitalize">{readiness.label}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {submitted ? (
        <Card className="border-green-500 bg-green-950/20">
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

const TABS: { id: Tab; label: string }[] = [
  { id: 'schlaf', label: 'Schlaf' },
  { id: 'mental', label: 'Mental' },
];

export default function Data() {
  const [tab, setTab] = useState<Tab>('schlaf');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Daten</h1>

      <div className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              tab === t.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'schlaf' && <SleepTab />}
      {tab === 'mental' && <MentalTab />}
    </div>
  );
}
