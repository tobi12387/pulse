# Phase 5: Coach-Intelligenz + Workout-Matching + Morning Briefing

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` — implementiere Task für Task mit Spec- und Code-Review nach jedem Task.

**Voraussetzung:** Phase 4 vollständig abgeschlossen (Trend-Charts, LLM-Plan, Gewicht).

**Ziel:** Den Coach vom Chat-Interface zu einem echten täglichen Begleiter machen. Drei Säulen:
1. **Morning Briefing** — beim ersten Öffnen des Coach-Tabs eine kontextualisierte Zusammenfassung (tages- und daten-gecacht)
2. **Workout-Matching** — Garmin-Aktivitäten automatisch mit geplanten Trainings verknüpfen
3. **Streak-Tracking** — Check-in-Konsistenz und Trainingskonsistenz sichtbar machen

**Was NICHT in Phase 5 ist (bewusste Entscheidung):**
- Echtzeit-Streaming im Chat (schön, aber kein Blocker)
- Push-Benachrichtigungen / PWA (erhebliche Komplexität, kein LAN-Gerät von Tobi gefordert)
- Multi-Sport Periodisierung (z.B. Triathlon-spezifisch) — Phase 6

---

## Kritische Voranalyse

| Feature | Aktueller Zustand | Problem |
|---|---|---|
| Coach-Chat | TanStack Query cached Chat-History | Kein Einstiegs-Kontext — erster Satz immer "Stell eine Frage" |
| Workout-Plan | Wird generiert, liegt in DB | Kein Match mit tatsächlichen Garmin-Aktivitäten → Plan wirkt immer "offen" |
| Check-in | Täglich möglich, Guard in Phase 4 | Keine Konsequenz bei Miss — Streak würde motivieren |
| Readiness-Anzeige | Home zeigt Zahl | Kein narrativer Kontext was das für HEUTE bedeutet |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `backend/src/pulse/services/briefing-engine.ts` |
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `backend/src/jobs/garmin-sync.job.ts` |
| Modify | `backend/src/db/pulse-schema.ts` |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` |
| Modify | `frontend/src/pages/Coach.tsx` |
| Modify | `frontend/src/pages/Home.tsx` |

---

## Task 1: Morning Briefing Engine

**Design:** `GET /api/pulse/briefing` gibt eine tagesaktuelle Zusammenfassung zurück.
Redis-Cache mit Key `briefing:{userId}:{date}` — TTL bis Mitternacht.
Generiert via `SMART_MODEL`, ca. 80-100 Wörter, kein Markdown.

Der Briefing-Text ist bereits im Home-Komponent als Placeholder vorhanden aber leer — wir füllen ihn.

**Files:**
- Create: `backend/src/pulse/services/briefing-engine.ts`
- Modify: `backend/src/pulse/plugin.ts`
- Modify: `frontend/src/pulse/api-client.ts`
- Modify: `frontend/src/pulse/hooks.ts`
- Modify: `frontend/src/pages/Coach.tsx`

- [ ] **1.1 Erstelle `backend/src/pulse/services/briefing-engine.ts`**

