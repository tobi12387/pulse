# Bündel C — Endpoint- und Page-Konsolidierung

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
>
> **Status:** Sinnvoll **nach** Bündel A (Context-Builder existiert) — kann parallel zu Bündel B laufen. Greift in Frontend-Layout ein, daher zuletzt.

**Ziel:** Doppelte Berechnungen auf dem Backend und überlappende UI-Inhalte im Frontend reduzieren. Heute rufen `/pulse/home` und `/pulse/coach` beide `computeFitnessLoad` (60-Tage-Activity-Scan) und `computeReadinessScore` jeden Request neu auf, ohne Cache. `Home`, `Data` und `Insights` zeigen drei verschiedene Sichten auf teils dieselben Daten — Tobi muss raten, welche Seite welche Frage beantwortet.

1. **Eigener `/pulse/readiness`-Endpoint** mit Redis-Cache (5 min TTL) — Single Endpoint für Score, Components, Bucket.
2. **Eigener `/pulse/load`-Endpoint** mit Redis-Cache (15 min TTL) — Single Endpoint für CTL/ATL/TSB-Snapshot.
3. **Page-Aufgaben klären**: Home = „heute & morgen", Data = „History/Trends/Edit", Plan = „Trainings & Wettkämpfe", Insights = „KI-Analyse", Coach = „Konversation".
4. **`Plan/Analyse-Tab` auflösen** — entweder in `Insights` einbetten oder zu reinem Volumen/Polarisierungs-Stat-Block umbauen.
5. **Daten-Page-Refactor**: kein Readiness-Score mehr (kommt aus Home-Layer), Fokus auf Trends + Edit.

**Architektur:** Cache-Schicht in `backend/src/pulse/lib/pulse-cache.ts` als dünner Wrapper um Redis. Cache-Key-Format: `pulse:{userId}:{kind}:{date}`. Invalidation: nach Garmin-Sync (key löschen für `userId`). Frontend bekommt zwei neue TanStack-Query-Hooks (`useReadiness`, `useFitnessLoad`); `usePulseHome` wird schmaler. Kein neuer State-Manager, kein Redux.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Aktuell | Lücke |
|---|---|
| `/pulse/home` ruft `computeFitnessLoad` (60d Activities-Scan) | Bei jedem Request — kein Cache |
| `/pulse/coach` ruft *erneut* `computeFitnessLoad` | Doppelarbeit, unterschiedliche Latenz pro Tab-Switch |
| `Home.tsx` und `Data.tsx` zeigen Readiness-Score | Beide via `usePulseHome`, also via /pulse/home — Data wartet unnötig auf Home-Daten |
| `Data.tsx` Tabs: Schlaf, Metriken, Gewicht, Mental | Zeigt teils Inhalte die auf Home schon stehen (Schlafstunden, Body-Battery) |
| `Plan.tsx` hat einen `analyse`-Tab | Inhaltlich überlappt mit `Insights.tsx` (auch dort: Domain `load`) |
| `Insights.tsx` ist eigene Top-Level-Page (Route `/insights`) | Aber im dokumentierten Hauptnav-Konzept nicht sauber eingeordnet — Drift |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `backend/src/pulse/lib/pulse-cache.ts` |
| Create | `backend/src/pulse/lib/pulse-cache.test.ts` |
| Modify | `backend/src/pulse/plugin.ts` (`/readiness`, `/load` Endpoints + Cache-Hits in `/home` und `/coach`) |
| Modify | `backend/src/jobs/garmin-sync.job.ts` (Cache-Invalidation nach Sync) |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` (`useReadiness`, `useFitnessLoad`) |
| Modify | `frontend/src/pages/Home.tsx` (slimmed via Hooks) |
| Modify | `frontend/src/pages/Data.tsx` (Readiness raus, Trend-Fokus) |
| Modify | `frontend/src/pages/Plan.tsx` (analyse-Tab Entscheidung) |
| Modify | `frontend/src/pages/Insights.tsx` (ggf. erweitert) |
| Modify | `AGENTS.md` Navigation-Tabelle (Insights-Status klären) |

---

## Task 1: Pulse-Cache-Lib

`backend/src/pulse/lib/pulse-cache.ts`:

```typescript
import { redis } from '../../lib/redis.js';

