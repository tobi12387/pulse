# Everyday Utility Wave — Garmin, Plan Calibration, Action Closure

**Goal:** Nach der Trust-Welle bleibt Pulse schmal, aber wird im Alltag noch verlässlicher: fehlende Garmin-Daten gezielt nachladen, Wochenpläne aus Feedback messbar kalibrieren und nächste Aktionen sauber abschließen.

1. Coverage-Diagnose wird zu sicherem, begrenztem Backfill statt pauschalem "alles neu laden".
2. Plan-Generierung lernt sichtbarer aus RPE, Compliance, Trace-Historie und Wochenreviews.
3. Home/Coach-Aktionen werden nicht nur angezeigt, sondern verschwinden nachvollziehbar, sobald die Quelle erledigt ist.

## Kontext

Die vorherige Welle ist erledigt: Plan-Traces zeigen Eingaben und freie Tage, Data/Settings zeigen Garmin-Abdeckung, Home/Coach/Briefing nutzen `nextBestActions` aus PulseContext. Damit ist die App erklärbarer geworden, aber zwei Alltagsfragen bleiben natürlich offen:

- "Kann Pulse die fehlenden Garmin-Daten für konkrete Zeiträume sicher nachladen?"
- "Wird mein nächster Plan wirklich besser, wenn ich Feedback gebe und letzte Wochen anders liefen als geplant?"

Diese Welle bleibt deshalb bewusst operational. Kein Telegram, kein Datenexport, kein Habit-Tracker, kein neues Dashboard.

## Evidence Map

| Beobachtung | Beleg | Konsequenz |
|---|---|---|
| Coverage ist read-only implementiert | `GET /api/pulse/data-coverage` | Nächster Schritt ist ein begrenzter Backfill-Job mit Vorschau/Rate-Limit |
| Plan-Traces sind persistiert | `pulse_plan_generations`, Plan-UI "Einbezogene Daten" | Trace-Historie kann Plan-Variation und Lernsignale speisen |
| RPE/Compliance existieren | `pulse_activities.rpe`, `pulse_planned_workouts.workout_feedback` | Plan-Kalibrierung sollte subjektive und geplante Realität zusammenführen |
| Next Actions kommen aus PulseContext | `nextBestActions` | Abschlusslogik bleibt source-driven, kein Habit-Tracker |
| Push ist aktivierbar, aber Gerät muss opt-in sein | Settings Push Card | Nudge bleibt Action, keine Spam-Mechanik |

## Priority Assessment

| Rang | Thema | Nutzen im Alltag | Aufwand | Risiko | Bewertung |
|---|---|---|---|---|---|
| 1 | Bounded Garmin Backfill | Löst Tobis konkrete Datenlücken-Frage und macht Coverage handlungsfähig | M | M | zuerst |
| 2 | Plan Feedback Calibration | Höchster Trainingsnutzen: Pläne werden weniger gleichförmig und stärker ziel-/feedbackbasiert | M-L | M | direkt danach |
| 3 | Action Closure & Review | Macht Home zuverlässig: erledigte Aktionen verschwinden, offene bleiben erklärbar | S-M | S | nach 1/2 |
| 4 | Mobile UI QA & Density | Verbessert tägliche Bedienbarkeit, aber fachlich kleinerer Hebel | S | S | laufend nebenbei |

## Slice 1 — Bounded Garmin Backfill

**Ziel:** Fehlende Daten können gezielt und sicher nachgeladen werden, ohne Garmin pauschal oder unkontrolliert zu belasten.

### Tasks

1. **Backfill Contract**
   - `POST /api/pulse/garmin/backfill` mit `from`, `to`, optional `domains`, optional `dryRun`.
   - Harte Limits: maximal 31 Tage pro Request; 2026-Backfill läuft über UI/Job in Monats-Chunks.
   - Antwort liefert geplante Tage, tatsächlich gestartete Tage, übersprungene Tage und Gründe.

2. **Queue/Progress**
   - Wiederverwendbare BullMQ-Queue oder bestehender Garmin-Sync-Job mit explizitem Backfill-Mode.
   - Idempotent: vorhandene Pulse-Daten werden upserted, nicht dupliziert.
   - Fehler pro Tag/Domain werden gespeichert oder mindestens im Response/Log sichtbar.

3. **Coverage UI → Action**
   - Data Coverage bekommt für fehlende Bereiche einen "Nachladen"-Flow mit Datumsgrenzen.
   - Settings zeigt letzten Backfill-Status und klare Rate-Limit-Hinweise.
   - Kein Button "alles für immer laden"; 2026 wird als geführter Monatsablauf angeboten.

