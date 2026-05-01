# Pulse — Decision Log

> **Pflicht-Datei für AI-Tools (Codex):** Jede nicht-triviale
> Entscheidung — Architektur, Scope, Priorität, technische Wahl —
> bekommt einen Eintrag hier, **bevor** die Session endet. Wenn eine
> Entscheidung nur im Chat besprochen wird, ist sie nicht passiert.
>
> Format pro Eintrag:
> - **Decision:** was entschieden wurde (1 Zeile)
> - **Why:** der Grund (1–3 Sätze)
> - **Alternatives:** verworfene Optionen, kurz
> - **Decided by:** Tobi / Codex (+ PR/Chat-Link, falls vorhanden)
> - **Status:** `active` | `superseded by [link]` | `reversed [date]`
>
> **Newest first.** Append-only — bestehende Einträge nie editieren,
> stattdessen neuen Eintrag mit Status `superseded` oder `reversed`
> anlegen.

---

## 2026-05-01 — Garmin Backfill startet begrenzt und synchron aus Coverage

- **Decision:** Slice 1 der Everyday Utility Wave startet mit einem begrenzten `POST /api/pulse/garmin/backfill` Contract: maximal 31 Tage, Dry-Run-Vorschau, sequentielle Tages-Syncs ueber `syncGarminDay()` und Coverage-basierte Skip-Gründe. Die UI bietet Monats-Chunks in Data an; Queue-/Progress-Persistenz bleibt ein moeglicher Folge-Slice, falls reale 31-Tage-Laeufe zu langsam oder zu wenig beobachtbar sind.
- **Why:** `syncGarminDay()` ist bereits idempotent und schreibt die Pulse-Domains. Der kleinste sichere Nutzenschritt ist deshalb ein harter, auditierbarer Rahmen um den vorhandenen Tages-Sync statt ein neuer ungetesteter Queue-Pfad.
- **Alternatives:** Pauschaler 2026-Reload (zu riskant und nicht rate-limit-freundlich); sofort neue Backfill-Queue plus Persistenz (mehr Scope vor erstem Nutzen); nur read-only Coverage behalten (Datenlücken bleiben nicht handlungsfähig).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Nach Trust-Welle priorisiert Pulse Garmin-Backfill und Plan-Kalibrierung

