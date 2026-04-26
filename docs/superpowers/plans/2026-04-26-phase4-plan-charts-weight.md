# Phase 4: Trainingsplan-KI + Trend-Charts + Gewichts-Tracking

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` — implementiere Task für Task mit Spec- und Code-Review nach jedem Task.

**Ziel:** Drei Gaps schließen, die die tägliche Nutzung blockieren oder wertlos machen:
1. Trainingsplan in der UI erzeugbar machen (inklusive LLM-generiertem polarem Plan)
2. Trend-Charts für HRV, Schlaf, Readiness und Load (visuell statt Karten-Listen)
3. Gewichts-Tracking mit Trendlinie und Zielgewicht

**Architektur:** Kein neues Framework. Charts als leichtgewichtige SVG-Inline-Komponenten (kein Recharts/Chart.js — zu groß für den Use Case). Gewicht als neue Tabelle `pulse_weight_log`. Trainingsplan-Generierung via LLM (Claude SMART_MODEL), Backend-Endpunkt `POST /api/pulse/plan/generate` bereits vorhanden — Qualität verbessern.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse der Altpläne

| Altplan-Feature | Status | Bewertung |
|---|---|---|
| Plan-Engine Templates (3b Task 5) | ✅ Implementiert | Templates zu starr für polares Training — ersetzen |
| `POST /plan/generate` Endpunkt (3b Task 7) | ✅ Implementiert | Funktioniert, aber nutzt Templates statt LLM |
| TrainingTab ohne Generate-Button (3c Task 3) | ✅ UI existiert | **Fehler: kein Button — Plan nie sichtbar** |
| MentalTab ohne Check-in-Guard (3c Task 3) | ✅ UI existiert | **Bug: Doppel-Submit möglich** |
| Charts waren in keinem Plan | ❌ Nie geplant | Höchste UX-Priorität |
| Gewicht war in keinem Plan | ❌ Nie geplant | Explizit in CLAUDE.md als Fokus |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `frontend/src/components/SparkChart.tsx` |
| Modify | `frontend/src/pages/Home.tsx` |
| Modify | `frontend/src/pages/Data.tsx` |
| Modify | `frontend/src/pages/Plan.tsx` |
| Create | `backend/src/db/migrations/0010_weight_log.sql` |
| Modify | `backend/src/db/pulse-schema.ts` |
| Modify | `backend/src/pulse/services/plan-engine.ts` |
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` |

---

## Task 1: SparkChart-Komponente (SVG, kein Dependency)

**Warum kein Chart-Framework:** Recharts/Chart.js sind 200-400 KB extra Bundle. Für Sparklines (7/14-Tage-Verlauf als Linie oder Balken) reichen 50 Zeilen SVG völlig aus.

**Files:**
- Create: `frontend/src/components/SparkChart.tsx`

- [ ] **1.1 Erstelle `frontend/src/components/SparkChart.tsx`**

```tsx
interface SparkLineProps {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
}

export function SparkLine({
  values,
  width = 120,
  height = 32,
  color = 'currentColor',
  fillOpacity = 0.15,
}: SparkLineProps) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return <div style={{ width, height }} className="bg-muted rounded" />;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points: [number, number][] = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * w;
    const y = v === null ? -1 : pad + h - ((v - min) / range) * h;
    return [x, y];
  });

  const visible = points.filter(([, y]) => y >= 0);
  const linePath = visible
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  const first = visible[0];
  const last = visible[visible.length - 1];
  const areaPath = first && last
    ? `${linePath} L${last[0].toFixed(1)},${(pad + h).toFixed(1)} L${first[0].toFixed(1)},${(pad + h).toFixed(1)} Z`
    : '';

  return (
    <svg width={width} height={height} className="overflow-visible">
      {areaPath && <path d={areaPath} fill={color} fillOpacity={fillOpacity} stroke="none" />}
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={2} fill={color} />}
    </svg>
  );
}

interface SparkBarProps {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  positiveColor?: string;
  negativeColor?: string;
  showZeroLine?: boolean;
}

export function SparkBar({
  values,
  width = 120,
  height = 32,
  color,
  positiveColor = '#22c55e',
  negativeColor = '#ef4444',
  showZeroLine = false,
}: SparkBarProps) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return <div style={{ width, height }} className="bg-muted rounded" />;

  const min = Math.min(...valid, 0);
  const max = Math.max(...valid, 0);
  const range = max - min || 1;

  const pad = 1;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const barW = Math.max(2, w / values.length - 1);
  const zeroY = pad + h - (0 - min) / range * h;

  return (
    <svg width={width} height={height}>
      {showZeroLine && (
        <line x1={pad} y1={zeroY} x2={pad + w} y2={zeroY} stroke="currentColor" strokeOpacity={0.2} strokeWidth={0.5} />
      )}
      {values.map((v, i) => {
        if (v === null) return null;
        const x = pad + (i / values.length) * w + 0.5;
        const y = pad + h - ((v - min) / range) * h;
        const barH = Math.abs(zeroY - y) || 1;
        const top = Math.min(y, zeroY);
        const fill = color ?? (v >= 0 ? positiveColor : negativeColor);
        return <rect key={i} x={x} y={top} width={barW} height={barH} fill={fill} rx={1} />;
      })}
    </svg>
  );
}
```

