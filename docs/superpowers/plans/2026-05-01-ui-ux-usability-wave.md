# UI/UX Usability Wave

> Stand: 2026-05-01. Neuer aktiver Plan nach Browser-Audit auf `https://192.168.178.46:5175` und lokalem Playwright-Smoke. Fokus: echte Nutzungswege, klare Interaktionen, bessere Fehler- und Entscheidungsoberflächen.

## Goal

1. Pulse soll in den taeglichen Kernwegen schneller verstaendlich werden: Home → naechste Aktion, Coach → Frage/Check-in, Plan → heutige Trainingsentscheidung, Data → Datenvertrauen, Settings → sichere Systemaktionen.
2. Usability-Regressionen sollen versioniert getestet werden: nicht nur "Seite rendert", sondern "Nutzer kann den naechsten sinnvollen Schritt erkennen und ohne visuelle Reibung ausfuehren".
3. Fehler- und Ladezustaende sollen fachlich erklaert werden, statt technische Rohfehler oder widerspruechliche Statusmeldungen zu zeigen.

## Architektur

- Kein grosses Redesign und kein neues Design-System als Vorbedingung. Die Welle verbessert vorhandene Flows inkrementell.
- Keine neuen Produktbereiche: kein Datenexport, kein Habit-Tracker, kein Telegram.
- Browser Use bleibt fuer manuelle, echte Server-QA; Playwright wird fuer wiederholbare Interaktions- und Layout-Tests erweitert.
- LLM-/Coach-/Insight-Aufrufe bleiben ueber `backend/src/lib/llm.ts`; UI darf diese Aufrufe nicht durch neue direkte Provider-Wege umgehen.
- Destruktive oder externe Aktionen in der UI bekommen klarere Labels, Kontext und sichtbare Folge-Erklaerung.

## Browser-Audit 2026-05-01

### Home

- Positiv: Next Actions sind als erster Einstieg wertvoll und verbinden Datenlage mit Handlung.
- Problem: Mobile ist sehr dicht. Die Aktion "1/3" erklaert nicht, ob weitere Karten durch Swipe, Klick oder Auto-Rotation erreichbar sind.
- Problem: Statusbegriffe wie "HRV-Δ 30d", "TSB", "ATL" und "Recovery gut" konkurrieren direkt mit Alltagssprache.
- Optimierung: Home braucht eine klare Tagesentscheidung oben: "Heute tun", "Warum", "Danach verschwindet es". Detailmetriken koennen darunter bleiben.

### Coach

- Positiv: Eingabe ist schnell erreichbar, Send-Button wird korrekt aktiv, wenn Text vorhanden ist.
- Problem: Die leere Historie wirkt wie ein grosser leerer Bereich; es fehlt ein konkreter Startpunkt.
- Problem: Metrik-Chips oben zeigen Rohwerte, aber nicht, ob sie die Coach-Antwort beeinflussen.
- Optimierung: Coach sollte mit 2-3 kontextuellen Quick Prompts starten, z.B. "Was ist heute sinnvoll?", "Soll ich die Einheit anpassen?", "Warum diese Readiness?".

### Data

- Positiv: Coverage macht Datenluecken sichtbar und ist fachlich nuetzlich.
- Problem: Mobile Tabs und Tabellen sind eng; "Mental" ist im Tabstrip nur teilweise sichtbar.
- Problem: "Nachladen" ist deaktiviert, aber der Grund ist erst indirekt aus "0 Kandidaten" ableitbar.
- Optimierung: Data braucht einen Diagnosemodus mit klarer Prioritaet: "Alles gut", "Diese Domain fehlt", "Das kannst du tun".

### Plan

- Positiv: Plan Trace zeigt inzwischen, welche Daten in die Planung eingeflossen sind.
- Problem: Auf Mobile dominiert der Kraft-Logger den ersten Screen, obwohl der Kernweg oft "Was soll ich trainieren?" ist.
- Problem: "wechseln" an Workout-Karten ist zu vage; der Nutzer erkennt nicht, ob Sportart, Tag, Intensitaet oder Alternativvorschlag geaendert wird.
- Problem: Plan-Generierung ist eine starke Aktion ohne vorgeschaltete Zusammenfassung der verwendeten Constraints.
- Optimierung: Plan braucht eine Entscheidungsoberflaeche: heutige Einheit, Begruendung, Alternativen, Wochenlogik, danach Eingabe-/Logger-Tools.

### Insights

