import { useState } from 'react';
import { usePulseGoals, useCreateGoal } from '@/pulse/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-700 text-white border-0',
  completed: 'bg-blue-700 text-white border-0',
  paused:    'bg-yellow-600 text-white border-0',
  abandoned: 'bg-red-800 text-white border-0',
};

export default function GoalsScreen() {
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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Ziele</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Abbrechen' : '+ Ziel'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-border">
          <CardContent className="px-4 py-4">
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
              <div>
                <Label htmlFor="goal-title" className="text-sm">Titel</Label>
                <Input id="goal-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <Label htmlFor="goal-desc" className="text-sm">Beschreibung</Label>
                <Input id="goal-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="goal-date" className="text-sm">Zieldatum</Label>
                <Input id="goal-date" type="date" value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending ? 'Speichern…' : 'Ziel erstellen'}
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
          <p className="text-muted-foreground text-sm">Noch keine Ziele. Erstelle dein erstes Ziel!</p>
        )}
      </div>
    </div>
  );
}
