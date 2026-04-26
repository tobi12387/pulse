import { usePulseHome, useGarminSync } from '@/pulse/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function ReadinessBadge({ score, label }: { score: number; label: string }) {
  const color =
    label === 'excellent' ? 'bg-green-700 text-white border-0' :
    label === 'good'      ? 'bg-emerald-600 text-white border-0' :
    label === 'moderate'  ? 'bg-yellow-600 text-white border-0' :
                            'bg-red-700 text-white border-0';
  return <Badge className={color}>{score}/100 · {label}</Badge>;
}

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  if (v == null) return '–';
  return `${v.toFixed(decimals)}${suffix}`;
}

function MetricCard({ title, primary, secondary }: {
  title: string; primary: React.ReactNode; secondary?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-bold text-foreground">{primary}</div>
        {secondary && <div className="text-sm text-muted-foreground mt-0.5">{secondary}</div>}
      </CardContent>
    </Card>
  );
}

export default function HomeScreen() {
  const { data, isLoading, error } = usePulseHome();
  const sync = useGarminSync();

  if (isLoading) return <div className="text-muted-foreground text-sm py-8 text-center">Lade Daten…</div>;
  if (error)     return <div className="text-destructive text-sm py-8 text-center">Fehler: {error.message}</div>;
  if (!data)     return null;

  const m = data.todayMetrics;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Pulse</h1>
          <p className="text-sm text-muted-foreground">{data.date}</p>
        </div>
        <ReadinessBadge score={data.readiness.score} label={data.readiness.label} />
      </div>

      {/* Fitness Load */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard title="CTL" primary={data.fitnessLoad.ctl.toFixed(0)} secondary="Fitness" />
        <MetricCard title="ATL" primary={data.fitnessLoad.atl.toFixed(0)} secondary="Ermüdung" />
        <MetricCard title="TSB" primary={data.fitnessLoad.tsb.toFixed(0)} secondary="Form" />
      </div>

      {/* Daily Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard title="Schlaf"   primary={fmt(m?.sleepHours, 1, 'h')} secondary={m?.sleepScore ? `Score ${m.sleepScore}` : undefined} />
        <MetricCard title="HRV"      primary={fmt(m?.hrvRmssd, 0, ' ms')} secondary={m?.hrvStatus ?? undefined} />
        <MetricCard title="Batterie" primary={fmt(m?.bodyBatteryMax, 0, '%')} secondary={m?.bodyBatteryMin ? `Min ${m.bodyBatteryMin}%` : undefined} />
        <MetricCard title="Schritte" primary={m?.steps?.toLocaleString('de') ?? '–'} />
      </div>

      {/* Next Workout */}
      {data.nextWorkout && (
        <Card className="border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Nächstes Training</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="font-semibold text-foreground">{data.nextWorkout.plannedDate}</div>
            <div className="text-sm text-muted-foreground">
              {data.nextWorkout.activityType} · Zone {data.nextWorkout.zone} · {data.nextWorkout.durationMin} min
            </div>
            {data.nextWorkout.description && (
              <div className="text-xs text-muted-foreground mt-1">{data.nextWorkout.description}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Activities */}
      {data.recentActivities.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-2">Letzte Aktivitäten</h2>
          <div className="space-y-2">
            {data.recentActivities.map((a) => (
              <Card key={a.id} className="border-border">
                <CardContent className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">{a.name ?? a.activityType}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.durationSec ? `${Math.round(a.durationSec / 60)} min` : ''}{' '}
                      {a.distanceM ? `· ${(a.distanceM / 1000).toFixed(1)} km` : ''}
                    </div>
                  </div>
                  {a.tss && <Badge variant="outline">{a.tss.toFixed(0)} TSS</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Button
        variant="outline"
        className="w-full text-xs"
        onClick={() => sync.mutate()}
        disabled={sync.isPending}
      >
        {sync.isPending ? 'Synchronisiere…' : 'Garmin Sync'}
      </Button>
    </div>
  );
}