- Kritischer Befund: Die echte Server-UI zeigt in der aufgeklappten Gesamtkarte `Internal Server Error`.
- Problem: Die Seite sagt "Tippe auf eine Karte um die Analyse zu laden", laedt "Gesamt" aber automatisch.
- Problem: Rohfehler sind nicht handlungsfaehig; es fehlt Retry-, Cache- oder "Daten reichen nicht"-Kommunikation.
- Optimierung: Insights brauchen robuste Fehlerzustaende und Lazy-Load nur auf aktive Nutzeraktion, solange LLM-/Datenfehler auftreten koennen.

### Settings

- Positiv: Garmin, Profil, Backfill, Equipment, Push und Health State sind an einem Ort auffindbar.
- Problem: Push zeigt "BEREIT", Browser `denied` und gleichzeitig ein gespeichertes Geraet; das wirkt widerspruechlich.
- Problem: Mehrere Aktionen liegen dicht beieinander: "Jetzt syncen", "Kalender bereinigen", "Push aktivieren", "Test", "Dieses Geraet aus", "×".
- Problem: Technische Push-Endpunkte sind fuer Alltag nicht hilfreich und koennen sensibel wirken.
- Optimierung: Settings braucht Zustandsklaerung und sichere Aktionsgruppen: Verbindung, Datenpflege, Benachrichtigungen, Profil, Health States.

## Testluecke

Die aktuelle E2E-Suite prueft 14 Smoke-Faelle mit gemockten API-Antworten und ist gruEN. Sie deckt Runtime-Fehler, Navigation und Basis-Rendering ab.

Sie deckt aktuell nicht ab:

- echte Server-API-Fehler wie den beobachteten Insights-500,
- verstaendliche Fehlertexte statt Rohfehler,
- mobile visuelle Ueberlaeufe in Tabstrips, Bottom Nav und Tabellen,
- handlungsorientierte Flows wie "Home Action → Coach", "Plan Alternative waehlen", "Data Backfill Vorschau",
- riskante UI-Aktionen mit klarer Folgeerklaerung.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/e2e/pulse-smoke.spec.ts` | Von Smoke-Tests zu ersten Usability-Flows erweitern |
| Modify | `frontend/e2e/fixtures/pulse-api.ts` | Realistische Success-, Empty- und Error-Fixtures fuer Kernwege |
| Create | `frontend/e2e/pulse-usability.spec.ts` | Nutzerwege, Mobile-Layout und Fehlerzustaende pruefen |
| Modify | `frontend/src/components/Layout.tsx` | Navigation, Labels, aktive States und Badges klarer machen |
| Modify | `frontend/src/pages/Home.tsx` | Next Actions und Tagesentscheidung vereinfachen |
| Modify | `frontend/src/pages/Coach.tsx` | Empty State, Quick Prompts und Kontextsignale verbessern |
| Modify | `frontend/src/pages/Data.tsx` | Coverage/Backfill als Diagnose-Flow statt reine Tabelle |
| Modify | `frontend/src/pages/Plan.tsx` | Trainingsentscheidung vor Logger-Tools, Alternativen klarer |
| Modify | `frontend/src/pages/Insights.tsx` | Lazy-Load, Retry, fachliche Fehlertexte |
| Modify | `frontend/src/pages/Settings.tsx` | Push-/Backfill-/Health-State-Aktionsgruppen klaeren |
| Modify | `backend/src/pulse/services/insight-engine.ts` | Falls noetig: Insight-Fehler robust abfangen und fachlich klassifizieren |
| Modify | `backend/src/pulse/plugin.ts` | Falls noetig: Insight-Endpoint liefert kontrollierte Fehlerpayloads |
| Modify | `docs/ai/current-focus.md` | Aktive Welle und naechste Schritte sichtbar halten |
| Modify | `docs/decisions.md` | Scope-/Prioritaetsentscheidung festhalten |

## Tasks

### 1. Usability-Test-Foundation

**Status:** implemented in PR #61.

- Neue `pulse-usability.spec.ts` mit mobilen und Desktop-Kernwegen:
  - Home zeigt eine klare Primaeraktion und Zielroute.
  - Navigation labels sind eindeutig und ohne abgeschnittene Begriffe.
  - Insights zeigt bei API-Fehlern keinen rohen `Internal Server Error`.
  - Data Backfill erklaert deaktivierte Zustaende.
  - Settings Push-Zustand zeigt keine widerspruechliche Hauptbotschaft.
- Fixtures fuer Success, Empty, Error und "needs action" getrennt halten.
- Acceptance:
  - `npm run test:e2e` bleibt gruEN.
  - Mindestens ein Test wuerde den aktuell beobachteten Insights-Rohfehler verhindern.

### 2. Insights Resilience

**Status:** implemented in PR #61.

- Gesamtanalyse nicht automatisch als teurer/fragiler Deep-Insight laden, wenn die Seite sagt, dass Karten per Tap geladen werden.
- Fehlerzustand ersetzen:
  - technischer Fehler → "Analyse konnte gerade nicht geladen werden"
  - Datenmangel → "Noch nicht genug Daten fuer diese Analyse"
  - Retry sichtbar und nicht dominant.
- Backend-Fehlerpfad fuer Deep Insights pruefen und kontrollierte Fehlerantwort statt Roh-500 liefern, falls der Fehler serverseitig reproduzierbar ist.
- Acceptance:
  - Browser-Audit auf Server zeigt keinen rohen `Internal Server Error`.
  - E2E deckt Error-State ab.

### 3. Daily Action & Coach Flow

**Status:** in progress via `codex/ux-slice-b-home-coach`.

- Home Next Actions zu einer klaren Tagesentscheidung verdichten.
- Weitere Actions sichtbar erreichbar machen: z.B. Stepper, "alle anzeigen" oder klare Kartenliste.
- Coach Empty State mit kontextuellen Quick Prompts und sichtbarer Bedeutung der Top-Metriken.
- Keine automatische Coach-Anfrage ohne bewussten Nutzer-Send.
- Acceptance:
  - Home → Coach-Flow ist per Browser in maximal zwei eindeutigen Aktionen verstaendlich.
  - Coach wirkt ohne Chatverlauf nicht leer.

### 4. Plan Decision Flow

- Mobile First Screen im Plan auf "heutige/naechste Trainingsentscheidung" ausrichten.
- Kraft-Logger in eine eigene Sektion oder einen unteren Tool-Bereich verschieben.
- "wechseln" durch spezifische Aktionen ersetzen, z.B. "Alternative anzeigen", "Tag wechseln", "Intensitaet anpassen".
- Plan generieren mit kurzer Constraint-Zusammenfassung vor der Aktion.
- Acceptance:
  - Nutzer erkennt auf Mobile ohne Scrollen die naechste Trainingsempfehlung oder bewusst freie Tage.
  - Plan-Alternativen sind semantisch klar und testbar.

### 5. Data & Settings Trust

- Data Coverage in "Status → Ursache → Aktion" strukturieren.
- Deaktivierte Backfill-Aktion mit direktem Grund versehen.
- Settings Push-Zustand entflechten: Server bereit, Browser erlaubt/blockiert, Geraet registriert, Test moeglich.
- Technische Push-Endpunkte einklappen oder maskieren.
- Riskantere Aktionen optisch und sprachlich von harmlosen Navigationsaktionen trennen.
- Acceptance:
  - Browserstatus `denied` und vorhandenes Geraet ergeben eine verstaendliche Gesamtbotschaft.
  - Keine destructive-adjacent Aktion erscheint ohne erklaerende Folgezeile.

### 6. Visual Density Pass

- Mobile Tabstrips, Bottom Nav, Tabellen und Karten auf Ueberlauf pruefen.
- Navigation labels angleichen: Desktop und Mobile sollten semantisch gleich bleiben, auch wenn sie kuerzer sind.
- Kleine Monospace-Texte nur fuer Codes/Status, nicht fuer wichtige Alltagserklaerungen.
- Acceptance:
  - Desktop und Mobile Screenshots der sechs Hauptseiten zeigen keine abgeschnittenen Kernlabels.
  - Wichtige Alltagstexte bleiben ohne horizontales Raten lesbar.

## Suggested Sequence

1. **Slice A — Usability Tests + Insights Error Guard**: hoechste Wirkung, weil die reale UI bereits einen harten Fehler zeigt.
2. **Slice B — Home/Coach Daily Flow**: groesster Alltagsnutzen, da die App hier taeglich startet.
3. **Slice C — Plan Decision Flow**: adressiert Tobis wiederkehrendes Vertrauensthema bei Trainingsplaenen.
4. **Slice D — Data/Settings Trust**: macht Garmin-/Push-/Backfill-Zustaende weniger technisch und sicherer.
5. **Slice E — Visual Density Pass**: poliert Navigation, Tabs und mobile Lesbarkeit ueber alle Hauptseiten.

## Open Questions For Tobi

- Soll die App eher "Coach-zentriert" starten (Home fuehrt stark in Coach/Plan) oder "Dashboard-zentriert" bleiben (Metriken zuerst, Aktionen danach)?
- Sollen Insights standardmaessig nur auf expliziten Klick laden, um Fehler/Kosten/LLM-Latenz aus dem ersten Screen herauszuhalten?
- Soll der Kraft-Logger auf Plan bleiben oder als eigenes Tool innerhalb Plan tiefer einsortiert werden?