```typescript
import { db } from '../../lib/db.js';
import { redis } from '../../lib/redis.js';
import { llmComplete, SMART_MODEL } from '../../lib/llm.js';
import { pulseDailyMetrics, pulseMentalCheckins, pulsePlannedWorkouts } from '../../db/pulse-schema.js';
import { eq, and, gte } from 'drizzle-orm';

export async function generateDailyBriefing(userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0]!;
  const cacheKey = `briefing:${userId}:${today}`;

  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  // Daten für Briefing sammeln
  const [metrics] = await db.select({
    sleepHours:     pulseDailyMetrics.sleepHours,
    hrvRmssd:       pulseDailyMetrics.hrvRmssd,
    hrvStatus:      pulseDailyMetrics.hrvStatus,
    bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
    stressAvg:      pulseDailyMetrics.stressAvg,
    steps:          pulseDailyMetrics.steps,
  }).from(pulseDailyMetrics)
    .where(and(eq(pulseDailyMetrics.userId, userId), eq(pulseDailyMetrics.date, today)));

  const [checkin] = await db.select({
    mood:       pulseMentalCheckins.mood,
    energy:     pulseMentalCheckins.energy,
    stress:     pulseMentalCheckins.stress,
    motivation: pulseMentalCheckins.motivation,
  }).from(pulseMentalCheckins)
    .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));

  const todayWorkouts = await db.select({
    activityType: pulsePlannedWorkouts.activityType,
    zone:         pulsePlannedWorkouts.zone,
    durationMin:  pulsePlannedWorkouts.durationMin,
    description:  pulsePlannedWorkouts.description,
    status:       pulsePlannedWorkouts.status,
  }).from(pulsePlannedWorkouts)
    .where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      eq(pulsePlannedWorkouts.plannedDate, today),
    ));

  // Kontext zusammenstellen
  const parts: string[] = [];
  if (metrics?.sleepHours) parts.push(`Schlaf: ${metrics.sleepHours.toFixed(1)}h`);
  if (metrics?.hrvRmssd)   parts.push(`HRV: ${metrics.hrvRmssd.toFixed(0)} ms (${metrics.hrvStatus ?? '–'})`);
  if (metrics?.bodyBatteryMax) parts.push(`Körperbatterie: ${metrics.bodyBatteryMax}%`);
  if (checkin)             parts.push(`Check-in: Stimmung ${checkin.mood}/10, Energie ${checkin.energy}/10`);
  if (todayWorkouts.length > 0) {
    const w = todayWorkouts[0]!;
    parts.push(`Geplantes Training heute: ${w.activityType} Zone ${w.zone} ${w.durationMin} min — ${w.description ?? ''}`);
    if (todayWorkouts[0]?.status === 'completed') parts.push('(bereits abgeschlossen)');
  }

  const context = parts.join('\n');

  const briefing = await llmComplete(
    `Du bist Pulse, ein persönlicher Ausdauercoach für Tobi. Schreibe ein tägliches Morning Briefing (60-90 Wörter, kein Markdown, auf Deutsch). 
    Sei motivierend aber realistisch. Beziehe dich auf die konkreten Daten. Empfehle die Intensität für heute.`,
    `Heute, ${today}:\n${context || 'Noch keine Daten für heute verfügbar.'}`,
    SMART_MODEL,
  );

  // Cache bis Mitternacht
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ttl = Math.round((midnight.getTime() - now.getTime()) / 1000);
  await redis.set(cacheKey, briefing, 'EX', ttl);

  return briefing;
}
```

- [ ] **1.2 `plugin.ts` — `GET /briefing` Endpunkt**

```typescript
import { generateDailyBriefing } from './services/briefing-engine.js';

app.get('/briefing', { onRequest: [app.authenticate] }, async (req) => {
  const userId = req.user.sub;
  const text = await generateDailyBriefing(userId);
  return { briefing: text, date: new Date().toISOString().split('T')[0]! };
});
```

- [ ] **1.3 Frontend: `api-client.ts` + `hooks.ts`**

```typescript
// api-client.ts
briefing: {
  get: (): Promise<{ briefing: string; date: string }> =>
    request('/briefing'),
},
```

```typescript
// hooks.ts
export function usePulseBriefing() {
  return useQuery({
    queryKey: ['pulse', 'briefing'],
    queryFn: pulseApi.briefing.get,
    staleTime: 30 * 60_000, // 30 min — wird sowieso gecacht bis Mitternacht
    retry: false,
  });
}
```

- [ ] **1.4 `Coach.tsx` — Briefing als Einstieg anzeigen**

Wenn der Coach-Tab geladen wird und die Chat-History leer ist (oder heute noch keine Nachricht): Briefing-Karte oben in der Nachrichtenliste anzeigen.

```tsx
const { data: briefingData } = usePulseBriefing();

// In der Nachrichtenliste, vor historyData.messages:
{historyData?.messages.length === 0 && briefingData?.briefing && (
  <div className="flex justify-end">
    <div className="max-w-[85%] rounded-xl px-3 py-2 text-sm bg-primary/20 text-foreground border border-primary/30 leading-relaxed">
      {briefingData.briefing}
    </div>
  </div>
)}
```

- [ ] **1.5 Backend build + restart + commit**

```bash
cd /root/pulse/backend && npm run build && pm2 restart pulse --update-env
git -C /root/pulse add backend/src/pulse/services/briefing-engine.ts backend/src/pulse/plugin.ts frontend/src/pulse/api-client.ts frontend/src/pulse/hooks.ts frontend/src/pages/Coach.tsx
git -C /root/pulse commit -m "feat: daily morning briefing (LLM, Redis-gecacht bis Mitternacht)"
```

---

## Task 2: Workout-Matching (Garmin-Aktivität → geplantes Training)

**Problem:** Garmin-Sync schreibt Aktivitäten in `pulse_activities`. Der Plan liegt in `pulse_planned_workouts`. Beide Tabellen sind unverbunden — der Plan sieht immer "offen" aus, auch nach abgeschlossenem Training.

