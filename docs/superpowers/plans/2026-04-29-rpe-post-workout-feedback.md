# RPE & Post-Workout-Feedback-Loop

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
>
> **Querschnitt:** [HR-First](2026-04-28-cross-cutting-hr-first.md) — RPE ist die einzige Größe, die HR-First nicht aus Garmin ableiten kann.

**Ziel:** Subjektives Workout-Feedback in 30 Sekunden direkt nach jeder Einheit. Heute: Compliance-Score ist eine LLM-Schätzung aus Garmin-Daten — niemand fragt Tobi, *wie es sich angefühlt hat*. Das ist der eine Datenpunkt, den Garmin grundsätzlich nicht liefern kann, und für polarisiertes Training entscheidend (war Z2 wirklich Z2?).

1. **Borg-RPE 1–10** pro Aktivität, optional 1-Zeile Notiz und Soreness-Marker.
2. **Bottom-Sheet auf ActivityDetail** — kein neuer Screen, kein Modal-Stack, kein Navigations-Sprung.
3. **Coach-Engine bekommt RPE in den Kontext** — sowohl im Daily Briefing (vorletzte Einheit) als auch im Workout-Feedback-Prompt.
4. **Trend-Strip auf Plan/Analyse** — RPE-vs-prescribed-Zone-Heatmap, sichtbar wenn ≥10 Einträge.

**Architektur:** Additive DB-Migration (zwei Spalten in `pulse_activities`, kein neuer Table). Ein Endpoint `PATCH /pulse/activities/:id/feedback`. Coach-Engine zieht das Feld einfach mit, kein neuer Service. Frontend-only-Bottom-Sheet, keine neue Library. Kein Backfill — alte Aktivitäten bleiben ohne RPE.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Aktuell | Lücke |
|---|---|
| Compliance-Score wird aus Garmin-Daten + Plan-Ziel berechnet | Kein Signal von Tobi: "fühlte sich härter an als gedacht" |
| Coach-Briefing kennt letzte Aktivität (Distanz/HR/TSS) | Aber nicht ob Tobi sich gut/schlecht gefühlt hat |
| Health-States existieren (krank/verletzt) | Aber nicht der Graubereich „heute zäh" |
| Mental-Check-in tagesweise | Nicht workout-spezifisch |
| Weekly Review kann Trends zeigen | Aber nur objektive Metriken, kein RPE-Drift |

**Warum RPE und nicht „Mood-Score nach Workout":**
RPE ist eine etablierte Skala (Borg 6–20 oder modifizierte 1–10). Vergleichbar zwischen Sportlern und Studien. Mood-Score wäre redundant zum Mental-Check-in.

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `backend/src/db/migrations/0013_activity_rpe_feedback.sql` |
| Modify | `backend/src/db/pulse-schema.ts` |
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `backend/src/pulse/services/coach-engine.ts` |
| Modify | `backend/src/jobs/briefing-generation.job.ts` |
| Modify | `shared/pulse.ts` (oder vorhandenes shared-Type-Modul) |
| Create | `frontend/src/components/RpeFeedbackSheet.tsx` |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` |
| Modify | `frontend/src/pages/ActivityDetail.tsx` |
| Modify | `frontend/src/pages/Plan.tsx` (Analyse-Tab) |

---

## Task 1: Schema-Migration (additiv)

`backend/src/db/migrations/0013_activity_rpe_feedback.sql`:

```sql
-- RPE-Feedback (Borg 1–10) und kurzes Empfinden je Aktivität.
ALTER TABLE pulse_activities
  ADD COLUMN IF NOT EXISTS rpe SMALLINT,                         -- 1–10, NULL = nicht erfasst
  ADD COLUMN IF NOT EXISTS rpe_note TEXT,                        -- frei, max ~280 Zeichen
  ADD COLUMN IF NOT EXISTS soreness_areas TEXT[],                -- ['knee_left', 'lower_back', ...] oder NULL
  ADD COLUMN IF NOT EXISTS feedback_logged_at TIMESTAMPTZ;       -- when Tobi logged it

CREATE INDEX IF NOT EXISTS idx_pulse_activities_rpe
  ON pulse_activities(user_id, start_time DESC)
  WHERE rpe IS NOT NULL;
```

`pulse-schema.ts` entsprechend anpassen (rpe / rpeNote / sorenessAreas / feedbackLoggedAt).

**Validation in der API:** `rpe` ∈ [1,10], `rpe_note` ≤ 500 Zeichen, `soreness_areas` ∈ erlaubte enum-Liste (siehe Task 4).

---

## Task 2: Backend-Endpoint

`PATCH /pulse/activities/:id/feedback`:

```typescript
// Request body
{
  rpe: number;                  // 1–10
  rpeNote?: string | null;
  sorenessAreas?: string[] | null;   // siehe enum unten
}

