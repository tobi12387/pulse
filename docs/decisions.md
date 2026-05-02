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

## 2026-05-02 — Daily Decision Quality bleibt read-only und sichtbar

- **Decision:** Pulse fuehrt `GET /api/pulse/decisions/quality` als read-only Qualitaetslayer ein. Der Layer bewertet Action Decisions, Outcome Learning, Check-ins, Garmin-Ausfuehrung, Tagesmetriken und Plan-Traces deterministisch und zeigt den Status kompakt in Home, Coach und Insights.
- **Why:** Tobi soll erkennen, ob Empfehlungen wirklich geholfen haben, sinnvoll wiederholt werden, stale geworden sind oder eine Strategieaenderung brauchen. Der Coach darf diese Qualitaet zitieren, aber nicht als verstecktes Memory erfinden; fehlende Garmin-/Check-in-Daten bleiben als niedrige Evidenzqualitaet sichtbar.
- **Alternatives:** Neues persistiertes Quality-Memory (zu frueh und doppelt zu bestehenden Decisions/Outcomes); LLM-only Bewertung im Coach (nicht auditierbar); eigenes Dashboard (mehr Navigation statt besserer Tagesloop).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Garmin Signal Usefulness priorisiert Daily Decision als ersten Consumer

- **Decision:** `GET /api/pulse/garmin/signal-usefulness` bleibt read-only und nutzt nur Pulse-Tabellen sowie gecachte Garmin-Detailfelder. Die erste Anschlussrichtung ist Daily Decision Quality: Body-Battery-Tiefe, Stressdauer, Respiration und SpO2 werden zuerst als Entscheidungs-/Evidenzqualitaet bewertet; HR-Zonen/Laps folgen danach fuer Plan-Generierung.
- **Why:** Tobi braucht hoehere Alltagsqualitaet aus vorhandenen Daten, nicht mehr Live-Probing oder weitere Rohdatenlisten. Daily Decision Quality ist der direkteste Ort, um untergenutzte Garmin-Signale gegen Empfehlungserfolg, Staleness und Strategieaenderungen zu testen.
- **Alternatives:** Direkt neue Garmin-Sync-Domains bauen (mehr Daten ohne priorisierten Nutzen); HR-Zonen/Laps sofort in Plan-Generierung gewichten (wertvoll, aber erst nach Tagesloop-Qualitaet); alle Signale in Insights visualisieren (mehr Dashboard, weniger Entscheidung).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Naechste Richtung priorisiert Signalnutzen vor weiterer Breite

- **Decision:** Nach Season Strategy priorisiert Pulse drei Zukunftswellen: Garmin Signal Usefulness vor Daily Decision Quality Loop, Fueling & Recovery nur nach expliziten Ernaehrungs-/Produktpraeferenzen. Mobile Field Reliability bleibt ein echtes iPhone-Gate; Native iOS bleibt ein spaeteres Evidence-Gate.
- **Why:** Der groesste Nutzen entsteht jetzt nicht aus mehr Rohdaten oder mehr Seiten, sondern daraus, vorhandene Garmin- und Outcome-Signale sichtbar in bessere Tagesentscheidungen zu uebersetzen. Fueling kann sehr praktisch werden, braucht aber persoenliche Grenzen, damit Pulse nicht zu generisch oder zu bevormundend wird.
- **Alternatives:** Direkt Fueling implementieren (braucht Praeferenzen); weitere Garmin-Syncs ohne Usefulness-Ranking bauen (mehr Daten, unklarer Nutzen); Native iOS vor PWA-Feldbeweis starten (zu viel Plattformaufwand ohne Evidenz).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Season Strategy ist Plan-Guardrail statt neues Dashboard

- **Decision:** Pulse fuehrt `GET /api/pulse/season-strategy` als read-only Saisonstrategie ein, zeigt sie kompakt im Plan und nutzt ihre Guardrails in der Wochenplan-Generierung. Es gibt keine neue Route, keine neue Persistenztabelle und keine native-iOS- oder Public-Hosting-Ausweitung.
- **Why:** Die wiederholten Wochenplaene wirkten zu gleichfoermig, weil der 8-16-Wochen-Kontext zwischen Race Command und Wochenplan fehlte. Eine deterministische Saisonlinie erklaert Taper, Deload, Hard-Day-Caps und absichtlich freie Tage, bevor LLM-Narration daraus Text macht.
- **Alternatives:** Eigenes Strategie-Dashboard (mehr Navigation statt bessere Planentscheidung); LLM-only Saisonplanung (nicht testbar und schwer zu tracen); persistierte Saisonstrategie-Tabelle (v1 kann aus vorhandenen Zielen, RaceContext, Load und Verfuegbarkeit berechnet werden).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Outcome Learning bleibt read-only und deterministisch

- **Decision:** Pulse fuehrt `GET /api/pulse/outcomes/daily` als read-only Daily-Outcome-Layer ein. Der Layer korreliert bestehende Action Decisions, Daily Check-ins, geplante Workouts, Garmin-Aktivitaeten und Tagesmetriken und zeigt das Ergebnis kompakt in Home und Coach.
- **Why:** Empfehlungen sollen nicht nur geschlossen werden, sondern sichtbar aus echten Folge-Daten lernen. Die erste Version muss nachvollziehbar, testbar und ohne neue Persistenz bleiben, damit wiederholte Ratschlaege als bestaetigt, ersetzt, stale oder unklar erklaert werden koennen.
- **Alternatives:** Neues LLM-Memory einfuehren (nicht auditierbar); neue Outcome-Tabelle bauen (v1 braucht keine Persistenz); Outcome nur im Coach-Text verstecken (nicht sichtbar genug fuer den Tagesflow).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Nach Race Command kommen Outcome-Lernen und Saisonstrategie

- **Decision:** Nach Goal/Race Command Center priorisiert Pulse zwei autonome Produktwellen: Daily Outcome Learning Loop vor Season Strategy Planner. Mobile Field Reliability bleibt aktiv, aber echte iPhone-/Push-Evidenz ist ein manueller Gate; Fueling & Recovery wird erst geplant, wenn Ernaehrungspraeferenzen geklaert sind.
- **Why:** Die groesste Alltagsluecke ist jetzt, dass Pulse Empfehlungen zwar schliessen kann, aber noch nicht sichtbar aus deren Ergebnis lernt. Danach braucht der Wochenplan eine Saisonlinie, damit verfuegbare Tage nicht automatisch als Trainingspflicht gelesen werden und wiederkehrende Struktur erklaert wird.
- **Alternatives:** Direkt Fueling bauen (braucht persoenliche Praeferenzen); native iOS vor PWA-Feldbeweis starten (zu frueh); weitere Dashboards bauen (mehr Oberflaeche, weniger Loop-Qualitaet).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Race Command bleibt ein Plan-integrierter Readiness-Contract

- **Decision:** Pulse fuehrt `GET /api/pulse/race-command` als read-only Race-Preparation-Contract ein und zeigt ihn kompakt im Plan-Trainingstab. Die Berechnung nutzt bestehende Race-Ziele, Fitness-Load, geplante Workouts, Health-States und Risk-Signals; es gibt keine neue Persistenztabelle und kein eigenes Race-Dashboard.
- **Why:** Tobi braucht vor Rennen eine klare Antwort, welcher Phase der Plan folgt, welcher Schluesselreiz als naechstes zaehlt und welche Erholungsgrenze aktuell gilt. Diese Sicht gehoert direkt dorthin, wo Planentscheidungen und Workout-Aenderungen passieren, und muss mit CTL/ATL/TSB sowie Risk-/Health-Evidenz belegbar sein.
- **Alternatives:** Race Command als eigene Route bauen (mehr Navigation fuer denselben Entscheidungsflow); Readiness nur im LLM/Briefing formulieren (nicht deterministic/testbar); neue Race-Readiness-Tabelle einfuehren (dupliziert vorhandene Datenquellen).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Garmin-Datenqualität ist ein read-only Domain-Contract

- **Decision:** Pulse fuehrt `GET /api/pulse/garmin/coverage` als read-only Domainqualitaet ein. Der Contract liest nur Pulse-Tabellen mit Garmin-Quelle plus Redis-Circuit-State, zeigt `fresh | partial | missing | stale | blocked` pro Garmin-Domain und verweist Reparaturen auf bestehende bounded Backfill- oder Kalender-Sync-Flows.
- **Why:** Tobi soll in Settings/Data sehen, welchen Garmin-Daten er trauen kann, ohne Logs zu lesen oder unbounded Live-Probes auszulösen. Garmin-Ausfaelle, Rate-Limits und lokale Serviceprobleme muessen als sichtbare Zustände erscheinen, nicht als stilles Weglassen.
- **Alternatives:** Bestehende `/data-coverage` weiter ueberladen (zu tagezentriert und nicht Garmin-spezifisch); GET direkt gegen Garmin ausfuehren (Rate-Limit-/Credential-Risiko); automatische Reparatur beim Anzeigen starten (nicht auditierbar).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Mental Fitness Companion ist sichtbare Tages-Guidance

- **Decision:** Pulse berechnet gefuehrte Daily-Check-in-Fragen deterministisch im `PulseContext` und stellt sie ueber `GET /api/pulse/checkin/guidance` bereit. Mentale Support-Aktionen laufen als `source: mental` durch das bestehende Next-Best-Action- und Closure-Modell; es gibt keine neue versteckte Mental-Health-Memory-Tabelle.
- **Why:** Die Startfragen muessen zum heutigen Zustand passen und duerfen zukuenftige Workouts nicht wie heutige Aufgaben behandeln. Gleichzeitig sollen mentale Hinweise sichtbar, schliessbar und auditierbar bleiben, statt als implizite Coach-Annahme im Prompt zu verschwinden.
- **Alternatives:** Statische Frontend-Fragen behalten (zu ungenau); alles nur vom LLM formulieren lassen (nicht deterministisch/testbar); neues psychologisches Memory einfuehren (zu sensibel und unsichtbar fuer Tobi).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Adaptive Training nutzt deterministisches Execution Review