export type PulseCacheKind =
  | 'readiness'
  | 'fitness-load'
  | 'context';   // für Bündel-A-Builder

const TTL: Record<PulseCacheKind, number> = {
  'readiness':    5  * 60,
  'fitness-load': 15 * 60,
  'context':      5  * 60,
};

export function cacheKey(kind: PulseCacheKind, userId: string, date: string): string {
  return `pulse:${userId}:${kind}:${date}`;
}

export async function getCached<T>(kind: PulseCacheKind, userId: string, date: string): Promise<T | null>;
export async function setCached<T>(kind: PulseCacheKind, userId: string, date: string, value: T): Promise<void>;
export async function invalidateUser(userId: string): Promise<number>;   // SCAN+DEL alle Keys eines Users
```

Reines JSON.stringify/parse. SCAN-pattern `pulse:{userId}:*`.

---

## Task 2: `/pulse/readiness`-Endpoint

```typescript
GET /pulse/readiness
→ {
    date: string;
    score: number;
    label: string;
    shortLabel: string;     // aus Bucket (Bündel B)
    color: ColorToken;
    components: { sleep, hrv, tsb, battery, mental, stress };
    cached: boolean;
  }
```

Implementation:

```typescript
const cached = await getCached<ReadinessResponse>('readiness', userId, today);
if (cached) return { ...cached, cached: true };

const ctx = await buildPulseContextFor(userId, today);
const response = { ...ctx.readiness, date: today, cached: false };
await setCached('readiness', userId, today, response);
return response;
```

`/pulse/load` analog mit TTL 15 min.

`/pulse/home` und `/pulse/coach` benutzen ebenfalls `getCached`/`setCached` für `kind: 'context'` mit dem vollen Builder-Output — `/pulse/home` und `/pulse/coach` lesen denselben Cache.

---

## Task 3: Cache-Invalidation

In `garmin-sync.job.ts` nach erfolgreichem Sync:

```typescript
import { invalidateUser } from '../pulse/lib/pulse-cache.js';
// nach syncGarminDay/Activities:
await invalidateUser(userId);
```

Auch in `routes/checkin.ts` nach erfolgreichem Mental-Check-in (weil Readiness sich ändert).

Auch in `plugin.ts` nach Workout-Completion / Health-State-Erstellung.

---

## Task 4: Frontend Hooks

`frontend/src/pulse/hooks.ts`:

```typescript
export function useReadiness() {
  return useQuery({
    queryKey: pulseKeys.readiness,
    queryFn: () => pulseApi.readiness(),
    staleTime: 5 * 60_000,
  });
}

