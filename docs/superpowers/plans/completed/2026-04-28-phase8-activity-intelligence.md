# Phase 8: Activity Intelligence

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
>
> **Querschnitt:** [HR-First](2026-04-28-cross-cutting-hr-first.md) — alle Metriken HR-basiert, Power als Zusatzinfo.

**Ziel:** Jede Aktivität soll diagnostisch werden, nicht nur protokollarisch. Heute: ActivityDetail zeigt Laps und HR-Zonen. Künftig zeigt es, *ob die Einheit gut war* — und vergleicht mit deiner Historie.

1. **Aerobic Decoupling (Pa:HR)** — wie stark driftet Pace bei gleicher HR über die Einheit
2. **Efficiency Factor** — Pace/HR als Trend-Metric über Wochen
3. **Vergleich vs. Historie** — diese Z2-Einheit vs. avg der letzten 30d ähnlicher Einheiten
4. **Wetter-Kontext** — outdoor Workouts werden mit Wetter-Daten angereichert (Hitze-Adjust, Wind-Hinweis)

**Architektur:** Eine `activity-analytics.ts`-Lib berechnet alle Kennzahlen aus den vorhandenen Activity-Streams. Wetter via OpenWeather-API (kostenlos, 1000 calls/d), pro-Tag-Cache in Redis. Keine externen Analyse-Services. Streams sind in Garmin-FIT-Files; wir nutzen den bereits vorhandenen Garmin-API-Pfad.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Aktuell | Lücke |
|---|---|
| ActivityDetail zeigt Laps + HR-Zonen | Keine Effizienz-Metric, keine Drift-Analyse |
| Activities haben `avgHr/maxHr/normalizedPowerW` | Aber Streams (sec-by-sec) werden nicht persistiert/genutzt |
| Z2-Einheit heute vs. letzte Woche | Kein Vergleich, alles isoliert |
| Outdoor Workouts | Plan und Briefing kennen kein Wetter |
| Briefing erwähnt Belastung allgemein | Aber nicht „heute 32°C → Z2 reduzieren" |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `backend/src/lib/activity-analytics.ts` |
| Create | `backend/src/lib/weather.ts` |
| Create | `backend/src/db/migrations/0014_activity_analytics.sql` |
| Modify | `backend/src/db/pulse-schema.ts` |
| Modify | `backend/src/routes/garmin.ts` |
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `backend/src/pulse/services/briefing-engine.ts` |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` |
| Modify | `frontend/src/pages/ActivityDetail.tsx` |
| Modify | `frontend/src/pages/Plan.tsx` |
| Modify | `frontend/src/pages/Home.tsx` |

---

## Task 1: Activity-Streams persistieren

Garmin Activities API liefert pro Aktivität Streams (HR, pace, power, alt, time). Aktuell werden sie zur Lap-Aggregation genutzt aber nicht gespeichert. Für Decoupling/EF brauchen wir sie.

```sql
CREATE TABLE pulse_activity_streams (
  activity_id UUID PRIMARY KEY REFERENCES pulse_activities(id) ON DELETE CASCADE,
  duration_sec INT NOT NULL,
  hr_stream INT[] NOT NULL,           -- 1Hz
  pace_stream REAL[],                 -- min/km, NULL für Bike
  speed_stream REAL[],                -- m/s
  power_stream INT[],                 -- W, NULL wenn nicht gemessen
  altitude_stream INT[],              -- m
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Beim Garmin-Aktivitäts-Sync zusätzlich `/activity-service/activity/{id}/details` aufrufen und Streams speichern. Auf Streams-Tabelle <50 KB pro Aktivität — vertretbar.

---

## Task 2: Activity-Analytics-Lib

`backend/src/lib/activity-analytics.ts`:

```typescript
export interface AerobicDecoupling {
  firstHalfRatio: number;   // Pace_per_HR der ersten Hälfte
  secondHalfRatio: number;
  decouplingPct: number;    // (second - first) / first * 100
  rating: 'excellent' | 'good' | 'fair' | 'poor';   // <3% / <5% / <7% / >=7%
}

export interface EfficiencyFactor {
  ef: number;                // pace_per_hr für Run, NP/HR für Bike
  unit: 'min/km/bpm' | 'W/bpm';
  vsAvg30d: number | null;   // delta% vs 30d-Schnitt ähnlicher Workouts
}

export function computeDecouplingPaHR(args: {
  hrStream: number[];
  paceStream: number[];     // sec/km
  warmupSec: number;        // erste 10min weglassen
}): AerobicDecoupling;

export function computeEfRun(args: { hrStream: number[]; paceStream: number[] }): { ef: number };

export function computeEfBike(args: { hrStream: number[]; powerStream: number[] | null; speedStream: number[] }): { ef: number };
```

**Decoupling-Algorithmus:**
1. Skip erste 10 min (Warmup) und letzte 60 s (Cooldown).
2. Smoothe HR und Pace mit 30s-Mittelwert.
3. Erste Hälfte: avg(pace) / avg(hr). Zweite Hälfte: dito.
4. `decouplingPct = (second - first) / first * 100`.

**Decoupling-Schwellen** (für Z2-Endurance):
- < 3 % = ausgezeichnet (aerobe Basis stabil)
- 3–5 % = gut
- 5–7 % = grenzwertig (Hitze, schlechte Form, Glykogen?)
- > 7 % = schwach (Müdigkeit, Dehydrierung, zu hart gefahren)

---

## Task 3: Backend-Endpoint für Analytics

`GET /pulse/activities/:id/analytics`:

```typescript
{
  decoupling: AerobicDecoupling | null;   // null wenn Aktivität < 30min
  ef: EfficiencyFactor | null;
  zoneTime: { zone: 1|2|3|4|5; secs: number; pct: number }[];
  drift: {
    hrDriftBpm: number;     // letzte 30min HR - erste 30min HR (bei vergleichbarer Pace)
  } | null;
  comparable: {
    countLast30d: number;
    avgEf: number | null;
    avgDecouplingPct: number | null;
  };
  weather?: WeatherSnapshot;
}
```

Endpoint cached in Redis nach erstem Compute (Aktivität ändert sich nicht).

---

## Task 4: Vergleich mit historischen Workouts

Definition „ähnlich":
- Gleicher `activityType`
- Gleiche Primary-Zone (avg HR fällt in gleiche Z1–Z5-Range)
- Dauer ±25 %

```typescript
async function findComparable(userId: string, activity: PulseActivity, n = 10): Promise<PulseActivity[]>;
```

Frontend zeigt: "Heute EF 1.45 / 30d-Schnitt 1.42 → +2.1 %".

---

## Task 5: Wetter-Lib

`backend/src/lib/weather.ts`:

```typescript
export interface WeatherSnapshot {
  date: string;
  tempC: number;
  feelsC: number;
  humidityPct: number;
  windKmh: number;
  windDir: number;          // grad
  precipMm: number;
  conditions: string;       // 'clear', 'rain', 'snow', ...
  sunriseTime: string;
  sunsetTime: string;
}

export async function getWeather(args: { date: string; latitude: number; longitude: number }): Promise<WeatherSnapshot>;
export async function getForecast(args: { latitude: number; longitude: number; days: number }): Promise<WeatherSnapshot[]>;
```

OpenWeather One-Call API. Coordinates aus User-Profile (neues Feld `home_lat`/`home_lon` in `pulse_user_profile`).

Cache: `weather:{date}:{lat},{lon}` in Redis, TTL 6h für Forecast, persistent für Past.

---

## Task 6: Wetter-Integration in Aktivitäten und Briefing

**In `pulse_activities`** neues Feld `weather JSONB` — gefüllt beim Sync, falls Aktivität outdoor (heuristisch: hat altitude_stream variation > 5m oder location-data).

**Hitze-Penalty in Compliance-Score (Phase 5 retrofit):**

```typescript
function adjustHeatExpectation(plannedZone: number, weather: WeatherSnapshot | null): { hrCapAdjustment: number } {
  if (!weather) return { hrCapAdjustment: 0 };
  if (weather.feelsC > 28) return { hrCapAdjustment: +5 };  // bis +5 bpm in Soll-Range akzeptieren
  if (weather.feelsC > 32) return { hrCapAdjustment: +8 };
  return { hrCapAdjustment: 0 };
}
```

**Briefing erweitern:**

```
Heute Outdoor-Bike geplant (Z2 138-148bpm). 
Wetter: 31°C / Hitze gefühlt 34°C, Wind 12 km/h aus W.
→ HR-Drift normal in Hitze. Wenn HR-Cap (148) zu früh erreicht: Pace reduzieren statt anhalten.
→ 800 ml/h trinken, Salztabletten erwägen.
```

---

## Task 7: Frontend — ActivityDetail-Erweiterung

Neue Cards in `ActivityDetail.tsx`:

```
┌────────────────────────────────────────┐
│ AEROBIC DECOUPLING                      │
│                                         │
│ Pa:HR-Drift  +2.4 %    [████░░] gut    │
│                                         │
│ 1. Hälfte: Pace 5:12/km  HR 142 bpm    │
│ 2. Hälfte: Pace 5:18/km  HR 144 bpm    │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ EFFICIENCY FACTOR                       │
│                                         │
│ EF heute     1.47 min/km·bpm   ↗ +3.2% │
│ 30d-Schnitt  1.42                       │
│ Trend (8w)   [Sparkline]                │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ WETTER                                  │
│ 28°C / gefühlt 30°C / Wind 15 km/h W  │
│ → HR-Cap automatisch +5 bpm akzeptiert │
└────────────────────────────────────────┘
```

---

## Task 8: Frontend — WeatherCard für nächsten Workout

Auf Plan-Tab Workout-Row der nächsten 1–2 outdoor Trainings: kleine Wetter-Pille.

```
| Mi 30.04  Bike Z2 90min  · Outdoor  · ⛅ 24°C / 8 km/h |
```

Klick öffnet Modal mit Forecast + Heat-Adjust-Empfehlung.

---

## Acceptance

- [ ] Activity-Streams werden nach Garmin-Sync gespeichert (Stichprobe 1 Aktivität)
- [ ] Decoupling-Berechnung: synthetische Daten (gleichbleibende HR + Pace) → < 1 % drift
- [ ] EF historisch korrekt: bekannte Z2-Einheit aus Strava-Export validiert
- [ ] Wetter-API Integration funktioniert, Daten landen auf 1 outdoor Aktivität
- [ ] Briefing zeigt Wetter-Hinweis bei nächstem outdoor Workout
- [ ] ActivityDetail zeigt 3 neue Cards (Decoupling, EF, Weather)
- [ ] Vergleich vs. 30d-Schnitt funktioniert auch wenn nur 2 vergleichbare Workouts da
- [ ] OpenWeather-API-Key in `.env`, mit Fallback wenn missing