- **Decision:** Adaptive Training Intelligence v2 fuehrt ein reines `TrainingExecutionReview` ein, das geplante Workouts gegen ausgefuehrte Aktivitaeten, RPE, Soreness und verpasste/ersetzte Einheiten bewertet und diese Signale in Plan-Engine, Plan-Trace und Plan-UI durchreicht, ohne eine neue Persistenztabelle anzulegen.
- **Why:** Wiederholt wirkende Plaene sollen sichtbar entweder bewusst stabil oder datenbasiert angepasst sein. Die Anpassungsentscheidung muss vor LLM-Narration testbar und im Trace inspizierbar bleiben; alte Traces bleiben durch optionale JSON-Felder kompatibel.
- **Alternatives:** Anpassung nur im LLM-Prompt formulieren (nicht deterministisch/testbar); neue Plan-Memory-Tabelle einfuehren (der bestehende Trace reicht); vergangene geplante Einheiten beim Regenerieren loeschen (vernichtet Missed/Replaced-Evidenz).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Pulse Status trennt lokale Services vom Server-Mirror

- **Decision:** Local Ops Autopilot fuehrt `npm run pulse:status` als unabhaengige Triage ein: lokale Docker/Postgres/Redis-Checks laufen getrennt vom Server-Deploy-Mirror-Check, und beide Statuswerte werden im Output sichtbar.
- **Why:** Das wiederkehrende Problem war nicht, dass Pulse deployed defekt war, sondern dass Mac-lokale Testservices fehlten. Ein kombinierter Statuspfad verhindert, dass fehlendes Docker die Servergesundheit verdeckt oder dass Agenten lokale Servicefehler als App-Regression interpretieren.
- **Alternatives:** `services:status && verify:server` (bricht bei fehlendem Docker zu frueh ab); DB-Tests still ueberspringen (falsche Sicherheit); direkt auf dem Server entwickeln (verboten).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Future Waves werden als aktive Plan-Dokumente vorimplementiert

- **Decision:** Die Roadmap-Seeds fuer Adaptive Training Intelligence v2, Mental Fitness Companion, Garmin Data Quality Control Center, Goal/Race Command Center und Local Ops Autopilot werden als aktive Plan-Dokumente konkretisiert, ohne sie direkt in einer Sammel-PR zu implementieren.
- **Why:** Die Wellen beruehren unterschiedliche Subsysteme und sollen in kleinen PRs mit TDD/CI/Deploy umgesetzt werden. Konkrete Plan-Dateien reduzieren Tokenverbrauch und verhindern, dass neue Sessions die gleichen Architekturfragen erneut aufrollen.
- **Alternatives:** Alles sofort in einem grossen Feature-Branch implementieren (zu grosses Risiko); Seeds nur in der Roadmap lassen (zu unkonkret fuer autonome Agenten); Mobile/iPhone-Gates simulieren (falsche Evidenz).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Mobile Field Reliability bleibt ein echtes Device-Gate

- **Decision:** Nach PR #102 werden nur die autonomen Runbook- und Backlog-Aufgaben der Mobile Field Reliability Wave umgesetzt; iPhone/VPN, Add-to-Home-Screen und Push-Aktivierung bleiben manuelle Gates auf Tobis Gerät.
- **Why:** Browser-E2E und Server-Healthchecks koennen lokale Erreichbarkeit absichern, aber nicht das reale iOS-Zertifikat-, VPN-, Standalone- und Push-Verhalten auf dem Zielgeraet beweisen.
- **Alternatives:** Realgeraete-Ergebnis simulieren (falsche Sicherheit); native iOS sofort starten (zu frueh ohne PWA-Evidenz); lokale Serverstrategie durch Tunnel ersetzen (nicht entschieden).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Tägliche Check-in-Actions sind datumsscharf