- [ ] **1.2 TypeScript-Check**

```bash
cd /root/pulse/frontend && npx tsc --noEmit
```

- [ ] **1.3 Commit**

```bash
git -C /root/pulse add frontend/src/components/SparkChart.tsx
git -C /root/pulse commit -m "feat: add SparkLine + SparkBar SVG chart components"
```

---

## Task 2: Trend-Charts auf Home + Data

Jede Metrik bekommt neben dem aktuellen Wert einen 7-Tage-Sparkline-Chart.

**Problem mit bestehendem Code:**
- `usePulseHome()` liefert nur `todayMetrics` (Einzelwert)
- Wir brauchen historische Werte → `usePulseSleep(7)` und `usePulseDailyMetrics(14)` (neuer Hook)

**Neuer Backend-Endpunkt:** `GET /api/pulse/metrics?days=14` — gibt `pulseDailyMetrics` zurück (existiert in der DB, hat aber noch keinen eigenen Endpunkt außer dem home-Aggregat)

**Files:**
- Modify: `backend/src/pulse/plugin.ts`
- Modify: `frontend/src/pulse/api-client.ts`
- Modify: `frontend/src/pulse/hooks.ts`
- Modify: `frontend/src/pages/Home.tsx`
- Modify: `frontend/src/pages/Data.tsx`

- [ ] **2.1 Backend: `GET /api/pulse/metrics` hinzufügen**

In `backend/src/pulse/plugin.ts`, nach dem `/sleep`-Endpunkt einfügen:

```typescript
// ─── Daily metrics history ─────────────────────────────────────────────────────
app.get('/metrics', { onRequest: [app.authenticate] }, async (req) => {
  const userId = req.user.sub;
  const days = Math.min(Number((req.query as { days?: string }).days ?? 14), 90);
  const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]!;

  const metrics = await db.select({
    date:           pulseDailyMetrics.date,
    hrvRmssd:       pulseDailyMetrics.hrvRmssd,
    restingHr:      pulseDailyMetrics.restingHr,
    sleepHours:     pulseDailyMetrics.sleepHours,
    sleepScore:     pulseDailyMetrics.sleepScore,
    bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
    stressAvg:      pulseDailyMetrics.stressAvg,
    steps:          pulseDailyMetrics.steps,
  }).from(pulseDailyMetrics)
    .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since)))
    .orderBy(pulseDailyMetrics.date);

  return { metrics };
});
```

- [ ] **2.2 Frontend: `api-client.ts` erweitern**

```typescript
metrics: {
  list: (days = 14): Promise<{ metrics: Array<{
    date: string; hrvRmssd: number | null; restingHr: number | null;
    sleepHours: number | null; sleepScore: number | null;
    bodyBatteryMax: number | null; stressAvg: number | null; steps: number | null;
  }> }> =>
    request(`/metrics?days=${days}`),
},
```

- [ ] **2.3 Frontend: `hooks.ts` — `usePulseMetrics` hinzufügen**

```typescript
export function usePulseMetrics(days = 14) {
  return useQuery({
    queryKey: ['pulse', 'metrics', days],
    queryFn: () => pulseApi.metrics.list(days),
    staleTime: 5 * 60_000,
  });
}
```

- [ ] **2.4 `frontend/src/pages/Home.tsx` — Trend-Charts einbauen**

In der Readiness/Metriken-Sektion: neben jedem Wert einen `SparkLine` anzeigen.

