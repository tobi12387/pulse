# Phase 6: Health States & Adaptive Plan

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` — Task für Task, Spec- und Code-Review nach jedem Task.

**Ziel:** Den Daily-Loop schließen. Aktuell sind Plan und Tagesform entkoppelt: Krank? Erschöpft? Verletzt? Egal — der Plan steht. Phase 6 macht den Plan reaktiv.

1. **Health-State-Toggle** — Krankheit/Verletzung markieren, Plan respektiert das automatisch
2. **Adaptive Tagesanpassung** — bei niedriger Readiness One-Tap-Swap des heutigen Workouts
3. **Auto-Phase-Progression** — `trainingPhase` wird aus Race-Datum abgeleitet (vorbereitend für Phase 7)

**Architektur:** Health-States sind Hard-Constraints für die Plan-Engine. Tages-Adjust ist eine *temporäre* Override (nur dieser Tag, kein Rebuild der ganzen Woche). Beides geht durch `plan-engine.ts`, damit die Logik zentral bleibt.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Problem | Ist-Zustand | Soll-Zustand |
|---|---|---|
| HRV im Keller, Z4 geplant | Unverändert; Coach erwähnt es im Chat | One-Tap-Swap auf Z2 oder Rest |
| Erkältet | Keine Markierung möglich | Health-State `illness/mild/3d`, Plan zeigt nur Z1/Rest |
| Knie zwickt | Keine Markierung | Health-State `injury/knee` blockt Lauf-Workouts |
| Phase manuell in Settings | `trainingPhase: 'base'` | Aus Race-Datum: 16w aus = base, 8w = build, 4w = peak, 2w = taper |
| Keine Historie der Anpassungen | — | `originalZone`/`adjustedReason` auf Workout-Row |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Modify | `backend/src/db/pulse-schema.ts` |
| Create | `backend/src/db/migrations/0011_health_states.sql` |
| Modify | `backend/src/pulse/services/plan-engine.ts` |
| Create | `backend/src/pulse/services/adapt-engine.ts` |
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` |
| Modify | `frontend/src/pages/Home.tsx` |
| Modify | `frontend/src/pages/Plan.tsx` |
| Modify | `frontend/src/pages/Settings.tsx` |
| Create | `frontend/src/components/HealthStateBanner.tsx` |
| Create | `frontend/src/components/AdjustTodayCard.tsx` |
| Modify | `shared/types/pulse.ts` |

---

## Task 1: DB-Schema für Health States

**Tabelle `pulse_health_state`:**

```sql
CREATE TABLE pulse_health_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('illness','injury','fatigue','travel')),
  severity TEXT NOT NULL CHECK (severity IN ('mild','moderate','severe')),
  body_part TEXT,                         -- nur bei injury (z.B. 'knee_left')
  notes TEXT,
  start_date DATE NOT NULL,
  end_date DATE,                          -- NULL = aktiv, sonst auto-expire
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_health_state_user_active ON pulse_health_state(user_id, end_date) WHERE resolved_at IS NULL;
```

**Erweiterung `pulse_planned_workouts`:**

```sql
ALTER TABLE pulse_planned_workouts ADD COLUMN original_zone INT;
ALTER TABLE pulse_planned_workouts ADD COLUMN original_duration_min INT;
ALTER TABLE pulse_planned_workouts ADD COLUMN adjusted_reason TEXT;
ALTER TABLE pulse_planned_workouts ADD COLUMN adjusted_at TIMESTAMPTZ;
```

`adjusted_reason` mögliche Werte: `'low_readiness'`, `'illness'`, `'injury'`, `'manual'`.

**Drizzle-Schema in `pulse-schema.ts`** entsprechend ergänzen, Migration **additiv-only** (CLAUDE.md Regel 2).

---

## Task 2: Backend — Health-State-CRUD

`backend/src/pulse/plugin.ts`:

- `GET /pulse/health-state` → `{ active: HealthState[]; recent: HealthState[] }` (active = end_date >= today AND resolved_at IS NULL; recent = last 30d resolved)
- `POST /pulse/health-state` body: `{ type, severity, bodyPart?, notes?, durationDays }` → erstellt mit `start_date=today`, `end_date=today+durationDays`
- `PATCH /pulse/health-state/:id` → `severity` ändern oder `end_date` verlängern/verkürzen
- `POST /pulse/health-state/:id/resolve` → setzt `resolved_at=now()`

**Wichtig:** Beim Erstellen/Resolven sofort `triggerPlanRebuild(userId, fromDate)` aufrufen — Plan ab dem Tag muss neu generiert werden.

---

## Task 3: Plan-Engine respektiert Health States

In `plan-engine.ts` neue Eingabe `healthStates: ActiveHealthState[]` für `generateScientificWeekPlan`.

**Constraint-Logik im LLM-Prompt:**

```
KRANKHEIT/VERLETZUNG (HART):
- 2026-04-28 bis 2026-04-30: illness/mild → nur Z1, max 45min, kein Intervall
- 2026-05-01 bis 2026-05-14: injury/knee_left → keine Lauf-Workouts, alles Bike/Swim
```

**Programmatische Zusatz-Filter** *nach* der LLM-Generierung (Belt-and-suspenders):

