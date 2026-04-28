# Phase 7: Race Mode

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
>
> **Voraussetzung:** Phase 6 abgeschlossen — Auto-Phase-Progression nutzt Race-Datum.

**Ziel:** Pulse versteht das Konzept "Wettkampf" — periodisiert automatisch dorthin, prognostiziert eine Zielzeit, liefert Race-Day-Briefing.

1. **Race-Goal-Extension** — Goals der Kategorie `race` bekommen Distanz, Disziplin-Subtyp, Zielzeit
2. **Auto-Taper** — 2 Wochen vor Race fährt Plan-Engine Volumen runter, hält Intensität
3. **Race-Time-Prognose** — Riegel/Daniels-Formel adjustiert mit CTL/VO2max
4. **Race-Day-Briefing** — spezielles Briefing am Race-Tag (Pacing, Fueling, Wetter, Logistik-Reminder)

**Architektur:** Race ist ein Goal mit erweiterten Feldern. Eine "Race-Engine" als Service-Layer berechnet Phase, Prognose, Race-Briefing — `plan-engine.ts` und `briefing-engine.ts` rufen sie auf. Kein neues Modell — Wiederverwendung der Goal-Tabelle.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Aktuelles Verhalten | Problem |
|---|---|
| Goal `race` nur Titel/Datum | Keine Disziplin, keine Distanz, keine Zielzeit |
| Plan-Engine ignoriert Race-Datum | Trainiert in Race-Woche genauso hart wie 8w vorher |
| `trainingPhase` manuell | Tobi muss selbst auf "taper" stellen — vergisst er |
| Kein Race-Day-Briefing | Race-Morgen sieht aus wie jeder andere |
| Keine Pace-Prognose | Tobi weiß nicht, ob Trainings-Pace zur Goal-Pace passt |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Modify | `backend/src/db/pulse-schema.ts` |
| Create | `backend/src/db/migrations/0013_race_fields.sql` |
| Create | `backend/src/pulse/services/race-engine.ts` |
| Modify | `backend/src/pulse/services/plan-engine.ts` |
| Modify | `backend/src/pulse/services/briefing-engine.ts` |
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` |
| Modify | `frontend/src/pages/Plan.tsx` |
| Modify | `frontend/src/pages/Home.tsx` |
| Create | `frontend/src/components/RaceCard.tsx` |
| Modify | `shared/types/pulse.ts` |

---

## Task 1: Race-Felder auf Goals

```sql
ALTER TABLE pulse_goals ADD COLUMN race_discipline TEXT
  CHECK (race_discipline IN ('run','bike','swim','triathlon_sprint','triathlon_olympic','triathlon_70_3','triathlon_140_6','duathlon','other'));
ALTER TABLE pulse_goals ADD COLUMN race_distance_km REAL;
ALTER TABLE pulse_goals ADD COLUMN race_target_time_sec INT;
ALTER TABLE pulse_goals ADD COLUMN race_priority TEXT
  CHECK (race_priority IN ('A','B','C')) DEFAULT 'A';
ALTER TABLE pulse_goals ADD COLUMN race_location TEXT;
ALTER TABLE pulse_goals ADD COLUMN race_notes TEXT;
```

`race_priority`:
- **A** = Saisonhöhepunkt (volle Periodisierung, 2w Taper)
- **B** = wichtig, aber nicht Peak (1w Taper, kein voller Peak-Block)
- **C** = "im Training mitnehmen" (kein Taper)

Drizzle-Schema + `PulseGoal`-Typ in `shared/types/pulse.ts` ergänzen.

---

## Task 2: Race-Engine

`backend/src/pulse/services/race-engine.ts`:

```typescript
export interface RaceContext {
  goalId: string;
  date: string;
  daysUntil: number;
  phase: 'base' | 'build' | 'peak' | 'taper' | 'race_week' | 'race_day' | 'past';
  discipline: string;
  distanceKm: number;
  targetTimeSec: number | null;
  priority: 'A'|'B'|'C';
  predictedTimeSec: number | null;
  predictionConfidence: 'low'|'medium'|'high';
}

export async function getActiveRaces(userId: string, today: string): Promise<RaceContext[]>;

