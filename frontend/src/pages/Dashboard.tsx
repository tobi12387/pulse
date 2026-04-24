import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

function MetricCard({ title, primary, secondary }: {
  title: string; primary: React.ReactNode; secondary?: React.ReactNode;
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

function TrendRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function CoachCard({ briefingText, triggerType }: { briefingText: string; triggerType: string }) {
  return (
    <Card className="bg-card border-border border-primary/30">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-xs text-primary font-medium uppercase tracking-wide">Coach sagt heute</CardTitle>
        <Badge className={triggerType === 'garmin-alarm' ? 'bg-orange-600 text-white border-0 text-xs' : 'bg-blue-700 text-white border-0 text-xs'}>
          {triggerType === 'garmin-alarm' ? 'Alarm' : 'Check-in'}
        </Badge>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-sm text-foreground leading-relaxed">{briefingText}</p>
      </CardContent>
    </Card>
  );
}

function CheckInForm() {
  const queryClient = useQueryClient();
  const [energy, setEnergy]   = useState(5);
  const [stress, setStress]   = useState(5);
  const [notes, setNotes]     = useState('');
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.checkin.submit({ energy_level: energy, stress_level: stress, notes: notes || undefined }),
    onSuccess: () => {
      setSubmitted(true);
      void queryClient.invalidateQueries({ queryKey: ['checkin-today'] });
      void queryClient.invalidateQueries({ queryKey: ['briefing-latest'] });
    },
  });

  if (submitted) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="px-4 py-4 text-sm text-muted-foreground">
          Check-in gespeichert. Briefing wird generiert…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Wie geht's dir heute?</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Energielevel: <span className="text-foreground font-semibold">{energy}/10</span></label>
          <input type="range" min={1} max={10} value={energy} onChange={e => setEnergy(Number(e.target.value))}
            className="w-full accent-primary mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Stresslevel: <span className="text-foreground font-semibold">{stress}/10</span></label>
          <input type="range" min={1} max={10} value={stress} onChange={e => setStress(Number(e.target.value))}
            className="w-full accent-primary mt-1" />
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notiz (optional)…"
          maxLength={500}
          rows={2}
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {mutation.isPending ? 'Wird gespeichert…' : 'Abschicken'}
        </Button>
        {mutation.isError && (
          <p className="text-xs text-red-500">{String(mutation.error)}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['health-summary'],
    queryFn: () => api.health.summary(),
    refetchInterval: 300_000,
  });

  const { data: briefingData } = useQuery({
    queryKey: ['briefing-latest'],
    queryFn: () => api.briefing.latest(),
    refetchInterval: 60_000,
  });

  const { data: checkinData } = useQuery({
    queryKey: ['checkin-today'],
    queryFn: () => api.checkin.today(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Lade Daten…</p>
      </div>
    );
  }

  const today  = data?.today ?? null;
  const trend  = data?.trend7d ?? [];
  const briefing  = briefingData?.briefing ?? null;
  const hasCheckin = checkinData?.checkin !== null && checkinData?.checkin !== undefined;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>

      {briefing
        ? <CoachCard briefingText={briefing.briefing_text} triggerType={briefing.trigger_type} />
        : (
          <Card className="bg-card border-border border-dashed">
            <CardContent className="px-4 py-4 text-sm text-muted-foreground">
              Noch kein Briefing heute. Fülle das Check-in aus.
            </CardContent>
          </Card>
        )
      }

      {!hasCheckin && <CheckInForm />}

      {today === null ? (
        <p className="text-sm text-muted-foreground">Noch keine Garmin-Daten für heute.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard title="Schlaf" primary={fmt(today.sleepDurationH, 1, 'h')} secondary={today.sleepScore ? `Score ${today.sleepScore}` : undefined} />
          <MetricCard title="HRV" primary={<HrvBadge status={today.hrvStatus} />} secondary={today.restingHr ? `${today.restingHr} bpm` : undefined} />
          <MetricCard title="Body Battery" primary={fmt(today.bodyBatteryMax, 0)} secondary={today.stressAvg ? `Stress Ø ${today.stressAvg}` : undefined} />
          <MetricCard title="Schritte" primary={today.steps ? (today.steps >= 1000 ? `${(today.steps / 1000).toFixed(1)}k` : String(today.steps)) : '–'} />
        </div>
      )}

      {trend.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">7-Tage-Trend</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <TrendRow label="Ø Schlaf" value={fmt(avg(trend.map(d => d.sleepDurationH)), 1, 'h')} />
            <TrendRow label="Ø Ruhepuls" value={fmt(avg(trend.map(d => d.restingHr)), 0, ' bpm')} />
            <TrendRow label="Ø Body Battery" value={fmt(avg(trend.map(d => d.bodyBatteryMax)), 0)} />
            <TrendRow label="Ø Schritte" value={avg(trend.map(d => d.steps)) !== null ? `${((avg(trend.map(d => d.steps)) ?? 0) / 1000).toFixed(1)}k` : '–'} />
          </CardContent>
        </Card>
      )}

      {data?.lastSync && (
        <p className="text-xs text-muted-foreground text-center">Zuletzt synchronisiert: {new Date(data.lastSync).toLocaleString('de-DE')}</p>
      )}
    </div>
  );
}
