import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function fmt(value: number | null, decimals = 1, suffix = ''): string {
  if (value === null) return '–';
  return `${value.toFixed(decimals)}${suffix}`;
}

function HrvBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="text-muted-foreground">–</Badge>;
  const map: Record<string, string> = {
    balanced:   'bg-green-700 text-white border-0',
    unbalanced: 'bg-yellow-600 text-white border-0',
    poor:       'bg-red-700 text-white border-0',
  };
  return (
    <Badge className={map[status] ?? 'bg-muted text-muted-foreground border-0'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function MetricCard({
  title,
  primary,
  secondary,
}: {
  title: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-bold text-foreground">{primary}</div>
        {secondary && <div className="text-sm text-muted-foreground mt-0.5">{secondary}</div>}
      </CardContent>
    </Card>
  );
}

function TrendRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['health-summary'],
    queryFn: () => api.health.summary(),
    refetchInterval: 300_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Lade Daten...</p>
      </div>
    );
  }

  const today   = data?.today ?? null;
  const trend7d = data?.trend7d ?? [];

  const avgSleep   = avg(trend7d.map(d => d.sleepDurationH));
  const avgHr      = avg(trend7d.map(d => d.restingHr));
  const avgBattery = avg(trend7d.map(d => d.bodyBatteryMax));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>

      {data?.circuitOpen && (
        <div className="p-3 rounded-lg border border-yellow-600 text-yellow-400 bg-yellow-900/20 text-sm">
          Garmin-Sync pausiert — wird automatisch fortgesetzt (max. 1h).
        </div>
      )}

      {!today ? (
        <Card className="bg-card border-border">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              Noch keine Garmin-Daten — drücke &quot;Jetzt syncen&quot; in den Einstellungen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Heute</p>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                title="Schlaf"
                primary={fmt(today.sleepDurationH, 1, 'h')}
                secondary={today.sleepScore != null ? `Score: ${today.sleepScore}` : undefined}
              />
              <MetricCard
                title="HRV-Status"
                primary={<HrvBadge status={today.hrvStatus} />}
                secondary={today.restingHr != null ? `Ruhepuls: ${today.restingHr} bpm` : undefined}
              />
              <MetricCard
                title="Body Battery"
                primary={fmt(today.bodyBatteryMax, 0)}
              />
              <MetricCard
                title="Schritte"
                primary={today.steps != null ? today.steps.toLocaleString('de-DE') : '–'}
              />
            </div>
          </div>

          {trend7d.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-foreground">7-Tage-Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendRow label="Ø Schlaf"       value={fmt(avgSleep, 1, 'h')} />
                <TrendRow label="Ø Ruhepuls"     value={avgHr != null ? `${Math.round(avgHr)} bpm` : '–'} />
                <TrendRow label="Ø Body Battery" value={fmt(avgBattery, 0)} />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {data?.lastSync && (
        <p className="text-xs text-muted-foreground text-right">
          Letzter Sync: {new Date(data.lastSync).toLocaleString('de-DE')}
        </p>
      )}
    </div>
  );
}
