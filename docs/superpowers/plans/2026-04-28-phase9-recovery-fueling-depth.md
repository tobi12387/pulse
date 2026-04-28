# Phase 9: Recovery & Fueling Depth

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
>
> **Voraussetzung:** Phase 6 (Plan-Constraints) für Recovery-Override.
>
> **Querschnitt:** [HR-First](2026-04-28-cross-cutting-hr-first.md) — Recovery-Score nutzt HR-Drift als Eingabe.

**Ziel:** Recovery quantifizieren (statt nur Sparkline) und Fueling als zweite Achse einführen — denn ohne Nutrition-Kontext sagt der Compliance-Score wenig aus.

1. **Sleep-Debt + HRV-Deviation als Single Numbers** — drei Recovery-Kennzahlen prominent auf Home
2. **Nutrition Quick-Log post-Workout** — 3-Tap-Logging (kcal, Carbs, Gels, Trinkmenge)
3. **Body-Composition-Trends** — Weight + Bodyfat + Muscle als Chart, nicht nur Liste
4. **Recovery-Empfehlung aus Daten** — wenn Recovery-Score schlecht, präzise Maßnahme („+1.5h Schlaf nötig" / „RHR +6 bpm — Z2-Tag empfohlen")

**Architektur:** Recovery-Metrics als pure-functions in `recovery-metrics.ts`. Nutrition als eigene Tabelle, optional pro Workout, optional pro Tag (für Out-of-Workout-Snacks). Body-Comp nutzt bestehende `pulse_weight_entry` (hat `bodyFatPct`, `muscleMassKg`).

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Aktuell | Lücke |
|---|---|
| Sparklines auf Home | Keine numerische Aggregat-Kennzahl |
| Schlafdaten täglich | Sleep-Debt (kumulativ) wird nicht berechnet |
| HRV-Wert pro Tag | HRV-Deviation vs. 30d-Baseline nicht angezeigt |
| Compliance-Score (Phase 5) | Sagt „60 % Compliance" — aber warum? Fueling-Daten fehlen |
| Body-Fat in DB | Nirgends visualisiert |
| Recovery-Empfehlung | Nur narrativ via Coach, keine konkrete Zahl |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `backend/src/lib/recovery-metrics.ts` |
| Create | `backend/src/db/migrations/0015_nutrition.sql` |
| Modify | `backend/src/db/pulse-schema.ts` |
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `backend/src/pulse/services/coach-engine.ts` |
| Modify | `backend/src/routes/garmin.ts` |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` |
| Modify | `frontend/src/pages/Home.tsx` |
| Modify | `frontend/src/pages/Data.tsx` |
| Modify | `frontend/src/pages/ActivityDetail.tsx` |
| Create | `frontend/src/components/RecoveryStrip.tsx` |
| Create | `frontend/src/components/NutritionLogModal.tsx` |
| Create | `frontend/src/components/BodyCompChart.tsx` |
| Modify | `shared/types/pulse.ts` |

---

## Task 1: Recovery-Metrics-Lib

`backend/src/lib/recovery-metrics.ts`:

```typescript
export interface RecoveryMetrics {
  sleepDebt7d: { hours: number; targetH: number; status: 'ok'|'mild'|'severe' };
  hrvDeviation7d: { pct: number; status: 'recovering'|'stable'|'declining' };
  rhrDrift7d: { bpmAboveBaseline: number; status: 'normal'|'elevated' };
  recoveryScore: number;          // 0-100, Aggregat
  recommendation: string;          // 1-Satz aus Daten
}

export async function computeRecovery(args: {
  daily: PulseDailyMetrics[];     // letzte 30d, neueste zuerst
  sleepTargetH: number;            // aus Profile, default 8.0
}): Promise<RecoveryMetrics>;
```

**Sleep-Debt:**
```
sleepDebt7d.hours = sum(targetH - actualH) für letzte 7 Tage
status = ok wenn <2h, mild 2-5h, severe >5h
```

**HRV-Deviation:**
```
baseline = avg(hrv) der Tage 8-30 (also 23 Tage rolling baseline)
recent  = avg(hrv) der letzten 7 Tage
pct = (recent - baseline) / baseline * 100
```

**RHR-Drift:**
```
rhrBaseline = min(rhr) der Tage 8-30
rhrRecent7d = avg(rhr) der letzten 7 Tage
elevated wenn rhrRecent7d > rhrBaseline + 5
```

**Recovery-Score (0–100):**
```
recoveryScore =
  weight(sleep) * sleepFactor +
  weight(hrv)   * hrvFactor +
  weight(rhr)   * rhrFactor
