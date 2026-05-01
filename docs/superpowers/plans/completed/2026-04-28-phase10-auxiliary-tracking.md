# Phase 10: Strength & Equipment Tracking

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
>
> **Voraussetzung:** [Bündel A — Context Unification](2026-04-29-bundle-a-context-unification.md), [Bündel B — Threshold Canonicalization](2026-04-29-bundle-b-thresholds-canonicalization.md), [RPE & Post-Workout-Feedback](2026-04-29-rpe-post-workout-feedback.md).
>
> **Hinweis Re-Evaluation 2026-04-29:** Original-Plan hieß „Auxiliary Tracking" mit drei Domänen (Strength + Habits + Equipment). Nach Code-Review und im Licht der neuen Pläne wurde **Habit-Tracker gestrichen** (Begründung unten); übrig bleiben **Strength-Logger** und **Equipment-Mileage**.

**Ziel:** Zwei konkrete Tracking-Domänen, die *neben* Endurance laufen aber heute unsichtbar sind. Bewusst spät einsortiert — niedrigerer Tages-Mehrwert als 6–9 oder Bündel A–C, aber wertvoll sobald der Coaching-Kern steht.

1. **Strength-Logger** — Top-Übungen, Sätze, Reps, RPE (gleicher Borg 1–10 aus RPE-Plan), e1RM-Trend.
2. **Equipment-Mileage** — Kette, Reifen, Bremsbeläge, Schuhe; auto-tally aus Aktivitäten.

**Architektur:** Zwei separate, voneinander unabhängige Module. Equipment-Auto-Tally aus `pulse_activities` per Sync-Hook. Strength-Sessions optional an `pulse_planned_workouts` mit `activity_type='strength'` gekoppelt. **Keine eigenen RPE/Threshold-Konstanten** — wiederverwendet `RPE_BUCKETS` aus Bündel B. **PulseContext erweitert** (Bündel A) um `recentStrengthSessions` und `equipmentDueForReplacement`, damit Coach und Briefing Kontext haben.

**Repo root:** `/root/pulse`

---

## Re-Evaluation: Habit-Tracker gestrichen

Nach Review aller bestehenden Features:

| Habit-Beispiel aus Original-Plan | Bereits abgedeckt durch |
|---|---|
| „10k Schritte" | `pulse_daily_metrics.steps` (auto, kein Toggle nötig) |
| „1L Wasser pre-noon" | Voice-Check-in mit Themes (Bündel A erlaubt Coach, das in Kontext zu nehmen) |
| „Magnesium" | Notiz im Voice-Check-in |
| „Mobility 10min" | Theme im Check-in |
| „Blockzeit 8h" | Außerhalb des Pulse-Scopes (Arbeits-Tracking) |

**Tobi's Stimmung wird täglich via Voice-Check-in erfasst, mit Theme-Extraktion.** Manuelles Habit-Toggling ist Reibung ohne Mehrwert: jede Habit ist entweder schon auto-erfasst oder als Theme im Check-in besser dokumentiert. **Risk Watch** schließt zusätzlich datengetriebene Trends ab (z.B. Sleep-Debt). Habit-Streaks würden sich gegenseitig mit dem Voice-Check-in als Eingabekanal duplizieren.

**Entscheidung:** Habit-Tracker komplett verworfen. Wird *nicht* als Backlog-Item geführt.

---

## Kritische Voranalyse