**Matching-Logik:**
- Datum der Aktivität = `plannedDate` des Workouts
- Aktivitätstyp kommt überein (bike↔bike, run↔run; strength ist flexibel)
- Wenn Match: `status = 'completed'`, `completedActivityId = activity.id` setzen

**Schema-Erweiterung:**

```sql
ALTER TABLE pulse_planned_workouts
  ADD COLUMN IF NOT EXISTS completed_activity_id UUID REFERENCES pulse_activities(id);
```

**Files:**
- Modify: `backend/src/db/pulse-schema.ts`
- Create: `backend/src/db/migrations/0011_workout_match.sql`
- Modify: `backend/src/jobs/garmin-sync.job.ts`
- Modify: `frontend/src/pages/Plan.tsx`

- [ ] **2.1 Schema-Erweiterung**

In `pulse-schema.ts` im `pulsePlannedWorkouts`-Table:

```typescript
completedActivityId: uuid('completed_activity_id').references(() => pulseActivities.id),
```

Migration `0011_workout_match.sql`:

```sql
ALTER TABLE pulse_planned_workouts
  ADD COLUMN IF NOT EXISTS completed_activity_id UUID REFERENCES pulse_activities(id);
```

```bash
psql -U postgres -p 5433 -d coaching_os_v2 -f /root/pulse/backend/src/db/migrations/0011_workout_match.sql
```

- [ ] **2.2 Matching-Funktion im Garmin-Sync-Job**

In `backend/src/jobs/garmin-sync.job.ts` nach dem Upsert der Aktivität:

```typescript
import { pulsePlannedWorkouts, pulseActivities } from '../db/pulse-schema.js';

async function matchActivityToWorkout(userId: string, activityId: string, date: string, activityType: string): Promise<void> {
  // Suche nicht-abgeschlossenes geplantes Training am selben Tag mit passendem Typ
  const [planned] = await db.select({ id: pulsePlannedWorkouts.id })
    .from(pulsePlannedWorkouts)
    .where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      eq(pulsePlannedWorkouts.plannedDate, date),
      eq(pulsePlannedWorkouts.status, 'planned'),
      // Flexibles Matching: 'strength' matcht immer, sonst exakt
      activityType === 'strength'
        ? eq(pulsePlannedWorkouts.activityType, 'strength')
        : eq(pulsePlannedWorkouts.activityType, activityType),
    ))
    .limit(1);

  if (!planned) return;

  await db.update(pulsePlannedWorkouts)
    .set({ status: 'completed', completedActivityId: activityId })
    .where(eq(pulsePlannedWorkouts.id, planned.id));
}
```

Aufruf nach dem Activity-Upsert im Sync-Job:
```typescript
await matchActivityToWorkout(userId, insertedActivity.id, dateStr, activityType);
```

- [ ] **2.3 `Plan.tsx` TrainingTab — Status visuell anzeigen**

Completed-Workouts mit grünem Häkchen und Datum anzeigen:

```tsx
{(plan.data?.workouts ?? []).map((w) => (
  <Card key={w.id} className={`border-border ${w.status === 'completed' ? 'opacity-60' : ''}`}>
    <CardContent className="px-4 py-3 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-1.5">
          {w.status === 'completed' && <span className="text-green-400">✓</span>}
          <div className="text-sm font-medium text-foreground">{w.plannedDate}</div>
        </div>
        {/* ... rest unverändert ... */}
      </div>
      <Badge className={ZONE_COLORS[w.zone] ?? 'bg-muted'}>Z{w.zone}</Badge>
    </CardContent>
  </Card>
))}
```

- [ ] **2.4 Build + commit**

```bash
cd /root/pulse/backend && npm run build && pm2 restart pulse --update-env
git -C /root/pulse add backend/src/db/pulse-schema.ts backend/src/db/migrations/0011_workout_match.sql backend/src/jobs/garmin-sync.job.ts frontend/src/pages/Plan.tsx
git -C /root/pulse commit -m "feat: auto-match Garmin activities to planned workouts"
```

---

## Task 3: Streak-Tracking (Check-in + Training)

**Warum:** Konsistenz ist im Ausdauersport entscheidend. Streaks machen Lücken sichtbar und motivieren. Kein gamification-Overkill — nur zwei einfache Zahlen: wie viele Tage am Stück Check-in gemacht, wie viele Trainings in Folge abgeschlossen.

**Design:** Keine neue DB-Tabelle — wird on-the-fly aus `pulse_mental_checkins` und `pulse_planned_workouts` (status='completed') berechnet, gecacht in Redis.

**Files:**
- Create: `backend/src/pulse/services/streak-engine.ts`
- Modify: `backend/src/pulse/plugin.ts`
- Modify: `shared/types/pulse.ts`
- Modify: `frontend/src/pages/Home.tsx`