weights: sleep 0.4, hrv 0.4, rhr 0.2
```

---

## Task 2: Recovery in Home + Coach

**`GET /pulse/home`** erweitern: `recovery: RecoveryMetrics`.

**`coach-engine.ts`** Context erweitern um `recovery`. Wenn `recoveryScore < 50` UND heute hartes Workout geplant → Coach erwähnt das proaktiv im Briefing/Antwort.

---

## Task 3: Frontend — RecoveryStrip auf Home

Schmale, prominente Leiste oberhalb der Metrik-Cards:

```
┌─────────────────────────────────────────────────────────────┐
│ RECOVERY  62/100  ↘ -8  vs Vorwoche                          │
│                                                              │
│ Schlafdefizit  -3.2h    HRV  -9 %    Ruhepuls  +4 bpm       │
└─────────────────────────────────────────────────────────────┘
```

Klick → Modal mit Recommendation + 30d-Sparklines pro Achse.

---

## Task 4: Nutrition-Log

```sql
CREATE TABLE pulse_nutrition_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  workout_id UUID REFERENCES pulse_planned_workouts(id) ON DELETE SET NULL,
  context TEXT CHECK (context IN ('pre','during','post','daily')) DEFAULT 'during',
  kcal INT,
  carbs_g INT,
  protein_g INT,
  gels_count INT,
  drinks_ml INT,
  sodium_mg INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_nutrition_user_date ON pulse_nutrition_log(user_id, date);
```

**Endpoints:**
- `POST /pulse/nutrition` body
- `GET /pulse/nutrition?from=...&to=...`
- `DELETE /pulse/nutrition/:id`
- `GET /pulse/nutrition/workout/:workoutId` — alle Logs zu einem Workout

---

## Task 5: 3-Tap-Logger

`NutritionLogModal.tsx` mit Quick-Picker:

```
┌──────────────────────────────────────┐
│ FUELING — 90min Bike Z2              │
│                                       │
│ Gels:    [-]  2  [+]                 │
│ Trinken: [-] 750 [+] ml              │
│ Carbs:   [-]  60 [+] g  (auto: gels) │
│ Notes:   [Beine müde, kein Hunger]   │
│                                       │
│ [ Speichern ]   [ Skip ]              │
└──────────────────────────────────────┘
```

Auto-Vorschlag aus Workout-Dauer:
- 60g Carbs/h Bike
- 30g Carbs/h Run < 90min, 60g/h > 90min
- 500-600ml/h
- 0.5g Sodium/L bei Hitze

Verknüpft mit Workout-Row in Plan/ActivityDetail. Zugang:
- ActivityDetail-Page → "Fueling-Log" Button
- Push-Reminder via Telegram (Phase 12) nach Workout-Abschluss

---

## Task 6: Compliance-Score nutzt Nutrition

`generateWorkoutFeedback()` in `garmin.ts` (Phase 5) bekommt zusätzlichen Kontext:

```typescript
const nutrition = await getNutritionForWorkout(workoutId);
// in Prompt:
// FUELING: 2 Gels (60g Carbs), 750ml, Notiz "Beine müde"
// → Coach kann unterscheiden: schwache Performance = Fueling-Problem oder Form?
```

Wenn `nutrition` fehlt: Coach fragt im Feedback nach (1-Satz) und schlägt Default vor.

---

## Task 7: Body-Composition-Chart

Bestehende `pulse_weight_entry` hat schon `bodyFatPct` und `muscleMassKg`. UI fehlt.

Neuer `BodyCompChart.tsx` in Data-Page (Weight-Tab):

```
┌────────────────────────────────────────┐
│ KÖRPERZUSAMMENSETZUNG (90 Tage)        │
│                                         │
│ ─── Gewicht 78.4 kg                    │
│ ─── Körperfett 14.2 % (zwei Y-Achsen) │
│ ─── Muskelmasse 36.8 kg                │
│                                         │
│ [Sparkline mit drei Linien]             │
│                                         │
│ Trend 30d: -0.8 kg, -0.4 % BF, +0.2 kg M │
└────────────────────────────────────────┘
```

Reuse `SparkChart`-Komponente, multi-line erweitern.

---

## Task 8: Power-to-Weight (W/kg) — wenn Power-Daten vorhanden

Auf Home oder Insights: aktuelle FTP/Gewicht und Trend:

```
W/kg  3.21  (FTP 252W / 78.4kg)   ↗ +0.04 vs 30d
```

Optional, niedrige Priorität — nur wenn FTP gesetzt.

---

## Acceptance

- [ ] `computeRecovery()` Unit-Tests mit synthetischen 30d-Daten (3 Szenarien: gut/mittel/schlecht)
- [ ] RecoveryStrip auf Home sichtbar, klickbar
- [ ] Nutrition-Log über Modal speichert in DB
- [ ] ActivityDetail zeigt Nutrition-Logs zu der Aktivität
- [ ] Compliance-Score-Prompt enthält Nutrition-Kontext, wenn vorhanden
- [ ] Body-Comp-Chart zeigt 3 Linien synchronisiert
- [ ] W/kg auf Insights/Home sichtbar wenn FTP vorhanden
- [ ] Coach erwähnt schlechtes Recovery proaktiv im nächsten Briefing
- [ ] Telegram-Push (falls Phase 12 live): Nutrition-Reminder 5min nach Activity-End