Konkret: Die 4er-Grid-Karten (Schlaf, HRV, Batterie, Schritte) werden um einen Chart erweitert. Die Komponente ruft `usePulseMetrics(7)` auf und mappt das auf die jeweiligen Werte-Arrays.

Änderung in der `MetricCard` oder als Wrapper:
```tsx
import { SparkLine } from '@/components/SparkChart';
import { usePulseMetrics } from '@/pulse/hooks';

// in der Home-Komponente:
const { data: metricsHistory } = usePulseMetrics(7);
const hrv7d    = metricsHistory?.metrics.map(m => m.hrvRmssd)       ?? [];
const sleep7d  = metricsHistory?.metrics.map(m => m.sleepHours)     ?? [];
const batt7d   = metricsHistory?.metrics.map(m => m.bodyBatteryMax) ?? [];
const steps7d  = metricsHistory?.metrics.map(m => m.steps != null ? m.steps / 1000 : null) ?? [];
```

Jede Metrik-Karte: unter dem Hauptwert den SparkLine einbauen:
```tsx
<SparkLine values={hrv7d} width={100} height={24} color="var(--primary)" />
```

- [ ] **2.5 `frontend/src/pages/Data.tsx` — SleepTab mit Chart**

Im SleepTab: Oben eine Übersichtskarte mit `SparkBar` für Schlafdauer der letzten 14 Tage einfügen, bevor die Einzel-Karten kommen.

```tsx
const durationValues = sessions.map(s => s.durationH);
// Ziel-Linie bei 8h visuell sichtbar machen
<div className="space-y-1">
  <div className="flex justify-between text-xs text-muted-foreground">
    <span>14 Tage</span>
    <span>Ziel: 8h</span>
  </div>
  <SparkBar values={durationValues} width={undefined} height={40} color="var(--primary)" />
</div>
```

- [ ] **2.6 Backend bauen + PM2 restart**

```bash
cd /root/pulse/backend && npm run build && pm2 restart pulse --update-env
```

- [ ] **2.7 TypeScript-Check**

```bash
cd /root/pulse/frontend && npx tsc --noEmit
```

- [ ] **2.8 Commit**

```bash
git -C /root/pulse add backend/src/pulse/plugin.ts frontend/src/pulse/api-client.ts frontend/src/pulse/hooks.ts frontend/src/pages/Home.tsx frontend/src/pages/Data.tsx
git -C /root/pulse commit -m "feat: add trend charts (SparkLine/SparkBar) on Home + Data pages"
```

---

## Task 3: Trainingsplan-Fixes + LLM-Generierung

**Zwei Probleme lösen:**

**Problem A:** "Kein Plan vorhanden" in der UI — kein Generate-Button, der Plan-Workflow ist tot.

**Problem B:** Die `plan-engine.ts` nutzt starre Templates statt echtem polarem Training.

Polarisiertes Training = ~80% Z1-Z2, ~20% Z4-Z5. Die aktuellen Templates mischen das nicht korrekt und ignorieren FTP/aktuelle Load.

**Ansatz für LLM-Plan:** Der bestehende `POST /plan/generate` Endpunkt ruft `generateWeekWorkouts` auf. Wir erweitern das: wenn ein LLM-Key vorhanden, generiert Claude einen JSON-Trainingsplan; sonst Fallback auf Templates.

**Files:**
- Modify: `backend/src/pulse/services/plan-engine.ts`
- Modify: `backend/src/pulse/plugin.ts`
- Modify: `frontend/src/pages/Plan.tsx`

- [ ] **3.1 `plan-engine.ts` — LLM-Generierung hinzufügen**

Neue Funktion unter den Templates:

```typescript
import { llmComplete, SMART_MODEL } from '../../lib/llm.js';

export interface LLMPlanInput {
  weekStart: string;
  phase: 'base' | 'build' | 'peak' | 'taper';
  weeklyHoursTarget: number;
  availableDays: number[];  // Wochentage 0=So..6=Sa
  ctl: number;
  atl: number;
  tsb: number;
  ftpWatts: number;
  recentActivities: Array<{ activityType: string; durationMin: number; tss: number }>;
}

export async function generateLLMWeekPlan(input: LLMPlanInput): Promise<WeekWorkout[]> {
  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const availableStr = input.availableDays.map(d => dayNames[d]).join(', ');

  const prompt = `Erstelle einen Trainingsplan für diese Woche (ab ${input.weekStart}).

