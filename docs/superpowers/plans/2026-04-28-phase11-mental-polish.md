# Phase 11: Mental Themes Timeline & Data Export

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
>
> **Voraussetzung:** [Bündel A — Context Unification](2026-04-29-bundle-a-context-unification.md), [Bündel C — Endpoint & Page Consolidation](2026-04-29-bundle-c-endpoint-page-consolidation.md). Mindestens 30 Tage Voice-Check-in-Daten für sinnvolle Theme-Aggregation.
>
> **Hinweis Re-Evaluation 2026-04-29:** Bündel C definiert klare Page-Aufgaben (Home / Data / Plan / Insights / Coach). Original-Plan war unentschieden, wo Theme-Timeline und Mental-Load-Overlay landen sollen. Diese Revision **legt fest**: Theme-Timeline = Data/Mental-Tab (strukturierte Daten), Mental-Load-Overlay = Insights (Narrativ + Multi-Series-Chart). Außerdem nutzt Insights-Engine Mental-Domain den `PulseContext` aus Bündel A — was die Phase deutlich kürzer macht, weil der ganze Context-Aufbau wegfällt.

**Ziel:** Den letzten weißen Fleck schließen — die mentale Seite langfristig sichtbar machen — und einen sauberen Datenexport für Backup/externe Auswertung bereitstellen.