- **Decision:** Nach Abschluss von Plan Trace, Garmin Coverage und Coach Action Loop wird `docs/superpowers/plans/2026-05-01-everyday-utility-wave.md` die aktive Roadmap. Reihenfolge: bounded Garmin Backfill, Plan Feedback Calibration, Action Closure & Review, Mobile UI QA.
- **Why:** Coverage ist jetzt sichtbar, aber noch nicht handlungsfähig; Plan-Traces sind sichtbar, aber noch nicht als Lernhistorie genutzt. Die nächste Welle soll deshalb Datenlücken gezielt schließen und danach Pläne aus realem Feedback besser kalibrieren, statt neue Produktbereiche zu eröffnen.
- **Alternatives:** Sofort UI-Polish priorisieren (weniger fachlicher Nutzen); unbounded 2026-Garmin-Reload bauen (Rate-Limit-/Fehler-Risiko); neue Feature-Domains starten (widerspricht dem Fokus auf Alltagnutzen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Coach Action Loop nutzt PulseContext als Actions-Quelle

- **Decision:** Slice 3 fuehrt `nextBestActions` im PulseContext ein und macht daraus die gemeinsame Server-Quelle fuer Home, Coach-Prompt und Briefing-Kontext. Aktionen sind auf maximal drei priorisierte Eintraege begrenzt und decken Risk, Check-in, RPE, Plan, Push-Aktivierung und Equipment ab; der Context-Cache nutzt `context-v2`, damit alte Cache-Payloads ohne Actions nicht wiederverwendet werden.
- **Why:** Tobi soll auf Home direkt sehen, was als Naechstes sinnvoll ist, ohne einen Habit-Tracker oder duplizierte Frontend-Heuristiken einzufuehren. Coach und Briefing bleiben dadurch auf PulseContext statt eigener Datenlogik.
- **Alternatives:** Aktionen nur im Frontend aus vorhandenen Endpunkten ableiten (nicht kanonisch); separaten Habit-/Task-Tracker bauen (nicht Ziel des Produkts); Coach/Briefing eigene Action-Heuristiken geben (Drift-Risiko).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Garmin Data Trust startet read-only ueber Coverage statt Backfill

- **Decision:** Slice 2 liefert zuerst einen read-only `/api/pulse/data-coverage` Contract mit Domain-Abdeckung fuer Tagesmetriken, Schlaf, Aktivitaeten/Wetter, Gewicht und Profilwerte. Data zeigt die Abdeckung als eigenen Tab; Settings zeigt kompakte 30-Tage-Domainwerte. Ein Range-Backfill folgt erst nach sichtbarer Diagnose.
- **Why:** Tobi braucht zuerst Klarheit, welche Garmin-Daten fehlen und welche Domain betroffen ist. Eine pauschale Nachladefunktion ohne Coverage-Diagnose wuerde Rate-Limit- und Datenqualitaetsprobleme verschleiern.
- **Alternatives:** Sofort alle 2026-Daten neu laden (zu grob, nicht auditierbar); nur Home-Datenstatus erweitern (zu wenig Detail); Legacy-Garmin-Tabellen auswerten (widerspricht Pulse-Schema-Entscheidung).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Plan-Generierungen bekommen einen persistierten Trace

- **Decision:** Jede neue Wochenplan-Generierung persistiert einen `pulse_plan_generations` Trace mit Input-Snapshot, Plan-Decision, Sportmix, harten Tagen und Summary; Rohprompts oder Provider-Antworten werden nicht gespeichert. Der Trace wird ueber `/api/pulse/plan/trace/:weekStart` gelesen und in der Plan-UI als "Einbezogene Daten" angezeigt.
- **Why:** Tobi muss nachvollziehen koennen, ob Ziele, Garmin-Last, RPE, Risk-Signale, Health-States und Verfuegbarkeit wirklich in den Plan eingeflossen sind. Ein persistierter, strukturierter Trace bleibt nach Reload pruefbar und vermeidet Debugging ueber transienten LLM-Text.
- **Alternatives:** Nur die bestehende `planDecision` im Response anzeigen (nach Reload weg und zu schmal); LLM-Prompt/Antwort komplett speichern (unnötige Datenmenge und potenziell sensible Rohdaten); Trace rein im Frontend rekonstruieren (nicht kanonisch und nicht auditierbar).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Naechste Welle priorisiert Vertrauen vor Feature-Breite

- **Decision:** Die naechste aktive Roadmap-Welle ist `docs/superpowers/plans/2026-05-01-next-wave-product-technical-audit.md`. Reihenfolge: Plan Trust & Learning, Garmin Data Trust, Coach Action Loop.
- **Why:** Nach Phase 11 ist das Kernproblem nicht fehlende Feature-Breite, sondern Alltagvertrauen: Tobi muss sehen, warum Wochenplaene so entstehen, welche Garmin-Daten fehlen und welche naechste Aktion wirklich wichtig ist.
- **Alternatives:** Direkt neue Features bauen (hohes Risiko fuer weitere Breite ohne Nutzenklarheit); nur UI-Polish (behebt fachliche Transparenz nicht); Garmin-Backfill ohne Coverage-Plan (Symptom statt Diagnose).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Race-Prognosen nutzen echte CTL statt festen Platzhalter

- **Decision:** `getActiveRaces()` akzeptiert eine optionale Fitness-Load-Quelle (`ctl`) und berechnet CTL nur als Fallback selbst. PulseContext, `/pulse/races` und Plan-Generierung reichen ihre bereits vorhandene Trainingslast weiter, damit Race-Time-Prognosen nicht mehr auf dem festen Platzhalter `ctl = 30` basieren.
- **Why:** Die Roadmap markierte den hardcoded CTL-Wert als offenen Quickie. Race-Prognosen sollen Tobis aktuelle Form beruecksichtigen und gleichzeitig keine doppelte Load-Berechnung ausloesen, wenn der Aufrufer CTL bereits geladen hat.
- **Alternatives:** CTL weiterhin hardcoden (fachlich falsch); in jedem Race-Aufruf immer `computeFitnessLoad()` starten (einfach, aber vermeidbare Doppelarbeit); Race-Prognosen aus PulseContext entfernen (verliert Nutzen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Implementierte Plan-Dokumente wandern nach completed

- **Decision:** Alle Plan-Dokumente, die laut Merge-/Deploy-Historie erledigt sind, werden aus `docs/superpowers/plans/` nach `docs/superpowers/plans/completed/` verschoben. Roadmap, Current-Focus und Non-Negotiables markieren die bisherige Sequenz bis Phase 11 sowie Web Push/VAPID als erledigt.
- **Why:** Aktive Plan-Dokumente sind Arbeits-Backlog. Wenn implementierte Plaene dort liegen bleiben, riskieren neue AI-Sessions Doppelarbeit oder widerspruechliche Priorisierung.
- **Alternatives:** Plaene aktiv liegen lassen (hohes Rebuild-Risiko); nur Current-Focus aktualisieren (Roadmap bleibt irrefuehrend); Completed-Historie ohne PR-/Commit-Referenz pflegen (schlechter nachvollziehbar).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Mental Insights nutzen PulseContext, Theme-Aggregat und days-aware Cache

- **Decision:** Die Mental-Domain der Deep Insights baut ihren Prompt aus dem gecachten PulseContext fuer Readiness/Load, einem expliziten Check-in-Fenster fuer die angeforderten `days`, dem Mental-Theme-Aggregat und der Mental-Load-Overlay-Statistik. Der Deep-Insight-Cache-Key enthaelt zusaetzlich `days`, damit 7/30/90-Tage-Analysen nicht gegenseitig ueberschrieben werden.
- **Why:** Phase 11 soll descriptive Mental-Analyse liefern, die Check-ins, wiederkehrende Themes und Belastung/TSB gemeinsam interpretiert. PulseContext ist die etablierte gemeinsame Quelle fuer Coach-/Briefing-Kontext, reicht mit `checkins14d` allein aber nicht fuer 30/90-Tage-Analysen; der `days`-Cache-Fix verhindert fachlich falsche Wiederverwendung alter Analysen.
- **Alternatives:** Mental Insights nur ueber `checkins14d` bauen (verliert historische 30/90-Tage-Check-ins); nur Prompt-Text ohne Theme-/Load-Daten erweitern (keine echte Phase-11-Integration); Cache-Key unveraendert lassen (verschiedene Zeitraeume koennten dieselbe Analyse sehen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Mental-Load-Overlay nutzt berechnete Serien statt persistierter Load-Tabelle

- **Decision:** Das Phase-11-Overlay wird aus einer wiederverwendbaren `computeFitnessLoadSeries`-Berechnung gespeist und nicht aus einer neuen `pulse_fitness_load` Tabelle. Der Insights-Overlay-Endpunkt kombiniert diese taeglichen CTL/ATL/TSB/TSS-Punkte mit sparse `pulse_mental_checkins`-Werten.
- **Why:** Im aktuellen Schema gibt es keine persistierte Fitness-Load-Tabelle; `computeFitnessLoad` ist die kanonische Quelle fuer CTL/ATL/TSB. Eine Serienfunktion vermeidet dutzende Einzelberechnungen und schafft die Grundlage fuer Multi-Series-Charts und spaetere theme-aware Insight-Prompts.
- **Alternatives:** Neue Persistenz fuer Fitness Load einfuehren (groesserer Scope und Migration ohne akuten Bedarf); `computeFitnessLoad` pro Chart-Tag aufrufen (ineffizient und inkonsistent); Overlay nur im Frontend aus bestehenden Einzelendpunkten approximieren (keine saubere X-Achsen-Ausrichtung).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Phase 11 startet mit Theme-Timeline als eigenem Slice

- **Decision:** Phase 11 wird zuerst als Mental-Theme-Slice umgesetzt: ein `/api/pulse/mental/themes` Endpunkt aggregiert wiederkehrende Voice-/Check-in-Themes inklusive Wochenfrequenz, Resurfacing/Resolved-Heuristik und Check-in-Occurrences fuer das Timeline-Modal; Mental-Load-Overlay und theme-aware Insights folgen in separaten PRs.
- **Why:** Theme-Timeline ist fachlich eigenstaendig und liefert sofort Alltagssichtbarkeit fuer vorhandene `pulse_mental_checkins.themes`. Die Occurrences direkt im Aggregat vermeiden einen zweiten Detail-Endpunkt und halten die Data/Mental-UI ohne weitere Roundtrips bedienbar.
- **Alternatives:** Alle Phase-11-Tasks in einem PR bauen (zu breit fuer Review und Deployment); Modal-Daten ueber `checkin/history` im Frontend zusammensuchen (mehr Client-Logik und groesserer Datenabruf); neue persistente Theme-Tabelle einfuehren (laut Plan nicht noetig).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Phase 10 UI bleibt in Plan, Settings und ActivityDetail

- **Decision:** Strength Logging und Equipment Tracking bekommen keine neue Hauptnavigation. Der Strength Logger sitzt im Plan-Training-Tab mit e1RM/Recent-Session-Summary, Equipment-Verwaltung und Defaults sitzen in Settings, und das manuelle Equipment-Override sitzt direkt im ActivityDetail; dafür liefert `GET /pulse/activities/:id` die aktuellen `equipmentIds` mit.
- **Why:** Strength und Equipment sind Hilfs-Workflows rund um Training und Garmin-Aktivitäten. Eine eigene Seite würde Alltagswege verlängern; die bestehenden Oberflächen haben bereits die richtige Aufgabe: Plan fürs Loggen/Analysieren, Settings für Stammdaten, ActivityDetail für Aktivitätskorrekturen.
- **Alternatives:** Eigene Equipment-/Strength-Seite bauen (mehr Navigation und Scope); Override ohne aktuelle Zuordnung anzeigen (fachlich unehrlich); nur Settings ohne ActivityDetail-Override bauen (Default-Fehler wären schwer korrigierbar).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Phase 10 startet als Backend-Fundament vor UI

- **Decision:** Phase 10 wird in reviewbare Slices geschnitten. Der erste Slice liefert additive Strength-/Equipment-Tabellen, Backend-APIs, idempotente Equipment-Mileage-Zuordnung und PulseContext-/Coach-/Briefing-Anbindung; UI-Komponenten folgen separat.
- **Why:** Strength Logger, Equipment-Liste, Activity-Override und Plan-Analyse berühren viele Frontend-Flächen. Ein Backend-Fundament mit Tests reduziert Review-Risiko und macht die spätere UI zu einer Anbindung an stabile Verträge statt zu einem Full-Stack-Klumpen.
- **Alternatives:** Phase 10 in einem PR vollständig bauen (zu breit); nur UI-Mockups ohne persistente API bauen (nicht nutzbar); Equipment-Totals als mutable Spalte speichern (anfällig bei Overrides).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Web Push Triggers hängen an bestehenden Jobs und pushen Criticals nur neu

- **Decision:** Web-Push-Trigger werden als zweiter Slice an die bestehenden Auslöser gehängt: Briefing pusht nur beim ersten erfolgreichen Insert pro Nutzer und Tag, der Check-in-Reminder läuft als eigener BullMQ-Repeat-Job um 19:30 Europe/Berlin, und Risk-Watch pusht nur neu eingefügte `critical`-Signale.
- **Why:** Die Foundation enthält bereits Topic-Filter, Quiet-Hours und Subscription-Lifecycle. Trigger sollen diese Regeln nur nutzen und keine zweite Filterlogik bauen; bei Risk-Watch verhindert “nur neue Criticals” wiederholte Pushes aus den regelmäßigen Garmin-Sync-Läufen.
- **Alternatives:** Alle Trigger in einen neuen zentralen Notification-Worker auslagern (mehr Infrastruktur ohne aktuellen Nutzen); auch Warn→Critical-Updates pushen (höheres Spam-Risiko); Check-in-Reminder im Frontend timen (funktioniert nicht, wenn die App geschlossen ist).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Web Push startet als Foundation-Slice ohne Trigger-Jobs

- **Decision:** Web Push wird zuerst als Foundation-PR umgesetzt: additive Subscription-Tabelle, optionale VAPID-Konfiguration, Backend-Settings-/Subscribe-/Test-Endpunkte, Service Worker/Manifest und Settings-UI. Briefing-, Check-in- und Risk-Trigger folgen separat.
- **Why:** Push berührt DB, Backend-Env, Service Worker und Settings-UI gleichzeitig. Ein schmaler erster Slice macht die Browser-Berechtigung und den End-to-End-Test möglich, ohne die Job-Trigger und Dedupe-Regeln im selben PR zu verstecken.
- **Alternatives:** Vollständige Push-Phase in einem PR (zu breiter Review- und Deploy-Radius); VAPID-Keys hart erforderlich machen (würde lokale Tests und Deploys ohne Secret sofort brechen); Trigger-Jobs ohne Settings/Test-Flow zuerst bauen (schwer verifizierbar).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Frontend-QA räumt React-Compiler-Lint vor Web Push auf

- **Decision:** Vor Web Push wird eine kleine Frontend-QA-Runde abgeschlossen, die React-19/Compiler-Lint-Funde in Plan/Coach-nahen Flows und Activity-/Fueling-Komponenten behebt.
- **Why:** Web Push fügt neue Frontend-Zustände, Service-Worker-Interaktion und Settings-UI hinzu. Ein bereits roter Frontend-Lint würde echte Regressionssignale verdecken und die nächste Feature-Phase unnötig fragil machen.
- **Alternatives:** Lint weiter ignorieren und nur Builds verwenden (verpasst React-Compiler-Probleme); Web Push direkt beginnen (mehr neue Oberfläche auf unsauberer Basis).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Garmin-Workouts bekommen HR-Zielzonen statt No-Target-Steps

- **Decision:** Strukturierte Run/Bike/Hike-Workout-Steps erhalten deterministisch berechnete HR-Zielbereiche im `WorkoutStep`-JSON und werden beim Garmin-Upload als `heart.rate.zone`-Targets exportiert. Schwimmen und Kraft bleiben vorerst ohne erzwungene HR-Targets.
- **Why:** Nach der HR-first Plan-Engine waren Pulsziele zwar im Text sichtbar, aber Garmin bekam weiter `no.target`-Steps. Die Zielsteuerung muss bis zum Gerät reichen, ohne das LLM zur Quelle der Intensitätslogik zu machen.
- **Alternatives:** Nur bpm in Beschreibungstext schreiben (auf der Uhr nicht als Target nutzbar); Custom-HR-Range ohne verifizierte Garmin-Payload erzwingen (höheres Upload-Risiko); Power/Pace-Targets weiter priorisieren (widerspricht Tobis HR-first Steuerung).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Plan-Engine entscheidet Zielmix und Safety deterministisch

- **Decision:** Wochenpläne bekommen eine deterministische Plan-Intelligence-Schicht: aktive Ziele bestimmen Sportmix und harte Reize, RPE aus jüngsten Einheiten kann Trainingsdichte und Intensität reduzieren, und jede Einheit erhält vor LLM-Enrichment eine HR-first Beschreibung mit Pulsbereich.
- **Why:** Tobi sah repetitive Workouts und erwartete, dass Ziele, Garmin-Profil und subjektive Belastung tatsächlich die Planung verändern. Struktur und Safety dürfen nicht von LLM-Text abhängen; das LLM darf nur noch Beschreibungen verfeinern.
- **Alternatives:** Nur den Prompt anpassen (weiter nicht testbar); LLM die komplette Woche frei planen lassen (weniger deterministisch); RPE nur im Coach/Briefing anzeigen (Plan bleibt blind für gefühlte Überlastung).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Coach, Voice und Live-Briefing teilen denselben PulseContext

- **Decision:** Coach-UI und neue Pulse-Coach-History laufen über `pulse_coach_sessions`; Legacy `/api/chat/*` bleibt kompatibel, nutzt aber denselben reichen PulseContext-Prompt. Voice-Check-ins erzeugen ihre finale Coach-Antwort erst nach Persistenz des Check-ins, und Live-Briefings verwenden denselben Briefing-Prompt wie der Background-Job.
- **Why:** Text-Chat, Voice-Reply und Live-Briefing hatten dieselben Daten fachlich unterschiedlich gelesen. Dadurch konnten Check-ins, Risk-Signale, RPE und Recovery im UI-Loop unterschiedlich stark wirken. Ein gemeinsamer Context-Pfad macht Coach-Antworten und Briefings konsistenter und invalidierbar.
- **Alternatives:** Legacy-Chat sofort entfernen (unnötiges Breaking Change); nur Coach-UI umhängen, aber Backend-Legacy flach lassen (weiter Drift); Live-Briefing weiter mit eigener SQL-Auswahl bauen (Risk/RPE/Recovery bleiben lückenhaft).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Deploy und CI werden vor weiteren Features gehärtet

- **Decision:** Vor den nächsten fachlichen Features bekommt Pulse eine Phase-0-Stabilitätsrunde: SQL-Migrationen bilden alle Drizzle-Tabellen ab, der Server-Deploy führt `db:migrate` vor PM2-Restarts aus, und GitHub CI prüft Migration-Guard, Build und Backend-Tests mit Postgres/Redis-Services.
- **Why:** Der Audit zeigte, dass Code und Server-Schema auseinanderlaufen konnten, weil Migrationen nicht Teil des Deploy-Pfads waren und CI weder Build noch Tests gate-te. Diese Fehlerklasse blockiert verlässliche Coach-, Briefing- und Plan-Verbesserungen.
- **Alternatives:** Direkt mit Coach/Briefing-Konsolidierung weitermachen (würde auf wackeliger Deploy-Basis bauen); Migrationen weiter manuell/serverseitig prüfen (bricht GitHub-main als Single Source of Truth); nur eine einzelne Baseline-Migration ohne CI/Deploy-Änderung (verhindert Wiederholung nicht).
- **Decided by:** Codex.
- **Status:** active.

## 2026-04-30 — Claude-Code-Integration wird entfernt

- **Decision:** Pulse nutzt vorerst nur noch Codex als AI-Coding-Agent. Die aktive Claude-Code-Integration wird entfernt: `CLAUDE.md` entfällt, `.claude/` wird nicht mehr als Projektzustand geführt, Branch-Regeln erwähnen nur noch `codex/<topic>` und manuelle `tobi/<topic>`-Branches.
- **Why:** Tobi möchte aktuell mit Codex weitermachen und keine parallele Claude-Code-Konfiguration im Projekt pflegen. Eine aktive AI-Regeldatei reduziert Drift und macht `AGENTS.md` zur klaren Wahrheit für Codex.
- **Alternatives:** Claude-Code-Doku als parallele zweite Quelle behalten (unnötige Drift); `CLAUDE.md` leer als Platzhalter behalten (weiterhin missverständlich); historische Plan- und Decision-Referenzen umschreiben (würde Verlauf verfälschen).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-04-30 — Pulse nutzt projektlokale Codex-Skills für wiederkehrende Arbeitsrituale

- **Decision:** Pulse verankert fünf project-level Codex-Skills unter `.codex/skills/`: Session-Ritual, Migration-Guard, PR-Review, Frontend-QA und Deploy-Readiness.
- **Why:** Die kritischen Arbeitsregeln des Projekts sollen nicht nur in langen Prompt- oder Doku-Abschnitten stehen, sondern als kleine, taskbezogen triggerbare Workflows im Repo verfügbar sein. Das reduziert Wiederholung und hilft besonders bei Branch-Hygiene, additiven Migrationen, Review-Risiken und Deploy-Checks.
- **Alternatives:** Nur globale Codex-Skills nutzen (zu wenig Pulse-spezifisch); alle Regeln weiter ausschließlich in `AGENTS.md` pflegen (weniger taskbezogen); große monolithische Pulse-Skill-Datei (zu viel Kontext pro Trigger).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Risk Watch begrenzt die Wochenplanung

- **Decision:** Aktive Risk-Watch-Signale fließen in die Plan-Day-Decision ein. Warnsignale reduzieren die Trainingsfrequenz, kritische Signale deckeln die Woche auf zwei Einheiten; recovery-nahe Signale wie RHR/HRV/Sleep-Debt entfernen harte Reize.
- **Why:** Risiko-Signale dürfen nicht nur als Banner oder Briefing-Text sichtbar sein. Wenn Pulse ein Risiko erkennt, muss der Trainingsplan selbst defensiver werden.
- **Alternatives:** Risk Watch nur in Home/Coach zeigen (zu reaktiv); pauschal alle Trainings bei Warnung löschen (zu grob und im Alltag frustrierend).
- **Decided by:** Codex.
- **Status:** active.

---
## 2026-04-30 — Plan-Entscheidungen werden in der UI sichtbar

- **Decision:** Die Plan-Generierung gibt die Day-Decision an die UI zurück: gewählte Trainingstage, bewusst freie verfügbare Tage und kurze Begründungen. Die Anzeige erscheint direkt nach “Plan erstellen”.
- **Why:** Planqualität soll überprüfbar sein. Wenn Pulse Tage frei lässt oder nicht alle verfügbaren Tage nutzt, muss Tobi sehen können, dass das Absicht ist und welche Daten/Ziele dahinterstehen.
- **Alternatives:** Entscheidung nur im Log belassen (für Tobi unsichtbar); Gründe in Workout-Beschreibungen verstecken (schwer scannbar und vermischt Struktur mit Einheitendetails).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Verfügbarkeit ist Kandidatenraum, keine Trainingspflicht

- **Decision:** Die Wochenplanung interpretiert verfügbare Tage ab sofort als mögliche Trainingstage. Ein neuer Plan-Day-Decision-Layer wählt daraus eine sinnvolle Anzahl und lässt bei Gewichtsziel, negativer Form oder Regenerationswoche bewusst freie Tage stehen.
- **Why:** Tobi meldete zurecht, dass geplante Workouts repetitiv wirken und zu oft alle verfügbaren Tage belegen. Echte Coaching-Planung muss “du könntest” von “du solltest” trennen und Ziele/Belastung in die Wochenstruktur einrechnen.
- **Alternatives:** Feste Sportrotation weiter nutzen und nur Beschreibungen verbessern (behebt das Kernproblem nicht); LLM direkt die komplette Woche frei planen lassen (weniger deterministisch und schwerer testbar).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Risk Watch wird Teil des gemeinsamen PulseContext

- **Decision:** Aktive Risk-Watch-Signale werden in `PulseContext` aufgenommen und von dort in Coach-Systemprompt und Briefing-Prompt ausgespielt. Kritische Signale bekommen eine explizite Prompt-Regel, dass sie adressiert werden müssen.
- **Why:** Coach und Briefing sollen dieselbe kanonische Tageslage sehen, ohne eigene Risk-Queries oder divergierende Formatter. Damit bleibt die Kontext-Unifizierung erhalten und Risk Watch wird im Alltag nicht nur als Home-Banner sichtbar.
- **Alternatives:** Separate Risk-Abfragen direkt in Coach/Briefing (mehr Drift und Cache-Komplexität); nur Home-Banner ohne LLM-Kontext (weniger Coaching-Nutzen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Risk Watch erscheint zuerst als Home-Banner

- **Decision:** Die erste Risk-Watch-UI wird als kompakter Home-Banner umgesetzt, der nur aktive `warn`/`critical`-Signale zeigt und Snooze direkt anbietet. Info-Signale bleiben aus der Startseite heraus, bis ein sinnvoller Inbox-/Historienkontext existiert.
- **Why:** Die Home-Seite ist der tägliche Einstieg und soll nur handlungsrelevante Risiken zeigen, ohne als zweite Analyseansicht zu wirken. Der Backend-Lifecycle ist bereits vorhanden; der UI-Slice bleibt dadurch klein und sofort nutzbar.
- **Alternatives:** Eigene Risk-Watch-Seite im ersten UI-Slice (zu viel Navigation für wenig Zusatznutzen); alle Info-Signale im Home-Banner anzeigen (zu viel Rauschen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Risk Watch startet als Backend-Regelschicht

- **Decision:** Risk Watch wird zuerst als Backend-Slice umgesetzt: additive Tabelle `pulse_risk_signals`, reine Rule-Engine mit fünf Regeln, Persistenz-Lifecycle, API und Garmin-Post-Sync-Hook. UI sowie Coach-/Briefing-Anzeige folgen separat.
- **Why:** Die Risikoerkennung ist die zentrale Logik und muss idempotent sowie testbar sein, bevor Home-Banner oder Push-Kanäle darauf aufbauen. Kleine PRs reduzieren Risiko bei Migration, Background-Job und API gleichzeitig.
- **Alternatives:** Kompletter Risk-Watch-Plan in einem PR (zu breit: DB, Job, API, Home, Coach, Tests); nur UI auf bestehenden Insights (kein aktiver Frühwarnnutzen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — RPE wird über PulseContext in Coach und Plan ausgewertet

- **Decision:** RPE aus `pulse_activities` wird in den gemeinsamen PulseContext aufgenommen, im Coach-Systemprompt und Briefing-Prompt ausgespielt und in `/pulse/training-analytics` als RPE-vs-Zone-Auswertung geliefert. Geplante Zone aus completed Workouts hat Vorrang; falls keine Plan-Verknüpfung existiert, nutzt die Statistik die bestehende Intensitätsableitung als Fallback.
- **Why:** RPE soll nicht nur im ActivityDetail gespeichert werden, sondern den täglichen Coaching-Loop beeinflussen. PulseContext ist bereits die gemeinsame Wahrheit für Coach und Briefing; die Plan-Statistik hängt an `/training-analytics`.
- **Alternatives:** Separater RPE-Service oder neue Analytics-Route (mehr API-Oberfläche ohne Bedarf); reine Frontend-Berechnung aus Activity-Listen (würde Coach/Briefing nicht verbessern).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Drizzle-Journal muss jede SQL-Migration referenzieren

- **Decision:** `backend/src/db/migrations/meta/_journal.json` wird wieder mit allen vorhandenen SQL-Migrationen synchronisiert und ein GitHub-Workflow blockt künftig Migrationen, die keinen Journal-Eintrag haben.
- **Why:** Auf dem Server meldete `drizzle-kit migrate` Erfolg, obwohl Migrationen ab `0003` nicht im Journal standen und deshalb nicht zuverlässig angewendet wurden. Das führte dazu, dass der RPE-Code deployed war, die Spalten in `pulse_activities` aber fehlten.
- **Alternatives:** Migrationen weiter manuell mit `psql -f` anwenden (fragil und nicht GitHub-main-getrieben); alle alten Migrationen in eine neue Sammelmigration kopieren (riskant wegen bereits existierender Spalten und schlechter Historie).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-30 — Garmin-Activity-Import nutzt gemeinsame Upsert-Strecke

- **Decision:** Tages-Sync und Activity-Backfill schreiben Garmin-Aktivitäten über einen gemeinsamen Helper (`backend/src/lib/garmin-activities.ts`). Der Backfill ist range-basiert (`BACKFILL_ACTIVITIES_START`/`END`, Default ab 2026-01-01) und der Upsert aktualisiert Garmin-Messwerte aus `excluded`, ohne RPE-Feedbackfelder zu überschreiben.
- **Why:** Nach der RPE-Erweiterung schlug der Activity-Insert im Tages-Backfill fehl, und das alte Backfill-Skript war auf 2025 hartcodiert sowie bei Konflikten praktisch no-op. Eine gemeinsame Strecke verhindert Drift zwischen manuellem Backfill und täglichem Sync.
- **Alternatives:** Nur das Backfill-Skript per Raw-SQL reparieren (würde den täglichen Sync weiter fragil lassen); 2025 weiterhin pauschal importieren (mehr Daten als angefragt und langsamer).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-29 — RPE zuerst als Activity-Feedback-Schnitt

- **Decision:** RPE & Post-Workout-Feedback wird in mindestens zwei PRs geschnitten. Slice 1 liefert additive Activity-Spalten, PATCH-Endpoint, Shared-Kontrakt und ActivityDetail-Feedback-Sheet; Coach-/Briefing-Kontext und Plan-RPE-Trends folgen separat.
- **Why:** Der erste Slice macht die Datenerfassung sofort nutzbar und reduziert Risiko, bevor RPE in Coaching- und Analyse-Prompts einfliesst. Migration, API und UI sind bereits ein zusammenhaengender Review-Block.
- **Alternatives:** Kompletten RPE-Plan in einem PR (zu breit: DB, UI, Coach, Briefing und Statistik gleichzeitig); nur Backend ohne UI (kein Alltagsnutzen).
- **Decided by:** Codex, PR pending.
- **Status:** active.

---

## 2026-04-29 — Deploy baut und startet Frontend Preview mit

- **Decision:** `scripts/deploy.sh` baut jetzt auch `frontend` und startet den PM2-Prozess `pulse-frontend` neu, falls er existiert. Backend und Frontend werden damit bei jedem Server-Deploy gemeinsam aktualisiert.
- **Why:** Nach PR #15 war der Server-Code auf `main`, aber `https://192.168.178.46:5175` zeigte weiter den alten Vite-Preview-Build, weil der Deploy nur Shared/Backend baute und nur `pulse` neu startete.
- **Alternatives:** Frontend nach jedem Deploy manuell bauen und neu starten (fragil); Vite-Preview durch Dev-Server ersetzen (nicht noetig fuer diesen Fix).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-04-29 — Bundle C trennt Plan-Statistik von Insights

- **Decision:** Der Plan-Untertab heisst `Statistik` und bleibt rein trainingsmetrisch (TSS-Kalender, Intensitaetsverteilung, VO2max, Wochenumfang). `Insights` bleibt als eigener Top-Level-Bereich fuer KI-Narrativ sichtbar und bekommt zusaetzlich eine Home-Quick-Action; die Mobile-Nav nutzt kurze Labels, damit sechs Tabs nicht umbrechen.
- **Why:** Der Code hatte bereits eine `/insights`-Route in der Navigation, waehrend `CLAUDE.md` noch fuenf Tabs dokumentierte. Die Trennung verhindert, dass Plan-Statistiken und KI-Interpretation wieder in einem unscharfen Analyse-Tab verschwimmen.
- **Alternatives:** Insights aus der Bottom-Nav entfernen und nur ueber Home verlinken (verworfen, weil die bestehende App Insights bereits als Top-Level-Route fuehrt); Plan-Analyse unveraendert lassen (Dokumentationsdrift und unklarer Page-Auftrag).
- **Decided by:** Codex, PR pending.
- **Status:** active.

---

## 2026-04-29 — Bündel C zuerst als Cache/Endpoint-Schnitt

- **Decision:** Bündel C wird in zwei PRs geschnitten. Der erste PR liefert Cache-Lib, `/pulse/readiness`, `/pulse/load`, Context-/Load-Cache-Nutzung und Invalidation; der Plan/Analyse- und Insights-Navigationsschnitt bleibt ein eigener Folge-PR.
- **Why:** Der Deploy-Hotfix fuer Shared-Builds war dringlich und C beruehrt viele Frontend-Flows. Ein kleiner Cache/Endpoint-PR reduziert Risiko und liefert schon den Performance-Nutzen fuer Home/Coach.
- **Alternatives:** Komplettes Bündel C in einem PR (zu breit nach dem Deploy-Fix); nur UI-Aufraeumen ohne Cache (verfehlt den Kernnutzen).
- **Decided by:** Codex, PR pending.
- **Status:** active.

---

## 2026-04-29 — Kompakter AI-Kontext vor Vollhistorie

- **Decision:** AI-Sessions starten mit `docs/ai/session-brief.md`, `docs/ai/current-focus.md`, `docs/ai/non-negotiables.md` und `docs/ai/context-map.md`, bevor lange Historien oder breite Codebereiche gelesen werden. `docs/decisions.md` bleibt die vollstaendige Chronik, wird aber nicht mehr als primaere Arbeitszusammenfassung verwendet.
- **Why:** Pulse hat genug Regeln, Plaene und Historie, dass wiederholtes Voll-Lesen pro Session Tokens verschwendet und alte Scope-Details leichter versehentlich reaktiviert. Die kompakten Dateien geben Agents denselben Qualitaetsrahmen mit weniger Kontextlast.
- **Alternatives:** Nur den Pointer-Prompt verwenden (spart Prompt-Tokens, aber nicht Repo-Lese-Tokens); alle Regeln weiter in `CLAUDE.md`/`AGENTS.md` duplizieren (mehr Drift).
- **Decided by:** Tobi + Codex, PR pending.
- **Status:** active.

---

## 2026-04-29 — Datenexport aus Phase 11 entfernt

- **Decision:** Datenexport ist bis auf Widerruf kein Feature-Ziel fuer Pulse. Phase 11 bleibt auf Mental-Theme-Timeline und Mental-Load-Overlay fokussiert.
- **Why:** Tobi braucht den Export im Alltag nicht; er wuerde eine Wartungs- und Datenschutzflaeche schaffen, ohne aktuellen Nutzen zu bringen.
- **Alternatives:** Export als optionales Backlog-Item behalten (verworfen, weil AI-Tools ihn sonst spaeter aus alten Plan-Docs wieder priorisieren koennten).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-04-29 — Deploy baut Shared vor Backend

- **Decision:** `scripts/deploy.sh` installiert Workspaces im Repo-Root und baut `shared` vor `backend`. Backend-only Builds auf dem Server sind nicht mehr ausreichend, sobald Backend neue Shared-Subpath-Exports importiert.
- **Why:** PR #11 erweiterte `@coaching-os/shared` um `pulse-thresholds`; lokal war der Root-Build gruen, der Server-Deploy scheiterte aber, weil `shared/dist` dort vor dem Backend-Build nicht aktualisiert wurde.
- **Alternatives:** Shared-Dist committen (verworfen — Build-Artefakte gehoeren nicht ins Repo); manuell vor jedem Deploy `npm run build -w shared` ausfuehren (fragil).
- **Decided by:** Codex, PR pending.
- **Status:** active.

---

## 2026-04-29 — Thresholds als Shared-Package-Kontrakt

- **Decision:** Readiness-, TSB-, HRV- und RPE-Buckets leben als reine Daten plus `bucketize()` im Shared-Package (`@coaching-os/shared/pulse-thresholds`). Backend gibt fuer Readiness neben Score auch `label`, `shortLabel` und `color` aus; Frontend rendert diese Tokens und klassifiziert Readiness/TSB nicht mehr selbst.
- **Why:** Die App hatte widerspruechliche Schwellen zwischen Server und Home-UI. Ein Shared-Kontrakt macht spaetere Features wie RPE und Risk Watch konsistent und reduziert UI-Sonderlogik.
- **Alternatives:** Schwellen nur im Frontend zentralisieren (Server/Briefing wuerde weiter driften); Backend-Enums ohne Beschreibungen (Tooltips wuerden weiter separat gepflegt).
- **Decided by:** Codex, PR pending.
- **Status:** active.

---

## 2026-04-29 — Pulse-Context als gemeinsame Server-Wahrheit für Bündel A

- **Decision:** Bundle A führt `buildPulseContextFor(userId, date)` als zentrale Server-Context-Schicht ein. Briefing, `/api/pulse/coach`, Legacy-Chat, Health-Summary und der Garmin-Alarmjob lesen ihre Tages-, Load-, Readiness-, Health-State- und Workout-Kontexte aus Pulse-Tabellen; der Legacy-Write nach `garmin_daily_health` bleibt vorerst als Kompatibilitätspfad markiert.
- **Why:** Der gleiche Coaching-Kontext wurde bisher mehrfach und teils aus alten Tabellen aufgebaut. Eine gemeinsame Builder-Schicht reduziert Drift zwischen Briefing und Coach und macht spätere Threshold- und Endpoint-Konsolidierung kleiner.
- **Alternatives:** Nur den Briefing-Job migrieren (zu wenig, Coach/Chat würden weiter driften); Legacy-Write sofort entfernen (zu riskant für bestehende Garmin-Kompatibilität ohne separaten Cleanup-PR).
- **Decided by:** Codex, PR pending.
- **Status:** active.

---

## 2026-04-29 — Codex-System-Prompt auf Pointer reduziert

- **Decision:** `docs/codex-system-prompt.md` enthält statt des langen ~150-Zeilen-Prompts nur noch einen ~10-Zeilen-Pointer-Prompt zum Kopieren. Hard Rules, Roadmap, Anti-Patterns leben in `AGENTS.md`, `CLAUDE.md`, `docs/decisions.md`, `docs/superpowers/plans/`. CI-Sync-Check prüft jetzt nur noch `CLAUDE.md` und `AGENTS.md`.
- **Why:** Codex CLI lädt `AGENTS.md` automatisch beim Session-Start. Den langen Prompt zu pasten dupliziert Repo-Inhalt, kostet ~2000 Tokens pro Session und hat ein Drift-Risiko, sobald sich die Roadmap ändert. Mit `decisions.md` + CI-Check sind die Repo-Files zuverlässig die Wahrheit.
- **Alternatives:** Langen Prompt behalten (Token-Verschwendung + manuelles Sync-Risiko); `codex-system-prompt.md` ganz löschen (verlieren Doku, wie Codex aufgesetzt wird).
- **Decided by:** Tobi + Claude Code, supersedes ein Teil der Entscheidung vom Setup-Tag.
- **Status:** active. Supersedet: den 2026-04-29-Eintrag „Codex-System-Prompt als eigene Datei" (Datei existiert weiter, aber als reine Doku, nicht als Roadmap-Mirror).

---

## 2026-04-29 — Decision-Log eingeführt + CI-Sync-Check

- **Decision:** Diese Datei (`docs/decisions.md`) wird zur Pflicht für jede AI-Session. Zusätzlich CI-Workflow `.github/workflows/docs-sync.yml`, der prüft, ob Hard-Rule-Marker in CLAUDE.md, AGENTS.md, codex-system-prompt.md vorhanden sind.
- **Why:** Setup mit drei Tools (Claude Code, Codex, Tobi manuell) und drei Doc-Dateien hat zwei Drift-Risiken: (a) Chat-Entscheidungen werden nicht persistiert; (b) die drei Doc-Dateien laufen auseinander, wenn nur eine geändert wird.
- **Alternatives:** „Nur ehrliche Disziplin" (zu fragil); ein einziges Master-Doc mit Includes (zu invasiv für die unterschiedliche Tonalität pro Audience).
- **Decided by:** Tobi + Claude Code, [PR pending].
- **Status:** active.

---

## 2026-04-29 — `completed/`-Archiv für erledigte Pläne

- **Decision:** 11 Plan-Dateien (Phasen 3a–9, Mental-Check-in, HR-First) und 1 Spec nach `docs/superpowers/plans/completed/` bzw. `specs/completed/` verschoben. `completed/README.md` mit „⚠ do not implement"-Banner.
- **Why:** AI-Tools sollen nicht versehentlich abgeschlossene Pläne re-implementieren. Top-Level `plans/` enthält nur noch aktive Pläne.
- **Alternatives:** Pläne in-place mit Banner markieren (visuell schwächer); Pläne löschen (verliert Historie).
- **Decided by:** Tobi + Claude Code, [PR #7](https://github.com/tobi12387/pulse/pull/7).
- **Status:** active.

---

## 2026-04-29 — Codex-System-Prompt als eigene Datei

- **Decision:** `docs/codex-system-prompt.md` enthält den vollen kopierbaren Prompt für OpenAI Codex. AGENTS.md und CLAUDE.md verlinken darauf.
- **Why:** Codex liest AGENTS.md je nach Setup nicht garantiert vollständig. Eine dezidierte Prompt-Datei macht es explizit, was reinkopiert werden muss, und enthält die roadmap-spezifischen „nicht mehr verhandelbaren" Entscheidungen, die Claude Code im eigenen System-Prompt schon hat.
- **Alternatives:** Nur AGENTS.md (Codex könnte sie übersehen); System-Prompt direkt in Codex-Konfiguration ohne Repo-Spiegel (Drift-Risiko).
- **Decided by:** Tobi + Claude Code, [PR #7](https://github.com/tobi12387/pulse/pull/7).
- **Status:** active.

---

## 2026-04-29 — Phase 10 re-evaluiert; Habit-Tracker gestrichen

- **Decision:** Phase 10 (vorher „Auxiliary Tracking") heißt jetzt „Strength & Equipment Tracking". Habit-Tracker komplett verworfen.
- **Why:** Drei der ursprünglich vorgeschlagenen 5 Habits sind schon auto-erfasst (Schritte aus `pulse_daily_metrics`); die übrigen werden im Voice-Check-in als Themes besser dokumentiert. Manuelles Toggling würde den Eingabekanal duplizieren. Risk Watch deckt zusätzlich datengetriebene Trends ab.
- **Alternatives:** Habit-Tracker als Backlog-Item (verworfen — soll keine Last sein); reduzierten Habit-Tracker mit nur 2 Habits (Aufwand-Nutzen passt nicht).
- **Decided by:** Tobi + Claude Code, [PR #6](https://github.com/tobi12387/pulse/pull/6).
- **Status:** active.

---

## 2026-04-29 — Konsistenz-Bündel A/B/C vor Phase 10/11

- **Decision:** Drei Refactor-Bündel (A: Context Unification, B: Threshold Canonicalization, C: Endpoint & Page Consolidation) werden **vor** den Feature-Phasen RPE/Risk/Push und vor Phase 10/11 implementiert. Reihenfolge: A → B → C → RPE → Risk Watch → Web Push → Phase 10 → Phase 11.
- **Why:** Code-Review nach Phase 9 fand strukturelle Inkonsistenzen: Briefing-Job liest aus Legacy-Schema, Coach-Context wird inline doppelt aufgebaut, TSB-Schwellen widersprechen sich, Server-Readiness-Label ≠ Frontend-Label. Diese Lücken multiplizieren sich, wenn Features ohne Refactor-Basis dazukommen.
- **Alternatives:** Features zuerst, Refactor später (verworfen — Drift wächst); großer Single-Refactor (verworfen — zu groß für sauberen PR).
- **Decided by:** Tobi + Claude Code, [PR #5](https://github.com/tobi12387/pulse/pull/5).
- **Status:** active.

---

## 2026-04-29 — Telegram-Integration verworfen; Web Push als Ersatz

- **Decision:** Phase 12 (Telegram-Notifications) ersatzlos gestrichen. Web Push (PWA) als Plan, der den aktiven Push-Kanal in der bestehenden App schließt.
- **Why:** Tobi will keine Telegram-Integration. Web Push erfüllt denselben Zweck (Briefing-Push, Check-in-Reminder, Risk-Critical-Push) ohne Drittanbieter, ohne neuen Channel.
- **Alternatives:** Email-Digest (passt schlecht zu Mobile-First); Pure Pull-Modus belassen (verfehlt das eigentliche Pain-Point „App muss aktiv geöffnet werden").
- **Decided by:** Tobi, [PR #3](https://github.com/tobi12387/pulse/pull/3) (drop) + [PR #4](https://github.com/tobi12387/pulse/pull/4) (Web-Push-Plan).
- **Status:** active.

---

## 2026-04-29 — Parallel-Workflow für Claude Code + Codex

- **Decision:** GitHub `main` ist Single Source of Truth. Mac und Server sind Konsumenten, niemals Editoren. Branch-Namespaces: `claude/<topic>` (Claude Code), `codex/<topic>` (Codex), `tobi/<topic>` (manuell). Server-Deploy nur via `scripts/deploy.sh`, das dirty Trees und Non-Main-Branches verweigert.
- **Why:** Zwei AI-Tools parallel im selben Repo ohne Konfliktregelung führt zu untracked Files, doppelten Migrationen, und Server-State-Drift. Eine harte Single-Source-of-Truth + Read-Only-Server-Mirror beendet alle drei Drift-Klassen.
- **Alternatives:** Nur ein Tool benutzen (verworfen — beide haben Stärken); manuelles Konflikt-Management (verworfen — fragil).
- **Decided by:** Tobi + Claude Code, [PR #1](https://github.com/tobi12387/pulse/pull/1).
- **Status:** active.