Athletenprofil:
- Trainingsziel: ${input.phase === 'base' ? 'Grundlagenaufbau' : input.phase === 'build' ? 'Aufbau' : input.phase === 'peak' ? 'Wettkampfvorbereitung' : 'Tapering'}
- Wöchentliche Stunden: ${input.weeklyHoursTarget}h
- Verfügbare Tage: ${availableStr}
- FTP: ${input.ftpWatts}W
- Fitness (CTL): ${input.ctl.toFixed(0)}, Ermüdung (ATL): ${input.atl.toFixed(0)}, Form (TSB): ${input.tsb.toFixed(0)}
- Letzte Trainings: ${input.recentActivities.slice(0, 3).map(a => `${a.activityType} ${a.durationMin}min ${a.tss}TSS`).join(', ') || 'keine'}

Erstelle ${input.availableDays.length} Trainingseinheiten nach polarisiertem Trainingsmodell (80% extensiv Z1-Z2, 20% intensiv Z4-Z5).
${input.tsb < -15 ? 'WICHTIG: Hohe Ermüdung (TSB negativ) — Intensität reduzieren, Erholung priorisieren.' : ''}

Antworte NUR mit einem JSON-Array, kein Text davor/danach:
[
  {
    "dayOffset": 1,
    "activityType": "run|bike|swim|strength",
    "zone": 1-5,
    "durationMin": Zahl,
    "description": "kurze Beschreibung auf Deutsch"
  }
]
dayOffset = Tage ab Montag der Woche (0=Mo, 1=Di..6=So)`;

  const raw = await llmComplete(
    'Du bist Sportwissenschaftler und Ausdauercoach. Antworte nur mit validem JSON.',
    prompt,
    SMART_MODEL,
  );

  // JSON aus der Antwort extrahieren
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('LLM returned no valid JSON');

  const items = JSON.parse(jsonMatch[0]) as Array<{
    dayOffset: number; activityType: string; zone: number; durationMin: number; description: string;
  }>;

  const startDate = new Date(input.weekStart);
  return items.map(item => {
    const plannedDate = new Date(startDate);
    plannedDate.setDate(plannedDate.getDate() + item.dayOffset);
    return {
      plannedDate: plannedDate.toISOString().split('T')[0]!,
      activityType: item.activityType as 'run' | 'bike' | 'swim' | 'strength',
      zone: Math.max(1, Math.min(5, item.zone)),
      durationMin: Math.max(15, Math.min(300, item.durationMin)),
      targetTss: Math.round(item.zone * 15 * (item.durationMin / 60)),
      description: item.description,
    };
  });
}
```

- [ ] **3.2 `plugin.ts` — `POST /plan/generate` auf LLM-Generierung upgraden**

Im bestehenden `POST /plan/generate` Handler: vor dem `generateWeekWorkouts`-Aufruf prüfen ob LLM verfügbar, und dann `generateLLMWeekPlan` bevorzugen:

```typescript
import { generateWeekWorkouts, generateLLMWeekPlan } from './services/plan-engine.js';
import { computeFitnessLoad } from './services/load-engine.js';
import { env } from '../lib/env.js';

// Im Handler:
let generated: Awaited<ReturnType<typeof generateWeekWorkouts>>;

if (env.OPENAI_API_KEY || true) { // LLM immer nutzen (Claude via OpenRouter)
  const fitnessLoad = await computeFitnessLoad(userId, new Date().toISOString().split('T')[0]!);
  const recentActs = await db.select({
    activityType: pulseActivities.activityType,
    durationSec: pulseActivities.durationSec,
    tss: pulseActivities.tss,
  }).from(pulseActivities)
    .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, new Date(Date.now() - 14 * 86_400_000))))
    .orderBy(desc(pulseActivities.startTime))
    .limit(5);

  try {
    generated = await generateLLMWeekPlan({
      weekStart: weekStartStr,
      phase: (profile?.trainingPhase ?? 'base') as 'base' | 'build' | 'peak' | 'taper',
      weeklyHoursTarget: profile?.weeklyHoursTarget ?? 8,
      availableDays: [1, 3, 5, 6],
      ctl: fitnessLoad.ctl,
      atl: fitnessLoad.atl,
      tsb: fitnessLoad.tsb,
      ftpWatts: profile?.ftpWatts ?? 200,
      recentActivities: recentActs.map(a => ({
        activityType: a.activityType,
        durationMin: Math.round((a.durationSec ?? 0) / 60),
        tss: a.tss ?? 0,
      })),
    });
  } catch {
    // Fallback auf Templates
    generated = generateWeekWorkouts({
      weekStart: weekStartStr,
      phase: (profile?.trainingPhase ?? 'base') as 'base' | 'build' | 'peak' | 'taper',
      weeklyHoursTarget: profile?.weeklyHoursTarget ?? 8,
      availableDays: [1, 3, 5, 6],
    });
  }
} else {
  generated = generateWeekWorkouts({ /* ... wie bisher ... */ });
}
```

