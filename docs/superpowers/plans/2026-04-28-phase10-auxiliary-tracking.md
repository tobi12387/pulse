# Phase 10: Auxiliary Tracking

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.

**Ziel:** Drei Tracking-Domänen, die *neben* Endurance laufen aber bisher unsichtbar sind. Bewusst spät einsortiert — niedrigerer Tages-Mehrwert als 6–9, aber hilfreich, sobald Kern steht.

1. **Strength-Logger** — Top-Übungen, Sätze, Reps, RPE, e1RM-Trend
2. **Habit-Tracker (light)** — 3–5 tägliche Habits, einfache Streak-Anzeige
3. **Equipment-Mileage** — Kette, Reifen, Bremsbeläge, Schuhe; auto-tally aus Aktivitäten

**Architektur:** Drei separate, voneinander unabhängige Module. Keine Synergie, keine Querverbindung — bewusst flach. Equipment-Auto-Tally aus `pulse_activities` per Cron.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Bereich | Aktuell | Notwendige Mindestlösung |
|---|---|---|
| Strength | Activity-Type `strength` aber kein Detail | Set/Rep/RPE-Logger pro Übung, e1RM-Trend |
| Habits | Streak nur für Check-in/Workout | 3–5 tägliche Habits, manuelles Toggle |
| Equipment | Komplette Lücke | Kette, Reifen, Bremsbeläge, Laufschuhe, Karbon-Räder |
| Aktivitäts-Equipment-Zuordnung | Garmin liefert `gear` per Aktivität | Aktuell nicht persistiert |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `backend/src/db/migrations/0016_strength_habits_equipment.sql` |
| Modify | `backend/src/db/pulse-schema.ts` |
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `backend/src/jobs/garmin-sync.job.ts` |
| Modify | `backend/src/routes/garmin.ts` |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` |
| Modify | `frontend/src/pages/Plan.tsx` |
| Modify | `frontend/src/pages/Data.tsx` |
| Modify | `frontend/src/pages/Settings.tsx` |
| Create | `frontend/src/components/StrengthLogger.tsx` |
| Create | `frontend/src/components/HabitGrid.tsx` |
| Create | `frontend/src/components/EquipmentList.tsx` |

---

## Task 1: Strength-Schema

```sql
CREATE TABLE pulse_strength_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  duration_min INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pulse_strength_set (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES pulse_strength_session(id) ON DELETE CASCADE,
  exercise TEXT NOT NULL,
  set_number INT NOT NULL,
  reps INT NOT NULL,
  weight_kg REAL,
  rpe REAL,                  -- 1-10
  e1rm_kg REAL               -- berechnet (Epley): w * (1 + reps/30)
);
CREATE INDEX idx_strength_session_user_date ON pulse_strength_session(user_id, date);
CREATE INDEX idx_strength_set_session ON pulse_strength_set(session_id);
```

**Top-Lift-Liste** (statisch, frei erweiterbar): Squat, Deadlift, Bench, OHP, Pullup, Lunges, RDL, Hip Thrust, Calf Raise, Plank.

**e1RM** = Epley-Formel = `weight * (1 + reps/30)`. Trend-Chart pro Übung über Zeit.

---

## Task 2: Strength-Logger UI

In `Plan.tsx` neuer Sub-Tab "Kraft" (oder neuer Hauptbereich, je nach Layout-Druck):

```
┌──────────────────────────────────────┐
│ NEUE EINHEIT  · 28.04                 │
│                                       │
│ Übung: [Squat ▼]                      │
│ Sätze:                                │
│   1: 10 reps × 80kg @ RPE 7  [✕]    │
│   2: 8  reps × 90kg @ RPE 8  [✕]    │
│   3: 6  reps × 95kg @ RPE 9  [✕]    │
│   [+ Satz]                            │
│                                       │
│ + Übung hinzufügen                    │
│                                       │
│ [ Speichern ]                         │
└──────────────────────────────────────┘
```

Pro Übung Trend-Card: e1RM-Verlauf 90d.

**Schnell-Eingabe**: nach erstem Satz Buttons "Wiederholen", "+5kg", "+1 Rep".

---

## Task 3: Habit-Schema

```sql
CREATE TABLE pulse_habit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT,
  frequency TEXT CHECK (frequency IN ('daily','weekdays','custom')) DEFAULT 'daily',
  custom_days INT[],          -- 0-6 wenn frequency='custom'
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE pulse_habit_completion (
  habit_id UUID NOT NULL REFERENCES pulse_habit(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (habit_id, date)
);
```

**Standard-Habits** (Tobi kann ändern): "10k Schritte", "Mobility 10min", "1L Wasser pre-noon", "Magnesium", "Blockzeit 8h".

---

## Task 4: HabitGrid UI

In `Data.tsx` neuer Tab "Habits":

```
┌────────────────────────────────────────────┐
│ HABITS  ·  diese Woche                      │
│                                             │
│              Mo  Di  Mi  Do  Fr  Sa  So     │
│ 🚶 10k       ✓   ✓   ·   ✓   ·   —   —    │
│ 🧘 Mobility  ✓   ·   ✓   ·   ✓   —   —    │
│ 💧 Wasser    ✓   ✓   ✓   ✓   ✓   —   —    │
│ 💊 Magnesium ✓   ✓   ✓   ·   ✓   —   —    │
│                                             │
│ Streak:  10k 4 Tage  ·  Wasser 23 Tage     │
└────────────────────────────────────────────┘
```

Tap auf Tag = toggle. Vergangene Tage editierbar.

**Habit-Mgmt**: in Settings → Habits-Card add/rename/archive.

---

## Task 5: Equipment-Schema

```sql
CREATE TABLE pulse_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('chain','tire','brake_pad','cassette','running_shoe','bike','wetsuit','other')),
  parent_equipment_id UUID REFERENCES pulse_equipment(id) ON DELETE SET NULL,    -- z.B. Kette gehört zu Bike
  activity_types TEXT[] NOT NULL,              -- ['bike','run']
  installed_date DATE NOT NULL,
  initial_km REAL DEFAULT 0,                   -- bei Übernahme
  retirement_km REAL,                          -- Soll-Wechsel
  retirement_date DATE,                         -- Soll-Wechsel nach Datum
  retired_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE pulse_equipment_activity (
  equipment_id UUID NOT NULL REFERENCES pulse_equipment(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES pulse_activities(id) ON DELETE CASCADE,
  km_added REAL NOT NULL,
  PRIMARY KEY (equipment_id, activity_id)
);
```

**Strategie zur Aktivitäts-Zuordnung:**
- **Default-Equipment pro `activity_type`** in Settings — z.B. „Standard-Bike" für alle Bike-Aktivitäten ohne explizite Garmin-Gear-Info
- Garmin liefert manchmal `gear` per Aktivität (wenn man's pflegt) → mappen wir auf Pulse-Equipment via Name-Match
- Manuelles Override pro Aktivität in ActivityDetail

**Auto-Tally:** beim Garmin-Sync wird für jede Aktivität die `distanceM` dem zugeordneten Equipment hinzugefügt.

---

## Task 6: EquipmentList UI

In `Settings.tsx` neue Card "Equipment":

```
┌────────────────────────────────────────┐
│ EQUIPMENT                               │
│                                         │
│ 🚴 Standard-Bike       2.840 km        │
│   ↳ Kette (15.10.25)    1.240/3.500   │
│   ↳ Reifen V (10.11.25) 1.890/5.000   │
│   ↳ Reifen H (10.11.25) 1.890/5.000   │
│   ↳ Bremsbeläge VR     [Ersetzen ⚠]   │
│                                         │
│ 👟 Hoka Speedgoat 5    412/700 km      │
│ 👟 Saucony Endorphin   89/600 km       │
│                                         │
│ [+ Equipment]                           │
└────────────────────────────────────────┘
```

Warn-Badge bei >90 % retirement-km.

---

## Task 7: Plan-Engine respektiert Strength

Wenn Strength als Activity-Type generiert wird (Phase 4 Plan-Engine generiert das schon), Beschreibung wird bedeutsamer:

```
Strength · Z1 · 60min
"Lower Body Focus: Squat 4×6 @75% 1RM, RDL 3×10, Lunges 3×8, Calf 3×15"
```

Beim Speichern eines Strength-Workouts kann eine `pulse_strength_session` mit `workout_id` verknüpft werden. Compliance erkennbar: Sets gemacht? Volumen erreicht?

---

## Acceptance

- [ ] Migration läuft additiv durch
- [ ] Strength-Session mit 3 Sätzen speicherbar, e1RM korrekt berechnet
- [ ] e1RM-Trend zeigt 8w-History pro Übung
- [ ] Habit-Grid: Toggle, Streak korrekt nach Definition
- [ ] Equipment automatisch befüllt nach Bike-Aktivität (Default-Bike-Mapping)
- [ ] Replacement-Warning bei >90 % km
- [ ] Plan zeigt Strength-Workouts mit konkreter Übungsliste
