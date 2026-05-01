# Next Wave — Product & Technical Audit

**Goal:** Nach Phase 11 keine weitere Feature-Breite starten, sondern die vorhandenen Daten im Alltag vertrauenswürdiger, erklärbarer und handlungsnäher machen.

1. Wochenpläne müssen sichtbar zeigen, welche Ziele, Daten, Risiken und Feedbacks wirklich eingeflossen sind.
2. Garmin-Daten müssen als Abdeckung/Qualität sichtbar werden, nicht nur als einzelne Werte in verstreuten Tabs.
3. Coach, Briefing, Push und Plan sollen in eine kleine Zahl klarer nächster Aktionen münden.

## Kontext

Der alte Backlog ist erledigt und liegt in `completed/`. Der Code hat inzwischen starke Bausteine: Plan-Engine berücksichtigt RPE-Safety, Ziele, TSB, Risk-Signale und verfügbare Tage; Home zeigt Datenstatus; Settings kann Push aktivieren; Data zeigt Metriken, Schlaf, Gewicht und Mentaldaten.

Die Lücke ist weniger "noch mehr Daten" als "kann Tobi sehen und fühlen, dass Pulse diese Daten sinnvoll nutzt?". Genau das war zuletzt auffällig bei den geplanten Workouts: selbst wenn die Engine Daten einbezieht, ist die Wirkung in der UI noch zu schwer nachvollziehbar.

## Evidence Map

| Beobachtung | Beleg | Konsequenz |
|---|---|---|
| Plan-Engine nutzt bereits RPE als Safety-Signal | `backend/src/pulse/services/plan-engine.ts` `summarizeRpeSafety()` | Nicht neu bauen; besser sichtbar und testbarer machen |
| Plan-Engine reduziert Trainingstage bei Ziel/TSB/Risk/RPE | `decidePlanDays()` | UI sollte erklären, warum verfügbare Tage frei bleiben |
| Plan-Prompt bekommt Ziele, Historie, RPE, Health und Races | `buildPlanPrompt()` | Gute Grundlage, aber ohne Persistenz/Trace schwer auditierbar |
| Home zeigt nur groben Garmin-Datenstatus | `frontend/src/pages/Home.tsx` Datenstatus-Banner | Für "warum sehe ich Daten nicht?" braucht es eine Coverage-Ansicht |
| Garmin-Sync schreibt viele Domains getrennt | `backend/src/routes/garmin.ts` daily metrics, sleep, activities, weather, weight | Coverage sollte domainweise pro Tag prüfbar sein |
| Push ist serverseitig bereit, Nutzeraktivierung passiert in Settings | `frontend/src/pages/Settings.tsx` Push card | Aktivierung bleibt ein Produkt-/Onboarding-Thema |

## Priority Assessment

| Rang | Thema | Nutzen im Alltag | Aufwand | Risiko | Bewertung |
|---|---|---|---|---|---|
| 1 | Plan Trust & Learning | Höchster Hebel: Tobi sieht, warum ein Plan so aussieht und ob Daten wirklich wirken | M | M | zuerst |
| 2 | Garmin Data Trust | Löst Verwirrung über fehlende Garmin-Daten und verhindert falsche Coach-Schlüsse | M | M | direkt danach |
| 3 | Coach Action Loop | Macht Briefing/Coach/Push handlungsorientiert statt nur informativ | L | M | nach 1/2 |
| 4 | UI Polish & Density | Wichtig, aber weniger fachlicher Hebel als Planung/Datenvertrauen | S-M | S | laufend nebenbei |

## Slice 1 — Plan Trust & Learning

**Ziel:** Jede generierte Woche bekommt einen nachvollziehbaren Trace: Datenlage, Zielprofil, Sicherheitsgründe, bewusst freie Tage, Sportmix und Variation gegenüber den letzten Wochen.

### Tasks

1. **Plan Generation Trace persistieren**
   - Additive Tabelle `pulse_plan_generations`.
   - Speichert `user_id`, `week_start`, `input_snapshot`, `plan_decision`, `sport_mix`, `hard_days`, `created_at`.
   - Kein Speichern von LLM-Prompt-Rohtext, keine Secrets.

2. **Backend-Kontrakt erweitern**
   - `/api/pulse/plan/generate` liefert `planTrace`.
   - `/api/pulse/plan/trace/:weekStart` liefert den letzten Trace.
   - Trace enthält: verwendete Ziele, CTL/ATL/TSB, RPE-Safety, Risk-Signale, Health-States, verfügbare vs. genutzte Tage, letzte 6 Wochen Sportmix.

