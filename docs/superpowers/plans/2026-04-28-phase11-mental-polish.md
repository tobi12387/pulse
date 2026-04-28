# Phase 11: Mental Themes Timeline & Export

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
>
> **Voraussetzung:** Mindestens 30 Tage Voice-Check-in-Daten für sinnvolle Theme-Aggregation.

**Ziel:** Den letzten weißen Fleck schließen — die mentale Seite langfristig sichtbar machen — und einen sauberen Datenexport für Backup/externe Auswertung bereitstellen.

1. **Theme-Timeline** — Voice-Check-in extrahiert bereits `themes`, aber sie verschwinden im Datengrab
2. **Mental-Trends überlagert mit Trainingsbelastung** — Mood/Stress-Trend mit CTL/TSB-Linie zeigen
3. **CSV-Export** — alle Pulse-Daten sauber exportierbar (Backup, externe Analyse, Doctors-Visit)

**Architektur:** Theme-Aggregation als View/Query (kein neues Persistenz-Layer). Export als Streaming-CSV-Endpoint pro Datentyp. Kein State, keine Hintergrund-Jobs.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Daten in DB | Sichtbarkeit |
|---|---|
| `pulse_mental_checkin.themes` (string[]) | Nirgends visualisiert |
| `pulse_mental_checkin.mood/energy/stress/motivation` | 4-Tage-Sparkline auf Home, sonst nichts |
| `pulse_fitness_load` (CTL/ATL) | Auf Home, aber nie überlagert mit Mental-Daten |
| Daily Metrics, Sleep, Activities, Weight, Goals, Reviews | Backup nur via pg_dump (technisch, nicht user-facing) |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Modify | `backend/src/pulse/plugin.ts` |
| Create | `backend/src/lib/export.ts` |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pages/Data.tsx` |
| Modify | `frontend/src/pages/Settings.tsx` |
| Create | `frontend/src/components/ThemeTimeline.tsx` |
| Create | `frontend/src/components/MentalLoadOverlay.tsx` |

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
  }>;
  totalCheckins: number;
}
```

SQL (Postgres `unnest` auf das `themes`-Array):

```sql
SELECT
  unnest(themes) as theme,
  COUNT(*) as count,
  MIN(date) as first_seen,
  MAX(date) as last_seen
FROM pulse_mental_checkin
WHERE user_id = $1 AND date >= now() - interval '90 days'
GROUP BY theme
ORDER BY count DESC;
```

Themes mit `count = 1` ausfiltern (vermutlich Noise oder Einzelereignis).

---

## Task 2: ThemeTimeline UI

In `Data.tsx` Mental-Tab neue Sektion "Themen":

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
│ rückenschmerz  3×  Resolved 14d        │
│   ▌▌·▌··········  (verblasst)          │
└────────────────────────────────────────┘
```

Klick auf Theme → Modal mit allen Check-ins, in denen das Theme vorkam, mit Notiz-Auszug.

**Auto-Highlight** wenn Theme in den letzten 14d häufiger als in vorherigen 30d → roter Punkt.

---

## Task 3: Mental-Load-Overlay

Neue Card im Mental-Tab oder Insights:

```
┌────────────────────────────────────────┐
│ STIMMUNG vs BELASTUNG  · 8 Wochen      │
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
└────────────────────────────────────────┘
```

Visuell zeigt: korreliert hohe TSB (frisch) mit guter Stimmung? Oder leidet Stimmung wenn ATL hoch?

`SparkLine`-Komponente erweitern auf Multi-Series mit Y-Achsen-Skalierung.

---

## Task 4: Insights-Engine nutzt Themes

`insight-engine.ts` Mental-Domain bekommt zusätzlich Theme-Aggregat als Eingabe. LLM kann dann formulieren:

> „In den letzten 14 Tagen tauchte 'work-stress' 5× auf, 3× zusammen mit Stimmung ≤5. Korrelation mit TSB negativ — bei akuter Müdigkeit (TSB < -10) verstärken sich Stress-Themen. Empfehlung: Mittwoch-Z2 statt Z4 wenn TSB < -10 und work-stress in den letzten 3 Check-ins."

---

## Task 5: CSV-Export

`backend/src/lib/export.ts`:

```typescript
export async function streamCsv(
  reply: FastifyReply,
  rows: AsyncIterable<Record<string, unknown>>,
  columns: string[],
  filename: string
): Promise<void>;
```

**Endpoints:**
- `GET /pulse/export/daily-metrics.csv?from=...&to=...`
- `GET /pulse/export/activities.csv`
- `GET /pulse/export/checkins.csv`
- `GET /pulse/export/workouts.csv`
- `GET /pulse/export/weight.csv`
- `GET /pulse/export/all.zip` — ein Zip mit allen CSV-Files

Streaming via `pg-query-stream` oder cursor-basierter Drizzle-Iteration. Memory-Footprint konstant.

**Spalten konsistent:** ISO-Dates, semicolon-separator (Excel-DE-freundlich) als Option.

---

## Task 6: Settings — Export-UI

Neue Card "Datenexport":

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
│                                         │
│ [ Als ZIP herunterladen ]                │
└────────────────────────────────────────┘
```

Format: ZIP mit ausgewählten CSVs + `README.txt` mit Schema-Beschreibung.

---

## Task 7: Datenschutz-Hinweis

Im Export-UI knapper Hinweis: „Export enthält alle persönlichen Gesundheitsdaten — sicher aufbewahren." Kein technisches Encryption-Setup nötig (Single-User, lokale Maschine).

---

## Acceptance

- [ ] Theme-Aggregation Endpoint liefert korrekte Counts (Test mit 30d synth data)
- [ ] ThemeTimeline rendert >5 Themes ohne Layout-Bruch
- [ ] Mental-Load-Overlay synchronisiert X-Achsen über alle drei Linien
- [ ] CSV-Export aller 5 Datentypen funktioniert (manueller Download-Test)
- [ ] ZIP-Download enthält README + alle CSVs
- [ ] Export-Dateinamen enthalten ISO-Datum
- [ ] Streaming bei 10.000+ Zeilen — kein OOM
- [ ] Insights-Engine Mental nutzt Themes im Prompt
