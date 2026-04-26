import { usePulseSleep } from '@/pulse/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function fmt(v: number | null | undefined, decimals = 1, suffix = ''): string {
  if (v == null) return '–';
  return `${v.toFixed(decimals)}${suffix}`;
}

function SleepBar({ deepH, remH, lightH, awakeH, totalH }: {
  deepH: number | null; remH: number | null;
  lightH: number | null; awakeH: number | null; totalH: number | null;
}) {
  if (!totalH || totalH <= 0) return <div className="h-3 bg-muted rounded-full" />;
  const pct = (h: number | null) => Math.round(((h ?? 0) / totalH) * 100);

  return (
    <div className="flex h-3 rounded-full overflow-hidden gap-px">
      <div style={{ width: `${pct(deepH)}%` }} className="bg-indigo-600" title={`Tief ${fmt(deepH, 1, 'h')}`} />
      <div style={{ width: `${pct(remH)}%` }}  className="bg-violet-500" title={`REM ${fmt(remH, 1, 'h')}`} />
      <div style={{ width: `${pct(lightH)}%` }} className="bg-blue-400" title={`Leicht ${fmt(lightH, 1, 'h')}`} />
      <div style={{ width: `${pct(awakeH)}%` }} className="bg-muted-foreground/30" title={`Wach ${fmt(awakeH, 1, 'h')}`} />
    </div>
  );
}

export default function SleepScreen() {
  const { data, isLoading, error } = usePulseSleep(14);

  if (isLoading) return <div className="text-muted-foreground text-sm py-8 text-center">Lade Schlafdaten…</div>;
  if (error)     return <div className="text-destructive text-sm py-4">{error.message}</div>;

  const sessions = data?.sessions ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-foreground">Schlaf</h1>

      {sessions.length === 0 && (
        <p className="text-muted-foreground text-sm">Keine Schlafdaten vorhanden. Synchronisiere Garmin.</p>
      )}

      <div className="space-y-3">
        {sessions.map((s) => (
          <Card key={s.id} className="border-border">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-foreground flex justify-between">
                <span>{s.date}</span>
                <span className="text-muted-foreground font-normal">{fmt(s.durationH, 1, 'h')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <SleepBar
                deepH={s.deepSleepH} remH={s.remSleepH}
                lightH={s.lightSleepH} awakeH={s.awakeH} totalH={s.durationH}
              />
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-indigo-600" />Tief {fmt(s.deepSleepH, 1, 'h')}</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-violet-500" />REM {fmt(s.remSleepH, 1, 'h')}</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-400" />Leicht {fmt(s.lightSleepH, 1, 'h')}</span>
              </div>
              {s.sleepScore && (
                <div className="text-xs text-muted-foreground">Score: {s.sleepScore}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
