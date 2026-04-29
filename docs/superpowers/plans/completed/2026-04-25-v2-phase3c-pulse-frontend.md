# Pulse Frontend (Phase 3c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Pulse frontend — a typed API client, TanStack Query v5 hooks, 8 screens (Home, Sleep, Training, Mental, Calendar, Coach, Goals, Review), a lazy-loaded PulseRouter, and wire it all into the existing App.tsx and Layout.tsx.

**Architecture:** All Pulse frontend code lives in `frontend/src/pulse/` (api-client, hooks, routing) and `frontend/src/pages/pulse/` (screens). The PulseRouter is registered as a nested route under the existing AuthGuard layout at `/pulse/*`. A new "Pulse" nav item is added to Layout.tsx. All API calls go to `/api/pulse/*`. Screens use existing shadcn/ui components (Card, Badge, Button, Input, Label) — no new shadcn components needed.

**Prerequisite:** Phase 3a and 3b must be complete (all /api/pulse/* routes working).

**Repo root:** `/root/coaching-os-v2`

---

## File Map

| Action | Path |
|--------|------|
| Create | `frontend/src/pulse/api-client.ts` |
| Create | `frontend/src/pulse/hooks.ts` |
| Create | `frontend/src/pulse/routing.tsx` |
| Create | `frontend/src/pages/pulse/HomeScreen.tsx` |
| Create | `frontend/src/pages/pulse/CoachScreen.tsx` |
| Create | `frontend/src/pages/pulse/SleepScreen.tsx` |
| Create | `frontend/src/pages/pulse/TrainingScreen.tsx` |
| Create | `frontend/src/pages/pulse/MentalScreen.tsx` |
| Create | `frontend/src/pages/pulse/CalendarScreen.tsx` |
| Create | `frontend/src/pages/pulse/GoalsScreen.tsx` |
| Create | `frontend/src/pages/pulse/ReviewScreen.tsx` |
| Modify | `frontend/src/App.tsx` |
| Modify | `frontend/src/components/Layout.tsx` |

---

## Task 1: Pulse API Client + Hooks

**Files:**
- Modify: `frontend/package.json` (add shared dep)
- Create: `frontend/src/pulse/api-client.ts`
- Create: `frontend/src/pulse/hooks.ts`

- [ ] **Step 1: Add `@coaching-os/shared` to frontend dependencies**

`frontend/package.json` currently does NOT list `@coaching-os/shared`. The api-client imports types from it, so it must be declared.

In `frontend/package.json`, add to the `"dependencies"` block:
```json
"@coaching-os/shared": "*"
```

Full updated dependencies block:
```json
"dependencies": {
  "@base-ui/react": "^1.4.1",
  "@coaching-os/shared": "*",
  "@fontsource-variable/geist": "^5.2.8",
  "@tanstack/react-query": "^5.99.2",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^1.8.0",
  "react": "^19.2.5",
  "react-dom": "^19.2.5",
  "shadcn": "^4.4.0",
  "tailwind-merge": "^3.5.0",
  "tw-animate-css": "^1.4.0",
  "zustand": "^5.0.12"
}
```

Then install from the repo root so the workspace link is created:
```bash
npm install -w frontend
```
Expected: `node_modules/@coaching-os/shared` symlinks to `shared/`.

- [ ] **Step 2: Create `frontend/src/pulse/api-client.ts`**

```typescript
// Typed fetch wrapper for /api/pulse/* endpoints.
// Reads JWT from the same Zustand store as the existing api client.

import type {
  PulseHomeScreenData, PulseSleepSession, PulseActivity,
  PulsePlannedWorkout, PulseMentalCheckin, PulseGoal,
  PulseWeeklyReview,
} from '@coaching-os/shared/pulse';

const BASE = '/api/pulse';

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('coaching-os-auth');
    if (!stored) return null;
    return (JSON.parse(stored) as { state?: { token?: string } }).state?.token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Fehler' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const pulseApi = {
  home: {
    get: (): Promise<PulseHomeScreenData> =>
      request('/home'),
  },

  coach: {
    send: (message: string): Promise<{ reply: string }> =>
      request('/coach', { method: 'POST', body: JSON.stringify({ message }) }),
  },

  checkin: {
    submit: (data: {
      mood: number; energy: number; stress: number; motivation: number; notes?: string;
    }): Promise<PulseMentalCheckin> =>
      request('/checkin', { method: 'POST', body: JSON.stringify(data) }),
  },

  sleep: {
    list: (limit = 7): Promise<{ sessions: PulseSleepSession[] }> =>
      request(`/sleep?limit=${limit}`),
  },

  activities: {
    list: (limit = 10): Promise<{ activities: PulseActivity[] }> =>
      request(`/activities?limit=${limit}`),
  },

  plan: {
    list: (): Promise<{ workouts: PulsePlannedWorkout[] }> =>
      request('/plan'),
    generate: (): Promise<{ workouts: PulsePlannedWorkout[] }> =>
      request('/plan/generate', { method: 'POST' }),
  },

  goals: {
    list: (): Promise<{ goals: PulseGoal[] }> =>
      request('/goals'),
    create: (data: { title: string; description?: string; targetDate?: string }): Promise<PulseGoal> =>
      request('/goals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ status: string; progress: number }>): Promise<PulseGoal> =>
      request(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  review: {
    latest: (): Promise<PulseWeeklyReview | null> =>
      request('/review/latest'),
    generate: (): Promise<PulseWeeklyReview> =>
      request('/review/generate', { method: 'POST' }),
  },

  garmin: {
    sync: (): Promise<{ status: string }> =>
      request('/garmin/sync', { method: 'POST' }),
  },
};
```

- [ ] **Step 2: Create `frontend/src/pulse/hooks.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pulseApi } from './api-client.js';

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const pulseKeys = {
  home:       ['pulse', 'home'] as const,
  sleep:      (limit: number) => ['pulse', 'sleep', limit] as const,
  activities: (limit: number) => ['pulse', 'activities', limit] as const,
  plan:       ['pulse', 'plan'] as const,
  goals:      ['pulse', 'goals'] as const,
  review:     ['pulse', 'review', 'latest'] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePulseHome() {
  return useQuery({
    queryKey: pulseKeys.home,
    queryFn: pulseApi.home.get,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function usePulseSleep(limit = 7) {
  return useQuery({
    queryKey: pulseKeys.sleep(limit),
    queryFn: () => pulseApi.sleep.list(limit),
    staleTime: 5 * 60_000,
  });
}

export function usePulseActivities(limit = 10) {
  return useQuery({
    queryKey: pulseKeys.activities(limit),
    queryFn: () => pulseApi.activities.list(limit),
    staleTime: 5 * 60_000,
  });
}

export function usePulsePlan() {
  return useQuery({
    queryKey: pulseKeys.plan,
    queryFn: pulseApi.plan.list,
    staleTime: 30 * 60_000,
  });
}

export function usePulseGoals() {
  return useQuery({
    queryKey: pulseKeys.goals,
    queryFn: pulseApi.goals.list,
    staleTime: 10 * 60_000,
  });
}

export function usePulseReview() {
  return useQuery({
    queryKey: pulseKeys.review,
    queryFn: pulseApi.review.latest,
    staleTime: 60 * 60_000,
  });
}

export function useCoachSend() {
  return useMutation({
    mutationFn: (message: string) => pulseApi.coach.send(message),
  });
}

export function usePulseCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.checkin.submit,
    onSuccess: () => qc.invalidateQueries({ queryKey: pulseKeys.home }),
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.goals.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: pulseKeys.goals }),
  });
}

export function useGarminSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.garmin.sync,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pulse'] }),
  });
}

export function useGenerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.review.generate,
    onSuccess: () => qc.invalidateQueries({ queryKey: pulseKeys.review }),
  });
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd /root/coaching-os-v2/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git -C /root/coaching-os-v2 add frontend/package.json frontend/src/pulse/api-client.ts frontend/src/pulse/hooks.ts
git -C /root/coaching-os-v2 commit -m "feat: add pulse frontend api-client + TanStack Query hooks"
```

---

## Task 2: HomeScreen + CoachScreen

**Files:**
- Create: `frontend/src/pages/pulse/HomeScreen.tsx`
- Create: `frontend/src/pages/pulse/CoachScreen.tsx`

- [ ] **Step 1: Create `frontend/src/pages/pulse/HomeScreen.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `frontend/src/pages/pulse/CoachScreen.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react';
import { useCoachSend } from '@/pulse/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: number;
}

export default function CoachScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'assistant', content: 'Hallo! Ich bin dein Pulse Coach. Frag mich zu Training, Schlaf, HRV oder deiner Readiness.' },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const send = useCoachSend();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: Date.now(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      const res = await send.mutateAsync(text);
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: res.reply }]);
    } catch {
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Fehler beim Laden der Antwort. Bitte versuche es erneut.' }]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <h1 className="text-lg font-bold text-foreground mb-3">Pulse Coach</h1>

      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {send.isPending && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground rounded-2xl px-4 py-2 text-sm">…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nachricht eingeben…"
          disabled={send.isPending}
          className="flex-1"
        />
        <Button
          onClick={() => void handleSend()}
          disabled={send.isPending || !input.trim()}
          aria-label="Senden"
        >
          →
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd /root/coaching-os-v2/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git -C /root/coaching-os-v2 add frontend/src/pages/pulse/HomeScreen.tsx frontend/src/pages/pulse/CoachScreen.tsx
git -C /root/coaching-os-v2 commit -m "feat: add pulse HomeScreen + CoachScreen"
```

---

## Task 3: SleepScreen + TrainingScreen + MentalScreen

**Files:**
- Create: `frontend/src/pages/pulse/SleepScreen.tsx`
- Create: `frontend/src/pages/pulse/TrainingScreen.tsx`
- Create: `frontend/src/pages/pulse/MentalScreen.tsx`

- [ ] **Step 1: Create `frontend/src/pages/pulse/SleepScreen.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `frontend/src/pages/pulse/TrainingScreen.tsx`**

```tsx
import { usePulseActivities, usePulsePlan } from '@/pulse/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
```

- [ ] **Step 3: Create `frontend/src/pages/pulse/MentalScreen.tsx`**

```tsx
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
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
cd /root/coaching-os-v2/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -C /root/coaching-os-v2 add frontend/src/pages/pulse/SleepScreen.tsx frontend/src/pages/pulse/TrainingScreen.tsx frontend/src/pages/pulse/MentalScreen.tsx
git -C /root/coaching-os-v2 commit -m "feat: add pulse SleepScreen + TrainingScreen + MentalScreen"
```

---

## Task 4: CalendarScreen + GoalsScreen + ReviewScreen

**Files:**
- Create: `frontend/src/pages/pulse/CalendarScreen.tsx`
- Create: `frontend/src/pages/pulse/GoalsScreen.tsx`
- Create: `frontend/src/pages/pulse/ReviewScreen.tsx`

- [ ] **Step 1: Create `frontend/src/pages/pulse/CalendarScreen.tsx`**

```tsx
// Calendar data not yet available via API (Phase 3b stub) — shows placeholder.
import { Card, CardContent } from '@/components/ui/card';

export default function CalendarScreen() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-foreground">Kalender</h1>
      <Card className="border-border">
        <CardContent className="px-4 py-6 text-center text-muted-foreground text-sm">
          Google Kalender-Sync wird in einer zukünftigen Version verfügbar sein.
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/pages/pulse/GoalsScreen.tsx`**

```tsx
import { useState } from 'react';
import { usePulseGoals, useCreateGoal } from '@/pulse/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
```

- [ ] **Step 3: Create `frontend/src/pages/pulse/ReviewScreen.tsx`**

```tsx
import { usePulseReview, useGenerateReview } from '@/pulse/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReviewScreen() {
  const { data, isLoading } = usePulseReview();
  const generate = useGenerateReview();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Wochenreview</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          {generate.isPending ? 'Erstelle…' : 'Neu erstellen'}
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm py-4 text-center">Lade…</p>}

      {!isLoading && !data && (
        <Card className="border-border">
          <CardContent className="px-4 py-6 text-center text-muted-foreground text-sm">
            Kein Wochenreview vorhanden. Klicke "Neu erstellen" um eine KI-Analyse der letzten Woche zu generieren.
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
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
cd /root/coaching-os-v2/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -C /root/coaching-os-v2 add frontend/src/pages/pulse/CalendarScreen.tsx frontend/src/pages/pulse/GoalsScreen.tsx frontend/src/pages/pulse/ReviewScreen.tsx
git -C /root/coaching-os-v2 commit -m "feat: add pulse CalendarScreen + GoalsScreen + ReviewScreen"
```

---

## Task 5: PulseRouter + Wire into App.tsx + Layout.tsx

**Files:**
- Create: `frontend/src/pulse/routing.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Create `frontend/src/pulse/routing.tsx`**

```tsx
import { lazy, Suspense } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';

const HomeScreen     = lazy(() => import('@/pages/pulse/HomeScreen'));
const CoachScreen    = lazy(() => import('@/pages/pulse/CoachScreen'));
const SleepScreen    = lazy(() => import('@/pages/pulse/SleepScreen'));
const TrainingScreen = lazy(() => import('@/pages/pulse/TrainingScreen'));
const MentalScreen   = lazy(() => import('@/pages/pulse/MentalScreen'));
const CalendarScreen = lazy(() => import('@/pages/pulse/CalendarScreen'));
const GoalsScreen    = lazy(() => import('@/pages/pulse/GoalsScreen'));
const ReviewScreen   = lazy(() => import('@/pages/pulse/ReviewScreen'));

const PULSE_TABS = [
  { to: '',        label: 'Home',     end: true },
  { to: 'coach',   label: 'Coach'           },
  { to: 'sleep',   label: 'Schlaf'          },
  { to: 'train',   label: 'Training'        },
  { to: 'mental',  label: 'Mental'          },
  { to: 'goals',   label: 'Ziele'           },
  { to: 'review',  label: 'Review'          },
];

export function PulseRouter() {
  return (
    <div className="space-y-3">
      {/* Sub-navigation */}
      <nav className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {PULSE_TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            relative="path"
            className={({ isActive }) =>
              `whitespace-nowrap text-xs px-3 py-1.5 rounded-full transition-colors flex-shrink-0 ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Suspense fallback={<div className="text-muted-foreground text-sm py-4">Lade…</div>}>
        <Routes>
          <Route index         element={<HomeScreen />} />
          <Route path="coach"  element={<CoachScreen />} />
          <Route path="sleep"  element={<SleepScreen />} />
          <Route path="train"  element={<TrainingScreen />} />
          <Route path="mental" element={<MentalScreen />} />
          <Route path="cal"    element={<CalendarScreen />} />
          <Route path="goals"  element={<GoalsScreen />} />
          <Route path="review" element={<ReviewScreen />} />
        </Routes>
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 2: Update `frontend/src/App.tsx` — add Pulse route**

Add the import:
```tsx
import { PulseRouter } from '@/pulse/routing';
```

Add inside the authenticated `<Route path="/" ...>` block, after the `<Route path="chat" ...>` line:
```tsx
<Route path="pulse/*" element={<PulseRouter />} />
```

- [ ] **Step 3: Update `frontend/src/components/Layout.tsx` — add Pulse nav item**

In the `NAV_ITEMS` array, add the Pulse entry (after `chat`, before `tracking`):
```tsx
{ to: '/pulse', label: 'Pulse', icon: '⚡', end: false },
```

Full updated `NAV_ITEMS`:
```tsx
const NAV_ITEMS = [
  { to: '/',      label: 'Dashboard', icon: '📊', end: true },
  { to: '/chat',  label: 'Chat',      icon: '💬', end: false },
  { to: '/pulse', label: 'Pulse',     icon: '⚡', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false },
];
```

Note: Remove `tracking` and `plan` from `NAV_ITEMS` if they don't have corresponding routes (they appear in the existing array but have no route in `App.tsx`). If they are already cleaned up, only add the Pulse item.

- [ ] **Step 4: Check TypeScript compiles**

```bash
cd /root/coaching-os-v2/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Build frontend to verify bundling**

```bash
cd /root/coaching-os-v2/frontend && npm run build
```
Expected: build completes, no errors, `dist/` created.

- [ ] **Step 6: Run backend tests to confirm no regression**

```bash
cd /root/coaching-os-v2/backend && npm test
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git -C /root/coaching-os-v2 add frontend/src/pulse/routing.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git -C /root/coaching-os-v2 commit -m "feat: add PulseRouter + wire into App.tsx + Layout nav"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Pulse API client for all /api/pulse/* endpoints | Task 1 |
| TanStack Query v5 hooks with query keys | Task 1 |
| HomeScreen: readiness badge, CTL/ATL/TSB, metrics, activities | Task 2 |
| CoachScreen: message list, input, send on Enter | Task 2 |
| SleepScreen: sleep stage bar chart, 14-day list | Task 3 |
| TrainingScreen: planned workouts + activity history | Task 3 |
| MentalScreen: 4-slider check-in form | Task 3 |
| CalendarScreen: placeholder | Task 4 |
| GoalsScreen: list + create form + progress bar | Task 4 |
| ReviewScreen: narrative display + generate button | Task 4 |
| PulseRouter with lazy-loaded screens + sub-nav | Task 5 |
| Route /pulse/* wired into App.tsx | Task 5 |
| "Pulse" nav item in Layout.tsx | Task 5 |
| TypeScript compiles clean | Tasks 1-5 |
| Frontend builds without errors | Task 5 |

**Placeholder scan:** CalendarScreen intentionally shows a "coming soon" placeholder — this is by design (Google Calendar integration is future work), not a plan failure.

**Type consistency:**
- `pulseApi.*` return types match the `PulseHomeScreenData`, `PulseSleepSession` etc. interfaces from shared types ✓
- Hook return types inferred from `pulseApi.*` — no manual type assertions needed ✓
- `PulseRouter` uses React Router v7 `<Routes>`/`<Route>` pattern, same as existing `App.tsx` ✓
- `PulseCoachSession` import removed from api-client.ts (no endpoint returns a full session object) ✓
