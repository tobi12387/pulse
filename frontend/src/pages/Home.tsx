import { usePulseHome, useGarminSync } from '@/pulse/hooks';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { createPortal } from 'react-dom';
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

type Rating = 'good' | 'moderate' | 'bad' | 'neutral';

const ratingColor: Record<Rating, string> = {
  good:     'bg-emerald-500',
  moderate: 'bg-yellow-500',
  bad:      'bg-red-500',
  neutral:  'bg-muted-foreground/40',
};

function Tooltip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <span
      className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-muted-foreground/40 text-muted-foreground/60 text-[9px] font-bold cursor-help select-none leading-none shrink-0"
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.top });
      }}
      onMouseLeave={() => setPos(null)}
    >
      ?
      {pos && createPortal(
        <div
          className="fixed z-[9999] w-56 rounded-md bg-popover border border-border px-3 py-2 text-xs text-popover-foreground shadow-lg pointer-events-none whitespace-normal"
          style={{ left: pos.x, top: pos.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}

function MetricCard({ title, primary, secondary, rating, tooltip }: {
  title: string;
  primary: React.ReactNode;
  secondary?: string;
  rating?: Rating;
  tooltip?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-1 pt-4 px-4">
        <div className="flex items-center gap-1.5">
          {rating && rating !== 'neutral' && (
            <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${ratingColor[rating]}`} />
          )}
          <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</CardTitle>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
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

  function rateSleep(h: number | null | undefined): Rating {
    if (h == null) return 'neutral';
    if (h >= 7 && h <= 9) return 'good';
    if (h >= 6) return 'moderate';
    return 'bad';
  }
  function rateHrv(ms: number | null | undefined, status: string | null | undefined): Rating {
    if (status) {
      if (status === 'balanced') return 'good';
      if (status === 'unbalanced') return 'moderate';
      if (status === 'low') return 'bad';
    }
    if (ms == null) return 'neutral';
    if (ms >= 50) return 'good';
    if (ms >= 30) return 'moderate';
    return 'bad';
  }
  function rateBattery(max: number | null | undefined): Rating {
    if (max == null) return 'neutral';
    if (max >= 70) return 'good';
    if (max >= 40) return 'moderate';
    return 'bad';
  }
  function rateSteps(steps: number | null | undefined): Rating {
    if (steps == null) return 'neutral';
    if (steps >= 10_000) return 'good';
    if (steps >= 5_000) return 'moderate';
    return 'bad';
  }
  function rateTsb(tsb: number): Rating {
    if (tsb >= -10 && tsb <= 25) return 'good';
    if (tsb > 25 || (tsb < -10 && tsb >= -30)) return 'moderate';
    return 'bad';
  }

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
        <MetricCard
          title="Fitness" primary={data.fitnessLoad.ctl.toFixed(0)} secondary="CTL"
          rating="neutral"
          tooltip="CTL (Chronic Training Load) misst deine langfristige Fitness über ~42 Tage. Höher = fitter. Typischer Bereich für Ausdauersportler: 40–100."
        />
        <MetricCard
          title="Ermüdung" primary={data.fitnessLoad.atl.toFixed(0)} secondary="ATL"
          rating="neutral"
          tooltip="ATL (Acute Training Load) zeigt deine kurzfristige Ermüdung der letzten ~7 Tage. Ein hoher Wert bedeutet viel Trainingsbelastung in den letzten Tagen."
        />
        <MetricCard
          title="Form" primary={data.fitnessLoad.tsb.toFixed(0)} secondary="TSB"
          rating={rateTsb(data.fitnessLoad.tsb)}
          tooltip="TSB (Training Stress Balance) = Fitness − Ermüdung. Positiv (0–25): frisch, gut für Wettkämpfe. Leicht negativ (−10 bis 0): normaler Trainingsbereich. Sehr negativ (< −30): Überbelastung."
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          title="Schlaf" primary={fmt(m?.sleepHours, 1, 'h')} secondary={m?.sleepScore ? `Score ${m.sleepScore}` : undefined}
          rating={rateSleep(m?.sleepHours)}
          tooltip="Optimale Schlafdauer: 7–9 Stunden. Unter 6h erhöht das Verletzungsrisiko und beeinträchtigt die Regeneration deutlich."
        />
        <MetricCard
          title="HRV" primary={fmt(m?.hrvRmssd, 0, ' ms')} secondary={m?.hrvStatus ?? undefined}
          rating={rateHrv(m?.hrvRmssd, m?.hrvStatus)}
          tooltip="HRV (Herzratenvariabilität) ist ein Maß für Erholung und Stressbelastung des Nervensystems. Höher = besser erholt. 'Balanced' bedeutet gute Regeneration, 'Low' signalisiert Stress oder Überbelastung."
        />
        <MetricCard
          title="Batterie" primary={fmt(m?.bodyBatteryMax, 0, '%')} secondary={m?.bodyBatteryMin ? `Min ${m.bodyBatteryMin}%` : undefined}
          rating={rateBattery(m?.bodyBatteryMax)}
          tooltip="Garmin Body Battery zeigt deine Energiereserven (0–100%). Über 70%: gut erholt. 40–70%: moderat. Unter 40%: erschöpft — leichtes Training bevorzugen."
        />
        <MetricCard
          title="Schritte" primary={m?.steps?.toLocaleString('de') ?? '–'}
          rating={rateSteps(m?.steps)}
          tooltip="10.000 Schritte täglich gelten als Zielwert für allgemeine Gesundheit. Weniger als 5.000 Schritte ist sehr inaktiv."
        />
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