### Acceptance

- Tobi kann fehlende 2026-Daten in begrenzten Zeitfenstern nachladen.
- Coverage zeigt nach erfolgreichem Backfill bessere Domain-Abdeckung.
- Fehler pro Tag sind nachvollziehbar.
- Keine Legacy-Tabellen als primäre Pulse-UI-Quelle.

## Slice 2 — Plan Feedback Calibration

**Ziel:** Wochenpläne werden aus vergangenem Plan-Verhalten sichtbar kalibriert: was wurde absolviert, wie hart fühlte es sich an, welche Ziele stehen an, welche Varianten gab es zuletzt?

### Tasks

1. **Plan Learning Snapshot**
   - Backend-Helper sammelt letzte 4-6 Wochen: Plan-Traces, absolvierte Workouts, Compliance, RPE, bewusst freie Tage, aktive Ziele/Races.
   - Kein Rohprompt-Speichern, keine direkte LLM-Provider-Nutzung außerhalb `backend/src/lib/llm.ts`.

2. **Plan-Engine-Inputs erweitern**
   - `generateScientificWeekPlan()` bekommt Variation-/Adherence-Kontext.
   - Regeln: ähnliche Wochen vermeiden, harte Tage nicht wiederholen, Zielpriorität sichtbar machen, verfügbare Tage nur sinnvoll nutzen.

3. **Trace-Erklärung erweitern**
   - Plan-Trace zeigt "Gelernt aus letzter Woche" und "Variation gegenüber letzter Woche".
   - Tests für gleichförmige Vorwochen, hohes RPE trotz Z2 und niedrige Compliance.

### Acceptance

- Der nächste Plan kann nachvollziehbar anders werden, wenn RPE/Compliance/Goals es begründen.
- Freie verfügbare Tage bleiben erlaubt und werden weiter positiv erklärt.
- Plan-Tests decken Ziel-/Feedback-/Variation-Fälle ab.

## Slice 3 — Action Closure & Review

**Ziel:** Next Best Actions bleiben source-driven, aber werden für Tobi nachvollziehbarer: warum offen, wodurch erledigt, wann zuletzt gesehen.

### Tasks

1. **Action Debug Contract**
   - Optionaler read-only Debug-Endpunkt oder Home-Kontrakt-Erweiterung: `source`, `openedAt`, `resolvedBy`, `evidence`.
   - Keine manuelle Todo-Persistenz; Abschluss kommt aus Quelle: Check-in vorhanden, RPE gespeichert, Plan vorhanden, Push-Gerät aktiv.

2. **Home UI Polish**
   - Aktionen kompakter auf Mobile prüfen.
   - Kritische Aktionen bleiben prominent, normale Actions stören nicht die Readiness-Übersicht.

3. **Coach/Briefing Verhalten**
   - Coach referenziert offene Aktionen nur, wenn sie fachlich zur Frage passen.
   - Briefing priorisiert critical/high Actions, vermeidet Wiederholung von normalen Nudges.

### Acceptance

- Eine erledigte Aktion verschwindet nach Reload sofort.
- Tobi kann erkennen, warum eine Aktion noch offen ist.
- Kein Habit-Tracker und keine manuelle To-do-Liste.

## Slice 4 — Mobile UI QA & Density

**Ziel:** Die wichtigsten Tagesflüsse funktionieren auf Desktop und Mobile ohne Layout-Überlagerung oder zu lange Texte.

### Tasks

1. **Browser-QA**
   - Home, Data Coverage, Plan Trace, Coach, Settings Push auf Mobile/Desktop prüfen.
   - Lange deutsche Texte, Buttons und Tabellen auf Umbruch testen.

2. **Density-Pass**
   - Überlange Cards kürzen.
   - Wiederkehrende Status-/Action-Blöcke vereinheitlichen.

3. **Regression Checklist**
   - `docs/ai/checklists/frontend-change.md` bei UI-PRs konsequent nutzen.

### Acceptance

- Kein Text überläuft in den Kernansichten.
- Tagesfluss Home → Aktion → Zielseite bleibt auf Mobile schnell bedienbar.

## Nicht-Ziele

- Kein Telegram.
- Kein Datenexport.
- Kein Habit-Tracker.
- Kein neues Dashboard.
- Kein Rebuild von completed-Plänen.

## Empfohlene Reihenfolge

1. `codex/garmin-bounded-backfill`
2. `codex/plan-feedback-calibration`
3. `codex/action-closure-review`
4. `codex/mobile-density-qa`