3. **Plan-UI erklären lassen**
   - Plan-Seite zeigt "Einbezogene Daten" als kompakte, scanbare Erklärung.
   - Freie verfügbare Tage werden positiv erklärt: Reserve, TSB, RPE, Taper, Risk oder Ziel-Fokus.
   - Wiederholung wird nicht nur behauptet, sondern mit Sportmix/Hard-Day-Vergleich gezeigt.

4. **Qualitätsregeln testen**
   - FTP-Ziel erzeugt Bike-Fokus und dokumentiert ihn.
   - Hohe RPE-Signale blockieren harte Reize und erscheinen im Trace.
   - Negative TSB/Risk reduziert Dichte und erscheint im Trace.
   - Verfügbare Tage dürfen bewusst frei bleiben und werden im Trace begründet.

### Acceptance

- Nach einer Plan-Generierung ist in der UI sichtbar, welche Daten eingeflossen sind.
- Tobi kann erkennen, warum nicht alle verfügbaren Tage genutzt wurden.
- Der Trace ist serverseitig persistiert und nach Reload weiter sichtbar.
- Keine direkte LLM-Provider-Nutzung außerhalb `backend/src/lib/llm.ts`.
- `npm run check:migrations`, relevante Backend-Tests, `npm run typecheck`, CI grün.

## Slice 2 — Garmin Data Trust

**Ziel:** Fehlende Garmin-Daten werden domainweise sichtbar und nachprüfbar: Tagesmetriken, Schlafphasen, Aktivitäten, Wetter, Gewicht, Profilwerte und Kalenderstatus.

### Tasks

1. **Coverage-Endpoint**
   - `GET /api/pulse/data-coverage?days=30`.
   - Liefert pro Tag Flags/Counts für `dailyMetrics`, `sleep`, `activities`, `weather`, `weight`.
   - Liefert Profilstatus: FTP, MaxHR, LTHR, VO2max, letzter Profil-Sync.

2. **Data/Settings UI**
   - Data bekommt einen "Abdeckung"-Block.
   - Settings zeigt Sync-Status nach Domain statt nur "last sync".
   - Fehlende Daten werden als "nicht vorhanden", "noch nicht synchronisiert" oder "Garmin liefert nicht" unterschieden, soweit technisch erkennbar.

3. **Backfill-Planung**
   - Erst read-only Coverage, danach optional gezielter Range-Backfill.
   - Keine pauschale "alles neu laden"-Taste ohne klare Datumsgrenzen und Rate-Limit-Schutz.

### Acceptance

- Tobi kann für 2026 sehen, welche Tage/Domains vollständig oder lückenhaft sind.
- Keine Legacy-Tabellen als primäre Quelle für Pulse-UI.
- Sync-Fehler werden nicht still verschluckt, sondern als Coverage-Grund sichtbar, wo möglich.

## Slice 3 — Coach Action Loop

**Ziel:** Briefing, Coach, Risk, Push und Plan münden in wenige klare nächste Aktionen.

### Tasks

1. **Next Best Actions**
   - Backend-Helper aus PulseContext: maximal 3 Aktionen mit Priorität, Grund und Zielseite.
   - Beispiele: Push aktivieren, Check-in fehlt, RPE nach letzter Einheit fehlt, kritisches Risk-Signal ansehen, Plan für nächste Woche erzeugen.

2. **Home/Coach Integration**
   - Home zeigt Aktionen als kompakte Arbeitsliste.
   - Coach kann die Aktionen referenzieren, ohne eigene Datenlogik zu bauen.

3. **Push-Aktivierungs-Nudge**
   - Wenn VAPID konfiguriert ist, aber kein aktives Gerät existiert, erscheint ein Settings-Link.
   - Keine Push-Spam-Mechanik; Aktivierung bleibt Nutzerentscheidung.

### Acceptance

- Home beantwortet "Was soll ich jetzt tun?" ohne neuen Habit-Tracker.
- Aktionen kommen aus einer Server-Quelle und sind testbar.
- Coach/Briefing bleiben auf PulseContext.

## Nicht-Ziele

- Kein Telegram.
- Kein Datenexport.
- Kein Habit-Tracker.
- Kein neues Dashboard neben Home/Data/Plan/Coach/Insights.
- Kein Rebuild von completed-Plänen.

## Empfohlene Reihenfolge

1. `codex/plan-trust-learning`
2. `codex/garmin-data-trust`
3. `codex/coach-action-loop`

Slice 1 ist zuerst dran, weil er Tobis unmittelbar geäußerte Sorge adressiert: geplante Workouts wirken gleichförmig und die Datenwirkung ist nicht sichtbar genug.
