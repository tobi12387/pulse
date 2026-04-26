import { useState } from 'react';
import { usePulseActivities, usePulsePlan, usePulseGoals, useCreateGoal, usePulseReview, useGenerateReview } from '@/pulse/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Tab = 'training' | 'ziele' | 'review';

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  if (v == null) return '–';
  return `${v.toFixed(decimals)}${suffix}`;
}

const ZONE_COLORS: Record<number, string> = {
  1: 'bg-gray-400 text-white border-0',
  2: 'bg-blue-500 text-white border-0',
  3: 'bg-green-600 text-white border-0',
  4: 'bg-orange-500 text-white border-0',
  5: 'bg-red-600 text-white border-0',
};

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-700 text-white border-0',
  completed: 'bg-blue-700 text-white border-0',
  paused:    'bg-yellow-600 text-white border-0',
  abandoned: 'bg-red-800 text-white border-0',
};

function TrainingTab() {
  const acts = usePulseActivities(14);
  const plan = usePulsePlan();

  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-2">Trainingsplan</h2>
        {plan.isLoading && <p className="text-muted-foreground text-sm">Lade…</p>}
        {!plan.isLoading && (plan.data?.workouts ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm">Kein Plan vorhanden.</p>
        )}
        <div className="space-y-2">
          {(plan.data?.workouts ?? []).map((w) => (
            <Card key={w.id} className="border-border">
              <CardContent className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{w.plannedDate}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.activityType} · {w.durationMin} min{w.distanceKm ? ` · ${w.distanceKm.toFixed(1)} km` : ''}
                  </div>
                  {w.description && <div className="text-xs text-muted-foreground">{w.description}</div>}
                </div>
                <Badge className={ZONE_COLORS[w.zone] ?? 'bg-muted'}>Z{w.zone}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-2">Aktivitäten (14 Tage)</h2>
        {acts.isLoading && <p className="text-muted-foreground text-sm">Lade…</p>}
        <div className="space-y-2">
          {(acts.data?.activities ?? []).map((a) => (
            <Card key={a.id} className="border-border">
              <CardContent className="px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">{a.name ?? a.activityType}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.startTime).toLocaleDateString('de')}
                      {a.durationSec ? ` · ${Math.round(a.durationSec / 60)} min` : ''}
                      {a.distanceM ? ` · ${(a.distanceM / 1000).toFixed(1)} km` : ''}
                    </div>
                    {(a.avgHr || a.avgPowerW) && (
                      <div className="text-xs text-muted-foreground">
                        {a.avgHr ? `Ø ${a.avgHr} bpm` : ''}
                        {a.avgPowerW ? ` · Ø ${a.avgPowerW}W` : ''}
                      </div>
                    )}
                  </div>
                  {a.tss && <Badge variant="outline">{fmt(a.tss, 0)} TSS</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function ZieleTab() {
  const { data, isLoading } = usePulseGoals();
  const create = useCreateGoal();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', targetDate: '' });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      title: form.title,
      description: form.description || undefined,
      targetDate: form.targetDate || undefined,
    });
    setForm({ title: '', description: '', targetDate: '' });
    setShowForm(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Abbrechen' : '+ Ziel'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-border">
          <CardContent className="px-4 py-4">
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
              <div>
                <Label htmlFor="goal-title" className="text-sm">Titel</Label>
                <Input id="goal-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <Label htmlFor="goal-desc" className="text-sm">Beschreibung</Label>
                <Input id="goal-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="goal-date" className="text-sm">Zieldatum</Label>
                <Input id="goal-date" type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending ? 'Speichern…' : 'Erstellen'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Lade…</p>}

      <div className="space-y-2">
        {(data?.goals ?? []).map((g) => (
          <Card key={g.id} className="border-border">
            <CardContent className="px-4 py-3 flex items-start justify-between">
              <div className="flex-1 min-w-0 mr-2">
                <div className="text-sm font-medium text-foreground">{g.title}</div>
                {g.description && <div className="text-xs text-muted-foreground">{g.description}</div>}
                {g.targetDate && <div className="text-xs text-muted-foreground">Bis {g.targetDate}</div>}
                <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(g.progress ?? 0) * 100}%` }} />
                </div>
              </div>
              <Badge className={STATUS_COLORS[g.status] ?? 'bg-muted'}>{g.status}</Badge>
            </CardContent>
          </Card>
        ))}
        {!isLoading && (data?.goals ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm">Noch keine Ziele. Erstelle dein erstes!</p>
        )}
      </div>
    </div>
  );
}

function ReviewTab() {
  const { data, isLoading } = usePulseReview();
  const generate = useGenerateReview();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? 'Erstelle…' : 'Neu erstellen'}
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm py-4 text-center">Lade…</p>}

      {!isLoading && !data && (
        <Card className="border-border">
          <CardContent className="px-4 py-6 text-center text-muted-foreground text-sm">
            Kein Wochenreview vorhanden. Klicke "Neu erstellen" für eine KI-Analyse der letzten Woche.
          </CardContent>
        </Card>
      )}

      {data && (
        <Card className="border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">
              {data.weekStart} – {data.weekEnd}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{data.narrative}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'training', label: 'Training' },
  { id: 'ziele',    label: 'Ziele' },
  { id: 'review',   label: 'Review' },
];

export default function Plan() {
  const [tab, setTab] = useState<Tab>('training');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Plan</h1>

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

      {tab === 'training' && <TrainingTab />}
      {tab === 'ziele'    && <ZieleTab />}
      {tab === 'review'   && <ReviewTab />}
    </div>
  );
}
