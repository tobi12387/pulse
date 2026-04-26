import { usePulseActivities, usePulsePlan } from '@/pulse/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ZONE_COLORS: Record<number, string> = {
  1: 'bg-gray-400 text-white border-0',
  2: 'bg-blue-500 text-white border-0',
  3: 'bg-green-600 text-white border-0',
  4: 'bg-orange-500 text-white border-0',
  5: 'bg-red-600 text-white border-0',
};

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  if (v == null) return '–';
  return `${v.toFixed(decimals)}${suffix}`;
}

export default function TrainingScreen() {
  const acts = usePulseActivities(14);
  const plan = usePulsePlan();

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-foreground">Training</h1>

      {/* Planned workouts */}
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

      {/* Activity history */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-2">Aktivitäten</h2>
        {acts.isLoading && <p className="text-muted-foreground text-sm">Lade…</p>}
        <div className="space-y-2">
          {(acts.data?.activities ?? []).map((a) => (
            <Card key={a.id} className="border-border">
              <CardContent className="px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">{a.name ?? a.activityType}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.startTime).toLocaleDateString('de')} ·
                      {a.durationSec ? ` ${Math.round(a.durationSec / 60)} min` : ''}{' '}
                      {a.distanceM ? `· ${(a.distanceM / 1000).toFixed(1)} km` : ''}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.avgHr ? `Ø ${a.avgHr} bpm` : ''}{' '}
                      {a.avgPowerW ? `· Ø ${a.avgPowerW}W` : ''}
                    </div>
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