1. **Theme-Timeline** — Voice-Check-in extrahiert bereits `themes`, aber sie verschwinden im Datengrab. Neue Section im Data/Mental-Tab.
2. **Mental-Load-Overlay** — Mood/Stress-Trend mit CTL/TSB-Linie; **gehört nach Insights**, nicht auf Data (Bündel-C-Abgrenzung).
3. **Insights-Engine Mental-Domain wird Theme-aware** — nutzt PulseContext aus Bündel A.
4. **CSV-Export** — alle Pulse-Daten exportierbar (Backup, externe Analyse, Doctor's-Visit).

**Architektur:** Theme-Aggregation als reine Postgres-Query (kein neues Persistenz-Layer). Mental-Load-Overlay als Multi-Series-`SparkLine`-Erweiterung. Export als Streaming-CSV-Endpoint pro Datentyp + ZIP-Bündler. Kein State, keine Hintergrund-Jobs.

**Repo root:** `/root/pulse`

---

## Re-Evaluation: was sich durch frühere Pläne ändert

| Frage | Original-Plan | Revidiert |
|---|---|---|
| Wo Theme-Timeline anzeigen? | „Mental-Tab oder Insights" | **Data/Mental-Tab** — strukturierte Daten gehören nach Bündel C dorthin |
| Wo Mental-Load-Overlay? | „Mental-Tab oder Insights" | **Insights** — Multi-Series-Chart + KI-Narrativ |
| Insights-Engine: Mental-Domain | Hardcoded SQL für Mental-Aggregat | **Nutzt PulseContext** aus Bündel A — checkins14d kommt schon mit |
| Doppel-Berechnung mit Risk-Engine | Original: nicht thematisiert | Risk-Engine `mental_negative_streak` ist *prescriptive* (was tun?), Phase 11 ist *descriptive* (was passiert gerade?). Klare Trennung |
| Threshold-Färbung mood/energy/stress | Hardcoded | Soll `bucketize` mit Bündel-B-Buckets nutzen — Konsistenz mit RPE-Skala |

---

## Kritische Voranalyse

| Daten in DB | Sichtbarkeit aktuell | Nach Phase 11 |
|---|---|---|
| `pulse_mental_checkins.themes` (string[]) | Nirgends visualisiert | ThemeTimeline Data/Mental-Tab |
| `pulse_mental_checkins.mood/energy/stress/motivation` | 4-Tage-Sparkline auf Home | + Multi-Series-Overlay in Insights |
| `pulse_fitness_load` (CTL/ATL/TSB) | Home + Plan/Analyse (Bündel C) | + überlagert mit Mental-Daten in Insights |
| Daily Metrics, Sleep, Activities, Weight, Goals, Reviews | Backup nur via pg_dump | CSV-Export pro Datentyp + ZIP-Gesamt-Bundle |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Modify | `backend/src/pulse/plugin.ts` (Theme-Endpoint, Mental-Load-Endpoint, Export-Endpoints) |
| Create | `backend/src/lib/export.ts` |
| Modify | `backend/src/pulse/services/insight-engine.ts` (Mental-Domain Theme-aware) |
| Modify | `backend/src/pulse/lib/pulse-context.ts` (optional: `mentalThemesRecent`) |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` |
| Modify | `frontend/src/pages/Data.tsx` (Mental-Tab erweitert) |
| Modify | `frontend/src/pages/Insights.tsx` (Mental-Load-Overlay-Card) |
| Modify | `frontend/src/pages/Settings.tsx` (Export-Card) |
| Create | `frontend/src/components/ThemeTimeline.tsx` |
| Create | `frontend/src/components/MentalLoadOverlay.tsx` |
| Modify | `frontend/src/components/SparkChart.tsx` (Multi-Series-Erweiterung) |

---

## Task 1: Theme-Aggregation-Endpoint

`GET /pulse/mental/themes?days=90`:

```typescript
{
  themes: Array<{
    theme: string;
    count: number;
    firstSeen: string;
    lastSeen: string;
    weeklyFrequency: Array<{ weekStart: string; count: number }>;
    isResurfacing: boolean;     // letzte 14d > 30d-davor
    isResolved: boolean;        // nicht in den letzten 14d, aber davor häufig
  }>;
  totalCheckins: number;
}
```

SQL via `unnest` auf `pulse_mental_checkins.themes`:

```sql
WITH t AS (
  SELECT unnest(themes) AS theme, date
  FROM pulse_mental_checkins
  WHERE user_id = $1 AND date >= now() - interval '90 days'
)
SELECT theme, COUNT(*), MIN(date) AS first_seen, MAX(date) AS last_seen
FROM t GROUP BY theme HAVING COUNT(*) >= 2
ORDER BY COUNT(*) DESC;
```

Themes mit `count = 1` ausfiltern (Noise / Einzelereignis). `weeklyFrequency` als Sub-Query oder im Application-Layer gruppieren.

**Resurfacing-Heuristik:**
```
count(letzte 14d) / 14  >  count(15-44d davor) / 30 * 1.5
```
→ Theme tritt aktuell ≥1.5× häufiger auf als historisch.

**Resolved-Heuristik:** kein Vorkommen in den letzten 14d, aber ≥3× in den 30d davor.

---

## Task 2: ThemeTimeline UI (Data/Mental-Tab)

In `Data.tsx` Mental-Tab neue Section „Themen":

```
┌────────────────────────────────────────┐
│ THEMEN  · letzte 90 Tage                │
│                                         │
│ work-stress    8×  letzte 14d ●        │
│   ▌▌▌··▌··▌·▌··  (Bar pro Woche)      │
│                                         │
│ schlaf-mangel  6×  letzte 7d ●●        │
│   ····▌·▌··▌▌·▌                        │
│                                         │
│ training-spaß  5×  letzte 30d           │
│   ▌··▌······▌··                        │
│                                         │
│ rückenschmerz  3×  resolved 14d        │
│   ▌▌·▌··········  (verblasst)          │
└────────────────────────────────────────┘
```

Klick auf Theme → Modal mit allen Check-ins, in denen das Theme vorkam, mit Notiz-Auszug.

**Auto-Highlight** wenn `isResurfacing` → roter Punkt rechts neben dem Label. **Verblassen** wenn `isResolved`.

---

## Task 3: Mental-Load-Overlay (Insights, NICHT Data)

Bündel C ordnet zu: **Insights = KI-Narrativ + Multi-Series-Visualisierung**. Mental-Load-Overlay landet als neue Card im Insights-Bereich:

```
┌────────────────────────────────────────┐
│ 🧠 STIMMUNG vs BELASTUNG · 8 Wochen    │
│                                         │
│  10 ┤ ╱╲    ╱─╲                        │
│   8 ┤╱  ╲──╱   ╲╱╲   ── Stimmung       │
│   6 ┤    ╲      ╲ ╲                    │
│                                         │
│  60 ┤        ╱──────                    │
│  40 ┤───────╯       ── CTL              │
│                                         │
│  +5 ┤  ╲╱╲╱   ╱─                       │
│  -10┤      ╲─╯       ── TSB             │
│                                         │
│ KI-Analyse:                             │
│ Stimmung korreliert seit 6 Wochen       │
│ negativ mit ATL (r=-0.42). Bei TSB<-10  │
│ erscheinen 'work-stress' Themes 2.3×    │
│ häufiger.                                │
└────────────────────────────────────────┘
```

`SparkLine` → `MultiSparkLine` mit getrennten Y-Skalen. X-Achse synchronisiert.

---

## Task 4: Insights-Engine Mental-Domain Theme-aware

`insight-engine.ts` Mental-Domain bekommt zusätzlich Theme-Aggregat als Input — und nutzt `PulseContext` aus Bündel A statt eigener SQL-Fetches:

```typescript
async function mentalContext(ctx: PulseContext, days: number) {
  const themes = await aggregateThemes(ctx.userId, days);
  return {
    checkins: ctx.checkins14d,            // schon im Context
    themes:   themes.themes.slice(0, 10), // top 10
    fitnessLoad: ctx.fitnessLoad,         // schon im Context — für Korrelation
  };
}
```

LLM-Prompt erweitert:

> „In den letzten 14 Tagen tauchte 'work-stress' 5× auf, 3× zusammen mit Stimmung ≤ 5/10. Die Korrelation mit TSB ist negativ — bei akuter Müdigkeit (TSB < −10) verstärken sich Stress-Themen. Empfehlung: Mittwochs-Z2 statt Z4, wenn TSB < −10 und 'work-stress' in den letzten 3 Check-ins."

**Abgrenzung zu Risk Watch:** Risk-Engine `mental_negative_streak` ist eine *Schwellwert-Regel mit Aktion* (warn/info, Snooze, im Briefing direkt). Insights-Engine Mental-Domain ist eine *narrative LLM-Analyse über 14–90 Tage*. Beide verwenden dieselben Daten, aber unterschiedliche Sicht.

---

## Task 5: Multi-Series-SparkChart-Erweiterung

`frontend/src/components/SparkChart.tsx`:

```typescript
export interface SparkSeries {
  values: (number | null)[];
  label: string;
  color: string;
  yAxis?: 'primary' | 'secondary' | 'tertiary';
}

export function MultiSparkLine({
  series,
  width,
  height,
  yAxes,           // { primary: [min, max], secondary: [min, max], ... }
}: {
  series: SparkSeries[];
  width: number;
  height: number;
  yAxes: Record<'primary' | 'secondary' | 'tertiary', [number, number]>;
}): JSX.Element;
```

Jede Serie wird in ihre eigene Y-Skala normalisiert. SVG-Stack identisch zur bestehenden `SparkLine`, nur mehrfach gerendert.

---

## Task 6: CSV-Export-Lib

`backend/src/lib/export.ts`:

```typescript
import type { FastifyReply } from 'fastify';

export async function streamCsv<T>(
  reply: FastifyReply,
  rows: AsyncIterable<T>,
  columns: Array<{ key: keyof T & string; label: string }>,
  filename: string,
): Promise<void>;

export async function streamZip(
  reply: FastifyReply,
  files: Array<{ filename: string; content: AsyncIterable<string> }>,
  zipFilename: string,
): Promise<void>;
```

Format: ISO-Datum, semicolon-separator (Excel-DE-freundlich) als Default. UTF-8 mit BOM.

---

## Task 7: Export-Endpoints

```
GET /pulse/export/daily-metrics.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /pulse/export/activities.csv
GET /pulse/export/checkins.csv
GET /pulse/export/workouts.csv
GET /pulse/export/weight.csv
GET /pulse/export/strength.csv          // Phase 10 — falls implementiert
GET /pulse/export/all.zip               // ZIP mit allen CSVs + README.txt
```

Streaming via `pg-query-stream` oder cursor-basierter Drizzle-Iteration. Memory-Footprint konstant. Auth: `app.authenticate`.

---

## Task 8: Settings — Export-UI

```
┌────────────────────────────────────────┐
│ DATENEXPORT                             │
│                                         │
│ Zeitraum: [letzte 12 Monate ▼]          │
│                                         │
│ ☑ Tagesmetriken                         │
│ ☑ Aktivitäten                           │
│ ☑ Mental Check-ins                      │
│ ☑ Geplante Workouts                     │
│ ☑ Gewicht                               │
│ ☑ Strength-Sessions  (falls Phase 10)   │
│                                         │
│ [ Als ZIP herunterladen ]                │
└────────────────────────────────────────┘
```

ZIP enthält ausgewählte CSVs + `README.txt` mit Schema-Beschreibung.

**Datenschutz-Hinweis** im Export-UI: „Export enthält alle persönlichen Gesundheitsdaten — sicher aufbewahren." Kein technisches Encryption-Setup nötig (Single-User, lokale Maschine).

---

## Task 9: Tests

- `pulse-mental.test.ts`: Theme-Aggregation Counts korrekt, Resurfacing/Resolved-Heuristik, count=1 ausgefiltert.
- `export.test.ts`: CSV-Streaming idempotent, ZIP enthält erwartete Files, Memory-Usage konstant bei 10.000+ Zeilen.
- `insight-engine.test.ts`: Mental-Domain-Prompt enthält Top-Themes und CTL/TSB-Werte.
- `MultiSparkLine.test.tsx`: 3 Serien rendern korrekt mit getrennten Y-Skalen.

---

## Acceptance

- [ ] Theme-Aggregation-Endpoint liefert korrekte Counts (Test mit 30d synth data)
- [ ] ThemeTimeline rendert ≥5 Themes ohne Layout-Bruch (Data/Mental-Tab)
- [ ] Resurfacing-Marker funktioniert (Theme das sich kürzlich häuft)
- [ ] Mental-Load-Overlay synchronisiert X-Achse über alle drei Linien (Insights)
- [ ] Insights-Engine Mental-Domain nutzt `PulseContext` aus Bündel A
- [ ] LLM-Prompt enthält Top-Themes und CTL/TSB-Korrelation
- [ ] Klare Abgrenzung zu Risk-Engine `mental_negative_streak` dokumentiert (descriptive vs prescriptive)
- [ ] CSV-Export aller Datentypen funktioniert (manueller Download-Test)
- [ ] ZIP-Download enthält README + alle CSVs
- [ ] Streaming bei 10.000+ Zeilen — kein OOM
- [ ] Multi-Series-SparkLine wird auch von anderen Cards wiederverwendet (z.B. zukünftige Plan/Analyse-Volumen-Trends)