export function predictRaceTime(args: {
  discipline: string;
  distanceKm: number;
  recentEFKgPace: { distanceKm: number; timeSec: number; date: string }[];
  ctl: number;
  vo2max: number | null;
}): { timeSec: number; confidence: 'low'|'medium'|'high' };
```

**Riegel-Formel** als Backbone:

```
T2 = T1 * (D2 / D1) ^ 1.06
```

`T1/D1` = bester ähnlicher Trainings-Lauf der letzten 60d. CTL-Adjust: `T2 *= max(0.95, 1 - (currentCTL - baselineCTL)/200)` — d.h. höhere Fitness = schnellere Prognose, gedeckelt bei -5%.

**Confidence:**
- `high`: ≥3 Trainings auf >50% der Race-Distanz in letzten 30d
- `medium`: 1-2 Trainings, oder Race-Distanz >2× größter Trainings-Distanz
- `low`: keine vergleichbaren Trainings

---

## Task 3: Plan-Engine baut Periodisierung

In `plan-engine.ts` neue Eingabe `races: RaceContext[]`. LLM-Prompt-Block:

```
RACES:
- 2026-06-15 (in 7w) — Triathlon 70.3, Priority A — Volumen reduzieren ab 2026-06-01, Z3-Z4 Race-Pace-Sessions in 4w-3w-Range, Taper ab 2w mit -50% Volumen letzte Woche.
- 2026-05-12 (in 2w) — 10k Run, Priority B — Diese Woche normal, nächste Woche -20% Volumen, Race-Pace-Workout 4-6 Tage vor Race.
```

**Programmatischer Volumen-Cap nach LLM-Output** (analog Health-Constraints aus Phase 6):

```typescript
function applyTaper(workouts: PlannedWorkout[], race: RaceContext): PlannedWorkout[] {
  const w2 = race.daysUntil; // negativ = vorbei
  if (race.priority === 'A' && w2 <= 14 && w2 > 7) return scale(workouts, { vol: 0.75, intensity: 1.0 });
  if (race.priority === 'A' && w2 <= 7  && w2 > 1) return scale(workouts, { vol: 0.50, intensity: 0.9 });
  if (w2 === 1) return openersDay(workouts);   // Race -1: kurzes Z3-Workout
  if (w2 === 0) return raceDay(workouts);
  return workouts;
}
```

---

## Task 4: Race-Day-Briefing

In `briefing-engine.ts` neuer Code-Pfad: wenn heute Race-Tag (`getActiveRaces` enthält race mit `daysUntil === 0`):

**Andere Generierung** als normales Briefing — kein Daten-Dump, sondern:

```
🏁 RACE DAY — Triathlon 70.3 Mainz

Wetter: 19°C bewölkt, Wind 12km/h NW
Start: 07:30, Briefing 06:45

Pacing-Plan:
- Schwimmen 1.9k:  1:50/100m → ca. 35min
- Rad 90k:           Z3 lower bound, NP ~ 220W, Ziel 2:35h
- Lauf 21k:          Erste 10k 5:00/km, danach nach Gefühl

Fueling: 60-90g Carbs/h Rad, 30-60g Lauf, 500ml/h.

Heart-Rate-Cap: 170 (Bike), 175 (Run).
Bei TSB +12 — gut erholt, leicht aggressiv pacen ist okay.

Letzte Erinnerung: Helm, Startnummer, Gels (8), Salztabletten.
```

LLM-Prompt enthält: Race-Daten, aktuelle Form (CTL/TSB), Wetter (Phase 8 — falls noch nicht da, leer lassen), prognostizierte Zeit, Fueling-Defaults aus Distanz, persönliche Logistik-Items (statisch hinterlegt: Helm/Nummer/Gels/Salz für Tri).

---

## Task 5: Race-Card auf Home

`RaceCard.tsx`:

```
┌──────────────────────────────────────┐
│ 🏁 NÄCHSTES RACE                       │
│ Triathlon 70.3 Mainz · Priority A    │
│                                       │
│ in 47 Tagen  |  Phase: BASE → BUILD  │
│                                       │
│ Prognose: 5:18:42 (medium confidence) │
│ Ziel:    5:15:00                     │
└──────────────────────────────────────┘
```

Klick → Plan-Tab mit Race-Detail-Modal (Task 6).

---

## Task 6: Goal/Race-Form-Erweiterung

In `Plan.tsx` Goals-Tab: wenn `category='race'` ausgewählt → zeigt Felder:
- Discipline (dropdown)
- Distance km (input)
- Target time (h:mm:ss)
- Priority A/B/C
- Location
- Notes

Beim Erstellen `category='race'` setzen, Felder validieren.

**Race-Detail-Modal:** zeigt Prognose-Historie (wie sich `predictedTimeSec` über Wochen verändert), Pace-Vergleich mit recent Workouts, Taper-Plan.

---

## Task 7: Phase-Auto-Aktualisierung

`derivePhase()` aus Phase 6 wird erweitert:

```typescript
export async function deriveCurrentPhase(userId: string, today: string): Promise<TrainingPhase> {
  const races = await getActiveRaces(userId, today);
  const aRace = races.find(r => r.priority === 'A' && r.daysUntil >= 0);
  if (!aRace) return 'base';
  return derivePhaseFromDays(aRace.daysUntil);
}
```

Profile-Endpoint `GET /pulse/profile` returned beide:
```ts
{ ftpWatts, maxHrBpm, ..., trainingPhaseManual: 'base'|null, trainingPhaseDerived: 'build' }
```

UI in Settings: Toggle "Phase manuell setzen" (default off → uses derived).

---

## Acceptance

- [ ] Race-Goal mit allen Feldern erstellbar
- [ ] Plan 8w vor A-Race zeigt Build-Phase, 2w vor zeigt Taper
- [ ] Volumen ist messbar reduziert in Taper-Wochen (Tests mit synthetischen Daten)
- [ ] Race-Day Briefing schaltet automatisch um
- [ ] Prognose updatet sich nach jedem matched Workout
- [ ] RaceCard zeigt korrekten Countdown
- [ ] Auto-Phase-Progression respektiert manuelles Override
- [ ] Riegel-Prediction validiert: 5k 22min → 10k Prognose ~ 45:50 (innerhalb ±60s)