- [ ] **3.3 `Plan.tsx` — "Plan generieren"-Button + Check-in-Guard**

Im `TrainingTab`:

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pulseApi } from '@/pulse/api-client';

function TrainingTab() {
  const acts = usePulseActivities(14);
  const plan = usePulsePlan();
  const qc = useQueryClient();

  const generatePlan = useMutation({
    mutationFn: pulseApi.plan.generate,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pulse', 'plan'] }),
  });

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground">Trainingsplan</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generatePlan.mutate()}
            disabled={generatePlan.isPending}
          >
            {generatePlan.isPending ? 'Generiere…' : '✦ Plan erstellen'}
          </Button>
        </div>
        {/* ... Rest unverändert ... */}
      </section>
      {/* ... */}
    </div>
  );
}
```

Im `MentalTab` in `Data.tsx` — Check-in-Guard einbauen:

```tsx
import { useCheckinToday } from '@/pulse/hooks';

function MentalTab() {
  const home = usePulseHome();
  const { data: todayCheckin } = useCheckinToday();
  const checkin = usePulseCheckin();
  const [form, setForm] = useState({ mood: 7, energy: 7, stress: 3, motivation: 7, notes: '' });

  const alreadyDone = todayCheckin?.checkin != null;

  // Wenn alreadyDone: Scores anzeigen statt Formular
  if (alreadyDone) {
    return (
      <div className="space-y-4">
        {/* Readiness card wie bisher */}
        <Card className="border-green-700/50 bg-green-950/20">
          <CardContent className="px-4 py-3 text-sm text-green-400">
            Check-in heute bereits abgeschlossen.
          </CardContent>
        </Card>
      </div>
    );
  }

  // ... Rest des Formulars unverändert
}
```

- [ ] **3.4 Backend build + restart**

```bash
cd /root/pulse/backend && npm run build && pm2 restart pulse --update-env
```

- [ ] **3.5 TypeScript-Check**

```bash
cd /root/pulse/frontend && npx tsc --noEmit
```

- [ ] **3.6 Commit**

```bash
git -C /root/pulse add backend/src/pulse/services/plan-engine.ts backend/src/pulse/plugin.ts frontend/src/pages/Plan.tsx frontend/src/pages/Data.tsx
git -C /root/pulse commit -m "feat: LLM-Trainingsplan + Generate-Button + Check-in-Guard"
```

---

## Task 4: Gewichts-Tracking

**Warum:** CLAUDE.md nennt Gewichtsmanagement als expliziten Fokus. Kein Tracking = keine Daten = kein Coaching.

**Design:** Einfach halten. Tägliche Gewichtseingabe (kg, 1 Dezimalstelle), Trend über 30 Tage, Zielgewicht. Kein Body-Fat, keine Körperzusammensetzung — das gehört in Phase 5.

**Wo in der UI:** Neues Tab "Gewicht" in der Data-Page (neben Schlaf + Mental).

**Files:**
- Modify: `backend/src/db/pulse-schema.ts`
- Create: `backend/src/db/migrations/0010_weight_log.sql`
- Modify: `backend/src/pulse/plugin.ts`
- Modify: `frontend/src/pulse/api-client.ts`
- Modify: `frontend/src/pulse/hooks.ts`
- Modify: `frontend/src/pages/Data.tsx`

- [ ] **4.1 DB-Schema: `pulse_weight_log` hinzufügen**

In `backend/src/db/pulse-schema.ts` einfügen (nach `pulseMentalCheckins`):

```typescript
export const pulseWeightLog = pgTable('pulse_weight_log', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date:      date('date').notNull(),
  weightKg:  numeric('weight_kg', { precision: 5, scale: 2 }).notNull(),
  notes:     text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('pulse_weight_log_user_date_idx').on(t.userId, t.date)]);