| Bereich | Aktuell | Notwendige Mindestlösung |
|---|---|---|
| Strength | Activity-Type `strength` aber kein Detail | Set/Rep/RPE-Logger pro Übung, e1RM-Trend |
| Strength × RPE | RPE-Plan adressiert Endurance-RPE auf `pulse_activities` | Strength-Sets brauchen eigene RPE-Spalte (set-level) — gleicher Borg 1–10 |
| Equipment | Komplette Lücke | Kette, Reifen, Bremsbeläge, Laufschuhe, Bike(s) |
| Aktivitäts-Equipment-Zuordnung | Garmin liefert manchmal `gear` | Heute nicht persistiert |
| Plan/Analyse-Tab (nach Bündel C) | Wird zu Volumen/Polarisierung | Strength-Volumen passt dort hin |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `backend/src/db/migrations/0017_strength_equipment.sql` |
| Modify | `backend/src/db/pulse-schema.ts` |
| Modify | `backend/src/pulse/lib/pulse-context.ts` (recentStrengthSessions + equipmentDueForReplacement) |
| Modify | `backend/src/pulse/plugin.ts` (Strength + Equipment Endpoints) |
| Modify | `backend/src/jobs/garmin-sync.job.ts` (Equipment-Auto-Tally) |
| Modify | `backend/src/routes/garmin.ts` (Garmin-Gear → Pulse-Equipment-Mapping) |
| Modify | `backend/src/pulse/services/coach-engine.ts` (Strength-Volumen erwähnen) |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` |
| Modify | `frontend/src/pages/Plan.tsx` (Strength-Logger + Volumen im Analyse-Tab) |
| Modify | `frontend/src/pages/Settings.tsx` (Equipment-Card) |
| Modify | `frontend/src/pages/ActivityDetail.tsx` (Equipment-Override pro Aktivität) |
| Create | `frontend/src/components/StrengthLogger.tsx` |
| Create | `frontend/src/components/EquipmentList.tsx` |

---

## Task 1: Strength-Schema

```sql
CREATE TABLE IF NOT EXISTS pulse_strength_session (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  planned_workout_id UUID REFERENCES pulse_planned_workouts(id) ON DELETE SET NULL,
  date          DATE NOT NULL,
  duration_min  INT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pulse_strength_set (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES pulse_strength_session(id) ON DELETE CASCADE,
  exercise    TEXT NOT NULL,
  set_number  INT NOT NULL,
  reps        INT NOT NULL,
  weight_kg   REAL,
  rpe         SMALLINT,                     -- 1-10, gleiches Borg-Schema wie pulse_activities.rpe
  e1rm_kg     REAL                          -- Epley: weight * (1 + reps/30)
);

CREATE INDEX IF NOT EXISTS idx_strength_session_user_date
  ON pulse_strength_session(user_id, date);
CREATE INDEX IF NOT EXISTS idx_strength_set_session
  ON pulse_strength_set(session_id);
```

**Top-Lift-Liste** (statisch, frei erweiterbar): Squat, Deadlift, Bench, OHP, Pullup, Lunges, RDL, Hip Thrust, Calf Raise, Plank.

**e1RM** = Epley-Formel = `weight * (1 + reps/30)`. Trend-Chart pro Übung über 90d.

**Validation:** `rpe` ∈ [1,10] (gleiche Constraints wie [RPE-Plan](2026-04-29-rpe-post-workout-feedback.md)). UI zeigt RPE mit Farbe aus `RPE_BUCKETS` (Bündel B).

---

## Task 2: Strength-Logger UI

In `Plan.tsx` neuer Sub-Bereich. Wenn aktueller `pulse_planned_workouts.activityType === 'strength'`: **Logger-Modus**, sonst **Free-Logging-Modus**.

```
┌──────────────────────────────────────┐
│ KRAFT-EINHEIT  · 28.04                │
│ → verbunden mit Plan: "Lower Body 60min"│
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
│ Notiz (optional)                      │
│ [ Speichern ]                         │
└──────────────────────────────────────┘
```

Pro Übung Trend-Card: e1RM-Verlauf 90d.

**Schnell-Eingabe:** nach erstem Satz Buttons „Wiederholen", „+5 kg", „+1 Rep".

**RPE-Picker:** identisch zur RPE-Plan-Komponente (`RpeFeedbackSheet.tsx`) — Borg-Skala 1–10 mit Bündel-B-Farben. Beide Komponenten wiederverwenden eine gemeinsame `RpeBar`-Sub-Komponente.

---

## Task 3: Strength im Plan/Analyse-Tab (Bündel-C-Kompatibel)

Plan/Analyse-Tab ist nach Bündel C ein **reiner Volumen/Polarisierungs-Block**. Strength fügt sich dort ein:

```
┌────────────────────────────────────────┐
│ TRAININGS-VOLUMEN  · letzte 4 Wochen   │
│                                         │
│ Endurance      14.5 h  ████████████    │
│ Strength        2.5 h  ██              │
│ Polarisierung  Z1/Z2  82% / Z3+ 18%   │
│                                         │
│ Strength-Trend (e1RM avg, top 5 lifts):│
│ Squat   +4.2%   Bench  +1.8%           │
│ Deadlift +2.1%   OHP   −0.5%           │
└────────────────────────────────────────┘
```

---

## Task 4: Equipment-Schema

```sql
CREATE TABLE IF NOT EXISTS pulse_equipment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN
    ('chain','tire','brake_pad','cassette','running_shoe','bike','wetsuit','other')),
  parent_equipment_id UUID REFERENCES pulse_equipment(id) ON DELETE SET NULL,
  activity_types  TEXT[] NOT NULL,                -- ['bike','run']
  installed_date  DATE NOT NULL,
  initial_km      REAL DEFAULT 0,
  retirement_km   REAL,
  retirement_date DATE,
  retired_at      TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pulse_equipment_activity (
  equipment_id  UUID NOT NULL REFERENCES pulse_equipment(id) ON DELETE CASCADE,
  activity_id   UUID NOT NULL REFERENCES pulse_activities(id) ON DELETE CASCADE,
  km_added      REAL NOT NULL,
  PRIMARY KEY (equipment_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_user_active
  ON pulse_equipment(user_id) WHERE retired_at IS NULL;
```

**Aktivitäts-Zuordnungs-Strategie:**
- **Default-Equipment pro `activity_type`** (in Settings) — z.B. „Standard-Bike" für alle Bike-Aktivitäten ohne explizite Garmin-Gear-Info.
- Garmin-Gear-Info pro Aktivität → Mapping auf Pulse-Equipment via Name-Match.
- Manuelles Override pro Aktivität in `ActivityDetail.tsx` (Dropdown).

**Auto-Tally:** im Garmin-Sync nach jedem neuen Activity → für jedes zugeordnete Equipment `km_added += distanceM/1000`. Kette/Reifen/Bremsbeläge erben Distance vom übergeordneten Bike (parent_equipment_id) automatisch.

---

## Task 5: EquipmentList UI

In `Settings.tsx` neue Card „Equipment":

```
┌────────────────────────────────────────┐
│ EQUIPMENT                               │
│                                         │
│ 🚴 Standard-Bike       2.840 km        │
│   ↳ Kette (15.10.25)    1.240/3.500   │
│   ↳ Reifen V (10.11.25) 1.890/5.000   │
│   ↳ Reifen H (10.11.25) 1.890/5.000   │
│   ↳ Bremsbeläge VR     [⚠ Ersetzen]   │
│                                         │
│ 👟 Hoka Speedgoat 5    412/700 km      │
│ 👟 Saucony Endorphin   89/600 km       │
│                                         │
│ [+ Equipment]                           │
└────────────────────────────────────────┘
```

Warn-Badge bei `km_total >= retirement_km * 0.9`.

**Settings „Defaults":**
```
Standard-Bike-Equipment:    [Standard-Bike ▼]
Standard-Run-Schuhe:         [Hoka Speedgoat 5 ▼]
```

---

## Task 6: ActivityDetail Equipment-Override

Auf `ActivityDetail.tsx` neue Section:

```
🚴 Equipment: [Standard-Bike ▼]   (geändert aus „Standard-Bike (default)")
```

Bei Änderung → `km_added` neu vergeben (vom alten Equipment subtrahieren, dem neuen addieren). Idempotent.

---

## Task 7: PulseContext-Integration (Bündel-A-Erweiterung)

`backend/src/pulse/lib/pulse-context.ts` erweitern:

```typescript
export interface PulseContext {
  // ... existing fields
  recentStrengthSessions: Array<{
    date: string;
    sessionId: string;
    durationMin: number | null;
    topLifts: Array<{ exercise: string; bestSet: { reps: number; weightKg: number; rpe: number; e1rm: number } }>;
  }>;
  equipmentDueForReplacement: Array<{
    name: string;
    category: string;
    kmCurrent: number;
    kmRetirement: number;
    pctConsumed: number;
  }>;
}
```

Coach-Engine erwähnt Strength im Kontext und Equipment-Replacement-Hinweise im Briefing-Prompt:

```
== EQUIPMENT ==
- Bremsbeläge VR: 92% verschlissen (1.840/2.000 km)
```

---

## Task 8: Tests

- `pulse-strength.test.ts`: e1RM korrekt (Epley), RPE-Range, Session+Sets-CRUD.
- `pulse-equipment.test.ts`: Auto-Tally idempotent, parent-child-Vererbung, Warn-Badge bei 90%.
- `garmin-sync.job.test.ts`: Gear-Mapping aus Garmin-Activity zu Pulse-Equipment.
- `pulse-context.test.ts`: Strength + Equipment landen im Context.

---

## Acceptance

- [ ] Migration läuft additiv durch
- [ ] Strength-Session mit 3 Sätzen speicherbar, e1RM Epley-korrekt
- [ ] e1RM-Trend zeigt 90d-History pro Übung
- [ ] RPE-Picker im Strength-Logger nutzt `RPE_BUCKETS` aus Bündel B (geteilte UI-Komponente mit RPE-Plan)
- [ ] Equipment automatisch befüllt nach Bike-Aktivität (Default-Bike-Mapping)
- [ ] Replacement-Warning bei ≥90 % km
- [ ] ActivityDetail Equipment-Override funktioniert idempotent
- [ ] PulseContext enthält `recentStrengthSessions` und `equipmentDueForReplacement`
- [ ] Coach-Briefing erwähnt Equipment-Replacement, wenn ≥1 Item ≥90 % verschlissen
- [ ] Plan/Analyse-Tab zeigt Strength-Volumen + e1RM-Trend
- [ ] Habits-Funktionalität ist NICHT Teil dieser Phase (bewusste Streichung)
