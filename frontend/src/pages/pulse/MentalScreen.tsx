import { useState } from 'react';
import { usePulseCheckin, usePulseHome } from '@/pulse/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

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

export default function MentalScreen() {
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
      <h1 className="text-lg font-bold text-foreground">Mental</h1>

      {readiness && (
        <Card className="border-border">
          <CardContent className="px-4 py-3">
            <div className="text-sm text-muted-foreground">Readiness</div>
            <div className="text-2xl font-bold text-foreground">{readiness.score}/100</div>
            <div className="text-xs text-muted-foreground capitalize">{readiness.label}</div>
          </CardContent>
        </Card>
      )}

      {submitted ? (
        <Card className="border-green-500 bg-green-950/20">
          <CardContent className="px-4 py-4 text-sm text-green-400">
            Check-in gespeichert! Gute Arbeit.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">Täglicher Check-in</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <Slider id="mood"       label="Stimmung"   value={form.mood}       onChange={(v) => setForm((f) => ({ ...f, mood: v }))} />
              <Slider id="energy"     label="Energie"    value={form.energy}     onChange={(v) => setForm((f) => ({ ...f, energy: v }))} />
              <Slider id="stress"     label="Stress"     value={form.stress}     onChange={(v) => setForm((f) => ({ ...f, stress: v }))} />
              <Slider id="motivation" label="Motivation" value={form.motivation} onChange={(v) => setForm((f) => ({ ...f, motivation: v }))} />
              <div className="space-y-1">
                <Label htmlFor="notes" className="text-sm text-foreground">Notizen (optional)</Label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