// Response: aktualisiertes pulse_activities-Object
```

Auth-Check: Activity gehört zu `req.user.id`. Update via Drizzle. `feedbackLoggedAt = now()`. Idempotent — Tobi darf RPE auch nachträglich korrigieren.

**Soreness-Enum** (geteilt zwischen Backend Validation und Frontend Buttons):
```
'neck', 'shoulders', 'upper_back', 'lower_back',
'hip', 'glutes', 'quad', 'hamstring', 'calf',
'knee_left', 'knee_right', 'achilles', 'foot',
'general_fatigue'
```

---

## Task 3: Coach-Engine bekommt RPE im Kontext

In `coach-engine.ts` → `buildRichSystemPrompt(ctx)`: bei `recentActivities` zusätzlich `rpe` und `rpeNote` ausgeben, falls vorhanden:

```
- Mi 24.04, Run 12 km Z2, TSS 78, RPE 7/10 ("Beine zäh, Hitze")
- Di 23.04, Bike 90min Z2, TSS 65, kein RPE
```

In `briefing-generation.job.ts` → bei vorletzter Einheit: wenn RPE > Compliance-Score-Erwartung (z.B. RPE 8 für eine Z2-Einheit), Briefing-Prompt erhält Hinweis:

```
Letzte Z2-Einheit fühlte sich für Tobi überraschend hart an (RPE 8/10).
→ Berücksichtige das bei der Empfehlung für heute.
```

**Soft-Rule für Briefing-Prompt:**
- RPE ≥ 8 für Z1/Z2-Einheit → flag „aerobe Müdigkeit"
- RPE ≤ 4 für Z4/Z5-Einheit → flag „nicht ausgereizt / zu kurz"

---

## Task 4: Frontend — RpeFeedbackSheet

Bottom-Sheet (slide-up, kein Modal-Block) auf `ActivityDetail.tsx`. Trigger:
- Auto-Open, wenn `rpe == null` und Aktivität < 24 h alt
- Manueller Trigger via Button „RPE eintragen" / „RPE bearbeiten"

```
┌─────────────────────────────────────┐
│  Wie hat sich's angefühlt?     [×]  │
├─────────────────────────────────────┤
│  ① ② ③ ④ ⑤ ⑥ ⑦ ⑧ ⑨ ⑩            │
│  locker                  alles geben │
│                                     │
│  Notiz (optional)                   │
│  ┌─────────────────────────────────┐│
│  │ z.B. Beine zäh, Hitze...        ││
│  └─────────────────────────────────┘│
│                                     │
│  Wo zwickt's? (optional)            │
│  [ Knie L ] [ Knie R ] [ Wade ]    │
│  [ Lower Back ] [ ... ]             │
│                                     │
│           [   SPEICHERN   ]         │
└─────────────────────────────────────┘
```

UI-Detail:
- RPE-Skala als horizontale Buttons 1–10, ausgewähltes Element farbig (Z1=blau, Z3=grün, Z5=rot — analog zu vorhandener Zone-Color-Palette).
- Soreness-Buttons sind Toggle-Pills.
- Speichern → optimistisches Update via TanStack Query, Sheet schließt automatisch.
- Wenn Aktivität älter als 24 h: keine Auto-Open, aber „RPE noch eintragen?" als kleiner Hinweis im ActivityDetail-Header.

---

## Task 5: Trend-Visualisierung in Plan/Analyse

Wenn ≥10 Aktivitäten mit RPE existieren: neue Card im `Plan.tsx` Analyse-Tab.

```
┌────────────────────────────────────────────┐
│ RPE vs. Zone (letzte 30 Tage)              │
├────────────────────────────────────────────┤
│ Z1     RPE Ø 3.2   [██░░░░░░] 5 Einheiten  │
│ Z2     RPE Ø 5.1   [████░░░░] 12 Einheiten │
│ Z3     RPE Ø 6.8   [██████░░] 3 Einheiten  │
│ Z4     RPE Ø 8.4   [████████] 2 Einheiten  │
│ Z5     RPE Ø 9.5   [████████] 1 Einheit    │
│                                            │
│ Drift: Z2-RPE +0.8 vs Vormonat → leichte   │
│         aerobe Ermüdung                    │
└────────────────────────────────────────────┘
```

Drift-Berechnung: avg(RPE) für Zone-Bucket der letzten 30d vs. die 30d davor. >+1.0 = „Ermüdung", <−1.0 = „Anpassung".

---

## Task 6: Tests

- `backend/src/pulse/plugin.test.ts` — neuer Test-Block:
  - 200 für validen Body, korrekte Persistenz
  - 400 für RPE 0 / 11
  - 400 für unbekannte Soreness-Area
  - 403 für fremde Activity
- `backend/src/pulse/services/coach-engine.test.ts` — RPE landet im System-Prompt
- `backend/src/jobs/briefing-generation.job.test.ts` — Soft-Rule feuert bei RPE 8 + Z2

---

## Acceptance

- [ ] Migration läuft idempotent durch (auch zweiter `DEPLOY` ok)
- [ ] PATCH-Endpoint validiert Borg-Range und Soreness-Enum
- [ ] ActivityDetail öffnet Sheet automatisch für ungewertete Aktivitäten <24h
- [ ] RPE landet im Coach-Briefing-Prompt für die letzte Aktivität
- [ ] RPE landet im rich coach context für Chat
- [ ] Plan/Analyse-Card erscheint, sobald ≥10 RPE-Einträge existieren
- [ ] Bestehende Aktivitäten ohne RPE funktionieren unverändert (kein Migration-Backfill)
- [ ] Soreness-Pills toggeln optimistisch, kein Doppel-Submit