export function useFitnessLoad() {
  return useQuery({
    queryKey: pulseKeys.load,
    queryFn: () => pulseApi.fitnessLoad(),
    staleTime: 10 * 60_000,
  });
}
```

`usePulseHome` bleibt bestehen, liefert aber Reduced-Set (Activities, NextWorkout, Streaks, DataStatus) — Readiness/FitnessLoad werden separat geholt. So profitieren beide Hooks vom Cache und Tab-Switches sind sofort.

---

## Task 5: Home-Page schlanker

`Home.tsx`: ersetzt `data.readiness` durch `useReadiness()` und `data.fitnessLoad` durch `useFitnessLoad()`. `usePulseHome` liefert nur noch Activities/NextWorkout/Recovery/Streaks/DataStatus.

Loading-States entkoppelt — Readiness-Card erscheint sobald `useReadiness` lädt, Form-Card sobald `useFitnessLoad` lädt.

---

## Task 6: Data-Page-Refactor

`Data.tsx`:

- **Raus:** Readiness-Header-Card (siehe Home).
- **Bleibt:** Schlaf-Tab (Trend-Charts + 14-Tage-Liste), Metriken-Tab (HRV/RHR-Trends), Gewicht-Tab (Body-Comp + Edit), Mental-Tab (Voice-Check-in-History).
- **Neuer Tab `Recovery`** (optional): Sleep-Debt-Trend, HRV-Deviation, RHR-Drift — Daten kommen aus `recovery-metrics.computeRecovery`. Heute liegen die Werte in `usePulseHome`-Antwort, aber ohne dedizierte Visualisierung.

Nav-Buttons in Data-Tabbar bleiben gleich Anzahl, nur Inhalts-Profil ändert sich.

---

## Task 7: Plan/Analyse-Tab — Entscheidung

Audit `Plan.tsx`-Analyse-Tab-Inhalt:

```bash
grep -A 30 "'analyse'" frontend/src/pages/Plan.tsx
```

Drei Optionen:

**Option I — Plan/Analyse löschen, Inhalte in Insights moved:** sauber, aber Insights wächst. Insights muss dann in der Hauptnavigation dokumentiert sein.

**Option II — Plan/Analyse umbauen zu reinem Volumen/Polarisierung:**
- Wochenvolumen pro Sportart
- Polarisierungs-Index (Z1/Z2 vs Z3/Z4/Z5)
- Sport-Verteilung
- Räumlich klar getrennt von Insights (KI-Narrativ).

**Option III — Status quo lassen, in Insights nur die Domains belassen, die Plan/Analyse nicht abdeckt.**

Empfehlung: **Option II**. Plan/Analyse wird zur reinen Trainings-Statistik-Seite, Insights bleibt KI-Narrativ.

---

## Task 8: Insights als sichtbarer Top-Level-Tab oder Schnellzugriff

`AGENTS.md` dokumentiert die Hauptnavigation. Insights-Page existiert im Code (`/insights`) und muss dort als Tab oder Home-Schnellzugriff konsistent abgebildet bleiben.

Zwei saubere Wege:
- Insights als 6. Tab — verändert Bottom-Nav-Layout.
- Insights als Quick-Action in Home (z.B. „KI-Analyse" Button).

Empfehlung: **Quick-Action in Home unten**, weil 6. Tab-Bar zu breit auf Mobile.

---

## Task 9: Tests

`pulse-cache.test.ts`:
- `setCached` + `getCached` round-trip
- TTL wird gesetzt
- `invalidateUser` löscht alle Keys eines Users, andere bleiben

`plugin.test.ts`:
- `/pulse/readiness` second call within TTL → `cached: true`
- `/pulse/readiness` after `invalidateUser` → `cached: false`

Frontend: keine neuen Tests, da Hooks dünn sind.

---

## Acceptance

- [ ] `pulse-cache.ts` mit get/set/invalidateUser, alle Keys gehen über `cacheKey()`
- [ ] `/pulse/readiness` und `/pulse/load` funktionieren mit Cache (Header `cached: true|false`)
- [ ] Cache wird nach Garmin-Sync, Check-in, Workout-Completion invalidiert
- [ ] `useReadiness` und `useFitnessLoad` als eigene Hooks; Home benutzt sie
- [ ] Tab-Switch Home ↔ Coach ↔ Data ist spürbar schneller (Cache-Hit auf 2./3. Page)
- [ ] Data-Page: kein Readiness-Header mehr, neuer Recovery-Tab (oder dokumentiert warum nicht)
- [ ] Plan/Analyse-Tab: entweder gelöscht (Inhalte in Insights) oder zu Volumen/Polarisierung-Block umgebaut — entscheidung dokumentiert
- [ ] Insights-Zugang von Home aus möglich (Quick-Action) **oder** als 6. Tab dokumentiert in `AGENTS.md`
- [ ] `AGENTS.md` Navigation-Tabelle aktualisiert