- **Decision:** Action-Closure-Memory darf tägliche Check-in-Empfehlungen nur für denselben `openedAt`-/Check-in-Tag wiederverwenden oder ausblenden; `/api/pulse/actions?includeHistory=true` zeigt gelöste Entscheidungen nur aus den letzten 14 Tagen.
- **Why:** Ein erledigter Check-in von gestern darf den heutigen Daily Loop nicht stumm schalten. Gleichzeitig soll die UI nur frische, erklärende Historie anzeigen, nicht eine lange Aufgabenchronik.
- **Alternatives:** Check-ins dauerhaft per Titel/Route matchen (führt zu fehlenden heutigen Check-ins); separate History-Tabelle (unnötig); unbegrenzte Historie im UI (zu viel Rauschen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Daily Loop Explainability nutzt bestehende Action- und Evidence-Daten

- **Decision:** Daily Loop Explainability wird ohne neue Persistenz umgesetzt: `/api/pulse/actions?includeHistory=true` liefert sichtbare Aktionen, ausgeblendete Aktionen mit Grund und aktuelle Entscheidungsverläufe aus `pulse_action_decisions`; Insight-Evidence bekommt optionale Zielrouten zu Data, Plan, Insights oder Activity-Details. Coach und Briefing erhalten die sichtbare Action-Historie als Kontext, dürfen sie aber nicht als offene Aufgabe neu formulieren.
- **Why:** Das Closure-Modell existiert bereits und ist die auditierbare Quelle für erledigte, verschobene oder ersetzte Empfehlungen. Neue Tabellen oder verstecktes Coach-Memory würden denselben Loop duplizieren und das Wiederholungsproblem wieder schwerer nachvollziehbar machen.
- **Alternatives:** Neue History-Tabelle (unnötige Doppelhaltung); nur Frontend-History anzeigen (nicht für Coach/Push/Briefing nutzbar); alles im LLM-Prompt merken (nicht sichtbar und nicht testbar).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Abgeschlossene aktive Planwellen werden archiviert

- **Decision:** Die May-1/May-2-Planwellen, deren Code- und Docs-Slices bereits per PR #79-#100 umgesetzt und deployed wurden, werden nach `docs/superpowers/plans/completed/` verschoben. Aktive neue Arbeit startet mit `2026-05-02-future-direction-roadmap.md`, `2026-05-02-daily-loop-explainability-wave.md` und `2026-05-02-mobile-field-reliability-wave.md`.
- **Why:** `docs/superpowers/plans/` ist laut AGENTS.md das aktive Backlog. Bereits erledigte Pläne dort zu lassen führt dazu, dass Agenten alte Arbeit erneut implementieren oder die falsche Reihenfolge ableiten.
- **Alternatives:** Alte Pläne aktiv liegen lassen (verwirrt Backlog und Token-Kontext); erledigte Pläne löschen (verliert historische Begründung); nur `current-focus` korrigieren (die Source-of-Truth-Regel für Planstatus bleibt gebrochen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — FigJam ist Loop-Diagramm, Canva bleibt Screenshot-/Review-Board

- **Decision:** Der aktuelle Pulse Daily Loop wird in FigJam als Architektur-/Ablaufdiagramm gepflegt; Canva bleibt das visuelle UX-Review-Board fuer Screenshots, Route-Notizen und Vorher/Nachher-Reviews. Canva-Edits werden erst nach Preview-Freigabe gespeichert, weil der Canva-Connector dies fuer Design-Commits verlangt.
- **Why:** FigJam eignet sich besser fuer schnelle System- und Flow-Diagramme, waehrend Canva fuer visuelle Route-Sammlungen und Review-Artefakte sinnvoll bleibt. Die Trennung verhindert, dass beide Boards unterschiedliche Wahrheiten ueber Status und Ablauf enthalten.
- **Alternatives:** Alles in Canva pflegen (Canva-Commit-Freigabe bremst autonome Updates); alles in FigJam pflegen (schwaecher fuer Screenshot-/Review-Boards); nur Repo-Docs nutzen (weniger visuell fuer UI/UX-Reviews).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Real-iPhone-QA wird als Evidence-Record gefuehrt

- **Decision:** Real-device iPhone/VPN/PWA-QA wird nicht nur im Chat bestaetigt, sondern in `docs/qa/2026-05-02-iphone-pwa-real-device.md` als ausfuellbarer Evidence-Record festgehalten. Die bestehende Checkliste verweist auf diesen Record.
- **Why:** Die WebKit-/Playwright-Gates pruefen Layout und PWA-Basics, ersetzen aber nicht Zertifikat, VPN, Add-to-Home-Screen, Tastaturverhalten und Push-Faehigkeit auf Tobis echtem iPhone. Ein repo-lokaler Record verhindert, dass manuelle Erkenntnisse beim naechsten Agentenwechsel verloren gehen.
- **Alternatives:** Ergebnis nur im Chat notieren (geht verloren); real-device QA als rein muendliche Freigabe behandeln (nicht nachvollziehbar); sofort native iOS bauen (zu frueh, solange lokale PWA ueber VPN Zielbild bleibt).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Push-Journeys referenzieren Action-Decisions

- **Decision:** Briefing- und Check-in-Pushes werden mit offenen `pulse_action_decisions` verbunden, wenn eine critical/high Next-Best-Action existiert. Die Push-URL enthaelt dann `actionId` und `decisionId`; wenn keine passende offene Action existiert, bleibt der Push eine normale Zielroute ohne Action-Parameter oder wird beim Check-in-Reminder uebersprungen.
- **Why:** Push darf nicht wiederholen, was Tobi bereits erledigt, verschoben oder bewusst verworfen hat. Dieselbe Action-History wie Home/Coach verhindert parallele Erinnerungslogiken und macht Push-Einstiege auditierbar.
- **Alternatives:** Pushes nur ueber Topic/Tag deduplizieren (kennt keine fachliche Erledigung); immer nach `/coach` oder `/` senden (verliert Kontext); eigene Push-Tabelle fuer Journey-State bauen (unnötig, solange `pulse_action_decisions` den Tagesloop abbildet).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Coach Preferences bleiben explizit editierbarer Zustand

- **Decision:** Pulse speichert Coach-Praeferenzen in `pulse_coach_preferences` und macht sie in Settings sichtbar editierbar. Der Coach-Kontext darf diese Zeitfenster, gemiedenen Muster, bevorzugten langen Tage, verletzungssensitiven Constraints und Kommunikationsstil nutzen, aber keine versteckten Persoenlichkeitseigenschaften ableiten.
- **Why:** Wiederholte oder unpassende Empfehlungen lassen sich besser ueber explizite, pruefbare Praeferenzen korrigieren als ueber implizite Chat-Erinnerung. So kann Tobi den Coach steuern, ohne dass Pulse sensible oder nicht sichtbare Annahmen aus Garmin-/Mentaldaten konstruiert.
- **Alternatives:** Praeferenzen nur im Chatverlauf halten (nicht auditierbar); aus Verhalten automatisch ableiten (Risiko falscher und sensibler Schluesse); alles in das Athletenprofil mischen (vermischt physiologische Werte mit Coaching-Stil).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Home und Coach nutzen denselben Action-Closure-Contract

- **Decision:** Die sichtbare Tagesaktion wird ueber `/api/pulse/actions` mit `decisionId` und Status geladen und ueber `PATCH /api/pulse/actions/:id` abgeschlossen, verschoben oder verworfen. Home bekommt kompakte Abschlusskontrollen; Coach zeigt denselben offenen oder leeren Action-State, ohne automatisch eine Nachricht zu senden.
- **Why:** Der Tagesloop muss an einer Stelle geschlossen werden, sonst koennen Home, Coach und Push spaeter auseinanderlaufen. Ein eigener Action-Contract trennt die durable Closure-Historie von `/home`, bleibt aber durch Cache-Invalidierung sofort in Briefing/Home/Coach wirksam.
- **Alternatives:** Nur `/home.nextBestActions` erweitern (vermischt Dashboard-Payload und Mutationen); Abschluss nur im Frontend ausblenden (nicht dauerhaft); Coach bei Action-Klick automatisch losschicken (nimmt Kontrolle aus dem Nutzerflow).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Action Closure startet als explizites Statusmodell

- **Decision:** Pulse fuehrt `pulse_action_decisions` als eigene Action-History ein und kapselt die ersten Statusuebergaenge in einem pure Service `decision-closure.ts`. Next-Best-Actions duerfen dadurch geschlossene oder durch echte Tagesdaten erledigte Aktionen ausblenden, ohne direkt UI-, Push- oder Coach-Memory-Logik zu vermischen.
- **Why:** Wiederholte Empfehlungen entstehen, wenn Pulse nur Empfehlungen erzeugt, aber deren Abschluss nicht als Datenmodell kennt. Eine kleine, auditierbare Tabelle mit Status, Quelle, Zielroute und Rohkontext ist belastbarer als implizite Prompt-Erinnerung und bleibt spaeter fuer Home, Coach und Push wiederverwendbar.
- **Alternatives:** Closure nur im Frontend-State halten (geht beim Reload verloren); direkt Home-/Coach-/Push-Flows im selben PR bauen (zu viel Scope); Coach-Memory unsichtbar im LLM-Kontext halten (nicht pruefbar und schwer zu korrigieren).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Decision Closure kommt vor weiterem Breitenwachstum

- **Decision:** Nach Insight Evidence Links wird Pulse zuerst die Decision-Closure-/Coach-Memory-Welle umsetzen: persistierte Action-Zustaende, Home/Coach-Closure-Controls, sichtbare Coach-Praeferenzen und Push-Action-Journeys. Reine Erweiterungen ohne geschlossenen Tagesloop werden nachrangig behandelt.
- **Why:** Die groesste verbleibende Alltagsluecke ist nicht noch ein Dashboard, sondern ob Pulse weiss, ob eine Empfehlung erledigt, verschoben oder ueberholt wurde. Erst dieser Verlauf verhindert wiederholte oder generische Empfehlungen.
- **Alternatives:** Zuerst weitere Garmin-Felder oder neue UI-Flächen bauen (mehr Oberflaeche, weniger Loop-Closure); Coach-Memory implizit im Prompt halten (nicht auditierbar); Push-Journeys vor Action-State bauen (Spam-/Wiederholungsrisiko).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Insights zeigen strukturierte Datenbasis statt nur Narrativ

- **Decision:** Deep Insights behalten den bestehenden `/api/pulse/insights`-Contract kompatibel, bekommen aber strukturierte `evidence`- und `missingData`-Listen. Datenmangel bleibt ein HTTP-200-Fachzustand (`status: data_missing`), Provider-/Timeoutfehler bleiben sanitizte HTTP-Fehler; leere Schlaf-/HRV-Fenster werden nicht mehr an das LLM zur Narrativbildung geschickt.
- **Why:** Der Nutzer muss sehen, welche Daten und Zeitfenster eine Insight tragen, ohne rohe Providertexte oder Promptdetails zu sehen. Das trennt Vertrauen in die Datenbasis von technischen KI-/Providerproblemen und verhindert leere Daten-Narrative.
- **Alternatives:** Neue Persistenztabellen fuer Insight-Belege (zu gross fuer diesen Slice); nur Frontend-Labels aus `stats` ableiten (keine belastbare API-Semantik); leere Daten weiterhin vom LLM beschreiben lassen (wirkt plausibel, ist aber fachlich schwach).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Lokale Testservices bleiben Mac-basiert und werden bootstrapbar

- **Decision:** Pulse entwickelt weiter lokal im Mac-Workspace mit GitHub `main` als Source of Truth; der Ubuntu-Server bleibt Deploy-Mirror. Lokale Postgres-/Redis-Testservices werden ueber `scripts/dev-services.sh` und `npm run services:*` bootstrapbar, und `verify:local` startet diese Services standardmaessig vor Backend-Tests.
- **Why:** Direktentwicklung auf dem Server wuerde Deploy-Zustand, PM2, echte `.env` und Datenbankbetrieb mit Codearbeit vermischen. Die wiederkehrenden Testprobleme lagen nicht am Mac-Workspace selbst, sondern an fehlendem Service-Bootstrap und unklarer `.env.test`-Prioritaet.
- **Alternatives:** Mac-Checkout loeschen und nur auf dem Server arbeiten (hohes Betriebsrisiko); weiterhin voraussetzen, dass Postgres/Redis manuell laufen (Agentenfehler wiederholen sich); Docker-Services nur dokumentieren, aber nicht in `verify:local` integrieren (zu leicht zu ueberspringen).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-01 — Daily Briefing ignoriert Future-Workouts ohne heutiges Training

- **Decision:** Daily Briefing, Daily Decision und Coach-Startfragen erwähnen zukünftige geplante Workouts nicht mehr, wenn heute kein Training geplant ist. Der Daily Check-in bleibt ohne neue Datenbankfelder, wird aber als geführter Mental-Fitness-Flow über die bestehenden Werte und Notiz-Tags geführt.
- **Why:** Ein Training am 04.05. darf am 01.05. weder wie eine heutige Entscheidung noch wie eine Startfrage wirken. Für trainingsfreie Tage ist der höchste Nutzen die Tagesgrenze, Erholung, Check-in und mentale Stabilität; der konkrete nächste Workout-Ausblick gehört in Plan, nicht ins Daily Briefing.
- **Alternatives:** Zukünftige Workouts weiter als Ausblick im Briefing zeigen (zu leicht als heutige Empfehlung missverständlich); eigene Check-in-Felder für mentale Gesundheit sofort migrieren (zu großer Scope für diese Korrektur); Future-Workout nur visuell abschwächen (Prompt/LLM könnten ihn weiter aufgreifen).
- **Decided by:** Tobi + Codex.
- **Status:** active; supersedes the future-workout-outlook part of "2026-05-01 — Daily Briefing trennt heutige Entscheidung von zukünftigem Trainingsausblick".

---

## 2026-05-01 — Daily Decision Center startet ohne neues Memory-Modell

- **Decision:** Der erste Daily-Decision-Center-Slice nutzt eine deterministische Frontend-Ableitung aus dem bestehenden `/api/pulse/home`-Payload und zeigt dieselbe Tagesentscheidung in Home, Coach und Plan. Die Entscheidung enthält Grund, Grenze, Alternative und Abschlusskriterium; persistente Action-Closure-/Coach-Memory-Tabellen bleiben einem separaten Folge-PR vorbehalten.
- **Why:** Home, Coach und Plan sollen sofort konsistent beantworten, was heute zu tun ist, ohne die nächste größere Decision-Closure-Migration mit UI-Flow und Coach-Memory zu vermischen. Die bestehende Datenbasis reicht für eine verlässliche Tagesentscheidung; Persistenz wird erst nötig, wenn Annahme, Zurückstellung und Abschluss dauerhaft gespeichert werden.
- **Alternatives:** Direkt `pulse_action_decisions` und Preference-Memory bauen (größerer Scope, Migration, Push-Integration); weiterhin drei lokale Tageslogiken behalten (inkonsistente Startfragen); Tagesentscheidung nur in Home anzeigen (Coach/Plan bleiben uneinheitlich).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Plan-Personalisierung variiert wiederholten Sportmix erklärbar

- **Decision:** Ein wiederholter Sportmix der Vorwochen wird als eigenes Plan-Lernsignal (`repeated_sport_mix`) geführt. Dieses Signal erhöht nicht automatisch die Trainingsdichte, sondern rotiert leichte Einheiten deterministisch und macht die Variation im PlanDecision/PlanTrace sichtbar; Health-/Race-Anpassungen werden über `adjustedReason` bis in Persistenz und Trace mitgeführt.
- **Why:** Der Nutzer soll nicht das Gefühl bekommen, jede Woche dieselben Workouts zu erhalten, während der Plan trotzdem stabil, datengetrieben und reproduzierbar bleibt. Außerdem müssen gekürzte oder veränderte Einheiten nachvollziehbar begründet werden, statt nur still im Ergebnis aufzutauchen.
- **Alternatives:** Zufällige Variation pro Generierung (nicht reproduzierbar); mehr Tage füllen, um Abwechslung zu erzeugen (fachlich schlechter); alles über LLM-Beschreibungen erklären (verliert Auditierbarkeit).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-01 — Daily Briefing trennt heutige Entscheidung von zukünftigem Trainingsausblick

- **Decision:** Daily Briefing und Coach-Startfragen behandeln nur Workouts mit `plannedDate === today` als heutige Trainingsempfehlung. Zukünftige Workouts bleiben ein klar markierter Ausblick; der manuelle Daily Check-in wird ohne Migration als geführter Mental-Fitness-Flow über die bestehenden Felder `mood`, `energy`, `stress`, `motivation` und `notes` geführt.
- **Why:** Ein Training am 04.05. darf am 01.05. nicht als heutige Entscheidung erscheinen. Der höchste Nutzen liegt hier in sauberer Tagesorientierung und besserer subjektiver/mentaler Datenerfassung, ohne sofort neue sensible Mental-Health-Felder einzuführen.
- **Alternatives:** Backend-Contract sofort um `todayWorkout` erweitern (größerer Shared-/API-Scope); zukünftige Workouts komplett aus Briefings entfernen (verliert sinnvollen Ausblick); neue Mental-Check-in-Tabelle/Felder sofort bauen (eigener PR wegen Migration, Context, Risk und Insights).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-01 — Garmin-Sync bleibt lokales Single-User-Modell mit benanntem Raw-Adapter

- **Decision:** Pulse bleibt fuer den lokalen Server bei `GARMIN_EMAIL`/`GARMIN_PASSWORD` als serverseitigem Single-User-Garmin-Modell. Raw-ConnectAPI-Zugriffe werden hinter `garminApi` in `backend/src/lib/garmin-client.ts` benannt; der Sidecar-Adapter bleibt nur Fallback fuer Worker-Kontexte ohne Fastify-App. Eine offizielle Garmin-API/OAuth-Migration wird erst relevant, wenn Pulse bewusst multi-user oder extern gehostet wird.
- **Why:** Das aktuelle Ziel ist eine lokal betriebene Alltags-App ueber VPN. OAuth/Token-UX wuerde jetzt mehr Angriffs- und Wartungsflaeche erzeugen, waehrend die echten Probleme aus verstreuten Raw-URLs und unklaren Sync-Pfaden kamen.
- **Alternatives:** Sofort OAuth/Official-API einfuehren (zu frueh fuer lokalen Single-User-Betrieb); Raw-URLs weiter inline lassen (Drift bei Kalender, Workout und Activity-Details); Sidecar wieder zur primaeren Quelle machen (verliert die inzwischen reichere direkte Pulse-Sync-Logik).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Profilwerte bekommen Feld-Herkunft und manuelle Autoritaet

- **Decision:** FTP, MaxHF, LTHR und VO2max bekommen eigene Source-/Timestamp-Felder. Manuell gesetzte Werte sind autoritativ und werden durch Garmin-Sync nicht ueberschrieben; bestehende Profilwerte werden per Migration konservativ als `manual` markiert. Garmin-Profil-Sync nutzt eine kontrollierte Settings-Lesung plus bereits gespeicherte Aktivitaeten fuer Activity-derived FTP/MaxHF.
- **Why:** Trainingszonen und PlanTrace duerfen nicht mehr nackte Zahlen zeigen, deren Herkunft unklar ist. Der Nutzer muss sehen, ob ein Wert manuell, aus Garmin-Settings oder aus Aktivitaeten stammt, und manuelle Korrekturen muessen stabil bleiben.
- **Alternatives:** Garmin-Werte immer ueberschreiben lassen (zerstoert bewusst gesetzte Zonen); Live-Activity-Probing fuer jede Profilaktualisierung (Rate-Limit- und Latenzrisiko); nur UI-Labels ohne Persistenz einfuehren (keine belastbare PlanTrace-/Audit-Basis).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Garmin-Recovery-Depth bleibt optional, erklärend und raw-snapshot-getrennt

- **Decision:** Erweiterte Garmin-Recovery-Signale werden additiv und nullable gespeichert: Sleep-Need/Actual, Schlafstress/HR/Respiration/Body-Battery-Change in `pulse_sleep_sessions`; Body-Battery Charge/Drain/Highest/Lowest/AtWake, Stressdauer, Intensitätsminuten, Respiration und SpO2 in `pulse_daily_metrics`. `bodyBatteryMax` bleibt aus Kompatibilitaetsgruenden der bisherige "most recent"-Wert; echte Tages-Extrema landen in `bodyBatteryHighest`/`bodyBatteryLowest`.
- **Why:** Garmin liefert diese Felder nicht immer und die Payload-Namen sind nicht stabil dokumentiert. Pulse soll Syncs deshalb nicht abbrechen, sondern vorhandene Signale erklaeren und konservativ in Recovery/Risk einbeziehen.
- **Alternatives:** Live-Garmin-Probing fuer jede Ansicht (Rate-Limit- und Latenzrisiko); bestehende Body-Battery-Semantik heimlich umdeuten (Regression in Readiness/Charts); Raw-Garmin-Payloads direkt im Frontend anzeigen (zu laut und fachlich wenig handlungsorientiert).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Workout-Ausführung bekommt eigenes Garmin-Reconciliation-Statusmodell

- **Decision:** Geplante Workouts behalten `status` fuer bestehende Planlogik, bekommen aber zusaetzlich nullable Execution-Felder (`execution_status`, `execution_matched_at`, `execution_match_confidence`, `execution_notes`). Die sechs UI-Zustaende sind `Lokal`, `Garmin`, `Kalender`, `Erledigt`, `Verpasst` und `Ersetzt`; `completed_activity_id` bleibt der kanonische Link zur ausgefuehrten Garmin-Aktivitaet.
- **Why:** Plan-, Lern- und Feedbacklogik duerfen nicht mehr nur zwischen `planned` und `completed` unterscheiden. Der Alltag braucht sichtbar, ob eine Einheit nur lokal existiert, als Garmin-Vorlage vorhanden ist, wirklich im Garmin-Kalender liegt, ausgefuehrt wurde, verpasst ist oder durch eine andere Aktivitaet ersetzt wurde.
- **Alternatives:** Bestehende `status`-Spalte mit neuen Werten ueberladen (Regression fuer Plan-Learning/Filter); nur im Frontend aus Garmin-IDs ableiten (keine Sync-/Audit-Spur); Live-Garmin-Kalender bei jedem Planaufruf lesen (Rate-Limit- und Latenzrisiko).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Garmin Activity Details bekommen eigenen Cache statt `raw_data`-Overwrite

- **Decision:** `pulse_activities.raw_data` bleibt der originale Garmin-Activity-Summary-Snapshot. Garmin-Splits, HR-Zonen und Detailpayloads werden in den nullable Spalten `garmin_detail_data`, `garmin_laps`, `garmin_hr_zones` und `garmin_detail_synced_at` gecacht; alte `{ laps, hrZones }`-Werte in `raw_data` bleiben als Legacy-Fallback lesbar und werden per Migration in den neuen Cache übernommen.
- **Why:** Die Activity-Detailroute hat bisher beim ersten Detailaufruf den ursprünglichen Garmin-Summary-Snapshot zerstört. Die Trennung erhält Audit-/Sync-Rohdaten und erlaubt trotzdem schnelle Detailansichten sowie bestehende Analytics.
- **Alternatives:** Weiter `raw_data` überschreiben (Datenverlust); separate Detailtabelle einführen (mehr Join-/Migrations-Scope für denselben Nutzen); alte Summary-Snapshots rekonstruieren (ohne erneuten Garmin-Summary-Sync nicht zuverlässig möglich).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Pulse priorisiert lokalen iPhone/PWA-Zugriff und Garmin-Datentiefe vor nativer App

- **Decision:** Die nächste Arbeitsfolge bleibt Web/PWA über den lokalen Server per VPN und erweitert zuerst Garmin-Rohdatenerhalt, Execution Reconciliation, Recovery-Datentiefe und sichtbare Entscheidungs-/Preference-Loops. Build Web Apps wird genutzt, sobald das Plugin als Codex-Tool sichtbar ist; Build iOS Apps bleibt eine spätere Native-Wrapper-Evaluation.
- **Why:** Der höchste Alltagsnutzen entsteht, wenn die vorhandene Pulse-App auf dem iPhone zuverlässig bedienbar ist und geplante Garmin-Workouts sauber mit Ausführung, Recovery und Coach-Entscheidungen zusammenlaufen. Eine native iOS-App würde aktuell Plattformaufwand erzeugen, bevor der Kernloop vollständig geschlossen ist.
- **Alternatives:** Sofort native iOS-App bauen (zu früh und mehr Deployment-Oberfläche); öffentliches Hosting/Tunnel einführen (nicht nötig für VPN-Zielbild); weitere breite Features vor Garmin-/Decision-Closure beginnen (erhöht Oberfläche statt Nutzen).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-01 — Garmin Repeat-Gruppen brauchen Iterations-EndCondition plus Anzahlfeld

- **Decision:** Pulse exportiert Garmin-Repeat-Gruppen mit `numberOfIterations = reps` und zusätzlich `endCondition.conditionTypeKey = iterations` sowie `endConditionValue = reps`. Der Garmin-Payload-Bau liegt als pure Helper-Schicht in `backend/src/pulse/services/garmin-workout.ts`.
- **Why:** Die bisherige Variante setzte nur `numberOfIterations` und `lap.button`; Garmin akzeptierte den Upload, speicherte die Wiederholungen aber als `null`. Ein temporärer Live-Probe gegen Garmin bestätigte, dass `numberOfIterations` für die Create-Validierung erforderlich bleibt, der sichtbare Wiederholungswert aber über die Iterations-EndCondition erhalten bleibt.
- **Alternatives:** Nur `endConditionValue` ohne `numberOfIterations` senden (Garmin lehnt mit 400 ab); Repeat-Gruppen in einzelne Steps auflösen (verlängert Workouts und verliert Gruppensemantik); bestehendes Payload belassen (Wiederholungen erscheinen als null).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Nächste Welle priorisiert Daily Intelligence vor Feature-Breite

- **Decision:** Nach der Everyday Flow Deepening Wave startet `docs/superpowers/plans/2026-05-01-daily-intelligence-next-wave.md`. Reihenfolge: Garmin Execution Reconciliation, Plan Personalization Loop, Daily Decision Center, Insight Evidence Links, Deep UI/UX Flow Audit.
- **Why:** Die größten verbleibenden Alltagslücken liegen nicht in neuen Produktbereichen, sondern im geschlossenen Ausführungsloop: Plan auf Garmin bringen, Durchführung erkennen, Feedback lernen, Tagesentscheidung erklären und UI-Flows real prüfen.
- **Alternatives:** Weitere breite Featurebereiche eröffnen (mehr Oberfläche, weniger Nutzen); sofort Design-Polish ohne Execution-Reconciliation (lässt Garmin/Uhr-Fragen offen); alles in einem großen PR bauen (zu hohes Review- und Deploy-Risiko).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Settings werden als sichtbare Aktionsgruppen geführt

- **Decision:** Settings nutzt sichtbare Gruppen für Profil, Verbindung, Datenpflege, Benachrichtigungen und Health-State. Die Gruppierung ist zunächst reine Informationsarchitektur und verwendet die bestehenden Contracts und Komponenten.
- **Why:** Kalender-Sync, Backfill, Push, Profilwerte und Health-State haben unterschiedliche Risiken und Frequenzen. Sie dürfen nicht wie eine gleichwertige Button-Liste wirken, sollen aber ohne neuen Backend-Scope besser scanbar werden.
- **Alternatives:** Neue Settings-Unterseiten bauen (zu groß für diese Phase); alle Karten unverändert lassen (Acceptance bleibt unerfüllt); gefährliche Aktionen nur farblich hervorheben (hilft weniger bei Orientierung).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Backfill-Beobachtung startet ohne neue Persistenz

- **Decision:** Data Backfill Observability nutzt vorerst die vorhandene Backfill-Response plus lokale Browser-Erinnerung (`localStorage`) für den letzten Lauf. Eine serverseitige Backfill-Historie wird erst eingeführt, wenn mehrere Geräte, Auditing oder Langzeitverlauf wirklich gebraucht werden.
- **Why:** Der direkte Alltagsnutzen ist Sichtbarkeit nach Vorschau/echtem Lauf: Zeitraum, geplante Tage, synchronisierte Tage, Fehler und nächste Aktion. Dafür reicht der bestehende API-Contract; eine neue Migration würde den Scope erhöhen, ohne den aktuellen Flow wesentlich robuster zu machen.
- **Alternatives:** Neue Backfill-History-Tabelle sofort einführen (größerer Backend-/Migrations-Scope); nur Toast/kurzen Text zeigen (zu wenig beobachtbar); Fehler als langen Textblock belassen (schwer scanbar).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Insights-Fehler werden am API-Rand klassifiziert

- **Decision:** `/api/pulse/insights` gibt kontrollierte Fehlercodes (`provider_unavailable`, `timeout`, `server_error`, `invalid_domain`) mit Retry-/Action-Hinweisen zurück. Echte Datenlücken bleiben erfolgreiche Responses mit `status: data_missing`, `retryable: false` und konkreter nächster Aktion.
- **Why:** Die UI soll keine rohen Provider- oder Servertexte zeigen und Retry nur anbieten, wenn ein erneuter Versuch fachlich sinnvoll ist. Datenmangel ist kein technischer Fehler und braucht eine Datenanforderung statt eines Retry-Buttons.
- **Alternatives:** Alle Fehler weiter als generischen 503 behandeln (zu wenig Diagnose); Datenmangel als Fehler werfen (falsche Nutzerführung); Providertexte in der UI durchreichen (instabil und potenziell sensibel).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Workout-Ausführung darf nicht von LLM-Verfügbarkeit abhängen

- **Decision:** Strukturierte Workout-Steps bekommen einen deterministischen HR-first-Fallback. Garmin-Upload nutzt diese Steps, wenn die LLM-Detailgenerierung wegen Provider-/Budgetfehlern, leerer Antwort oder ungültigem JSON nicht verfügbar ist.
- **Why:** Der Server zeigte OpenRouter `402`; dadurch blieben geplante Workouts ohne Steps und konnten nicht zuverlässig zu Garmin/Edge/Uhr synchronisiert werden. Die LLM-Schicht darf Coaching-Qualität verbessern, aber nicht die Ausführbarkeit des Plans blockieren.
- **Alternatives:** LLM-Fehler nur in der UI anzeigen (Plan bleibt nicht ausführbar); Garmin-Sync bei fehlenden Steps abbrechen (aktuelles Problem bleibt); alle Garmin-Syncs ausschließlich manuell erzwingen (zu wenig Alltagsnutzen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Plan-Alternativen erweitern Workout-PATCH statt neuen Alternativen-Service

- **Decision:** Plan Alternatives 2.0 nutzt die bestehende Workout-Aktualisierung und erweitert sie um `plannedDate`, `status` und `description`. Die Plan-UI berechnet die ersten semantischen Alternativen deterministisch im Frontend aus Workout, Verfügbarkeit, Zielen und PlanTrace-Kontext.
- **Why:** Der vorhandene `/plan/today/proposal`-Contract ist ein einzelner Sicherheitsvorschlag für heutige Health-/Readiness-Ausnahmen. Für die alltäglichen Optionen "kürzer", "leichter", "verschieben" und "frei lassen" reicht eine kontrollierte Erweiterung des bestehenden Workout-PATCH aus und vermeidet neue Migrationen oder einen zu frühen Alternativen-Service.
- **Alternatives:** Neuen `/plan/alternatives`-Endpoint bauen (größerer Backend-Scope); nur lokale UI ohne echte Mutation zeigen (kein Alltagsnutzen); bestehendes Today-Proposal zweckentfremden (zu eng und nur für heute gedacht).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Figma wird aktiv als Design-System-Ebene eingebunden

- **Decision:** Pulse nutzt Figma/FigJam ab sofort zusätzlich zu Canva und Superpowers. Figma ist die Arbeitsfläche für reusable UI-Sprache, Komponenten, Varianten, Zustände, Layout-Referenzen und perspektivisch Code Connect; Canva bleibt das leichtere Review-/Stakeholder-Board.
- **Why:** Nach dem Core-UI-Chrome-Pass entsteht Nutzen durch konsistente Controls und Zustände. Figma ist dafür besser geeignet als Canva, während Browser/E2E weiterhin die Wahrheit über implementiertes Verhalten liefern und GitHub `main` technische Source of Truth bleibt.
- **Alternatives:** Nur Canva nutzen (zu wenig komponenten- und variantentauglich); Figma als alleinige UX-Quelle nutzen (zu weit weg von deployter App und PR-Flow); Figma erst später prüfen (verpasst jetzt den Design-System-Moment nach `PulseChrome`).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-01 — Canva und Superpowers werden feste UX-Phase-Gates

- **Decision:** Everyday-Flow-Folgephasen nutzen Superpowers als verpflichtenden Prozessrahmen und Canva als visuelles UX-Board. Das Repo bleibt die technische Source of Truth; Canva sammelt Screens, Flow-Kritik und Review-Notizen.
- **Why:** Die wiederkehrenden Probleme entstehen weniger durch einzelne fehlende Komponenten als durch unklare Übergänge zwischen Plan, Browserprüfung, Review und sichtbarer UX-Absprache. Ein festes Gate macht die tägliche Nutzbarkeit prüfbar, ohne Markdown-Pläne oder PRs durch ein externes Design-Tool zu ersetzen.
- **Alternatives:** Nur Markdown-Pläne weiterführen (zu wenig visuelle UX-Kontrolle); Canva als alleinige Planung nutzen (nicht versioniert genug); Superpowers nur optional verwenden (zu leicht zu überspringen).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-01 — Core UI nutzt technische Line-Icons statt Emoji-Metaphern

- **Decision:** Pulse Core UI verwendet für wiederkehrende Navigations-, Status- und Analyse-Symbole ruhige Line-Icons und gemeinsame Chrome-Komponenten (`PageHeader`, `SegmentedControl`, `RangeControl`, `MiniButton`, `IconBadge`) statt lokaler Emoji-/Button-Varianten.
- **Why:** Das bestehende Cockpit-Design ist technisch, dicht und mono-orientiert. Emoji-Icons in Insights und verwandten Core-Flows wirkten wie eine andere Produktsprache und machten die Seiten weniger konsistent.
- **Alternatives:** Emojis nur in Insights ersetzen (zu punktuell); komplette Shadcn-Migration (zu großer Scope); gar keine Icons verwenden (verliert schnelle Domain-Erkennung).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-01 — Coach startet als geführter Tagesdialog statt nur Chat

- **Decision:** Everyday Flow Phase 1 macht den Coach-Empty-State zu einem geführten Tagesbriefing mit Lage, heutiger Grenze, nächster Entscheidung und bewusst vorbereiteten Prompt-Gruppen. Prompts füllen weiter nur das Eingabefeld und senden keine LLM-Anfrage automatisch.
- **Why:** Home führt bereits zur nächsten Aktion, aber der Coach muss den Tagesfaden aufnehmen und nicht wie ein leerer Chat wirken. Die Karte nutzt vorhandene Home-/Briefing-/PulseContext-Daten statt neuer Backend- oder LLM-Wege.
- **Alternatives:** Quick Prompts nur erweitern (zu wenig Führung); automatisches Briefing als Chatnachricht senden (überraschender LLM-Flow); neuen Backend-Contract bauen (nicht nötig für ersten Nutzen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Everyday Flow Deepening priorisiert tägliche Handlung vor Feature-Breite

- **Decision:** Die nächste aktive Welle ist `docs/superpowers/plans/2026-05-01-everyday-flow-deepening-wave.md`. Reihenfolge: Coach-Guided Daily Briefing, Plan Alternatives 2.0, Insights Reliability, Data Backfill Observability, Settings Action Grouping.
- **Why:** Nach der UI/UX Usability Wave sind die Oberflächen verständlicher, aber die täglichen Flows brauchen mehr Handlungstiefe: Coach soll führen, Plan soll echte Anpassungen anbieten, Insights sollen Ursachen erklären, Backfill soll beobachtbar werden und Settings soll nach sicheren Aktionsgruppen funktionieren.
- **Alternatives:** Direkt einzelne UI-Fixes ohne Plan starten (Scope-Drift); neue Produktbereiche eröffnen (widerspricht Alltagsnutzen); alle fünf Phasen in einem großen PR bauen (zu hohes Review-/Deploy-Risiko).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-01 — UI/UX Usability Wave ist abgeschlossen

- **Decision:** Die UI/UX Usability Wave wird nach PR #61, #63, #64, #65 und #66 geschlossen und nach `docs/superpowers/plans/completed/` verschoben. Es bleibt kein aktiver Implementierungsplan offen; neue Arbeit startet erst mit einem neuen Plan-Dokument.
- **Why:** Insights-Resilience, Home/Coach Daily Flow, Plan Decision Flow, Data/Settings Trust und Visual Density sind gemerged, deployed und durch lokale E2E plus CI abgesichert. Der Closeout verhindert Doppelarbeit in künftigen AI-Sessions.
- **Alternatives:** Plan aktiv liegen lassen (Rebuild-Risiko); nur Chat-Zusammenfassung ohne Repo-Status (nicht belastbar); direkt Folgefeatures ohne Plan starten (Scope-Drift).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Visual Density bleibt ein gezielter Label- und Tabstrip-Pass

- **Decision:** UI/UX Slice E begrenzt den Visual-Density-Pass auf klare mobile Hauptnavigation und umbruchfähige Data-/Plan-Tabstrips. Mobile Labels bleiben semantisch gleich zu Desktop (`Insights`, `Settings`), und Tabs werden verdichtet statt abgeschnitten.
- **Why:** Der Browser-Audit zeigte vor allem abgeschnittene Kernlabels und teilweise sichtbare Tabs. Ein kleiner, testbarer Pass senkt Alltagsreibung ohne ein neues Design-System oder großflächige Karten-/Layout-Refactors zu starten.
- **Alternatives:** Komplettes visuelles Redesign (zu großer Scope für die Usability-Welle); weitere Abkürzungen wie `Set` behalten (unklar); Tabstrips nur horizontal scrollen lassen (verhindert Clipping nicht im ersten Blick).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Data und Settings erklären Vertrauenszustände vor Aktionen

- **Decision:** UI/UX Slice D strukturiert Data Coverage als `Status → Ursache → Aktion` und trennt in Settings Push-Zustand nach Server, Browser, Geräten und Testfähigkeit. Backfill-, Kalender-, Push- und Health-State-Aktionen bekommen sichtbare Folgezeilen; technische Push-Endpunkte werden maskiert.
- **Why:** Garmin-Lücken, Push-Berechtigungen und Health-State-Aktionen sind Alltagsentscheidungen, keine Debug-Tabellen. Die UI muss erklären, ob eine Lücke nachladbar ist, ob der Browser blockiert, und welche Aktion Daten oder Geräte wirklich verändert.
- **Alternatives:** Nur Labels kürzen (löst widersprüchliche Zustände nicht); rohe Endpunkte weiter anzeigen (technisch und potenziell sensibel); Backfill weiter nur über Kandidatenzahl erklären (zu indirekt für riskantere Aktion).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Plan startet mit Trainingsentscheidung statt Logger

- **Decision:** UI/UX Slice C stellt im Plan-Trainingstab eine `NÄCHSTE TRAININGSENTSCHEIDUNG` vor Wochenstrip, Verfügbarkeit und Tools. Der Kraft-Logger wandert in einen Tools-Abschnitt, `wechseln` wird zu `Sportart ändern`, und die Planerstellung zeigt vor dem Klick eine kompakte Constraint-Zusammenfassung.
- **Why:** Tobis Kernfrage im Plan ist "Was soll ich trainieren?", nicht zuerst "welchen Satz logge ich?". Die UI muss die Trainingsentscheidung, ihre groben Constraints und gezielte Änderungen sichtbar machen, ohne neue Planlogik einzuführen.
- **Alternatives:** Kraft-Logger oben lassen (falsche Priorität im täglichen Flow); echten Alternativgenerator bauen (größerer Backend-Scope); nur Textlabels ändern (behebt First-Screen-Priorität nicht).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Home/Coach Daily Flow wird als vorbereitender Handlungsflow gebaut

- **Decision:** UI/UX Slice B macht Home zur klaren Tagesaktion mit "HEUTE TUN", "WARUM" und "FERTIG WENN". Coach bekommt kontextuelle Quick Prompts, die nur die Eingabe vorbereiten und keine Anfrage automatisch senden.
- **Why:** Der tägliche Nutzen entsteht, wenn Tobi sofort erkennt, was jetzt wichtig ist und warum. Gleichzeitig sollen Coach-Fragen bewusst abgeschickt werden, damit keine unbeabsichtigten LLM-Aufrufe oder missverständlichen Aktionen entstehen.
- **Alternatives:** Home als technische Aktionsliste lassen (weniger Alltagsschärfe); Quick Prompts direkt absenden (zu überraschend und potenziell kosten-/kontextintensiv); Coach nur mit leerem Eingabefeld starten (zu wenig Orientierung).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Insights laden Deep-Analysen nur noch auf Nutzeraktion

- **Decision:** Slice A der UI/UX-Welle macht Deep Insights opt-in pro Karte. `useDeepInsight()` akzeptiert ein `enabled`-Flag, Insights-Karten starten geschlossen, und der Backend-Endpoint `/api/pulse/insights` wandelt Generierungsfehler in einen kontrollierten 503 mit nutzbarem Fehlertext statt rohem Serverfehler.
- **Why:** Der Browser-Audit zeigte einen sichtbaren `Internal Server Error`, obwohl die bestehende E2E-Suite gruen war. On-demand Loading passt zur UI-Anweisung, reduziert unnoetige LLM-/Serverlast und macht Fehler fuer Tobi handlungsfaehig.
- **Alternatives:** Nur den Fehlertext im Frontend ersetzen (laedt weiter alle Domains automatisch); nur Backend catchen (teure automatische Requests bleiben); Insights komplett deaktivieren (verliert Nutzen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Naechste Welle priorisiert UI/UX-Usability und echte Interaktionen

- **Decision:** Die naechste aktive Roadmap-Welle ist `docs/superpowers/plans/2026-05-01-ui-ux-usability-wave.md`. Reihenfolge: Usability-Test-Foundation plus Insights-Error-Guard, Home/Coach Daily Flow, Plan Decision Flow, Data/Settings Trust, Visual Density Pass.
- **Why:** Der Browser-Audit auf dem deployten Server zeigte trotz gruener Smoke-E2E reale Nutzbarkeitsrisiken: ein roher `Internal Server Error` in Insights, mobile Dichteprobleme, unklare Action-/Backfill-/Push-Zustaende und zu technische Alltagskommunikation. Die naechste Arbeit soll deshalb echte Interaktionen und Verstaendlichkeit absichern, bevor neue Feature-Breite entsteht.
- **Alternatives:** Direkt kosmetisches UI-Polish starten (behebt den Insights-Fehler und Flow-Verstaendlichkeit nicht); nur weitere Mock-Smokes schreiben (verpasst echte Serverfehler); grosses Redesign beginnen (zu viel Scope und Risiko).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-01 — Reliability Wave wird nach Slice 4 geschlossen

- **Decision:** Nach PR #54 bis PR #57 gilt die Reliability Wave als abgeschlossen und das Plan-Dokument wird nach `completed/` verschoben. Es gibt keinen aktiven Folgeplan; neue Arbeit startet erst wieder mit einem explizit angelegten Plan in `docs/superpowers/plans/`.
- **Why:** E2E-CI, lokaler Verify-Pfad, Server-Smoke und Route-Code-Splitting sind gemergt und deployed. Ein Closeout verhindert, dass kuenftige AI-Sessions erledigte Reliability-Slices erneut beginnen.
- **Alternatives:** Reliability Wave aktiv liegen lassen (Rebuild-Risiko); direkt weitere Tasks ohne Plan starten (Scope-Drift); nur Chat-Zusammenfassung ohne Repo-Status (nicht belastbar fuer spaetere Sessions).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Frontend-Bundle wird ueber Route-Level Lazy Loading geschnitten

- **Decision:** Reliability Wave Slice 4 nutzt `React.lazy` und `Suspense` fuer die grossen Page-Komponenten in `frontend/src/App.tsx`. Layout, Router, QueryClient und ErrorBoundary bleiben eager; einzelne Pages werden erst beim jeweiligen Route-Aufruf geladen.
- **Why:** Die Vite-Warnung zeigte einen zu grossen gemeinsamen JS-Chunk. Route-Level Splitting reduziert den initialen App-Chunk mit geringem Risiko, und die Playwright-Smokes sichern die Hauptnavigation nach dem Split ab.
- **Alternatives:** Vite-Warnlimit nur erhoehen (verdeckt das Problem); manuelle Vendor-Chunks zuerst schneiden (mehr Build-Komplexitaet); alle Komponenten lazy laden (unnötige Fragmentierung).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Deploy-Smoke wird als Repo-Script standardisiert

- **Decision:** Reliability Wave Slice 3 fuehrt `scripts/verify-server.sh` und `npm run verify:server` ein. Der Check validiert Server-Branch, sauberen Worktree, erwarteten Commit, PM2-Prozesse sowie Frontend-, `/api/ping`- und `/api/pulse/health`-Healthchecks.
- **Why:** Deploys wurden bisher mit mehreren ad-hoc-Kommandos geprueft. Ein einheitlicher Befehl macht nach jedem Deploy sichtbar, ob GitHub-main wirklich auf dem Server laeuft und ob die App ueber die LAN-URL gesund ist.
- **Alternatives:** Manuelle Curl-/SSH-Folge beibehalten (fehleranfaellig); nur PM2 pruefen (deckt Proxy/API nicht ab); nur HTTP pruefen (deckt falschen Commit nicht ab).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Lokale Tests bekommen einen expliziten Verify-Pfad

- **Decision:** Reliability Wave Slice 2 fuehrt `.env.test.example`, `scripts/verify-local.sh`, `npm run verify:local` und `npm run verify:local:e2e` ein. Der Verify-Pfad prueft zuerst, dass `DATABASE_URL_TEST` separat und erreichbar ist, migriert dann die Testdatenbank und startet Backend-Tests plus Typecheck.
- **Why:** Lokale Testlaeufe sind wiederholt an fehlender DB/Env oder stillen Produktions-DB-Risiken gescheitert. Ein expliziter Verify-Pfad macht die Voraussetzungen sichtbar und verhindert, dass Tests versehentlich gegen dieselbe DB wie die App laufen.
- **Alternatives:** Weiter nur CI als Autoritaet nutzen (langsamer Feedback-Loop); Docker Compose sofort einfuehren (groesserer Infrastruktur-Scope); Backend-Tests ohne DB-Gate starten (unklare Fehlerbilder).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Reliability Wave priorisiert E2E-CI vor neuen Produktfeatures

- **Decision:** Nach PR #53 startet Pulse eine Reliability Wave mit der Reihenfolge E2E in CI, Local Test Env, Deploy Smoke, Bundle Cleanup. Slice 1 macht die Playwright-Smokes zum CI-Gate, bevor weitere Produktfeatures begonnen werden.
- **Why:** Die wiederkehrenden Probleme waren Browser-Vertrauen, lokale Test-Env-Luecken, manuelle Deploy-Verifikation und die grosse Vite-Bundle-Warnung. Diese Fehlerklassen zu schließen erhoeht die Qualitaet kuenftiger Features mehr als sofort neue UI-/Coach-Funktionalitaet.
- **Alternatives:** Direkt neue Produktfeatures bauen (Risiko weiterer Regressionen); nur lokal Playwright nutzen (kein Merge-Gate); Bundle-Cleanup vor Tests (weniger Schutz fuer Refactor).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Pulse ist Codex-only und nutzt aktuelle OpenRouter-Defaults

- **Decision:** Pulse entfernt die verbliebenen Referenzen auf den vorherigen AI-Coding-Workflow aus aktiver Doku, historischen Handoff-Texten und Modell-Defaults. OpenRouter bleibt der Provider-Pfad; `FAST_MODEL` nutzt `openai/gpt-5-mini`, `SMART_MODEL` nutzt `openai/gpt-5.5`, beide bleiben per Env ueberschreibbar.
- **Why:** Tobi moechte nicht mehr mit dem vorherigen AI-Coding-Tool arbeiten. Ein Codex-only Repo reduziert Drift; die Modell-Defaults muessen ausserdem gegen OpenRouter aktualisiert werden, weil Modellverfuegbarkeit und Preise volatile Produktdaten sind.
- **Alternatives:** Nur aktive Regeln bereinigen (alte Treffer bleiben bei Suche sichtbar); konservative GPT-4.1-Defaults setzen (zu alt fuer Pulse als Smart-Default); `SMART_MODEL` ebenfalls guenstig halten (spart Kosten, aber reduziert Plan-/Coach-/Insight-Qualitaet); OpenRouter entfernen (zu grosser Scope, da `backend/src/lib/llm.ts` bereits der zentrale LLM-Pfad ist).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-01 — Browser-QA bekommt eine zweistufige Teststrategie

- **Decision:** Pulse nutzt Browser Use weiter für interaktive Codex-QA und ergänzt Playwright als versionierte E2E-Smoke-Suite. Die erste Suite mockt `/api`-Antworten und prüft die sechs Hauptseiten plus Navigation in Desktop- und Mobile-Chromium.
- **Why:** Browser Use ist schnell für visuelle Exploration, aber nicht commitbar oder CI-fähig. Playwright gibt wiederholbare Regressionstests ohne echte Garmin-/Serverdaten und deckt Routing, Runtime Errors und zentrale Render-Brüche ab.
- **Alternatives:** Nur Browser Use verwenden (keine wiederholbare Regression); Playwright gegen den echten Backend-Server fahren (fragiler und langsamer); sofort breite End-to-End-Mutationsflows bauen (zu hoher Pflegeaufwand für den Einstieg).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-01 — Everyday Utility Wave wird nach Slice 4 geschlossen

- **Decision:** Nach PR #48 bis PR #51 gilt die Everyday Utility Wave als abgeschlossen und das Plan-Dokument wird nach `completed/` verschoben. Neue Feature-Arbeit startet erst wieder mit einem explizit aktiven Plan; die naechsten Kandidaten sind Browser-E2E-Smoke-Tests, lokale Test-Environment-Haertung und Bundle-/Code-Splitting-Cleanup.
- **Why:** Backfill, Plan-Kalibrierung, Action Closure und Mobile-Density-Fixes sind gemergt und deployed. Ohne Closeout wuerde `current-focus` kuenftige AI-Sessions auf erledigte Slices lenken und Doppelarbeit beguenstigen.
- **Alternatives:** Everyday Utility als aktiven Plan liegen lassen (Rebuild-Risiko); sofort ohne Plan in weitere Features springen (Scope-Drift); nur Chat-Zusammenfassung ohne Repo-Status (nicht belastbar fuer AI-Tools).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Mobile-Density-QA bleibt ein gezielter Kernfluss-Pass

- **Decision:** Slice 4 der Everyday Utility Wave begrenzt Mobile-Density-Fixes auf die zuletzt angefassten Kernfluesse Home Actions, Plan Trace, Data Coverage und Settings Backfill/Push-Status. Die Coverage-Tabelle darf auf Mobile horizontal scrollen; lange deutsche Status- und Evidence-Texte werden umbrochen statt gekuerzt.
- **Why:** Der hoechste Alltagsnutzen liegt darin, Ueberlaeufe in den neuen Trust-/Utility-Oberflaechen zu verhindern, ohne parallel ein Design-System-Refactor oder Auth-abhaengige Voll-QA zu starten.
- **Alternatives:** Breiter Frontend-Redesign-Pass (zu grosser Scope fuer die Abschlussrunde); Texte hart kuerzen (verliert Diagnosewert); Tabellen weiter quetschen oder verstecken (schlechter auf Mobile).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Next Actions bleiben source-driven und bekommen Erledigungs-Evidence

- **Decision:** Slice 3 erweitert `PulseNextBestAction` um optionale `openedAt`, `resolvedBy` und `evidence` Felder. Home zeigt damit, warum eine Action offen ist und wodurch sie verschwindet; Coach bekommt dieselben Hinweise, Briefings nutzen nur noch critical/high Actions und lassen normale Nudges auf Home.
- **Why:** Tobi braucht nachvollziehbare Actions, aber keine manuelle Todo-Liste. Die bestehende PulseContext-Quelle bleibt kanonisch: Wenn Check-in, RPE, Plan, Push, Risk oder Equipment-Quelle erledigt ist, verschwindet die Action beim nächsten Context-Reload.
- **Alternatives:** Persistente Todo-Tabelle (zu viel Produkt-Scope und Habit-Tracker-Nähe); reine Frontend-Hinweise ohne Server-Contract (Drift-Risiko); alle Actions in jedem Briefing wiederholen (Nudge-Spam).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-01 — Plan-Kalibrierung nutzt persistierte Lern-Snapshots statt Prompt-Hoffnung

- **Decision:** Slice 2 der Everyday Utility Wave fuehrt einen kompakten Plan-Learning-Snapshot ein, der die letzten sechs Wochen aus Plan-Traces, geplanten/abgeschlossenen Workouts, Compliance und RPE verdichtet. `generateScientificWeekPlan()` nutzt diesen Snapshot deterministisch fuer Dichte-Reduktion und Hard-Day-Variation; der persistierte Plan-Trace zeigt zusaetzlich "Gelernt aus letzter Woche" und "Variation".
- **Why:** Tobis Hauptproblem sind gleichfoermige Plaene trotz Feedback. Reine Prompt-Erweiterungen waeren schwer testbar; ein strukturierter Snapshot macht den Lernpfad sichtbar, wiederverwendbar und in Unit-Tests absicherbar.
- **Alternatives:** Nur LLM-Prompt um Vorwochenfeedback erweitern (zu wenig deterministisch); neue Plan-Learning-Tabelle einfuehren (mehr Migration/Scope ohne akuten Bedarf, JSONB-Trace reicht); manuelle Todo-/Habit-Logik fuer Planerfuellung bauen (widerspricht Scope).
- **Decided by:** Codex.
- **Status:** active.

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

## 2026-04-30 — Zweite AI-Coding-Integration wird entfernt

- **Decision:** Pulse nutzt vorerst nur noch Codex als AI-Coding-Agent. Die aktive zweite AI-Coding-Integration wird entfernt: die Legacy-Regeldatei entfällt, alte Tool-Verzeichnisse werden nicht mehr als Projektzustand geführt, Branch-Regeln erwähnen nur noch `codex/<topic>` und manuelle `tobi/<topic>`-Branches.
- **Why:** Tobi möchte aktuell mit Codex weitermachen und keine parallele zweite AI-Coding-Konfiguration im Projekt pflegen. Eine aktive AI-Regeldatei reduziert Drift und macht `AGENTS.md` zur klaren Wahrheit für Codex.
- **Alternatives:** Parallele zweite AI-Doku als Quelle behalten (unnötige Drift); Legacy-Regeldatei leer als Platzhalter behalten (weiterhin missverständlich); historische Plan- und Decision-Referenzen umschreiben (würde Verlauf verfälschen).
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
- **Why:** Der Code hatte bereits eine `/insights`-Route in der Navigation, waehrend die alte Regeldatei noch fuenf Tabs dokumentierte. Die Trennung verhindert, dass Plan-Statistiken und KI-Interpretation wieder in einem unscharfen Analyse-Tab verschwimmen.
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
- **Alternatives:** Nur den Pointer-Prompt verwenden (spart Prompt-Tokens, aber nicht Repo-Lese-Tokens); alle Regeln weiter in mehreren Regeldateien duplizieren (mehr Drift).
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

- **Decision:** `docs/codex-system-prompt.md` enthält statt des langen ~150-Zeilen-Prompts nur noch einen ~10-Zeilen-Pointer-Prompt zum Kopieren. Hard Rules, Roadmap, Anti-Patterns leben in `AGENTS.md`, `docs/decisions.md`, `docs/superpowers/plans/`. CI-Sync-Check prüft jetzt die Codex-Regeldatei.
- **Why:** Codex CLI lädt `AGENTS.md` automatisch beim Session-Start. Den langen Prompt zu pasten dupliziert Repo-Inhalt, kostet ~2000 Tokens pro Session und hat ein Drift-Risiko, sobald sich die Roadmap ändert. Mit `decisions.md` + CI-Check sind die Repo-Files zuverlässig die Wahrheit.
- **Alternatives:** Langen Prompt behalten (Token-Verschwendung + manuelles Sync-Risiko); `codex-system-prompt.md` ganz löschen (verlieren Doku, wie Codex aufgesetzt wird).
- **Decided by:** Tobi + vorheriger AI-Agent, supersedes ein Teil der Entscheidung vom Setup-Tag.
- **Status:** active. Supersedet: den 2026-04-29-Eintrag „Codex-System-Prompt als eigene Datei" (Datei existiert weiter, aber als reine Doku, nicht als Roadmap-Mirror).

---

## 2026-04-29 — Decision-Log eingeführt + CI-Sync-Check

- **Decision:** Diese Datei (`docs/decisions.md`) wird zur Pflicht für jede AI-Session. Zusätzlich CI-Workflow `.github/workflows/docs-sync.yml`, der prüft, ob Hard-Rule-Marker in AGENTS.md und codex-system-prompt.md vorhanden sind.
- **Why:** Setup mit mehreren Tools und mehreren Doc-Dateien hat zwei Drift-Risiken: (a) Chat-Entscheidungen werden nicht persistiert; (b) die Doc-Dateien laufen auseinander, wenn nur eine geändert wird.
- **Alternatives:** „Nur ehrliche Disziplin" (zu fragil); ein einziges Master-Doc mit Includes (zu invasiv für die unterschiedliche Tonalität pro Audience).
- **Decided by:** Tobi + vorheriger AI-Agent, [PR pending].
- **Status:** active.

---

## 2026-04-29 — `completed/`-Archiv für erledigte Pläne

- **Decision:** 11 Plan-Dateien (Phasen 3a–9, Mental-Check-in, HR-First) und 1 Spec nach `docs/superpowers/plans/completed/` bzw. `specs/completed/` verschoben. `completed/README.md` mit „⚠ do not implement"-Banner.
- **Why:** AI-Tools sollen nicht versehentlich abgeschlossene Pläne re-implementieren. Top-Level `plans/` enthält nur noch aktive Pläne.
- **Alternatives:** Pläne in-place mit Banner markieren (visuell schwächer); Pläne löschen (verliert Historie).
- **Decided by:** Tobi + vorheriger AI-Agent, [PR #7](https://github.com/tobi12387/pulse/pull/7).
- **Status:** active.

---

## 2026-04-29 — Codex-System-Prompt als eigene Datei

- **Decision:** `docs/codex-system-prompt.md` enthält den vollen kopierbaren Prompt für OpenAI Codex. AGENTS.md verlinkt darauf.
- **Why:** Codex liest AGENTS.md je nach Setup nicht garantiert vollständig. Eine dezidierte Prompt-Datei macht es explizit, was reinkopiert werden muss, und enthält die roadmap-spezifischen „nicht mehr verhandelbaren" Entscheidungen.
- **Alternatives:** Nur AGENTS.md (Codex könnte sie übersehen); System-Prompt direkt in Codex-Konfiguration ohne Repo-Spiegel (Drift-Risiko).
- **Decided by:** Tobi + vorheriger AI-Agent, [PR #7](https://github.com/tobi12387/pulse/pull/7).
- **Status:** active.

---

## 2026-04-29 — Phase 10 re-evaluiert; Habit-Tracker gestrichen

- **Decision:** Phase 10 (vorher „Auxiliary Tracking") heißt jetzt „Strength & Equipment Tracking". Habit-Tracker komplett verworfen.
- **Why:** Drei der ursprünglich vorgeschlagenen 5 Habits sind schon auto-erfasst (Schritte aus `pulse_daily_metrics`); die übrigen werden im Voice-Check-in als Themes besser dokumentiert. Manuelles Toggling würde den Eingabekanal duplizieren. Risk Watch deckt zusätzlich datengetriebene Trends ab.
- **Alternatives:** Habit-Tracker als Backlog-Item (verworfen — soll keine Last sein); reduzierten Habit-Tracker mit nur 2 Habits (Aufwand-Nutzen passt nicht).
- **Decided by:** Tobi + vorheriger AI-Agent, [PR #6](https://github.com/tobi12387/pulse/pull/6).
- **Status:** active.

---

## 2026-04-29 — Konsistenz-Bündel A/B/C vor Phase 10/11

- **Decision:** Drei Refactor-Bündel (A: Context Unification, B: Threshold Canonicalization, C: Endpoint & Page Consolidation) werden **vor** den Feature-Phasen RPE/Risk/Push und vor Phase 10/11 implementiert. Reihenfolge: A → B → C → RPE → Risk Watch → Web Push → Phase 10 → Phase 11.
- **Why:** Code-Review nach Phase 9 fand strukturelle Inkonsistenzen: Briefing-Job liest aus Legacy-Schema, Coach-Context wird inline doppelt aufgebaut, TSB-Schwellen widersprechen sich, Server-Readiness-Label ≠ Frontend-Label. Diese Lücken multiplizieren sich, wenn Features ohne Refactor-Basis dazukommen.
- **Alternatives:** Features zuerst, Refactor später (verworfen — Drift wächst); großer Single-Refactor (verworfen — zu groß für sauberen PR).
- **Decided by:** Tobi + vorheriger AI-Agent, [PR #5](https://github.com/tobi12387/pulse/pull/5).
- **Status:** active.

---

## 2026-04-29 — Telegram-Integration verworfen; Web Push als Ersatz

- **Decision:** Phase 12 (Telegram-Notifications) ersatzlos gestrichen. Web Push (PWA) als Plan, der den aktiven Push-Kanal in der bestehenden App schließt.
- **Why:** Tobi will keine Telegram-Integration. Web Push erfüllt denselben Zweck (Briefing-Push, Check-in-Reminder, Risk-Critical-Push) ohne Drittanbieter, ohne neuen Channel.
- **Alternatives:** Email-Digest (passt schlecht zu Mobile-First); Pure Pull-Modus belassen (verfehlt das eigentliche Pain-Point „App muss aktiv geöffnet werden").
- **Decided by:** Tobi, [PR #3](https://github.com/tobi12387/pulse/pull/3) (drop) + [PR #4](https://github.com/tobi12387/pulse/pull/4) (Web-Push-Plan).
- **Status:** active.

---

## 2026-04-29 — Parallel-Workflow für mehrere AI-Tools

- **Decision:** GitHub `main` ist Single Source of Truth. Mac und Server sind Konsumenten, niemals Editoren. Branch-Namespaces trennen AI- und manuelle Arbeit; aktuell gelten `codex/<topic>` (Codex) und `tobi/<topic>` (manuell). Server-Deploy nur via `scripts/deploy.sh`, das dirty Trees und Non-Main-Branches verweigert.
- **Why:** Zwei AI-Tools parallel im selben Repo ohne Konfliktregelung führt zu untracked Files, doppelten Migrationen, und Server-State-Drift. Eine harte Single-Source-of-Truth + Read-Only-Server-Mirror beendet alle drei Drift-Klassen.
- **Alternatives:** Nur ein Tool benutzen (verworfen — beide haben Stärken); manuelles Konflikt-Management (verworfen — fragil).
- **Decided by:** Tobi + vorheriger AI-Agent, [PR #1](https://github.com/tobi12387/pulse/pull/1).
- **Status:** active.
