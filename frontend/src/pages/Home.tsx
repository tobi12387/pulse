import { usePulseHome, useGarminSync } from '@/pulse/hooks';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  if (v == null) return '–';
  return `${v.toFixed(decimals)}${suffix}`;
}

function ReadinessBadge({ score, label }: { score: number; label: string }) {
  const color =
    label === 'excellent' ? 'bg-green-700 text-white border-0' :
    label === 'good'      ? 'bg-emerald-600 text-white border-0' :
    label === 'moderate'  ? 'bg-yellow-600 text-white border-0' :
                            'bg-red-700 text-white border-0';
  const labelMap: Record<string, string> = {
    excellent: 'Ausgezeichnet',
    good:      'Gut',
    moderate:  'Mäßig',
    poor:      'Schlecht',
  };
  return <Badge className={color}>{score}/100 · {labelMap[label] ?? label}</Badge>;
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

export default function Home() {
  const { data, isLoading, error } = usePulseHome();
  const sync = useGarminSync();

  const { data: briefing } = useQuery({
    queryKey: ['briefing-latest'],
    queryFn: () => api.briefing.latest(),
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="text-muted-foreground text-sm py-8 text-center">Lade Daten…</div>;
  if (error) return <div className="text-destructive text-sm py-8 text-center">Fehler: {error.message}</div>;
  if (!data) return null;

  const m = data.todayMetrics;
  const msg = briefing?.briefing;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Heute</h1>
          <p className="text-sm text-muted-foreground">{data.date}</p>
        </div>
        <ReadinessBadge score={data.readiness.score} label={data.readiness.label} />
      </div>

      {msg && (
        <Card className="border-primary/30 bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-primary font-medium uppercase tracking-wide">Coach</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-foreground leading-relaxed">{msg.briefing_text}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-2">
        <MetricCard title="Fitness" primary={data.fitnessLoad.ctl.toFixed(0)} secondary="CTL" />
        <MetricCard title="Ermüdung" primary={data.fitnessLoad.atl.toFixed(0)} secondary="ATL" />
        <MetricCard title="Form" primary={data.fitnessLoad.tsb.toFixed(0)} secondary="TSB" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCard title="Schlaf" primary={fmt(m?.sleepHours, 1, 'h')} secondary={m?.sleepScore ? `Score ${m.sleepScore}` : undefined} />
        <MetricCard title="HRV" primary={fmt(m?.hrvRmssd, 0, ' ms')} secondary={m?.hrvStatus ?? undefined} />
        <MetricCard title="Batterie" primary={fmt(m?.bodyBatteryMax, 0, '%')} secondary={m?.bodyBatteryMin ? `Min ${m.bodyBatteryMin}%` : undefined} />
        <MetricCard title="Schritte" primary={m?.steps?.toLocaleString('de') ?? '–'} />
      </div>

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

      {data.recentActivities.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-2">Letzte Aktivitäten</h2>
          <div className="space-y-2">
            {data.recentActivities.slice(0, 3).map((a) => (
              <Card key={a.id} className="border-border">
                <CardContent className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">{a.name ?? a.activityType}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.durationSec ? `${Math.round(a.durationSec / 60)} min` : ''}
                      {a.distanceM ? ` · ${(a.distanceM / 1000).toFixed(1)} km` : ''}
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
        size="sm"
        className="w-full text-xs"
        onClick={() => sync.mutate()}
        disabled={sync.isPending}
      >
        {sync.isPending ? 'Synchronisiere…' : 'Garmin sync'}
      </Button>
    </div>
  );
}
