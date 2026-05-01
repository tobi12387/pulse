# Daily Intelligence Next Wave

> Stand: 2026-05-01. Folgeplan nach der abgeschlossenen Everyday Flow Deepening Wave. Fokus: Pulse soll im Alltag weniger Oberfläche und mehr verlässliche Entscheidungshilfe sein.

## Goal

1. Trainingsplanung wird sichtbar datengetrieben: Ziele, Verfügbarkeit, Garmin-Ausführung, RPE, Health-State und Load erklären die nächste Einheit.
2. Garmin-Ausführung wird geschlossen: geplant → auf Uhr/Edge → durchgeführt → bewertet → Plan lernt daraus.
3. UI/UX wird anhand echter Tagesflows geprüft, nicht nur anhand einzelner Seiten.

## Architektur

- Kein Telegram, kein Datenexport, kein Habit-Tracker.
- GitHub `main` bleibt Source of Truth; Server ist nur Deploy-Mirror.
- LLM-Aufrufe bleiben ausschließlich über `backend/src/lib/llm.ts`.
- Neue Persistenz nur, wenn ein Flow ohne Verlauf nicht korrekt lösbar ist.
- Canva bleibt Review-Board; Figma bleibt Design-System- und Interaktionsfläche; Repo bleibt technische Source of Truth.
- Build Web Apps kann als zusätzliche PWA/mobile QA-Schicht genutzt werden, sobald das Plugin in Codex-Tools sichtbar ist. Build iOS Apps bleibt vorerst nur Evaluationsoption für einen späteren nativen Wrapper.
- Jede Phase bleibt eigener `codex/<topic>` Branch mit PR, Checks, Merge und Deploy.

## Phases

### 1. Garmin Execution Reconciliation

- Plan zeigt pro Workout klar: lokal geplant, Garmin-Workout vorhanden, Garmin-Kalender geplant, durchgeführt, verpasst oder ersetzt.
- Completed Activities werden gegen geplante Workouts abgeglichen und in der UI verständlich markiert.
- Acceptance:
  - Nutzer erkennt vor dem Training, ob die Einheit auf Uhr/Edge liegt.
  - Nutzer erkennt nach dem Training, ob Pulse die Einheit zugeordnet hat.
  - E2E deckt mindestens "geplant auf Garmin" und "durchgeführt zugeordnet" ab.

### 2. Plan Personalization Loop

- Wochenplanung berücksichtigt Ziele, Verfügbarkeit, letzte 14/30 Tage, RPE, Compliance, aktive Health-States und Race-Kontext sichtbar.
- Der Plan muss nicht jeden verfügbaren Tag nutzen; freie Tage sind gültige Entscheidungen.
- Acceptance:
  - PlanTrace erklärt, warum Tage frei bleiben oder Einheiten gekürzt/verschoben werden.
  - Wiederholte Generierung mit gleichen Daten bleibt stabil, aber nicht fachlich monoton.

### 3. Daily Decision Center

- Home und Coach führen morgens zu genau einer priorisierten Tagesentscheidung mit Grenze, Alternative und Abschlusskriterium.
- Plan, Data und Insights liefern Belege, aber Home bleibt der Startpunkt.
- Acceptance:
  - In einem Browser-Flow Home → Coach → Plan erkennt der Nutzer ohne Scroll-/Sucharbeit, was heute zu tun ist.
  - Health-State und niedrige Readiness überschreiben harte Trainingsempfehlungen sichtbar.

### 4. Insight Evidence Links

- Insights zeigen nicht nur Narrativ, sondern die wichtigsten Datenquellen und Zeitfenster, die zur Aussage geführt haben.
- Datenmangel, Cache und Provider-Probleme bleiben klar getrennt.
- Acceptance:
  - Jede geöffnete Insight-Karte zeigt "Datenbasis" oder "Daten fehlen".
  - Keine rohen Providertexte erscheinen in der UI.

### 5. Deep UI/UX Flow Audit

- Browser Use prüft die deployte App auf den täglichen Flows: Morgencheck, Training ausführen, nach Training bewerten, Daten nachladen, Push/Garmin warten.
- Canva/Figma werden mit den wichtigsten Screens, Frictions und Zielzuständen aktualisiert.
- Acceptance:
  - Bericht nennt konkrete UI/UX-Probleme nach Route und täglichem Flow.
  - Neue Folgepläne entstehen nur aus beobachteten Frictions oder klaren Produktlücken.

## Suggested Sequence

1. Garmin Execution Reconciliation.
2. Plan Personalization Loop.
3. Daily Decision Center.
4. Insight Evidence Links.
5. Deep UI/UX Flow Audit.

## Current Checks

- Previous wave plus Garmin repeat sync deployed and verified on `origin/main` commit `b082e5c` after PR #78.
- Open PRs: none at closeout time.
- Garmin calendar had repeat groups repaired by payload shape; broad live Garmin probing should wait until provider rate limiting has cooled down.
- Companion plans now exist for Garmin data enrichment, iPhone/PWA readiness, decision closure/coach memory and the full app potential audit.