```

- [ ] **4.2 Migration erstellen**

Datei `backend/src/db/migrations/0010_weight_log.sql`:

```sql
CREATE TABLE IF NOT EXISTS pulse_weight_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  weight_kg  NUMERIC(5,2) NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS pulse_weight_log_user_date_idx ON pulse_weight_log (user_id, date DESC);
```

Migration ausführen:

```bash
psql -U postgres -p 5433 -d coaching_os_v2 -f /root/pulse/backend/src/db/migrations/0010_weight_log.sql
```

- [ ] **4.3 Backend: Gewicht-Endpunkte in `plugin.ts`**

```typescript
import { pulseWeightLog } from '../db/pulse-schema.js';

// ─── Gewicht ───────────────────────────────────────────────────────────────────
app.get('/weight', { onRequest: [app.authenticate] }, async (req) => {
  const userId = req.user.sub;
  const days = Math.min(Number((req.query as { days?: string }).days ?? 30), 180);
  const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]!;

  const entries = await db.select({
    id:       pulseWeightLog.id,
    date:     pulseWeightLog.date,
    weightKg: pulseWeightLog.weightKg,
    notes:    pulseWeightLog.notes,
  }).from(pulseWeightLog)
    .where(and(eq(pulseWeightLog.userId, userId), gte(pulseWeightLog.date, since)))
    .orderBy(desc(pulseWeightLog.date));

  return { entries };
});

app.post('/weight', { onRequest: [app.authenticate] }, async (req, reply) => {
  const schema = z.object({
    weightKg: z.number().min(30).max(300),
    date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes:    z.string().max(500).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

  const userId = req.user.sub;
  const date = parsed.data.date ?? new Date().toISOString().split('T')[0]!;

  const [entry] = await db.insert(pulseWeightLog).values({
    userId,
    date,
    weightKg: String(parsed.data.weightKg),
    notes: parsed.data.notes ?? null,
  }).onConflictDoUpdate({
    target: [pulseWeightLog.userId, pulseWeightLog.date],
    set: { weightKg: String(parsed.data.weightKg), notes: parsed.data.notes ?? null },
  }).returning();

  return reply.status(201).send(entry);
});
```

- [ ] **4.4 Frontend: `api-client.ts` + `hooks.ts`**

In `api-client.ts`:

```typescript
weight: {
  list: (days = 30): Promise<{ entries: Array<{ id: string; date: string; weightKg: string; notes: string | null }> }> =>
    request(`/weight?days=${days}`),
  log: (data: { weightKg: number; date?: string; notes?: string }): Promise<{ id: string; date: string; weightKg: string }> =>
    request('/weight', { method: 'POST', body: JSON.stringify(data) }),
},
```

In `hooks.ts`:

```typescript
export function usePulseWeight(days = 30) {
  return useQuery({
    queryKey: ['pulse', 'weight', days],
    queryFn: () => pulseApi.weight.list(days),
    staleTime: 5 * 60_000,
  });
}

export function useLogWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pulseApi.weight.log,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pulse', 'weight'] }),
  });
}
```

- [ ] **4.5 Frontend: `Data.tsx` — Gewicht-Tab hinzufügen**

Tab-Array erweitern:

```tsx
type Tab = 'schlaf' | 'mental' | 'gewicht';