```typescript
function enforceHealthConstraints(workouts: PlannedWorkout[], states: HealthState[]): PlannedWorkout[] {
  return workouts.map(w => {
    const blocking = states.filter(s => dateInRange(w.plannedDate, s.startDate, s.endDate));
    for (const s of blocking) {
      if (s.type === 'illness' && s.severity !== 'mild') return makeRest(w);
      if (s.type === 'illness' && s.severity === 'mild') return cap(w, { maxZone: 1, maxDur: 45 });
      if (s.type === 'injury' && s.bodyPart?.startsWith('knee') && w.activityType === 'run') return swap(w, 'bike');
      // ...
    }
    return w;
  });
}
```

Diese Funktion wird im Plan-Generate UND in der Tages-Adjust-Logik (Task 4) aufgerufen.

---

## Task 4: Adapt-Engine — Tages-Adjust

Neue Datei `backend/src/pulse/services/adapt-engine.ts`:

```typescript
export interface AdjustProposal {
  workoutId: string;
  original: { zone: number; durationMin: number; activityType: string };
  proposed: { zone: number; durationMin: number; activityType: string; description: string };
  reason: 'low_readiness' | 'illness' | 'injury' | 'travel';
  rationale: string;   // 1-Satz LLM-generiert
}

export async function proposeTodayAdjustment(
  userId: string,
  date: string
): Promise<AdjustProposal | null> {
  const workout = await getPlannedWorkout(userId, date);
  if (!workout || workout.status !== 'planned') return null;

  const readiness = await computeReadiness(userId, date);   // bereits in load-engine.ts
  const states    = await getActiveHealthStates(userId, date);

  // Trigger-Schwelle: Readiness < 50 UND Workout zone >= 3, ODER aktiver Health-State
  const needsAdjust =
    (readiness.score < 50 && workout.zone >= 3) ||
    states.length > 0;

  if (!needsAdjust) return null;

  // Heuristik: Z3+ → Z2 50%; Z4+ → Z2 40min ODER Rest; Krank → Rest
  // ... (deterministisch, kein LLM für die Entscheidung — nur für die rationale)
}
```

**Endpoints:**
- `GET /pulse/plan/today/proposal` → `AdjustProposal | null`
- `POST /pulse/plan/today/accept` body `{ workoutId }` → speichert `originalZone`/`originalDurationMin`/`adjustedReason`, ruft Garmin-Re-Sync (Phase 5)

---

## Task 5: Auto-Phase-Progression

In `pulse_user_profile`: kein neues Feld nötig. Stattdessen abgeleitet:

```typescript
function derivePhase(nextRaceDate: string | null, today: string): TrainingPhase {
  if (!nextRaceDate) return 'base';
  const w = weeksBetween(today, nextRaceDate);
  if (w < 0)   return 'base';            // Race vorbei
  if (w <= 2)  return 'taper';
  if (w <= 4)  return 'peak';
  if (w <= 12) return 'build';
  return 'base';
}
```

Plan-Engine nutzt `derivePhase()` statt `profile.trainingPhase`. `trainingPhase`-Feld in Settings wird zu **Override** ("Auto" als Default).

> Fertig nutzbar wird das erst mit Phase 7 (Race-Datum), aber die Logik schon hier einbauen.

---

## Task 6: Frontend — HealthStateBanner & AdjustTodayCard

**`HealthStateBanner.tsx`:** zeigt aktive States als Pille auf Home und Plan, rot/orange je nach severity. Klick → Settings.

**`AdjustTodayCard.tsx`:** auf Home, *nur wenn* `proposal != null`. UI:

```
┌──────────────────────────────────────┐
│ ⚠ HEUTE ANPASSEN?                     │
│                                       │
│ Geplant: Z4 60min  →  Vorschlag: Z2 45min │
│ Grund: HRV 35ms (-22%), Schlaf 5.4h  │
│                                       │
│ [ Anpassen ]   [ Plan beibehalten ]   │
└──────────────────────────────────────┘
```

Nach `accept` → Card verschwindet, Plan-Tab + Garmin-Calendar-Sync werden invalidiert.

---

## Task 7: Frontend — Health-State-Settings

In `Settings.tsx` neuer Block "Gesundheits-Status":

- Liste aktiver States mit Resolve-Button
- "+" Button öffnet Modal: type/severity/bodyPart (bei injury)/durationDays/notes
- Recent-Section (collapsed): letzte 30d resolved States

---

## Acceptance

- [ ] Migration läuft additiv durch, keine bestehenden Workouts kaputt
- [ ] Krank markieren → Plan zeigt nächste 3d nur Rest/Z1
- [ ] HRV manuell auf 30 setzen, harten Tag wählen → AdjustTodayCard erscheint
- [ ] Accept → Workout in DB hat `originalZone`, neue Werte, `adjusted_reason='low_readiness'`
- [ ] Garmin-Calendar wird nach Accept aktualisiert
- [ ] `derivePhase()` Unit-Tests für 0/1/3/8/13 Wochen vor Race
- [ ] Plan-Engine LLM-Prompt enthält Health-State-Block wenn States aktiv
- [ ] Banner sichtbar auf Home und Plan
- [ ] Keine UI-Regression in Plan/Goals/Review-Tabs