- [ ] **3.1 Erstelle `backend/src/pulse/services/streak-engine.ts`**

```typescript
import { db } from '../../lib/db.js';
import { redis } from '../../lib/redis.js';
import { pulseMentalCheckins, pulsePlannedWorkouts } from '../../db/pulse-schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';

export interface Streaks {
  checkinStreakDays: number;
  workoutStreakDays: number;
  checkinTotal:     number;
  workoutTotal:     number;
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...dates].sort().reverse(); // neueste zuerst
  const today = new Date().toISOString().split('T')[0]!;

  let streak = 0;
  let expected = today;

  for (const d of sorted) {
    if (d === expected) {
      streak++;
      const prev = new Date(expected);
      prev.setDate(prev.getDate() - 1);
      expected = prev.toISOString().split('T')[0]!;
    } else if (d < expected) {
      break; // Lücke
    }
  }

  return streak;
}

export async function getStreaks(userId: string): Promise<Streaks> {
  const cacheKey = `streaks:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as Streaks;

  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0]!;

  const [checkins, workouts] = await Promise.all([
    db.select({ date: pulseMentalCheckins.date })
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since30)))
      .orderBy(desc(pulseMentalCheckins.date)),

    db.select({ date: pulsePlannedWorkouts.plannedDate })
      .from(pulsePlannedWorkouts)
      .where(and(
        eq(pulsePlannedWorkouts.userId, userId),
        eq(pulsePlannedWorkouts.status, 'completed'),
        gte(pulsePlannedWorkouts.plannedDate, since30),
      ))
      .orderBy(desc(pulsePlannedWorkouts.plannedDate)),
  ]);

  const result: Streaks = {
    checkinStreakDays: computeStreak(checkins.map(c => c.date)),
    workoutStreakDays: computeStreak(workouts.map(w => w.date)),
    checkinTotal:     checkins.length,
    workoutTotal:     workouts.length,
  };

  await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
  return result;
}
```

- [ ] **3.2 `plugin.ts` — `/streaks` Endpunkt + in `/home` integrieren**

```typescript
import { getStreaks } from './services/streak-engine.js';

app.get('/streaks', { onRequest: [app.authenticate] }, async (req) => {
  return getStreaks(req.user.sub);
});
```

In `GET /home`: parallel zu den anderen Daten `getStreaks` aufrufen und in die Response einbauen.

- [ ] **3.3 Shared Types: `PulseStreaks` + in `PulseHomeScreenData`**

In `shared/types/pulse.ts`:

```typescript
export interface PulseStreaks {
  checkinStreakDays: number;
  workoutStreakDays: number;
  checkinTotal:     number;
  workoutTotal:     number;
}
```

In `PulseHomeScreenData`:
```typescript
streaks: PulseStreaks;
```

- [ ] **3.4 `Home.tsx` — Streaks-Anzeige**

Kleine Streak-Zeile unter der Readiness-Badge:

```tsx
{data.streaks && (
  <div className="flex gap-4 text-xs text-muted-foreground">
    <span>🔥 Check-in {data.streaks.checkinStreakDays}d</span>
    <span>💪 Training {data.streaks.workoutStreakDays}d</span>
  </div>
)}
```

- [ ] **3.5 Build + commit + push**

```bash
cd /root/pulse/backend && npm run build && pm2 restart pulse --update-env
cd /root/pulse/frontend && npx tsc --noEmit
git -C /root/pulse add backend/src/pulse/services/streak-engine.ts backend/src/pulse/plugin.ts shared/types/pulse.ts frontend/src/pages/Home.tsx
git -C /root/pulse commit -m "feat: streak tracking (check-in + workout) on Home"
git -C /root/pulse push
```

---

## Selbst-Review

**Abhängigkeiten:**
- Task 1 (Briefing) ist unabhängig — kann als erstes implementiert werden
- Task 2 (Workout-Matching) hängt von Phase 4 Task 3 ab (Plan muss generiert worden sein)
- Task 3 (Streaks) hängt von Task 2 ab (streak.workoutStreakDays nur sinnvoll nach Matching)

**Risiken:**
- Morning Briefing: LLM-Latenz beim ersten Aufruf (~2-3s) → Redis-Cache löst das für den Rest des Tages
- Workout-Matching: Aktivitäten ohne klar definierten Typ (z.B. "other") matchen nicht → kein Problem, kein false-positive besser als falscher Match
- Streak-Computation: Wenn User an einem Tag zwei Check-ins hat (möglich nach Phase 4-Fix), wird Datum nur einmal gezählt → korrekt, kein Bug