const TABS: { id: Tab; label: string }[] = [
  { id: 'schlaf',  label: 'Schlaf' },
  { id: 'mental',  label: 'Mental' },
  { id: 'gewicht', label: 'Gewicht' },
];
```

Neue `GewichtTab`-Komponente:

```tsx
function GewichtTab() {
  const { data, isLoading } = usePulseWeight(30);
  const logWeight = useLogWeight();
  const [kg, setKg] = useState('');
  const [error, setError] = useState('');

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    const w = parseFloat(kg);
    if (isNaN(w) || w < 30 || w > 300) { setError('Ungültiger Wert'); return; }
    await logWeight.mutateAsync({ weightKg: w });
    setKg('');
    setError('');
  }

  const entries = data?.entries ?? [];
  const weights = entries.slice(0, 30).reverse().map(e => parseFloat(e.weightKg));
  const latest = entries[0];
  const prev7 = entries[6];
  const trend7d = latest && prev7
    ? parseFloat(latest.weightKg) - parseFloat(prev7.weightKg)
    : null;

  return (
    <div className="space-y-4">
      {/* Eingabe */}
      <Card className="border-border">
        <CardContent className="px-4 py-4">
          <form onSubmit={(e) => void handleLog(e)} className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="30"
              max="300"
              value={kg}
              onChange={e => setKg(e.target.value)}
              placeholder="kg"
              className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button type="submit" disabled={logWeight.isPending || !kg}>
              {logWeight.isPending ? '…' : 'Eintragen'}
            </Button>
          </form>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </CardContent>
      </Card>

      {/* Aktueller Wert + Trend */}
      {latest && (
        <div className="flex gap-3">
          <Card className="flex-1 border-border">
            <CardContent className="px-4 py-3">
              <div className="text-xs text-muted-foreground">Aktuell</div>
              <div className="text-2xl font-bold">{parseFloat(latest.weightKg).toFixed(1)} kg</div>
              <div className="text-xs text-muted-foreground">{latest.date}</div>
            </CardContent>
          </Card>
          {trend7d !== null && (
            <Card className="flex-1 border-border">
              <CardContent className="px-4 py-3">
                <div className="text-xs text-muted-foreground">7-Tage-Trend</div>
                <div className={`text-2xl font-bold ${trend7d < 0 ? 'text-green-400' : trend7d > 0 ? 'text-red-400' : ''}`}>
                  {trend7d > 0 ? '+' : ''}{trend7d.toFixed(1)} kg
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Chart */}
      {weights.length >= 2 && (
        <Card className="border-border">
          <CardContent className="px-4 py-3">
            <div className="text-xs text-muted-foreground mb-2">30 Tage</div>
            <SparkLine
              values={weights}
              width={undefined as unknown as number}
              height={48}
              color="var(--primary)"
            />
          </CardContent>
        </Card>
      )}

      {/* Verlauf */}
      {isLoading && <p className="text-muted-foreground text-sm">Lade…</p>}
      <div className="space-y-1.5">
        {entries.slice(0, 14).map(e => (
          <div key={e.id} className="flex justify-between items-center px-1 text-sm">
            <span className="text-muted-foreground">{e.date}</span>
            <span className="font-medium">{parseFloat(e.weightKg).toFixed(1)} kg</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Hinweis zu `SparkLine width`:** Die `SparkLine`-Komponente soll im `GewichtTab` die volle Breite nutzen. Entweder eine `className`-Prop ergänzen oder `width` auf einen festen Wert wie `320` setzen und den Container messen. Einfachste Lösung: `width={320}` mit `overflow-x-auto` falls nötig.

- [ ] **4.6 Backend build + restart**

```bash
cd /root/pulse/backend && npm run build && pm2 restart pulse --update-env
```

- [ ] **4.7 TypeScript-Check**

```bash
cd /root/pulse/frontend && npx tsc --noEmit
```

- [ ] **4.8 Commit + Push**

```bash
git -C /root/pulse add backend/src/db/pulse-schema.ts backend/src/db/migrations/0010_weight_log.sql backend/src/pulse/plugin.ts frontend/src/pulse/api-client.ts frontend/src/pulse/hooks.ts frontend/src/pages/Data.tsx
git -C /root/pulse commit -m "feat: add weight tracking (DB table, API, Gewicht-Tab with chart + trend)"
git -C /root/pulse push
```

---

## Selbst-Review

**Was bewusst NICHT in Phase 4 ist:**

| Feature | Warum verschoben |
|---|---|
| Workout-Matching (planned vs. done) | Komplex, kein direkter Nutzwert solange Plan-Qualität noch neu |
| Körperfett / DEXA | Zu spezialisiert für täglichen Betrieb |
| Google Calendar Sync | Externe Auth-Komplexität, kein Garmin-Äquivalent verfügbar |
| Streaming-Antworten im Coach | Schön-to-have, aber kein Blocker |
| Push-Benachrichtigungen | PWA-Komplexität — Phase 5 |

**Ausführungsreihenfolge:**
1 → 2 → 3 → 4 (jeder Task baut auf dem vorherigen auf, SparkChart wird in Task 2+4 genutzt)

**Qualitäts-Risiken:**
- LLM-Trainingsplan: JSON-Parsing kann fehlschlagen → Fallback auf Templates ist eingebaut
- SparkLine mit `width=undefined`: muss entweder CSS-gesteuert oder mit festem Wert gelöst werden
- Migration: Additive-only (kein DROP, kein NOT NULL ohne DEFAULT) ✓
