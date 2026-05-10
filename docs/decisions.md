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

## 2026-05-10 — Garmin-Readback verifiziert Wiederholungen explizit

- **Decision:** Der Garmin-Ausführungsdiff enthält einen optionalen `repeatAudit`, der Pulse-erwartete Repeat-Blöcke und Wiederholungen mit dem Garmin-Readback vergleicht. Repeat-Workouts mit fehlenden Garmin-Details werden nicht mehr als `ready`, sondern als `unknown` angezeigt.
- **Why:** Wiederholungen mit `0`/`null` waren ein konkreter Vertrauensbruch. Planung ist erst abgeschlossen, wenn die Uhr-/Edge-Struktur nicht nur als Kalendertermin, sondern auch als Wiederholungsstruktur verständlich geprüft oder reparierbar ist.
- **Alternatives:** Nur UI-Copy schärfen (behebt falsche Ready-Zustände nicht); automatisch reparieren, sobald ein Repeat auffällt (zu viel versteckte Garmin-Mutation); einen eigenen Ausführungs-Top-Level-Tab sofort bauen (größerer IA-Scope als nötig).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Daily Delta startet als read-only Home-Loop

- **Decision:** Pulse fuehrt einen read-only `GET /api/pulse/daily-delta` Contract ein und zeigt den neuesten Plan-vs-Ausfuehrung-Status zuerst auf Home direkt nach der Tagesentscheidung. Der Contract nutzt vorhandene Plan-, Aktivitaets- und Tagesmetriken-Daten und erfordert keine Migration.
- **Why:** Nach erledigten Workouts braucht Home eine klare Antwort, was wirklich passiert ist und wie das die naechste Planung beeinflusst. Eine kleine Home-Zeile reduziert kognitive Last staerker als ein neuer Analysebereich oder weitere Plan-Diagnostik.
- **Alternatives:** Nur bestehendes Outcome-Learning weiter anzeigen (zu indirekt fuer geplante vs. echte Einheit); Daily Delta sofort in Home, Plan und Data ausrollen (groesserer UI-Scope); neues Persistenzmodell bauen (unnötig fuer v1).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Plan startet mit einer sichtbaren Aktionsvereinbarung

- **Decision:** Der Plan-Tab zeigt vor Evidenz, Alternativen und Tools eine `Plan-Aktion` mit konkreter Primaerhandlung, `Warum jetzt` und `Nach dem Klick`; bei offener Einheit fuehrt die Primaerhandlung in die Einheit, bei fehlender Einheit zuerst in die Verfuegbarkeit, und Today Options uebernimmt den Vertrag, wenn nur dort die geplante Tagesaktion sichtbar ist.
- **Why:** Der UI/UX-Benchmark und die Roadmap verlangen, dass Plan nicht als Maschinenraum startet, sondern die aktuelle Aufgabe erklaert. Garmin-, Load-, Ziel- und Alternativ-Evidenz bleibt erhalten, wird aber nach der Handlungsvereinbarung einsortiert.
- **Alternatives:** Today Options allein als erste Karte nutzen (zu wenig Plan-/Garmin-Vertrag); Alternativen weiterhin vor die Hauptaktion stellen (zu viel Entscheidungsdruck); neuen Top-Level-Tab fuer Ausfuehrung sofort einfuehren (groesserer IA-Scope als dieser Slice).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Root-Navigation heißt sichtbar `Heute`, Route bleibt `/`

- **Decision:** Die primäre Navigation zeigt fuer den Root-Einstieg `Heute` statt `Home`; die Route `/`, Hotkey `1`, PWA-Launch-URL und bestehende Deep-Links bleiben unveraendert.
- **Why:** Nach der Daily-Decision-Vereinfachung ist der Root-Screen fachlich ein Tagesfokus, nicht eine generische Startseite. Die Umbenennung reduziert Orientierungsarbeit, ohne technische Routen oder Browser-/Push-Ziele zu brechen.
- **Alternatives:** Route auf `/heute` migrieren (zu viel Kompatibilitaetsrisiko fuer diesen Slice); Label `Home` behalten (weniger passend zur deutschen Daily-Flow-Sprache); alle Tabs gleichzeitig eindeutschen (groesserer IA-Scope).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Home Daily Decision nutzt den UX-Task-Contract als erste UI-Schicht

- **Decision:** Die Home-Tagesentscheidung zeigt standardmaessig `Warum jetzt`, einen kompakten naechsten Schritt und `Nach dem Klick`; detaillierte Schritte und Evidenz sind per `Details & Evidenz` optional aufklappbar.
- **Why:** Die Route-Evidence zeigte, dass die Karte auf Mobile den ersten Screen mit vollstaendiger Checkliste und Evidence-Chips ueberlaedt. Der Contract macht den ersten Handlungsschritt und die Folge des Klicks sichtbar, ohne Diagnose- und Garmin-/Load-Evidenz zu verlieren.
- **Alternatives:** Die komplette Schritt-/Evidenzliste weiter immer anzeigen (zu bulky); Evidence entfernen (verliert Vertrauen); eine neue Home-Route/Tabs sofort einfuehren (zu grosser IA-Sprung fuer diesen ersten Slice).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Aktive Planflaeche wird strikt von erledigten Plänen getrennt

- **Decision:** Erledigte Benchmark- und Implementierungsplaene aus der 2026-05-10-Welle werden nach `docs/superpowers/plans/completed/` verschoben; im aktiven Planordner bleiben nur die kanonische Produktroadmap, der iPhone/PWA-Manual-Gate-Plan und der historische 2026-04-28-Pointer.
- **Why:** Mehrere abgeschlossene Plaene lagen noch neben aktiven Roadmaps und konnten in autonomen Sessions als offene Arbeit fehlinterpretiert werden. Eine kleine aktive Planflaeche senkt Tokenverbrauch, reduziert doppelte Umsetzung und macht die naechste Produktentscheidung schneller auffindbar.
- **Alternatives:** Alle Plaene im Root liegen lassen und nur im Chat erklaeren (nicht dauerhaft); alte Plaene loeschen (verliert historische Evidenz); jeden Plan einzeln im Prompt ausschliessen (zu teuer und fehleranfaellig).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Produktroadmap wird um UX-Task-Contract und UI-Benchmark harmonisiert

- **Decision:** `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md` ist die kanonische Pulse-Produktroadmap. Sie buendelt Benchmark-Erkenntnisse, UX-Task-Contract, Navigation als Produktwerkzeug und die naechste Reihenfolge von Docs-Hygiene, UX-Contract, Today/Home, Plan Action Hierarchy, Daily Delta/Planned-vs-Completed, Garmin Execution, Athlete Levels/Alternatives und Nutrition Intelligence.
- **Why:** Die bisherigen aktiven Roadmap-Dokumente enthielten teils umgesetzte Phasen, Benchmark-Reste und alte Navigationsannahmen. Pulse braucht eine eindeutige Quelle, die neue Tabs nicht dogmatisch blockiert, aber jede Navigation an wiederkehrende Nutzerflows und klare Handlungen bindet.
- **Alternatives:** UI/UX-Plan und Benchmark-Plan getrennt weiterfuehren (erzeugt doppelte Prioritaeten); neue Top-Level-Tabs weiterhin implizit vermeiden (zu starr); nur Chat-Zusammenfassung nutzen (nicht dauerhaft fuer Agenten).
- **Decided by:** Tobi / Codex.
- **Status:** active.

## 2026-05-10 — Plan-/Garmin-QA bekommt einen read-only Harness

- **Decision:** Pulse fuehrt `npm run qa:plan:no-garmin-write` als dedizierten Playwright-Harness fuer Plan Refresh Preview, Today Options Signal Labels und Garmin Execution Readback. Der Harness nutzt ausschliesslich gemockte Pulse-API-Fixtures und asserted, dass keine Garmin- oder Plan-Mutationsendpunkte aufgerufen werden.
- **Why:** Browser-QA soll die kritischen Plan-/Garmin-Vertrauensflaechen schnell und deterministisch pruefen, ohne reale Garmin-Schreibzugriffe oder Plan-Apply-Seiteneffekte ausloesen zu koennen. Damit bleibt die Live-Server-Pruefung read-only, waehrend echte Garmin-Reparaturen explizite manuelle Aktionen bleiben.
- **Alternatives:** Bestehende grosse E2E-Suite weiter per grep kombinieren (weniger klarer Sicherheitsvertrag); Live-Garmin-Smoke automatisieren (zu riskant); nur Dokumentation ohne Test-Harness (zu schwach gegen Regressionen).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Limiter-Zuordnung bleibt beschreibungs- und Trace-basiert

- **Decision:** Pulse macht den aktiven Ziel-Limiter in `Warum diese Einheit`, der Plan-Wochenzusammenfassung und Data > Analysen sichtbar, ohne dafuer neue Workout-DB-Spalten einzufuehren. Die UI nutzt die vorhandene Plan-Trace-`goalLimiter`-Evidenz und die deterministisch erzeugten Beschreibungen.
- **Why:** Tobi braucht schnell erkennbaren Zweck pro Schluesseleinheit, aber die erste Umsetzung soll keine Migration oder Garmin-Contract-Aenderung erzwingen. Der bestehende Trace kennt Limiter, Fokus-Systeme und Capability-Evidenz bereits; dadurch bleibt die Aenderung klein, testbar und rueckwaertskompatibel fuer bestehende Plaene.
- **Alternatives:** Limiter pro Workout persistieren (mehr Schema-/Backfill-Aufwand fuer v1); einen neuen Plan-Top-Level-Tab bauen (gegen aktuelle IA-Entscheidung); proprietaere Workout-Bibliotheken kopieren (explizit ausgeschlossen).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Fueling-Schutz wird als explizite Debt Closure modelliert

- **Decision:** Pulse fuehrt fuer GI-/Fueling-Schutz einen expliziten `PulseFuelingDebtSummary` mit den Zustaenden `open_gi_issue`, `controlled_practice_planned`, `tolerated_follow_up` und `resolved`. Plan-Engine, Today Options, Adaptation Events und Activity-Fueling-UI nutzen diesen Status statt eines rohen `recentGiIssue`-Booleans.
- **Why:** Ein alter GI-Hinweis darf harte oder lange Einheiten nicht dauerhaft blockieren, wenn eine kontrollierte Folgeeinheit mit `Magen ok` geloggt wurde. Gleichzeitig muss Tobi unmittelbar sehen, welche konkrete Folgeaktion den Schutz wieder schliesst.
- **Alternatives:** Nur `recentGiIssue` kuerzer betrachten (willkuerlich und nicht fachlich geschlossen); neues DB-Feld fuer resolved-by einfuehren (nicht noetig fuer v1, vorhandene Logs reichen); nur UI-Hilfetext ergaenzen (behebt die Planlogik nicht).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Today Options bekommen kompakte Signal-Labels

- **Decision:** Today Options tragen optionale `signalLabels` im Shared Contract und zeigen pro Option kompakte Gründe wie `Produktiv`, `Recovery`, `Fueling schützen` oder `Mental schützen`. Das stärkste Schutzsignal wird vor produktiven oder generischen Recovery-Hinweisen angezeigt.
- **Why:** Tobi entscheidet die Tagesoptionen häufig auf iPhone/PWA. Die langen Evidence-Chips bleiben nützlich, aber der primäre Grund muss ohne Lesen langer Details sichtbar sein, besonders wenn GI-, Mental- oder Recovery-Schutz eine harte Einheit verdrängt.
- **Alternatives:** Nur Detailtexte schärfen (zu langsam erfassbar); Evidence-Chips im Backend umsortieren (zu grob und nicht semantisch); neues Daily-Panel bauen (mehr UI statt klarerer Karte).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Plan-Apply fuehrt direkt in Garmin-Ausfuehrungsreadback

- **Decision:** Plan- und Szenario-Vorschauen zeigen erwartete Garmin-Create/Update/Delete-Zaehler. Nach einem Apply wechselt Pulse automatisch in den Plan-Tab `Ausfuehrung`, wo der bestehende Garmin-Readback Vorlage, Kalender, Repeat-Status und explizite Reparaturaktionen prueft.
- **Why:** Apply und Garmin-Vertrauen duerfen kein mental getrennter Folgeprozess sein. Der Wechsel zum Readback macht sichtbar, was auf Uhr/Edge angekommen ist oder repariert werden muss, ohne dass normale Browser-QA selbst Garmin-Schreibaktionen ausloest.
- **Alternatives:** Nach Apply im Training-Tab bleiben (zu wenig Trust Closure); automatische Reparatur ohne Klick ausloesen (zu riskant); separaten Top-Level-Garmin-Tab bauen (mehr Navigation statt besserem Planfluss).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Plan Refresh Preview bleibt read-only bis Garmin-Diff/Apply geschlossen ist

- **Decision:** Pulse zeigt im Plan-Tab eine `Plan prüfen`-Vorschau fuer stale Wochen, offene Adaptionssignale, Capability-Updates und alte Plan-Engine-Versionen. Die Vorschau vergleicht aktuelle und vorgeschlagene Workouts, aber `Vorschau anwenden` bleibt in dieser Phase bewusst deaktiviert.
- **Why:** Tobi braucht vor einer Regeneration erst Klarheit, ob RPE/GI/Mental/Garmin-/Capability-Signale den sichtbaren Plan wirklich aendern wuerden. Ein read-only GET mit Tests gegen DB- und Garmin-Schreibzugriffe haelt Browser-QA sicher und bereitet die naechste Apply-/Readback-Phase sauber vor.
- **Alternatives:** Direkt `/plan/generate` aus der UI triggern (zu riskant wegen Garmin-Schreibpfaden); Apply sofort mitbauen (zu grosser Scope ohne Garmin-Diff); nur Adaptionskarten anzeigen (kein konkreter Workout-Vergleich).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Pulse bleibt proprietaer lizenziert

- **Decision:** Pulse wird als proprietaere Codebasis mit `All rights reserved`-Lizenzdatei gefuehrt; das Root-`package.json` markiert das Monorepo zusaetzlich als `UNLICENSED`.
- **Why:** Pulse enthaelt persoenliche Coaching-, Trainings-, Garmin-, Mental- und Betriebslogik und soll nicht stillschweigend als frei wiederverwendbare Open-Source-Codebasis erscheinen. Wiederverwendbare generische Bausteine koennen spaeter separat und bewusst unter einer offenen Lizenz veroeffentlicht werden.
- **Alternatives:** MIT oder Apache-2.0 fuer maximale Wiederverwendung (zu offen fuer die aktuelle Produkt-/Datendomaene); AGPL-3.0 fuer Open-Source-SaaS-Schutz (zu viel Open-Source-Signal fuer ein persoenliches Produkt); keine Lizenzdatei beibehalten (rechtlich restriktiv, aber auf GitHub zu implizit).
- **Decided by:** Tobi / Codex, PR #271.
- **Status:** active.

## 2026-05-10 — Karpathy-Agentenregeln werden als Pulse-Codex-Disziplin geführt

- **Decision:** Die Karpathy-inspirierten Agentenregeln aus `forrestchang/andrej-karpathy-skills` werden nicht als generische `CLAUDE.md` kopiert, sondern als Pulse-spezifische Codex-Skill `pulse-coding-discipline` plus knappe Pointer in `AGENTS.md`, `docs/ai/context-map.md` und `docs/codex-system-prompt.md` gepflegt.
- **Why:** Pulse hat bereits harte Repo-Regeln, Session-Rituale und Produktentscheidungen. Eine angepasste Codex-Skill hält die vier nützlichen Prinzipien (Annahmen sichtbar machen, einfachste ausreichende Lösung, chirurgische Diffs, verifizierbare Ziele) auffindbar, ohne Claude-/Cursor-spezifische Installationslogik oder doppelte Prompt-Regeln einzuschleppen.
- **Alternatives:** `CLAUDE.md` direkt übernehmen (falsches Tool und doppelte Single Source of Truth); Cursor-Regel übernehmen (nicht für Codex relevant); nur `AGENTS.md` erweitern (weniger gut als Skill triggerbar).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Sportarten werden in Tagesflows lokalisiert angezeigt

- **Decision:** Sichtbare Tages- und Planflächen verwenden eine gemeinsame Frontend-Label-Hilfe für Sportarten (`run` → `Laufen`, `bike` → `Radfahren`) statt technische Activity-Codes direkt zu rendern.
- **Why:** Der Live-Browser-Review zeigte `run` in Home-Tagesentscheidung, TodayOptions und Plan-Wochenleiste. Diese Rohcodes wirken wie interne Daten und stören gerade auf iPhone/PWA-Flows, in denen die Entscheidung schnell verständlich sein muss.
- **Alternatives:** Nur Home einzeln patchen (lässt denselben Fehler in Plan/Options wieder auftauchen); Backend-Labels erzwingen (größerer API-Vertrag für einen UI-Render-Fix); technische Codes akzeptieren (schwächt Vertrauen in die tägliche Führung).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Saisonlinie bleibt ohne Load-Model renderbar

- **Decision:** Die Plan-Saisonlinie behandelt `seasonStrategy.loadModel` als optionalen API-Bestandteil. Wenn die API keinen Load-Forecast liefert, rendert Pulse Block, Guardrails und Evidenz weiter und blendet nur Saisonlast, Forecast und Warnungen aus.
- **Why:** Der Live-Browser-Reload zeigte einen Crash auf `/plan`, weil produktive Saisonstrategie-Daten ohne `loadModel` zurückkamen. Eine fehlende Modell-Ergänzung darf die zentrale Planseite nicht über die Error Boundary unbenutzbar machen.
- **Alternatives:** Backend sofort verpflichtend auffüllen (sinnvoll als separate Datenvertrags-Härtung, aber nicht ausreichend als UI-Schutz); Error Boundary akzeptieren (zu hart für Alltag); Mock-Daten weiter als vollständig annehmen (hat den Live-Fehler verdeckt).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Garmin-Sync-Schulden zeigen einen 15-Tage-Gerätehorizont

- **Decision:** Die Plan-Garmin-Sync-Karte zeigt zusätzlich zur Gesamtzahl geplanter Zukunftseinheiten, wie viele offene Sync-Schulden im nächsten 15-Tage-Gerätehorizont liegen.
- **Why:** TrainingPeaks/Garmin-Workflows machen geplante strukturierte Workouts vor allem in einem nahen Gerätefenster relevant. Tobi braucht vor der Ausführung Vertrauen, ob Uhr oder Edge die nächsten Einheiten wirklich bekommen, statt nur eine ungewichtete Zukunftsliste zu sehen.
- **Alternatives:** Nur Gesamtzahl und Statuschips zeigen (zu wenig ausführungsscharf); automatisch synchronisieren (zu viel versteckte Mutation); einen separaten Garmin-Kalender-Screen bauen (zu groß für diesen Slice).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Planalternativen dürfen bei grünen Signalen auch Wachstum anbieten

- **Decision:** Die nächste Trainingsentscheidung bietet `Länger` als zielorientierte Alternative nur an, wenn keine Risiko- oder Mental-Warnung aktiv ist, ein Ziel vorhanden ist, die Einheit locker bleibt, die Dauer nicht bereits sehr lang ist und TSB positiv ist. In diesem Fall kann `Länger` als Empfehlung markiert werden.
- **Why:** Benchmark-Muster aus TrainerRoad Alternates zeigen, dass gute Alternativen nicht nur defensiv sein dürfen. Tobi will, dass Pulse Daten und Ziele einbezieht; bei grünen Signalen soll Pulse kontrollierten Ausdauer-Zusatzumfang anbieten, statt immer nur zu kürzen.
- **Alternatives:** Immer `Länger` zeigen (zu riskant); `Härter` ergänzen (ohne Leistungsziel-/FTP-Kontext zu grob); defensive Alternativen beibehalten (zu wenig zielorientiert).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Plan öffnet mit sichtbarem Adaptionscheck

- **Decision:** Die nächste Trainingsentscheidung zeigt einen kompakten `ADAPTIONS-CHECK`, der entweder `Plan aktuell` oder eine konkrete Empfehlung wie `Leichter empfohlen` benennt. Die Empfehlung bleibt ein Review-/Apply-Flow und ändert den Plan erst nach explizitem Klick auf die Alternative.
- **Why:** Benchmark-Muster aus TrainerRoad zeigen, dass Nutzer beim Öffnen verstehen wollen, ob der Plan geprüft wurde und ob eine Anpassung ansteht. Pulse hatte Alternativen, aber der Status war zu implizit; Tobi soll direkt sehen, ob aktuelle Daten den Plan beeinflussen.
- **Alternatives:** Nur die `Empfohlen`-Marke auf dem Button belassen (zu leicht zu übersehen); automatische Anpassung beim Öffnen (zu viel versteckte Mutation); eigene Adaptionsseite bauen (zu groß für diesen Slice).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Smoke-Route-Ready-Checks bekommen realistische Browser-Zeit

- **Decision:** Die Smoke-Suite wartet bei Route-Ready-Texten bis zu 15 Sekunden statt des Playwright-Defaults von 5 Sekunden. Der Runtime-Error-Check bleibt separat, aber sichtbare Route-Anker dürfen beim parallelen Desktop-Start länger brauchen.
- **Why:** Die Failure-Snapshots zeigten die erwarteten Inhalte sichtbar nach dem Timeout. Ein zu knapper Browser-Ready-Check macht autonome PR- und Deploy-Loops langsam und unzuverlässig, ohne echte Produktfehler zu finden.
- **Alternatives:** Smoke-Suite mehrfach manuell wiederholen (verschleiert Flakes); Parallelität global senken (langsamer); Produktcode ändern (falsche Ebene).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Manuelle Einheiten starten neutral statt als 155-km-Tour

- **Decision:** Das manuelle `+ Einheit`-Formular startet ohne Distanz- und Schnittwerte. Die 155-km-Rennradtour bleibt als expliziter Preset verfügbar, wird aber nicht mehr automatisch in jede neue manuelle Einheit übernommen.
- **Why:** Tobi braucht sowohl kurze manuelle Einträge als auch lange freie Touren. Ein versteckter 155-km-Default lässt neue Einheiten wieder gleich aussehen und verwischt, ob Pulse wirklich die konkrete Trainingsabsicht berücksichtigt.
- **Alternatives:** Den 155-km-Default beibehalten (zu viel ungewollte Vorprägung); das Distanz/Schnitt-Feature entfernen (verliert die lange Tour als echten Use Case); einen größeren Wizard bauen (zu schwer für diesen PR).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Planalternativen bekommen eine datenbasierte Empfehlung

- **Decision:** Die nächste Trainingsentscheidung markiert eine Alternative als `Empfohlen`, wenn Load, Risiko oder mentale Lage gegen das unveränderte Training sprechen. Bei moderatem Risiko priorisiert Pulse `Leichter`; bei sehr negativer TSB kann `Frei lassen` empfohlen werden; ohne Warnsignale kann ein kürzerer Zielreiz empfohlen werden.
- **Why:** Alternativen dürfen nicht wie vier gleichwertige Knöpfe wirken. Tobi will, dass aktuelle Daten und Ziele in die Planung eingehen; eine sichtbare Empfehlung reduziert Entscheidungsarbeit und macht die Datenwirkung im täglichen Flow greifbar.
- **Alternatives:** Alle Alternativen gleichrangig lassen (zu generisch); automatisch ändern (zu viel versteckte Mutation); Empfehlung nur im Coach-Text verstecken (zu indirekt).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Plan zeigt Garmin-Sync-Schulden als Übersicht

- **Decision:** Der Plan-Tab zeigt bei zukünftigen Workouts mit lokalem Status, nur Garmin-Vorlage oder degradiertem/blockiertem Sync-Vertrag eine kompakte `Garmin Sync-Check`-Karte. Die Karte fasst die Kategorien zusammen und führt nach Settings → Garmin, statt Nutzer erst einzelne Workout-Rows öffnen zu lassen.
- **Why:** Uhr-/Edge-Vertrauen ist ein eigener täglicher Flow. Sync-Schulden müssen vor der Ausführung sichtbar sein, besonders auf iPhone/PWA, damit Tobi nicht erst während der Einheit merkt, dass Kalender oder Struktur fehlen.
- **Alternatives:** Nur Row-/Modal-Badges beibehalten (zu kleinteilig); direkten Calendar-Sync aus dem Plan starten (zu viel Mutation im Trainingsscreen); separate Sync-Debt-Seite bauen (zu schwer für diesen Schritt).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Garmin-Reparaturaktionen müssen direkt ausführbar sein

- **Decision:** Garmin-Quality-Aktionen zeigen ihren konkreten Aktionstyp und führen `calendar_sync` direkt aus, statt generisch auf eine Seite zu verlinken. Backfill- und Plan-Aktionen behalten ihre vollständige Zielroute inklusive Query-Parametern.
- **Why:** Garmin-Sync-Schulden sollen dort auflösbar sein, wo Pulse sie sichtbar macht. Ein generisches `Öffnen` auf Settings erzeugt einen Sackgassen-Flow und verschleiert, ob die Uhr-/Edge-Synchronisation tatsächlich gestartet wurde.
- **Alternatives:** Alle Aktionen weiter als Navigation behandeln (zu indirekt); separate Sync-Debt-Seite bauen (zu groß für diesen Slice); Calendar-Sync automatisch im Hintergrund starten (zu viel versteckte Mutation).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — TrainNow führt in eine schreibfreie Plan-Vorschau

- **Decision:** Today-/TrainNow-Optionen verlinken mit `source=today-options` und konkreten Szenario-Parametern in die Plan-Szenario-Vorschau. Die Plan-Karte übernimmt Sportart, Zone, Dauer und Beschreibung, speichert aber erst nach expliziter Prüfung und Anwendung.
- **Why:** Der tägliche iPhone/PWA-Flow soll von einer Empfehlung direkt in eine prüfbare Planentscheidung führen, ohne heimlich neue Workouts oder Garmin-Syncs auszulösen. Benchmark-Muster aus TrainNow-/Structured-Workout-Flows sprechen dafür, Empfehlung, Planlast und Gerätewirkung in einem sicheren Review-Schritt zu verbinden.
- **Alternatives:** Direkt aus Home speichern (zu viel versteckte Mutation); weiter nur generisch auf den Plan-Tab verlinken (zu wenig Handlung); eigene TrainNow-Unterseite bauen (zu großer IA-Sprung für diesen Slice).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Fueling-Toleranz unterscheidet niedrige Zufuhr von Überlastung

- **Decision:** GI-/Magenprobleme bei niedriger Carb-Zufuhr unter 50 g/h werden nicht mehr pauschal als Signal für weniger Carbs interpretiert. Pulse empfiehlt dann früheres, gleichmäßigeres Fueling und einen kontrollierten 50-70-g/h-Schritt, besonders wenn ein später Snack wie Mars geholfen hat.
- **Why:** Tobis 155-km-Log spricht eher für Timing, Verteilung oder niedrige Energiezufuhr als für zu aggressive Carb-Mengen. Alltagsnutzen entsteht nur, wenn Pulse solche Logdetails fachlich differenziert statt jede GI-Notiz gleich zu behandeln.
- **Alternatives:** Jede GI-Notiz auf untere Range senken (zu grob); sofort aggressiv 90 g/h empfehlen (zu riskant); Mars als Standardprodukt empfehlen (nicht gewünscht).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Garmin-Resync-Fehler behalten lokalen Sync-Vertrag

- **Decision:** Wenn eine Prescription-Änderung wie Sportart, Zone oder Dauer neue Workout-Details erzeugt, bleibt der frisch berechnete Garmin-Sync-Vertrag erhalten, auch wenn der anschließende Garmin-Reupload fehlschlägt.
- **Why:** Pulse muss bei Garmin-Ausfällen weiterhin lokal erklären können, welche Struktur, Repeats und Zielarten geplant sind. Ein fehlgeschlagener Remote-Sync darf nicht die lokale Export-Evidenz löschen und dadurch die UI wieder in einen unklaren Zustand bringen.
- **Alternatives:** Den Vertrag bei jedem Garmin-relevanten PATCH löschen (verliert Evidenz bei Netzwerkfehlern); Sync-Fehler als kompletten PATCH-Fehler behandeln (würde lokale Planänderungen unnötig blockieren).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Sportartwechsel erklärt Detail- und Garmin-Neuaufbau

- **Decision:** Plan-Workout-Rows zeigen nach einem Sportartwechsel ein sichtbares `aria-live`-Feedback, dass Beschreibung, Garmin-Struktur und Garmin-Sync neu geprüft bzw. bei Sync-Fehlern offen bleiben.
- **Why:** Der Backend-Pfad regeneriert Sportart-, Zonen- und Daueränderungen bereits inklusive Garmin-Remote-Replacement. Ohne UI-Feedback wirkt der Flow aber wie ein reiner Feldwechsel und erklärt nicht, warum Beschreibung, Steps und Garmin-Kalender kurz danach anders aussehen können.
- **Alternatives:** Nur auf Query-Invalidation vertrauen (zu still); sofort ein Detailmodal öffnen (zu schwergewichtig); Sportartwechsel blockieren, bis Garmin fertig ist (zu langsam und fehleranfällig).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Planliste zeigt Garmin-Struktur vor dem Öffnen

- **Decision:** Strukturierte Workouts zeigen in der Planliste eine kompakte `Garmin-Struktur`-Zeile mit Blockanzahl, berechneter Step-Dauer, Repeat-Hinweis und HR-Ziel-Anzahl.
- **Why:** Benchmark-Blick auf TrainerRoad und TrainingPeaks zeigt, dass Schwierigkeit, Struktur und Exportrelevanz schon vor dem Öffnen der Detailansicht scannbar sein müssen. Pulse soll besonders auf iPhone/PWA Vertrauen in Garmin-Workouts geben, ohne jeden Row zu einer Detailkarte aufzublähen.
- **Alternatives:** Nur das Detailmodal erweitern (bereits umgesetzt, aber zu spät im Flow); Backend-DTO erweitern (für diese vorhandenen Step-Daten unnötig); vollständige Step-Liste in jeder Row zeigen (zu bulky).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Workout-Detail zeigt Garmin-Handoff-Inhalt vor Upload

- **Decision:** Das Workout-Detailmodal zeigt bei strukturierten Workouts eine kompakte `Garmin Workout-Inhalt`-Zusammenfassung mit Blockanzahl, Dauer, Repeat-Blöcken, Wiederholungen und HR-Zielen, bevor die Einheit auf Garmin geladen wird.
- **Why:** Top-Workout-Builder machen vor dem Geräteexport sichtbar, was tatsächlich ausgeführt wird. Pulse soll besonders bei Repeat-/HR-Ziel-Workouts Vertrauen schaffen, bevor Uhr oder Edge synchronisiert werden.
- **Alternatives:** Nur die Schritteliste behalten (zu schwer zu scannen); die Zusammenfassung erst nach Upload zeigen (zu spät); Backend-DTO erweitern (nicht nötig, da alle Daten im Workout vorhanden sind).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Plan erklärt Data-Handoff sichtbar

- **Decision:** Wenn die Plan-Szenario-Vorschau aus der Data `Plan-/Load`-Triage geöffnet wird, zeigt die Karte einen sichtbaren Kontext-Hinweis. Der Hinweis nennt Readiness, TSB und Plan-/Load-Evidenz als Grund für die Prüfung.
- **Why:** Deep Links dürfen Nutzer nicht kommentarlos in eine Aktionsfläche werfen. Ein kurzer Herkunftshinweis reduziert kognitive Last auf iPhone/PWA und macht klar, warum eine Planprüfung jetzt sinnvoll ist.
- **Alternatives:** Nur Hash-Fokus ohne Erklärung (zu still); separate Data-Zwischenseite bauen (zu viel Umweg); automatisch Vorschau starten (zu viel Automatik).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Data Plan-/Load führt zur Plan-Aktionsfläche

- **Decision:** Die `Plan-/Load`-Triage im Data-Überblick führt direkt zur Plan-Szenario-Vorschau (`/plan?tab=training#plan-scenario-preview`) statt nur zur Analyse-Ansicht. Plan unterstützt dafür Hash-Fokus auf konkrete Aktionsflächen.
- **Why:** Data soll nicht nur Evidenz erklären, sondern den täglichen Flow zur nächsten sinnvollen Handlung schließen. Gerade auf iPhone/PWA ist der Schritt von Load-/Plan-Signal zur Planprüfung sonst zu indirekt.
- **Alternatives:** Weiter nur zur Data-Analyse verlinken (zu wenig handlungsorientiert); automatisch Szenario berechnen (zu viel Automatik); neuen Action-Router bauen (zu groß für diesen Slice).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Szenario-Vorschau zeigt betroffene Workouts vor dem Anwenden

- **Decision:** Die Plan-Szenario-Vorschau zeigt konkrete betroffene Zukunftseinheiten mit Dauer- und TSS-Änderung, bevor ein Szenario angewendet wird. Tagesdeltas bleiben sichtbar, werden aber durch Workout-spezifische Auswirkungen ergänzt.
- **Why:** Plananpassungen müssen nachvollziehbar sein, bevor Pulse lokale Änderungen oder Garmin-Sync-Folgen auslöst. Das reduziert Blindflug bei Umfangssenkung, Verschieben und selbst vorgeschlagenen Einheiten.
- **Alternatives:** Nur aggregierte Tagesdeltas behalten (zu abstrakt); Backend-Vertrag um neue Impact-DTOs erweitern (größerer Slice); Szenario automatisch anwenden (zu wenig Kontrolle).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Data-Überblick wird zur täglichen Evidence-Triage

- **Decision:** Der Data-Überblick zeigt zuerst eine kompakte Triage aus Readiness/TSB, Mental Check-in, Garmin-Frische und Plan-/Load-Evidenz. Die Detailkarten bleiben bestehen, aber der Einstieg beantwortet zuerst, welche Daten heute entscheidungsrelevant sind.
- **Why:** Browser-Review zeigte, dass Data bisher sauber, aber zu sehr wie eine Sammlung von Launchern wirkte. Für die tägliche Pulse-Nutzung ist wichtiger, sofort die relevanten Signale und deren Prüfrouten zu sehen.
- **Alternatives:** Nur bestehende Provenance-Buttons behalten (zu wenig signalstark); alle Detailbereiche direkt auf dem Überblick ausrollen (zu bulky auf iPhone/PWA); Data komplett in Home integrieren (zu großer IA-Schnitt für diesen Loop).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Execution Review nutzt Garmin-HR-Zonen für Ausführungsqualität

- **Decision:** Die Plan-Execution-Review wertet gecachte Garmin-HR-Zonen aus, wenn sie vorhanden sind. Pulse unterscheidet damit nicht nur `completed`, sondern erkennt grob, ob lockere Einheiten zu hart ausgeführt wurden oder harte Einheiten das Intensitätsziel kaum getroffen haben.
- **Why:** Für planadaptive Qualität reicht ein Datums-/Dauer-Match nicht aus. Top-Trainingssysteme behandeln die tatsächliche Ausführung als Planinput; HR-Zonen sind in Pulse bereits gecacht und können deterministisch ohne neue Tabellen genutzt werden.
- **Alternatives:** Nur RPE/Soreness verwenden (subjektiv und oft leer); komplette Power-/Lap-Analyse bauen (größerer Slice); HR-Zonen erst live von Garmin laden (zu langsam/riskant für Plan-Generierung).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Adaptions-Check führt direkt in die passende Szenario-Prüfung

- **Decision:** Der Plan-Adaptions-Check öffnet die Szenario-Vorschau nicht mehr im generischen `155-km Tour`-Modus, sondern bereitet `Umfang senken` mit einem sichtbaren Hinweis vor. Nutzer prüfen damit direkt, ob die kommenden Workouts nach verpassten oder anders ausgeführten Einheiten defensiver werden sollten.
- **Why:** Ein Adaptions-Review muss wie bei etablierten Trainingsplattformen zur passenden Planänderung führen, nicht zu einer zufälligen Standard-Vorschau. Der Nutzer soll sofort verstehen, welche Anpassungsfrage Pulse beantworten will.
- **Alternatives:** Nur zur Karte scrollen (zu unpräzise); automatisch Vorschau berechnen und Plan ändern (zu viel Automatik); neue Adaptions-Inbox bauen (zu groß für diesen Slice).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Erledigte geplante Workouts schließen die Tagesoptionen mit geplantem Kontext

- **Decision:** `TodayOptions` behalten den geplanten Workout-Kontext auch dann, wenn die Einheit am selben Tag bereits als completed/matched gilt. Pulse zeigt dann `Geplantes Training erledigt`, listet geplante und abgeschlossene Einheit als Evidence und bietet nur Feedback, Fueling und Recovery statt weiterer Workout-CTAs.
- **Why:** Tagesentscheidungen sollen wie bei führenden Trainingsapps nach Ausführung eine klare Plan-Closure herstellen: erledigte Workouts sind kein weiterer Trainingsentscheid, sondern ein Anlass für Feedback, Versorgung, Recovery und nächste Anpassung.
- **Alternatives:** Completed-Aktivitäten generisch behandeln (zu wenig planbezogen); nur Home-Daily-Decision anpassen (Plan/Coach-Kontext bleibt widersprüchlich); weiterhin nur `status=planned` in `/plan/today/options` laden (verliert completed Workouts mit gespeicherter Planverknüpfung).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-10 — Plan bekommt einen sichtbaren Adaptions-Check statt stiller Ausführungsabweichungen

- **Decision:** Pulse zeigt im Plan eine `Adaptions-Check`-Karte, wenn geplante Workouts laut Garmin-Ausführung verpasst oder durch andere Aktivitäten ersetzt wurden. Die Karte bietet `Szenario prüfen` als Review-Einstieg und `Plan beibehalten` als bewusste Ablehnung, statt automatisch umzubauen.
- **Why:** Benchmark gegen TrainerRoads Adaptation-Preview zeigt: Anpassungen sollten sichtbar geprüft und akzeptiert/abgelehnt werden. Für Pulse ist das besonders wichtig, weil Garmin-Ausführung, Kalender-Sync und Planvertrauen zusammenhängen.
- **Alternatives:** Nur Badges in Workout-Zeilen belassen (zu versteckt); direkt automatisch regenerieren (zu wenig Kontrolle); komplette Adaptations-Inbox mit Persistenz bauen (zu groß für diesen Slice).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-09 — Plan zeigt fehlgeschlagenen Garmin-Sync nach lokalen Planänderungen sofort an

- **Decision:** Wenn eine eigene Einheit, ein angewendetes Szenario oder eine Planänderung lokal gespeichert wird, der Garmin-Upload aber fehlschlägt, zeigt Plan einen sichtbaren Warnhinweis (`Garmin-Sync offen`) im Flow und im Workout-Modal. Die Einheit bleibt in Pulse gespeichert; der Nutzer soll später über Workout oder Settings erneut synchronisieren können.
- **Why:** Für Tobi ist Garmin/Edge/Uhr-Ausführung ein Kernnutzen. Stille Teilerfolge erzeugen falsches Vertrauen, weil Pulse zwar geplant hat, das Workout aber nicht auf dem Gerät landen muss.
- **Alternatives:** Nur über Row-Badges `Lokal` informieren (zu indirekt nach einer Aktion); Mutation komplett fehlschlagen lassen, obwohl Pulse gespeichert hat (verliert den lokalen Plan); sofort automatisch retryen (riskant bei Garmin-Rate-Limits).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-09 — Data-Untertabs zeigen auf Mobile alle Bereiche sichtbar

- **Decision:** Data nutzt den gemeinsamen `SegmentedControl` mit opt-in Wrapping, damit alle sieben Unterbereiche auf iPhone-Breite sichtbar und direkt antippbar bleiben. Plan und andere kompakte Tab-Leisten behalten die einzeilige Variante.
- **Why:** Route-Evidence und Benchmark-Blick auf mobile Trainings-/Analyseapps zeigten, dass dichte Analysebereiche zwar segmentiert sein dürfen, aber nicht wie abgeschnittene Navigation wirken sollten. Sichtbare Tabs reduzieren Suchaufwand für Mental, Analysen und Garmin-Abdeckung.
- **Alternatives:** Scrollbare Leiste mit Fade/Arrow-Hinweis behalten (weiterhin versteckte Ziele); Data in mehrere Top-Level-Routen splitten (zu großer IA-Eingriff); Dropdown statt Tabs (weniger schnell für tägliche Wechsel).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-09 — Plan-UI unterdrückt leere Entscheidung bei geplanter Tagesoption

- **Decision:** Wenn Pulse keine offene Zukunftseinheit im Wochenplan findet, aber `TodayOptions` den aktuellen Tag als `planned_workout` bewertet, zeigt die Plan-Seite nicht zusätzlich die leere Karte `Kein offenes Training geplant`. Die Today-Options-Karte wird dann zur sichtbaren Trainingsentscheidung; Route-Evidence friert die Mock-Uhr auf das Fixture-Datum ein.
- **Why:** Browser-QA zeigte einen widersprüchlichen Plan-Screen: oben kein offenes Training, darunter heute trainieren. Die UI soll Dateninkonsistenzen defensiv behandeln und die tägliche Entscheidung nicht mit einem leeren Fallback überdecken.
- **Alternatives:** Nur die Screenshot-Fixture-Zeit fixieren (lässt echte Dateninkonsistenzen weiter widersprüchlich erscheinen); den Text der leeren Karte abschwächen (bleibt kognitiv doppelt); TodayOptions aus Plan entfernen (nimmt den frisch gebauten TrainNow-Nutzen aus dem Flow).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-09 — Ziel-Limiter bleiben berechnete Plan-Evidence

- **Decision:** Pulse führt physiologische Ziel-Limiter zunächst als deterministische, berechnete Plan-Evidence ein. Der Limiter wird aus aktivem Ziel, Capability Levels, jüngsten Aktivitäten und Fueling-/GI-Historie abgeleitet, im Plan-Trace gespeichert und in Plan-Entscheidungen/UI gezeigt; es gibt keine neue Tabelle und kein neues Dashboard.
- **Why:** Tobi braucht bessere Ziel- und Kurs-Spezifität im Wochenplan, aber zusätzliche Persistenz oder ein separates Analytics-Dashboard würde den Alltag überladen. Der Trace ist der richtige Ort, weil er erklärt, warum der aktuelle Plan Long-Endurance/Fueling oder Schwelle/VO2 priorisiert.
- **Alternatives:** WKO-artige Modellierung mit eigener Persistenz bauen (zu groß und datenhungrig); Limiter nur als UI-Text ergänzen (nicht testbar); neues Top-Level-Dashboard bauen (verstößt gegen die schlanke Navigation).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-09 — Garmin-Sync bekommt einen gespeicherten Ausführungsvertrag

- **Decision:** Pulse speichert pro geplantem Workout einen `garmin_sync_contract`, der den erzeugten Garmin-Payload vor dem Upload auf Wiederholungszahlen, Schrittstruktur und nicht unterstützte Zielarten prüft. Fehler blockieren den Upload sichtbar; degradierte Ziele wie Swim/Strength ohne HR-Ziel werden als Einschränkung in Plan und Modal gezeigt.
- **Why:** Workouts auf Edge/Uhr müssen Vertrauen erzeugen. Wiederholungen dürfen nicht mehr als `null`/0 auf Garmin landen, und stille Ziel-Degradierungen sind in der UI verwirrend, wenn Pulse im Plan etwas anderes suggeriert als Garmin ausführen kann.
- **Alternatives:** Nur Remote-Reparatur nach dem Upload behalten (zu spät); Sync-Fehler nur loggen (nicht alltagstauglich); Garmin-Targets komplett deaktivieren (verliert Nutzen für Run/Bike/Hike).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-09 — Saisonlinie bekommt ein explizites Load-Modell

- **Decision:** Pulse erweitert die Saisonlinie um ein deterministisches Load-Modell mit aktueller Zielwoche, 4-Wochen-Forecast, Zielstunden/TSS, CTL-Ziel, Ramp-Cap, Deload-Rhythmus und Taper-Warnungen. Die Plan-Entscheidung zitiert `Saisonlast` als Evidence, statt nur Zielblock/Guardrails zu zeigen.
- **Why:** Wochenplanung soll langfristige Ziele, A/B/C-Events, Ramp-Rate, Deload und Taper sichtbar berücksichtigen. Damit reagiert Pulse nicht nur auf die nächste Woche, sondern erklärt, ob eine Woche Build, Deload, Taper, Maintenance oder Recovery ist.
- **Alternatives:** Vollständiges TrainingPeaks-ATP-Schema mit eigener Persistenz bauen (zu groß für diesen Slice); nur UI-Text ergänzen (kein planbares Modell); TSS-Ziel dem LLM überlassen (nicht stabil/testbar).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-09 — Plan-Szenarien werden zuerst als write-free Preview bewertet

- **Decision:** Pulse fuehrt Plan Scenario Preview als read-only Bewertung ein: `/plan/scenario/preview` berechnet Projected Workouts, geaenderte Tage, TSS-/Dauer-Delta, Recovery-Folgetag, Gruende und Warnungen, ohne Plan, Availability oder Garmin zu schreiben. Die Plan-UI kann eine Vorschau danach explizit ueber bestehende sichere Create-/Update-Pfade anwenden.
- **Why:** Tobi will lange Touren, Verschieben oder Umfangsreduktion verstehen, bevor Pulse die Woche umschreibt. Ein write-free Preview-Layer verhindert versteckte Garmin-/DB-Seiteneffekte und macht Fueling-/Recovery-Auswirkungen sichtbar, besonders bei langen Custom-Touren.
- **Alternatives:** Direkt den bestehenden Plan-Generator als Preview missbrauchen (zu viel LLM-/DB-Nebeneffekt); Availability-PUT fuer Vorschau nutzen (schreibt sofort); kompletten Plan-Builder mit Apply-Route in einem PR bauen (zu gross und konflikttraechtig).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-09 — TrainNow bleibt read-only und priorisiert Tagesabschluss vor Zusatztraining

- **Decision:** Pulse ergaenzt einen read-only Endpoint `/plan/today/options`, der 2-3 stabile Tagesoptionen aus geplanten Workouts, heutigen Garmin-Aktivitaeten, Readiness/TSB, Risk, Mental Check-in, Fueling-Hinweisen, Sportmix und aktiven Zielen ableitet. Home zeigt diese Optionen kompakt nur dann, wenn sie den Tagesfluss klaeren; Plan zeigt die vollere Evidenz.
- **Why:** Spontane Tage sollen nicht automatisch mit Training gefuellt werden. Wenn heute bereits eine Garmin-Aktivitaet abgeschlossen wurde, sind Feedback, Fueling und Erholung wichtiger als ein weiterer Workout-Vorschlag; bei hohem Recovery-Risk muss Rest als aktive Trainingsentscheidung sichtbar sein.
- **Alternatives:** Existing Today-Adjust zu einem mutierenden Multi-Option-Flow ausbauen (zu riskant fuer diesen Slice); Optionen per LLM generieren (nicht stabil genug); TrainNow nur im Plan verstecken (Home-Friktion bleibt).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-09 — Planned Workouts speichern Archetyp, Difficulty und Capability-Fit

- **Decision:** Geplante Workouts bekommen persistente Library-Metadaten (`archetype_id`, `difficulty_level`, `difficulty_energy_system`, `capability_fit`). Beschreibung, Steps, Plan-/Modal-Copy und Garmin-Payload werden aus derselben deterministischen Workout-Library-Materialisierung erzeugt.
- **Why:** Sportartwechsel und Alternativen duerfen nicht nur einzelne Felder patchen, sondern muessen Zweck, Beschreibung, Steps und Garmin-Remote konsistent neu aufbauen. Persistente Metadaten machen spaetere TrainNow-/Scenario-/Limiter-Features wiederverwendbar und verhindern, dass die UI anders argumentiert als Garmin ausfuehrt.
- **Alternatives:** Nur Beschreibungstext anpassen (zu fragil); nur transient im Frontend fit-labeln (nicht Garmin-/API-sicher); weiterhin LLM-first Steps erzeugen (zu wenig stabil fuer Wiederholungen und Sync-Vertraeuen).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-09 — Capability Levels werden als persistente Trainingsgrundlage eingefuehrt

- **Decision:** Pulse speichert rolling Capability Levels pro Trainingssystem (`endurance`, `long_endurance`, `tempo`, `threshold`, `vo2`, `anaerobic`, `recovery`, `strength`) und nutzt daraus deterministische Fit-Labels wie `Erhaltung`, `Produktiv`, `Stretch` und `Zu hart heute` fuer Plan-Entscheidungen und Data-/Plan-Evidence.
- **Why:** Tobis wiederkehrendes Problem waren gleichfoermige oder nicht datenbasierte Trainingsempfehlungen. Ein persistenter, testbarer Level-Layer macht abgeschlossene Einheiten, Fehlversuche, lange ungeplante Garmin-Aktivitaeten, RPE und Compliance als Planungsgrund sichtbar, ohne Home weiter zu ueberladen.
- **Alternatives:** Level nur ad hoc im Frontend berechnen (nicht belastbar und nicht wiederverwendbar); direkt eine grosse Workout-Bibliothek bauen (Story 2, braucht diese Grundlage); Fit komplett dem LLM ueberlassen (zu zufaellig und schwer testbar).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-09 — Benchmark gegen Top-Trainingstools priorisiert Faehigkeiten statt Plan-Kopien

- **Decision:** Pulse nutzt TrainerRoad, TrainingPeaks, JOIN, Intervals.icu und WKO als Benchmark fuer Faehigkeitsluecken, kopiert aber keine proprietaeren Workout- oder Planinhalte. Die naechsten Training-PRs priorisieren Capability Levels, Workout-Difficulty-Fit, TrainNow-Optionen, Szenario-Preview, Jahreslastmodell, Garmin-Sync-Vertrag und Limiterspezifitaet.
- **Why:** Tobi will TrainerRoad-/TrainingPeaks-Niveau oder besser erreichen, aber Pulse soll durch eigene Garmin-, Mental-, Recovery- und Fueling-Evidenz besser zu seinem Alltag passen. Planinhalte aus fremden Bibliotheken waeren rechtlich/fachlich falsch; die uebertragbaren Produktmuster sind die relevanten Vergleichsdimensionen.
- **Alternatives:** Externe Plaene nachbauen (nicht akzeptabel); nur weitere Wochenplan-Promptlogik schreiben (zu wenig robust); sofort alle Benchmark-Luecken in einem PR bauen (zu gross und riskant).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-09 — Lokale Verify-Strecke umfasst Script- und Frontend-Logiktests

- **Decision:** `scripts/verify-local.sh` fuehrt nach dem Migration Guard auch `npm run test:scripts` aus; dieser Lauf enthaelt nun die bestehenden Ops-Skripttests und kleine TypeScript-Frontend-Logiktests.
- **Why:** UI-nahe Planlogik darf nicht nur ueber Build oder manuelle E2E-Pfade abgesichert sein. Der zusaetzliche Check ist schnell und faengt strukturierte Frontend-Entscheidungslogik ab, ohne den teuren Browser-Smoke standardmaessig zu erzwingen.
- **Alternatives:** Neue Frontend-Logiktests nur manuell laufen lassen (zu leicht zu vergessen); vollen Playwright-Smoke in jede lokale Verify-Strecke aufnehmen (zu langsam fuer kleine PRs); alles in Backend-Vitest pressen (falsche Testgrenze).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-09 — Plan-Entscheidungen werden als Signalgruppen statt Rohgruende gezeigt

- **Decision:** Die Plan-UI zeigt `planDecision.reasons` zuerst als kompakte Signalgruppen (`Fueling`, `Erholung`, `Variation`, `Freie Tage`, `Zielbezug`) und behaelt sonstige Gruende sichtbar, statt die Backend-Gruende nur als unstrukturierte Textliste auszugeben.
- **Why:** Die neue Trainingsintelligenz soll im Alltag nachvollziehbar sein. Tobi muss direkt sehen, ob Pulse wegen GI-/Fueling-Toleranz, Recovery, Variation oder bewussten freien Tagen konservativ plant, ohne den tieferen Trace-Block lesen zu muessen.
- **Alternatives:** Rohgruende weiter als Paragraphen zeigen (zu schwer scanbar); komplette Explainability-Dashboard bauen (zu gross fuer diesen Slice); Gruende nur im Data-Trace zeigen (zu weit weg vom Plan-Flow).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-09 — Fueling-Toleranz begrenzt Wochenplan-Dichte und Long-Endurance-Dosis

- **Decision:** Wenn Pulse in den letzten During-Fueling-Logs GI-Probleme bei langen Einheiten erkennt, wird die Wochenplanung konservativer: ein verfuegbarer Tag bleibt frei, lange aerobe Einheiten werden gedeckelt und die Workout-Beschreibung nennt `Fueling-Toleranz` als Planungsgrund.
- **Why:** Fueling-Erfahrung ist nicht nur Detail-Copy fuer ein einzelnes Workout. Nach Tobis langer Tour mit Magenproblemen muss Pulse die naechste Woche so planen, dass Fueling kontrolliert geuebt wird, statt denselben langen Reiz oder maximale Dichte stumpf zu wiederholen.
- **Alternatives:** Fueling-Toleranz nur in der Modal-Guidance anzeigen (zu spaet im Flow); harte automatische Carb-Vorgaben erzwingen (zu medizinisch/pseudopraezise); kompletten Nutrition-Score einfuehren (groesserer spaeterer Slice).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-09 — Fueling-Toleranz aus echten Logs beeinflusst kuenftige Guidance

- **Decision:** Pulse nutzt During-Fueling-Logs mit GI-Komfort, 750-ml-Flaschen, Pulvergramm und Aktivitaetsdauer als Toleranzsignal fuer spaetere lange Einheiten. Die Guidance zeigt ein `Toleranz-Lernen` und Evidence an, statt alte Fueling-Daten nur historisch zu speichern.
- **Why:** Tobis 155-km-Tour zeigte, dass Magen-/Energieprobleme erst nach vielen Stunden auftreten koennen und konkrete Mengen wie 300 g Pulver und vier Flaschen wichtig sind. Kuenftige Empfehlungen muessen diese Erfahrung sichtbar einpreisen, ohne daraus medizinische Praezision zu machen.
- **Alternatives:** Fueling-Logs nur anzeigen (kein Lernnutzen); Carb-Range aggressiv automatisch senken (fachlich riskant, weil GI- und Energieprobleme nicht immer zu viel Fueling bedeuten); neues Schema fuer Toleranzscores bauen (zu gross fuer diesen Slice).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-09 — Planvariation muss im Workout selbst sichtbar werden

- **Decision:** Wenn Pulse ein Wiederholungsmuster erkennt, variiert die Plan-Engine nicht nur intern Sportmix/Tage, sondern annotiert Workouts mit Trainingsarchetypen und einem sichtbaren `Variation zur Vorwoche`-Hinweis; kleine deterministische Dauer-/TSS-Nudges verhindern rein identische Einheiten.
- **Why:** Tobi soll im Plan nachvollziehen koennen, warum eine Einheit genau so aussieht und ob Pulse wirklich gelernt hat. Eine Trace-Warnung allein hilft nicht im Alltag, wenn die konkrete Einheit weiterhin generisch wirkt oder auf Garmin wie dieselbe Einheit erscheint.
- **Alternatives:** Nur Plan-Trace warnen (zu indirekt); Variation komplett dem LLM ueberlassen (nicht deterministisch genug); sofort ein grosses Workout-Library-UI bauen (groesserer Folgeslice).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-09 — Training Intelligence startet mit deterministischer Kontrollschicht

- **Decision:** Der naechste Training-Intelligence-Slice baut zuerst Workout-Archetypen, Difficulty-Scoring, Athlete-Progression und Plan-Quality-Evaluation als deterministische Backend-Schicht, bevor Pulse externe Planbibliotheken oder komplexere Plan-Builder-UI nachbildet.
- **Why:** Tobi kritisiert zu Recht wiederholte, generische Trainingsvorschlaege und fehlende Reaktion auf reale Garmin-Belastung. Eine kleine, testbare Kontrollschicht macht diese Fehler messbar und verhindert, dass die App harte oder lange Wochen wiederholt, bevor die groessere TrainerRoad-/TrainingPeaks-Vision weiter ausgebaut wird.
- **Alternatives:** Direkt eine grosse Planbibliothek/UI bauen (zu hoher Scope ohne Guardrails); externe Trainingsplaene inhaltlich kopieren (fachlich und rechtlich nicht sinnvoll); nur Prompt-Texte anpassen (zu wenig belastbar).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-09 — Lokale Backend-Tests laufen standardmaessig seriell

- **Decision:** Das Backend-Testscript nutzt `vitest run --fileParallelism=false`; parallele Ausfuehrung bleibt als `test:parallel` bewusst verfuegbar. Auf Macs ohne Docker darf die lokale Teststrecke ueber Homebrew-Postgres und Homebrew-Redis laufen.
- **Why:** Die lokalen Postgres-/Redis-Services waren stabil, aber parallele DB-Tests loeschten gemeinsame User-Fixtures und erzeugten dadurch falsche Foreign-Key-Fehler. Serielle Backend-Tests dauern lokal nur rund 20 Sekunden und machen `verify:local:no-services` verlaesslicher.
- **Alternatives:** Parallele DB-Tests trotz Flakiness behalten (blockiert PRs unnoetig); alle Fixtures sofort auf isolierte Transaktionen umbauen (groesserer Folgeslice); Docker als einzige lokale Option verlangen (passt nicht zu Tobis aktuellem Mac-Setup).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-09 — Fueling-Logs speichern alltagstaugliche During-Daten strukturiert

- **Decision:** Pulse speichert Fueling-Logs fuer Aktivitaeten mit praktischen During-Feldern: 750-ml-Flaschen, POWER-CARB-Pulvergramm, ausgewaehlte Produkte/Snacks und GI-Vertraeglichkeit. Freitext-Notizen bleiben ergaenzend, sind aber nicht mehr die einzige Quelle fuer solche Informationen.
- **Why:** Tobis 155-km-Tour hat gezeigt, dass konkrete Daten wie 300 g Pulver, vier 750-ml-Flaschen, Mars als GI-Hilfe und RPE spaeter fuer bessere Empfehlungen lernbar sein muessen. Strukturierte Felder machen diese Muster in der App sichtbar und fuer spaetere Guidance nutzbar.
- **Alternatives:** Weiter nur Notizen speichern (nicht maschinenlesbar); sofort einen vollstaendigen Produkt-/SKU-Katalog bauen (zu grosser Scope fuer diesen Slice); nur generische Carbs/Drinks speichern (verliert Tobis reale Produkte und GI-Kontext).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-09 — Home zaehlt heutige Garmin-Aktivitaeten als Tagesabschluss

- **Decision:** Wenn Garmin heute eine relevante Aktivitaet liefert und kein geplantes Pulse-Workout fuer heute offen ist, behandelt Home den Tag als `Training heute erledigt` statt als `Heute ist kein Training geplant`. Die Tagesentscheidung fuehrt dann zu RPE-/Feedback-Erfassung und Planabgleich, nicht zu einer weiteren Trainingssuche.
- **Why:** Tobi faehrt oder laeuft auch Einheiten, die vorher nicht in Pulse geplant waren. Die App muss die reale Belastung aus Garmin ernst nehmen, damit Home nicht fachlich falsch wirkt und der naechste Plan die echte Einheit einbeziehen kann.
- **Alternatives:** Weiter nur geplante Workouts als erledigt zaehlen (irrefuehrend nach spontanen Einheiten); jede kurze Aktivitaet zaehlen (zu laut, daher Mindestdauer); automatisch ein geplantes Workout nachtraeglich erzeugen (hoehere Sync- und Datenmodell-Komplexitaet, spaeterer Schritt).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-09 — Eigene geplante Workouts werden als user-locked Plananker behandelt

- **Decision:** Pulse speichert manuell angelegte geplante Workouts mit `origin = user` und `user_locked = true`, zeigt sie im Plan als eigene Einheit und schuetzt sie bei Plan-Regenerationen vor Loeschung oder Ueberschreiben. Die Einheit wird beim Anlegen wie normale geplante Workouts mit Beschreibung, Steps und optionalem Garmin-Sync vorbereitet.
- **Why:** Tobi muss Touren wie eine 155-km-Rennradausfahrt selbst in Pulse planen koennen, damit die App um diese Realitaet herum plant, statt sie beim naechsten Generatorlauf zu verlieren. Garmin bleibt Ausfuehrungsziel, aber Pulse bleibt fachlich fuehrend.
- **Alternatives:** Eigene Einheiten nur in der Beschreibung markieren (nicht maschinenlesbar); nur ueber Verfuegbarkeit blocken (keine konkrete Einheit, kein Garmin-Workout); alle manuellen Einheiten beim Generator wie normale Vorschlaege ersetzen (zerstoert explizite Nutzerabsicht).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-09 — Plan-Aenderungen ersetzen Garmin-Remote-Workouts statt sie zu behalten

- **Decision:** Wenn eine geplante Einheit fachlich geaendert wird (Sportart, Zone, Dauer, Datum, Beschreibung oder Status), behandelt Pulse vorhandene Garmin-Vorlagen und Kalendertermine als stale: alte Schedule/Template-Objekte werden best-effort entfernt, lokale Garmin-Felder werden zurueckgesetzt und geplante Einheiten werden anschliessend mit neu erzeugter Beschreibung/Steps wieder zu Garmin synchronisiert. `skipped` entfernt nur remote und laedt nichts neu hoch.
- **Why:** Tobi fuehrt die Workouts auf Uhr/Edge aus; eine geaenderte Pulse-Einheit darf dort nicht als alte Sportart, alte Beschreibung oder altes Intervallprofil liegen bleiben. Die lokale Planbearbeitung bleibt dennoch fuehrend: falls Garmin nicht erreichbar ist, bleibt die Pulse-Aenderung gespeichert und die Einheit faellt sichtbar auf local-planned zurueck.
- **Alternatives:** Nur `steps = null` setzen und manuellen Resync verlangen (veraltet auf Garmin und in der UI verwirrend); alte Garmin-IDs behalten (stale Confidence); PATCH hart fehlschlagen lassen, wenn Garmin nicht erreichbar ist (blockiert Planarbeit wegen eines externen Sync-Problems).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-06 — Fueling-Guidance rechnet fuer Tobi in 750-ml-Flaschen

- **Decision:** MNSTRY-During-Guidance fuer Tobi verwendet 750-ml-Flaschen als Standard und nennt POWER-CARB-Pulvergramm pro Flasche sowie Gesamtpulver fuer die Einheit. 500-ml-Flaschen bleiben aus Tobis produktspezifischer Copy raus.
- **Why:** Tobi nutzt nur 750-ml-Flaschen und braucht die Empfehlung als konkrete Mischanweisung, nicht als abstrakte Carb- oder 500-ml-Aequivalente. Die offizielle MNSTRY-Dosierung erlaubt eine konservative Umrechnung von POWER CARB Sour Cherry 1:0.8 in Pulvergramm pro 750-ml-Flasche.
- **Alternatives:** Weiter 500-ml-Aequivalente zeigen (passt nicht zu Tobis Alltag); neue Flaschengroessen-Migration bauen (zu viel fuer eine bestaetigte Einzelpraeferenz); nur Gesamt-Carbs ohne Pulver nennen (nicht handlungsleitend genug).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-06 — MNSTRY-Kalibrierung nutzt bestaetigte Produkte ohne neues Schema

- **Decision:** Pulse interpretiert `preferred_fueling_products = Ministry/MNSTRY` als Tobis bestaetigte Produktanker: `POWER CARB Sour Cherry 1:0.8` als primaeren During-Mix, `PORRIDGE BAR Sour Cherry` als Pre-/ruhiger Snack, `PROTEIN BAR 8 Peanut & Cranberry` als Recovery-Baustein und `BICARB GEL 40 Lemon 1:0.8` nur fuer race- oder intensitaetsnahe Kontexte. Intensity-/Caffeine-Produkte werden nicht automatisch empfohlen.
- **Why:** Tobi hat die konkreten Produkte bestaetigt, und die offiziellen MNSTRY-Angaben liefern genug Serving-Daten fuer alltagstaugliche Produktanker. Ein neues Profil-Schema waere fuer diesen Schritt Overhead, weil das bestehende freie Praeferenzfeld bereits den Ministry/MNSTRY-Anker speichert.
- **Alternatives:** Neue Produkt-Key-Spalten oder JSONB-Profilfelder anlegen (zu viel Migration fuer eine kleine Kalibrierung); weiter nur generische Gel-Aequivalente zeigen (weniger nuetzlich); BICARB als Standard-Gel zaehlen (fachlich irrefuehrend, weil es ein Spezialprodukt mit Bikarbonat ist).
- **Decided by:** Tobi + Codex.
- **Status:** active.

## 2026-05-06 — Fueling-Portionen bleiben generische Äquivalente statt Ministry-SKU-Katalog

- **Decision:** Pulse übersetzt Carb-/Sodium-Bereiche in generische Portionsäquivalente: Gesamt-Kohlenhydrate für die geplante Dauer, grobe Gel-Äquivalente mit 25 g Carbs pro Serving und Sodium-Spannen pro 500/750 ml Flasche. Ministry bleibt vorerst nur der bevorzugte Produktanker im Text.
- **Why:** Tobi kennt die g/h- und Sodium-Werte nicht auswendig und braucht alltagstaugliche Orientierung. Ohne konkrete Ministry-Produktdaten würde ein SKU-Katalog falsche Präzision erzeugen; generische Äquivalente machen die Empfehlung direkt nutzbar und bleiben transparent.
- **Alternatives:** Keine Portionshilfe geben (zu abstrakt); konkrete Ministry-Produkte hardcoden (veraltet schnell und riskant ohne Labeldaten); exakte Sodium-Mengen pro Stunde versprechen (zu präzise ohne Schweißrate und Trinkmenge).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-06 — Fueling-Guidance reist als kurzer Text in Garmin-Workout-Beschreibungen mit

- **Decision:** Beim Upload geplanter Workouts nach Garmin darf Pulse einen kurzen `Pulse Fueling`-Block in die Garmin-Workout-Beschreibung schreiben, wenn die workout-spezifische Fueling-&-Recovery-Guidance sichtbar sein soll. Der Block ersetzt ältere Pulse-Fueling-Blöcke statt sie zu duplizieren.
- **Why:** Tobi will geplante Einheiten auf Uhr/Edge ausführen, daher muss die wichtigste Fueling-Information nicht nur in der Web-UI, sondern auch am Ausführungsort sichtbar sein. Die Description ist der risikoärmste erste Handoff, weil sie keine Garmin-Step-Logik oder Wiederholungen verändert.
- **Alternatives:** Fueling nur in Pulse anzeigen (zu wenig Alltagstransfer); Garmin-Steps oder Workout-Namen verändern (höheres Risiko und schlechtere Anzeigequalität); produktgenaue Ministry-Portionen sofort schreiben (ohne konkrete Serving-Daten zu spekulativ).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-06 — Fueling-Guidance startet read-only im Plan-Workout-Modal

- **Decision:** Die erste UI-Integration der Fueling-&-Recovery-Guidance ist ein read-only Card-Block im Plan-Workout-Modal, gespeist von `GET /api/pulse/fueling-recovery/guidance?workoutId=...`. Garmin-Workout-Beschreibungen, automatische Kalendertexte und produktgenaue Ministry-Portionen bleiben eigene Folge-PRs.
- **Why:** Tobi braucht die Hinweise zuerst dort, wo die konkrete Einheit geplant und geöffnet wird. Der read-only Schnitt reduziert Risiko, vermeidet versehentliche Garmin-Sync-Nebenwirkungen und erlaubt Browser-QA, bevor Guidance in externe Gerätebeschreibungen geschrieben wird.
- **Alternatives:** Guidance sofort in Garmin-Descriptions schreiben (zu viel Sync-Risiko fuer den ersten UI-Schnitt); nur Backend-API ohne UI bauen (kein Alltagsnutzen); Guidance auf Home zeigen (zu viel kognitive Last fuer die Tagesentscheidung).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-06 — Fueling-Guidance nutzt konservative, evidenzbasierte Bereiche

- **Decision:** Die Fueling-&-Recovery-Guidance startet mit konservativen, regelbasierten Bereichen: kurze lockere Einheiten bleiben still, längere Ausdauer-Einheiten bekommen 30-60 g Kohlenhydrate/h, sehr lange Einheiten optional 60-90 g/h nur mit geübter Glukose-/Fruktose-Strategie, und Sodium startet vorsichtig bei 400-800 mg/L mit Hinweis auf Hitze, Durst, Körpergewicht und fehlende Schweißratenmessung.
- **Why:** Die App soll Tobi handlungsfähig machen, ohne medizinische oder sporternährungsdiagnostische Präzision vorzutäuschen. Die Bereiche orientieren sich an ACSM/AND/DC, Jeukendrup/Sports Medicine und NATA/Fluid-Replacement-Empfehlungen; individuelle Schweißrate und Verträglichkeit bleiben bewusst bessere zukünftige Datenquellen.
- **Alternatives:** Produktgenaue Ministry-Portionen hart verdrahten (zu wartungsintensiv); nur generische Texte ohne Mengen zeigen (zu wenig alltagstauglich); aggressive High-Carb-/High-Sodium-Ziele immer empfehlen (zu riskant ohne Gut-Training und Schweißdaten).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-06 — Fueling-Preferences leben im Athletenprofil

- **Decision:** Die expliziten Fueling-&-Recovery-Präferenzen werden als additive Felder in `pulse_user_profile` gespeichert, nicht in `pulse_coach_preferences`.
- **Why:** Fueling-Guidance soll spaeter direkt Plan-, Workout- und Recovery-Entscheidungen steuern und dabei Gewicht, Profil und Garmin-nahe Athletenwerte lesen. Der bestehende Plan nennt das Profil als Ziel, und die Felder sind Empfehlungsgates fuer den Athleten, nicht nur Kommunikationsstil des Coach-Chats.
- **Alternatives:** `pulse_coach_preferences` erweitern (naheliegend fuer sichtbare Vorlieben, aber zu stark an Coach-Texte gekoppelt); separate Preference-Tabelle bauen (sauber, aber zu gross fuer den ersten PR); nur im Plan-Doc festhalten (nicht maschinenlesbar).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-06 — Fueling & Recovery darf konservative Carb-/Sodium-Guidance geben

- **Decision:** Pulse darf fuer Fueling & Recovery konservative, koerpergewichtsbezogene Empfehlungen zu Kohlenhydraten pro Stunde und Sodium geben. Tobi hat keine Ernaehrungseinschraenkungen, nutzt primaer Ministry-Produkte, und Pulse soll die konkreten Gramm-/Sodium-Bereiche vorschlagen statt sie von Tobi zu verlangen.
- **Why:** Der bisherige Plan war bewusst preference-gated, damit Pulse keine ungefragten oder unpassenden Ernaehrungsvorgaben macht. Mit den bestaetigten Grenzen kann die App praktische Vorher-/Waehrend-/Nachher-Hinweise liefern, ohne medizinische Praezision oder individuelle Schweissraten vorzutaeuschen.
- **Alternatives:** Fueling weiter blockiert lassen (nimmt dem Plan den Alltagsnutzen); nur generische Hinweise ohne Mengen geben (zu wenig handlungsleitend); spezifische Produkte hart verdrahten (zu starr und wartungsintensiv).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-06 — Server-Verify zeigt PM2- und Garmin-Log-Signale als nicht-blockierende Ops-Hinweise

- **Decision:** `scripts/verify-server.sh` bleibt ein harter Healthcheck fuer Git-Stand, PM2-Online-Status, Frontend und API-Health, gibt aber zusaetzlich PM2-Restart-Zaehler, instabile Restarts und zusammengefasste Garmin-/Rate-Limit-/Proxy-Logsignale aus.
- **Why:** Wiederkehrende Probleme wie hohe PM2-Restart-Zaehler, Garmin-SSO-Rate-Limits oder temporaere Proxy-Resets waren bislang nur durch manuelles Log-Lesen sichtbar. Der Statuslauf soll diese Hinweise frueh zeigen, ohne historische Logeintraege faelschlich als aktuellen Deploy-Blocker zu behandeln.
- **Alternatives:** Logsignale weiter manuell per SSH pruefen (fehleranfaellig); `verify-server` bei jedem historischen Logtreffer fehlschlagen lassen (zu laut und blockiert gesunde Deploys); eine neue Monitoring-Infrastruktur bauen (zu gross fuer den lokalen Pulse-Betrieb).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — CI trennt Build, Backend und Browser per Change-Fläche

- **Decision:** Die GitHub-CI nutzt einen `changes`-Job und fuehrt Build, Backend-Tests und Browser-Tests als getrennte, parallelisierbare Jobs aus. Der stabile Pflicht-Check `build-and-test` bleibt als Aggregator erhalten und akzeptiert bewusst uebersprungene Jobs, solange kein benoetigter Job fehlschlaegt.
- **Why:** PRs mit Docs- oder reinen Frontend-Aenderungen sollen nicht automatisch Postgres/Redis-Services starten oder Backend-Tests blockieren. Gleichzeitig soll die bestehende Branch-Protection nicht durch neue Pflicht-Check-Namen brechen.
- **Alternatives:** Nur `paths-ignore` verwenden (koennte required checks fehlen lassen); komplett getrennte Workflows ohne Aggregator (Branch-Protection-Risiko); alle Jobs weiter seriell in einem Job lassen (verschwendet Zeit und startet Services unnoetig).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-05 — Pull-Request-CI nutzt schnelle Browser-Smokes statt voller E2E

- **Decision:** `build-and-test` bleibt der zentrale PR-Check, fuehrt bei Pull Requests aber nur die Desktop- und Mobile-Smoke-Suite aus. Die volle Playwright-Regression laeuft weiterhin auf `main` und per `workflow_dispatch`; alte CI-Laeufe desselben PRs werden automatisch abgebrochen.
- **Why:** Kleine UI- und Tooling-PRs warteten bislang auf die komplette Browser-Suite, obwohl lokale fokussierte E2E-Checks bereits die konkrete Aenderung pruefen. Ein schneller PR-Gate reduziert Wartezeit, ohne die Full-Regression aus dem Projekt zu entfernen.
- **Alternatives:** Full E2E auf jedem PR behalten (sicher, aber langsam); Full E2E komplett entfernen (zu riskant); Check-Namen/JOB-Struktur sofort stark splitten (mehr Branch-Protection-Risiko als erster Optimierungsschnitt).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-05 — Home `Was jetzt?` trennt erledigt, offen und Hinweise

- **Decision:** Die Home Daily Decision nutzt fuer abgeschlossene Tages-Trainings strukturierte Schritte mit `Erledigt`, `Noch offen` und `Heute beachten`. Feedback wird nur als offene Aufgabe gezeigt, wenn zur gematchten Aktivitaet weder RPE noch Feedback-Zeitpunkt oder Workout-Feedback vorliegt; passive Regenerationshinweise erscheinen nicht mehr als Aufgabe.
- **Why:** Nach erledigtem Training soll Tobi sofort erkennen, ob wirklich noch etwas zu tun ist. Pauschales `RPE/Feedback pruefen` war verwirrend, wenn Feedback bereits erfasst war, und liess Hinweise wie `kein Zusatztraining` wie abhakbare Aufgaben wirken.
- **Alternatives:** Die bisherige nummerierte Liste nur umformulieren (loest den Statusfehler nicht); immer zur Planseite schicken (Feedback-Luecke bleibt indirekt); eine neue Aufgaben-API bauen (zu gross fuer diesen Home-UX-Slice).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-05 — Home-Tagesentscheidung nutzt klare Alltagssprache statt interne Entscheidungslabels

- **Decision:** Die Home Daily Decision Card zeigt die internen Bausteine `Grenze`, `Alternative` und `Abschluss` nicht mehr als sichtbare Einzelkacheln. Home fasst sie unter `Was jetzt?` als nummerierte Hinweise zusammen und macht nur echte CTAs zu Buttons.
- **Why:** Tobi soll auf Home sofort verstehen, was jetzt zu tun ist. Die bisherigen Labels waren fuer die Coaching-Logik nuetzlich, wirkten aber im Tages-Cockpit wie unklare Aktionen und erhoehten die kognitive Last.
- **Alternatives:** Labels nur umbenennen (behält das Framework-Gefuehl); Kacheln als Buttons lassen (weiterhin falsche Affordance); alle Details entfernen (zu wenig Erklaerbarkeit fuer Tagesentscheidungen).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-05 — Home zeigt abgeschlossene Tages-Trainings als erledigt statt als freien Tag

- **Decision:** Home bekommt ein eigenes `todayWorkout`-Signal aus `/api/pulse/home` und behandelt heute geplante, per Garmin gematchte oder abgeschlossene Einheiten als erledigte Tagesentscheidung. Entscheidungsqualitaet und Recent Trainings werden nicht mehr auf Home angezeigt; Mental-Signale erscheinen dort nur noch als knapper Tageshinweis, wenn sie wirklich eine Belastungsgrenze setzen.
- **Why:** Tobi nutzt Home als taeglichen Einstieg. Nach einer erledigten geplanten Einheit ist "Heute ist kein Training geplant" fachlich falsch und erzeugt Misstrauen; Entscheidungsqualitaet, rohe Mental-Health-Labels und Recent Trainings erhoehen die kognitive Last ohne unmittelbare Tageshandlung.
- **Alternatives:** Recent Trainings auf Home behalten (dupliziert Data/Activity-Nutzen); Entscheidungsqualitaet weiter als Home-Strip zeigen (zu analytisch fuer den Startscreen); nur die Copy aendern ohne Backend-Contract (wuerde Garmin-Matches und naechstes Training weiter vermischen).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-05 — Manuelle Profilwerte koennen feldweise auf Automatik wechseln

- **Decision:** Manuelle Profilwerte bleiben weiterhin geschuetzt, koennen aber in Settings pro Feld explizit fuer den Garmin-Profil-Sync freigegeben werden. Die Freigabe gilt nur fuer angewaehlte Felder und uebernimmt den besten vorhandenen Garmin-Settings- oder Activity-derived-Kandidaten.
- **Why:** Tobi moechte FTP, MaxHF, LTHR und VO2max im Alltag automatisch aus Garmin/Aktivitaeten nutzen koennen, ohne dass ein normaler Sync still alle manuell korrigierten Trainingsanker ueberschreibt. Feldweise Automatik erhaelt Auditierbarkeit und vermeidet globale Ueberraschungen.
- **Alternatives:** Garmin immer alle manuellen Werte ueberschreiben lassen (zerstoert bewusste Korrekturen); nur die UI-Labels umbenennen (loest den eigentlichen Wechsel nicht); direkte DB-Korrekturen empfehlen (nicht alltagstauglich und nicht auditierbar).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-05 — Abgeschlossene Trust-Closure-Plaene werden archiviert

- **Decision:** Die erledigten Plaene `2026-05-05-mobile-a11y-controls-polish.md` und `2026-05-05-data-decision-evidence-trail.md` werden nach `docs/superpowers/plans/completed/` verschoben. Die Future-Roadmap fuehrt sie als abgeschlossene Wellen, nicht mehr als priorisierte Zukunftsarbeit.
- **Why:** Beide Plaene sind durch PRs, QA und Server-Deploy abgeschlossen. Im aktiven Planordner wuerden sie Token verschwenden und neue Sessions dazu verleiten, bereits implementierte UI/UX-Arbeit erneut zu bauen.
- **Alternatives:** Die Plaene aktiv liegen lassen (Reimplementierungsrisiko); Plaene loeschen (verliert Kontext und Acceptance-Historie); nur `current-focus` anpassen (Plan-Discovery bleibt stale).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — Data bleibt kanonische Evidence-Route fuer Home- und Plan-Entscheidungen

- **Decision:** Home Daily Decision Evidence und Plan-Quellenchips bekommen strukturierte `targetPath`-Metadaten und verweisen auf stabile Data-Anker (`data-recovery`, `data-mental`, `data-garmin-quality`, `data-plan-trace`). Data waehlt bei Hash-Links automatisch den passenden Tab, scrollt zum Ziel und fokussiert den Abschnitt.
- **Why:** Pulse soll im Alltag nicht nur Empfehlungen zeigen, sondern direkt erklaeren, woher sie kommen. Ein Data-zentrierter Evidence-Trail schliesst die Trust-Luecke ohne neue Route, Backend-API oder doppelte Dashboards.
- **Alternatives:** Neue Evidence-Detailseite bauen (zu grosser Scope und neue IA); Chips weiter als passive Labels lassen (Nutzer muss Evidenz suchen); Deep-Link-Ziele aus Label-Text ableiten (fragil bei lokalisierter/dynamischer Copy).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — Segmented Controls wechseln von Toggle-Buttons zu Tabs

- **Decision:** Shared `SegmentedControl` nutzt fuer Data und Plan echte `tablist`/`tab`-Semantik mit `aria-selected`, roving `tabIndex`, Arrow-/Home-/End-Navigation und aktivem Scrollen. Mental `button role="radio"` Gruppen bekommen eigene Arrow-Key-Auswahl statt in Toggle-Button-Logik integriert zu werden.
- **Why:** Data und Plan Tabs sind URL-backed Navigationsbereiche, keine unabhaengigen Toggle-Aktionen. Echte Tab-Semantik verbessert Screenreader- und Keyboard-Bedienung, waehrend Mental weiterhin radiogroup-Semantik behalten soll.
- **Alternatives:** `aria-pressed` behalten und nur Keydown ergaenzen (semantisch falsch fuer Tabs); alle Kontrollgruppen in eine neue Primitive abstrahieren (zu grosser Scope); Mental auf native Inputs umbauen (mehr UI-Risiko fuer den kleinen A11y-Slice).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — Mobile/A11y Controls werden in Touch-Ziele und Keyboard-Semantik getrennt

- **Decision:** Die Mobile/A11y Controls Polish Phase wird in einen ersten 44px-Touch-Target-Slice und einen nachgelagerten Keyboard-Semantik-Slice aufgeteilt. Der erste Slice hebt wiederholte Daily-Use-Controls in Home/Data/Plan/Coach/Settings auf mindestens 44px; Tablist-/Radio-Arrow-Key-Verhalten bleibt im aktiven Plan offen.
- **Why:** Die Touch-Ziel-Probleme sind konkret, risikarm und direkt relevant fuer iPhone/PWA-Nutzung. Tab-/Radio-Semantik beruehrt Rollen, Fokusmodell und bestehende Role-Tests und sollte getrennt verifiziert werden.
- **Alternatives:** Alles in einem PR bauen (mehr Regressionrisiko bei Navigation und Mental Controls); nur Coach/Mental fixen (laesst vom verschärften Test gefundene Plan/Settings-Controls weiter unter 44px); Keyboard-Semantik zuerst bauen (laesst die haeufigsten Touch-Probleme bestehen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — Garmin Sync Confidence bleibt Frontend-Surface auf vorhandenem Execution-State

- **Decision:** Plan nutzt die vorhandenen `executionStatus`-, Garmin-Template- und Garmin-Kalenderfelder fuer eine gemeinsame Frontend-Confidence-Copy in Zeilen und Workout-Detailmodal. Es gibt keine neue Backend-API, keine Migration und keine Live-Garmin-Requests in QA.
- **Why:** Der Trust-Gap ist UI-Erklaerung, nicht fehlende Garmin-Reconciliation-Logik. Der bestehende Vertrag kann lokal, Template, Kalender, erledigt, verpasst und ersetzt bereits ausdruecken; ein kleiner Frontend-Slice reduziert Sprachdrift und haelt die Garmin-Aktion begrenzt.
- **Alternatives:** Backend-Mapping neu einfuehren (groesserer Scope ohne neuen Datenbedarf); Live-Garmin-Sync in E2E pruefen (riskant und undeterministisch); mehrere Garmin-Aktionen im UI verteilen (mehr Unsicherheit statt Vertrauen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — Mental Check-in bekommt sichtbaren Signal-Impact statt neuer Eingabe

- **Decision:** Mental Health/Fitness wird nach dem Speichern ueber einen gemeinsamen Frontend-Klassifizierer in Data, Home, Plan und Coach ausgespielt. Home zeigt die Tageswirkung, Plan zeigt nur bei sensibler/schuetzender Lage eine Vorsichtszeile, Coach nutzt dieselben Labels im Kontext und Prompt. Es gibt keine neue Backend-API und keine neue Check-in-Eingabe.
- **Why:** Nach der Vereinfachung der Eingabe muss Pulse zeigen, was der Check-in konkret veraendert. Ein shared Frontend-Mapping reduziert Sprachdrift und macht die Wirkung sichtbar, ohne das bestehende numerische Check-in-Modell zu erweitern.
- **Alternatives:** Nur Data-Form weiter verbessern (loest nicht den Nutzen-Nachweis); Backend-Schema fuer qualitative Labels einfuehren (groesserer Scope ohne Bedarf); Coach eigene Labels behalten (Drift zwischen Home/Plan/Coach bleibt).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — Home schliesst trainingsfreie Tage lokal ohne synthetische Action-Patches

- **Decision:** Fallback-Tagesentscheidungen ohne Training nutzen auf Home `Erholungstag abschliessen` als primaere lokale Aktion und behalten `Coach fragen` nur als Support. Klicks auf `/`-Ziele patchen keine `nextBestActions.id`, weil diese IDs synthetisch sind; persistente Abschluesse bleiben beim separaten Action-Closure mit echter `decisionId`.
- **Why:** Ein freier Tag soll im Daily Flow abgeschlossen wirken, ohne einen Chat zu erzwingen oder einen falschen Backend-Status zu erzeugen. `nextBestActions.id` ist kein stabiler Action-Decision-Primary-Key.
- **Alternatives:** Coach weiterhin primaer oeffnen (Daily Loop bleibt unfertig); fuer Fallback-Tage neue Completion-Events erfinden (neues Modell ohne Bedarf); synthetische IDs an `/api/pulse/actions/:id` senden (wuerde reale Action-Closure-Semantik brechen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — UI/UX Phase 2 priorisiert Trust Closure vor neuen Features

- **Decision:** Nach PR #176 werden die naechsten UI/UX-Phasen als Trust-Closure-Welle sortiert: Home Daily Decision Closure, Mental Signal Impact, Garmin Workout Sync Confidence, Mobile/A11y Controls und Data Evidence Trail. Fueling/Recovery bleibt preference-gated, Native iOS bleibt evidence-gated.
- **Why:** Die App ist weniger bulky, aber der hoechste Alltagsnutzen entsteht jetzt aus Vertrauen: Was ist heute abgeschlossen, was hat der Check-in veraendert, und ist das Garmin-Workout wirklich korrekt auf Uhr/Edge? Neue Features ohne diese Vertrauensschicht wuerden die App wieder breiter statt nuetzlicher machen.
- **Alternatives:** Direkt Fueling/Recovery bauen (blockiert durch offene Praeferenzen); nur mobile Polish machen (verbessert Bedienung, aber nicht Entscheidungssicherheit); Coach weiter einbetten, bevor Mental/Garmin-Signale klar genug sind (mehr UI ohne bessere Grundlage).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — Mental Check-in nutzt qualitative Lagekarten vor Zahlen

- **Decision:** Data > Mental startet mit drei qualitativen Lagekarten (`Stabil starten`, `Dosiert bleiben`, `Schutzmodus`) fuer Mental Health und Mental Fitness. Die Karten mappen weiterhin clientseitig auf den bestehenden numerischen Check-in-Vertrag; Feinjustierung bleibt optional.
- **Why:** Tobi empfindet die direkte Werteingabe als zu schwer. Qualitative Presets reduzieren kognitive Last im Alltag, halten aber Trends, Coach-Kontext und bestehende API kompatibel.
- **Alternatives:** Neue Backend-Felder fuer qualitative Labels einfuehren (groesserer Scope ohne Noetigung); nur die bestehenden Quick Choices behalten (immer noch zu kleinteilig fuer den ersten Schritt); Zahlen komplett entfernen (bricht bestehende Auswertung).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-05 — Garmin-Repeats mit 0 Iterationen gelten als reparaturbeduerftig

- **Decision:** Garmin-Workout-Reparatur erkennt Repeat-Gruppen nicht nur bei `null`, sondern auch bei `0` oder negativen `numberOfIterations`/`endConditionValue` als defekt.
- **Why:** Garmin kann kaputte Wiederholungen als 0 anzeigen oder speichern. Ohne diese Erkennung bleiben geplante Workout-Vorlagen trotz Sync sichtbar falsch, obwohl sie neu hochgeladen werden sollten.
- **Alternatives:** Nur neue Exporte anpassen (hilft nicht bei bereits defekten Vorlagen); Live-Garmin-Sync als Test nutzen (zu riskant und nicht deterministisch); alle Repeat-Workouts immer neu hochladen (mehr API- und Kalender-Rauschen).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-05 — Coach-Tab-Entfernung wird als Navigation-Regression gesichert

- **Decision:** Die Primary Navigation wird in Smoke- und Daily-Flow-E2E-Tests explizit auf Home, Data, Plan und Settings begrenzt; `/coach` bleibt deep-link-faehig, darf aber nicht als sichtbarer Haupttab zurueckkehren.
- **Why:** Der sichtbare Coach-Tab war bereits entfernt, aber die Tests waren noch zu locker. Eine Regression wuerde die vereinfachte iPhone/PWA-Navigation wieder aufblaehen.
- **Alternatives:** Nur manuell kontrollieren (zu leicht zu uebersehen); `/coach` komplett entfernen (bricht bestehende Prompt-, Push- und History-Flows); Navigationstest global auf jeden Coach-Text setzen (falsch positiv bei Settings/Content).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — UI/UX Foundation reduziert Daily-Flow-Dopplung

- **Decision:** Home behaelt die volle Tagesentscheidung, Plan rendert keine generische `DailyDecisionCard` mehr und Coach-Zielentscheidungen zeigen in Home nur noch eine vorbereitete Prompt-Aktion statt zwei Coach-Buttons.
- **Why:** Die Review zeigte, dass doppelte Tagesentscheidungen und zwei aehnliche Coach-CTAs Vertrauen kosten. Eine kanonische Home-Entscheidung plus Plan-spezifische Trainingsentscheidung macht den taeglichen Flow klarer, ohne bestehende `/coach`-Deep-Links zu brechen.
- **Alternatives:** Plan weiter mit kompakter DailyDecisionCard lassen (Dopplung bleibt); Coach-Zielentscheidungen mit zwei Buttons lassen (unklare CTA-Semantik); Coach-Route sofort vollstaendig ersetzen (groesserer Scope).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-05 — Data startet mit Nutzwert statt Wartungsstatus

- **Decision:** `/data` oeffnet standardmaessig einen `Ueberblick` mit direkten Einstiegen in Analysen, Mental Check-in und Schlaf/Erholung. `Abdeckung` bleibt ueber `/data?tab=coverage` und Repair-/Settings-Links erreichbar.
- **Why:** Data soll als Evidence- und Trend-Ort verstanden werden. Die bisherige Abdeckungs-Defaultansicht war fuer Diagnose wichtig, wirkte aber als erster Eindruck wie Wartung statt Alltagsnutzen.
- **Alternatives:** Direkt `Analysen` als Default (weniger Fuehrung fuer Mental/Recovery); `Abdeckung` als Default behalten (Review-Finding bleibt); neuen Top-Level-Screen bauen (zu grosser Scope).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-05 — Settings nutzt gemeinsamen Garmin-Sync und ehrliche Diagnosezustaende

- **Decision:** Settings startet Garmin-Sync ueber die gemeinsame `useGarminSync`-Mutation und diagnostiziert Garmin getrennt als `Laedt`, `Blockiert`, `Unbekannt`, `Veraltet`, `Teilweise`, `Nicht verbunden` oder `Bereit`.
- **Why:** Ein Sync aus Settings muss dieselben Pulse-Queries aktualisieren wie andere Sync-Einstiege. Ausserdem darf fehlender Status nicht mehr als `Bereit` erscheinen; bekannte Blockaden sollen aber weiterhin vor unbekanntem Legacy-Status sichtbar bleiben.
- **Alternatives:** Nur Status/Coverage lokal refetchen (stale Home/Plan/Data-Risiko); Unknown immer vor Blocked priorisieren (versteckt bekannte Garmin-Circuit-Probleme); Status weiter implizit auf Bereit fallen lassen (irrefuehrend).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-05 — Frontend-Basis priorisiert sichtbaren Fokus und scrollende Mobile-Tabs

- **Decision:** Pulse bekommt einen globalen `focus-visible`-Standard, helleren `text-3`-Kontrast, horizontal scrollende SegmentedControls auf engen Viewports und breitere Operational-Shells fuer Data/Plan.
- **Why:** Die Review fand schwache Tastaturfuehrung, zu dunkle Kleinschrift, sperrige Mobile-Tab-Wraps und verschwendete Desktop-Breite. Die Basisregel verbessert Accessibility und Responsiveness, ohne die vier Haupttabs oder das bestehende Designsystem zu ersetzen.
- **Alternatives:** Pro Komponente einzelne Fokusfixes (mehr Drift); Mobile-Tabs weiter umbrechen lassen (mehr first-viewport Reibung); alle Routen breit ziehen (Home verliert ruhige Tagesfokussierung).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-05 — Coach-Kontext nutzt vorbereitete Deep-Link-Prompts

- **Decision:** Home und Plan oeffnen Coach fuer kontextuelle Fragen ueber `/coach?focus=...&prompt=...`. Coach uebernimmt diesen Prompt nur als Entwurf im Eingabefeld und sendet nie automatisch; bestehende `/coach?actionId=...&decisionId=...` Push-/Action-Links bleiben ohne Prompt kompatibel.
- **Why:** Coach ist nicht mehr Top-Level-Navigation, soll aber weiterhin als aufrufbare Aktionsebene helfen. Ein vorbereiteter Entwurf transportiert Tages-/Plan-Kontext mit sehr kleinem Frontend-Scope, ohne Backend-Vertrag, LLM-Kontextaufbau oder Push-Links zu veraendern.
- **Alternatives:** Sofort einen eingebetteten Coach-Composer in Home/Plan/Data bauen (groesserer UI-/State-Scope); alle `/coach`-Links auf Data/Plan umbiegen (bricht Chat-/History-Kompatibilitaet); Prompt automatisch senden (zu uebergriffig und schwerer kontrollierbar).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — Erledigte 2026-05-04-Pläne werden aus dem aktiven Backlog archiviert

- **Decision:** `2026-05-04-daily-loop-slimming.md`, `2026-05-04-insights-into-data.md` und `2026-05-04-mental-checkin-simplification.md` werden nach `docs/superpowers/plans/completed/` verschoben. Die aktive Roadmap referenziert diese Arbeiten nur noch als abgeschlossene Wellen; aktive Umsetzung bleibt Navigation-IA-Fortsetzung, Mobile Field Reliability und preference-gegatetes Fueling/Recovery.
- **Why:** Die drei Pläne sind durch QA-Dokumente und gemergte PRs belegt, lagen aber noch in der aktiven Planoberfläche. Das erzeugt Token- und Doppelarbeitsrisiko, weil neue Agenten sie erneut als offene Aufgaben lesen könnten.
- **Alternatives:** Die Pläne aktiv liegen lassen (höheres Reimplementierungsrisiko); erledigte Pläne löschen (verliert Begründung und QA-Historie); nur `current-focus` ändern (Plan-Discovery bleibt stale).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — Coach ist kein Top-Level-Tab mehr

- **Decision:** Pulse nutzt als primaere Navigation nur noch Home, Data, Plan und Settings. `/coach` bleibt als kompatible Route fuer bestehende Deep Links, Push-Aktionen, Home-/Plan-Einstiege und Verlauf erhalten, ist aber kein eigener Haupt-Tab und keine numerische Top-Level-Taste mehr.
- **Why:** Tobi wollte den Coach-Tab nicht mehr sichtbar haben, und die Navigation soll fuer iPhone/PWA sowie Desktop weniger bulky werden. Coach ist weiterhin eine Aktionsebene fuer Fragen, Planung und Reflexion, aber kein taeglich notwendiger Ort in der Hauptnavigation.
- **Alternatives:** `/coach` vollstaendig entfernen (zu riskant fuer Push-/Daily-Links und Verlauf); Coach als Top-Level-Tab behalten (widerspricht dem vier-Tab-IA-Ziel); Coach sofort komplett in neue Embedded Composer umbauen (groesserer Scope als der sichere erste Nav-Slice).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-05 — Coach zeigt erledigten Mental-Check-in als Kontext

- **Decision:** Coach rendert einen gespeicherten Tages-Mental-Check-in als read-only Kontextkarte und bereitet daraus eine Planungsfrage vor, statt erneut die gefuehrte Check-in-Frage als Standardprompt zu zeigen. Die Eingabe bleibt bei Home/Data beziehungsweise Voice; Coach dupliziert keine Check-in-Form.
- **Why:** Der Backend-Coach nutzt den Check-in bereits ueber PulseContext, aber die UI machte diesen Einfluss nicht sichtbar. Eine kleine Kontextkarte senkt Alltagsreibung und macht den Mental-Status handlungsrelevant, ohne den Coach zur zweiten Erfassungsoberflaeche aufzublasen.
- **Alternatives:** Eine zweite Quick-Check-in-UI in Coach bauen (Duplikation und mehr Pflege); nur den LLM-Kontext unsichtbar lassen (zu wenig nachvollziehbar); einen neuen Backend-Endpunkt fuer eine Zusammenfassung bauen (unnötig, solange die bestehende Check-in-Historie die Werte liefert).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — Home nutzt kompakten Mental-Check-in statt Data-Formular

- **Decision:** Home bekommt fuer offene Check-in-Tagesaktionen eine kompakte Drei-Preset-Karte (`Stabil`, `Gemischt`, `Schuetzen`), die auf den bestehenden numerischen `POST /api/pulse/checkin`-Vertrag speichert. Data > Mental bleibt die detaillierte Eingabe-, Freitext- und Auswertungsflaeche.
- **Why:** Der taegliche iPhone/PWA-Flow soll den Mental Check-in ohne Tab-Wechsel abschliessen koennen, ohne Home mit der vollstaendigen Data-UI zu beladen. Die Presets nutzen die gleiche grobe Score-Logik wie der Quick Check-in und halten Trends, Coach-Kontext und Backend-Vertrag stabil.
- **Alternatives:** Die komplette Data-Check-in-Komponente auf Home duplizieren (zu bulky fuer Home); Home nur auf Data verlinken lassen (loest die Alltagsreibung nicht); neue Home-spezifische API bauen (unnötiger Backend-Scope).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-05 — Mental Freitext nutzt Preview statt Auto-Save

- **Decision:** Data > Mental bekommt fuer Freitext einen neuen `POST /api/pulse/checkin/text`-Preview-Endpunkt, der `classifyAndExtractCheckin` ueber den bestehenden LLM-Layer nutzt, aber keinen Check-in, keine Coach-Session und keinen Cache-Eintrag persistiert. Gespeichert wird erst nach expliziter Nutzerbestaetigung ueber den bestehenden `POST /api/pulse/checkin`-Vertrag.
- **Why:** Der taegliche Mental Check-in soll weniger Zahlendenken erfordern, ohne dass eine unsichere LLM-Extraktion automatisch Tagesdaten veraendert. Die Preview macht erkannte Werte, Themen und Rueckfragen sichtbar und haelt den bestehenden Trend-/Coach-Kontext kompatibel.
- **Alternatives:** Bestehenden Voice-Endpunkt wiederverwenden (speichert heute direkt und ist fuer Preview zu grob); Freitext nur lokal heuristisch mappen (weniger alltagstauglich fuer natuerliche Beschreibung); neue DB-Felder fuer Extraktionsconfidence einfuehren (groesserer Scope ohne aktuellen Speicherbedarf).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-04 — Quick Check-in bleibt ein Frontend-Adapter

- **Decision:** Der erste Mental-Check-in-Umsetzungsslice ersetzt die 1-10-Pflichtbewertung in Data > Mental durch Quick Choices, mapped diese aber clientseitig auf die bestehende numerische `POST /api/pulse/checkin`-Nutzlast. Garmin-/Recovery-Schwellen fuer die Vorauswahl liegen als Shared Threshold Contract in `@coaching-os/shared/pulse-thresholds`.
- **Why:** Tobi braucht weniger kognitive Last im taeglichen Check-in, waehrend Trends, Coach-Kontext und Backend-Vertrag stabil bleiben sollen. Ein Frontend-Adapter liefert schnellen iPhone/PWA-Nutzen ohne Migration oder neue API-Felder; die Shared Thresholds verhindern lokale Drift in der Komponente.
- **Alternatives:** Neue DB-Felder fuer Choice-Metadaten sofort einfuehren (groesserer Backend-Scope ohne ersten UX-Beweis); nur kosmetisch groessere 1-10-Regler bauen (loest das Entscheidungsproblem nicht); Schwellenwerte direkt in der React-Komponente halten (driftet gegen Pulse-Regeln); Voice zuerst bauen (mehr Fehlermodi und schwerer testbar).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-04 — Habit Tracker ist kein globales No-Go mehr

- **Decision:** Habit-/Routine-Tracking wird aus den globalen Pulse-No-Gos entfernt. Das oeffnet den Scope fuer spaetere Bewertung, priorisiert oder implementiert aber noch keinen Habit Tracker.
- **Why:** Tobi hat die globale Sperre explizit aufgehoben. Pulse soll Habit-/Routine-Ideen deshalb nicht mehr automatisch ablehnen, aber sie weiterhin gegen Alltagsnutzen, Datenquellen, Mental-Fitness-Scope und UI-Schlankheit pruefen.
- **Alternatives:** Die Sperre in `AGENTS.md`/`docs/ai/non-negotiables.md` beibehalten (widerspricht Tobis aktueller Anweisung); sofort einen Habit Tracker bauen (zu grosser Scope ohne UX-/Datenplan); nur einzelne Specs anpassen (laesst CI und globale Agentenregeln stale).
- **Decided by:** Tobi.
- **Status:** active.

---

## 2026-05-04 — Mental Check-in wird als Quick-Check-in geplant

- **Decision:** Pulse plant den Mental Check-in als naechste UX-Phase mit Garmin-/Recovery-Vorschlag, drei einfachen Zustandswahlen und optionalem Freitext statt verpflichtender 1-10-Feinbewertung.
- **Why:** Tobi faellt es schwer, taeglich die "richtigen" Mental-Werte einzugeben. Ein schneller, erklaerbarer Check-in verbessert den Alltagsnutzen auf iPhone/PWA und laesst die vorhandenen numerischen Felder im ersten Schritt kompatibel weiterlaufen.
- **Alternatives:** Vier 1-10-Regler beibehalten (zu viel kognitive Last); nur Voice nutzen (nicht immer alltagstauglich); sofort neue DB-Felder bauen (groesserer Backend-Scope ohne ersten UX-Beweis).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-04 — Insights wandert als Analysen nach Data

- **Decision:** Insights wird aus der Hauptnavigation entfernt und als `Analysen`-Tab in Data gerendert; `/insights` bleibt vorerst ein Redirect auf `/data?tab=analysen`.
- **Why:** Insights ist ein Evidenz- und Analysemodus, dessen Domains zu Data passen. Der Schritt reduziert die mobile und Desktop-Hauptnavigation sofort, ohne Coach Voice, History oder Chat-State anzufassen.
- **Alternatives:** Insights als Haupttab behalten (keine Entlastung); Insights komplett loeschen (verliert Analysefaehigkeit); Coach zuerst entfernen (hoeheres Risiko durch Eingabe-, Voice- und History-Flows).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-04 — Habit-/Routine-Scope bleibt ausserhalb der Nav-IA

- **Decision:** Der Navigation-IA-Spec fuehrt Habit Tracker nicht als eigenes Non-Goal, weil dieser Spec nur Coach/Insights-Navigation entscheidet. Das hebt die bestehenden Pulse-Non-Negotiables gegen Habit Tracker nicht auf; eine separate explizite Umkehrentscheidung waere dafuer noetig.
- **Why:** Tobi wollte den Habit-Tracker-Punkt aus den Non-Goals dieses Specs streichen. Damit bleibt der IA-Spec enger und erzeugt keinen neuen Habit-Scope, waehrend die aktuelle Hauptentscheidung unveraendert bleibt: kein neuer Top-Level-Tab und zuerst Insights nach Data.
- **Alternatives:** Habit Tracker im IA-Spec weiter als Non-Goal fuehren (vermischt globale Produktgrenzen mit diesem Navigations-Spec); Habit-/Routine-Support in diesem PR neu oeffnen (Scope-Creep und Konflikt mit `AGENTS.md`/`docs/ai/non-negotiables.md`); sofort einen Habit-Tab planen (widerspricht dem schlanken Ziel).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-04 — Coach und Insights werden zu Funktionen statt Haupttabs

- **Decision:** Pulse zielt auf vier Haupttabs: Home, Data, Plan und Settings. Coach wird schrittweise als aufrufbare Interaktionsschicht in Home/Plan/Data integriert; Insights wird als Analysebereich in Data integriert. Zuerst soll Insights in Data wandern, weil das einen Haupttab entfernt und weniger Risiko als der Coach-Umbau hat.
- **Why:** Frische Route-Evidence zeigt keine horizontalen Layoutfehler, aber die Navigation bleibt mit sechs Hauptzielen schwer fuer iPhone/PWA- und Desktop-Alltag. Coach ist ein Modus zum Fragen, Einchecken und Kontext klaeren; Insights ist ein Evidenzmodus, dessen Domains bereits zu Data passen.
- **Alternatives:** Coach und Insights unveraendert als Haupttabs behalten (weiterhin zu bulky); beide sofort in einem grossen PR entfernen (zu riskant fuer Voice, History und Deep Links); neue Ersatz-Tabs einfuehren (verschiebt die Navigationslast nur).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-04 — Plan-Leerzustand bekommt direkte naechste Aktionen

- **Decision:** Wenn auf Plan kein offenes Training geplant ist, zeigt die naechste Trainingsentscheidung direkte Aktionen fuer Verfuegbarkeit pruefen, Plan generieren und Coach fragen.
- **Why:** Nach dem Daily-Loop-Slimming blieb der wichtigste Plan-Leerzustand zwar erklaerend, aber nicht handlungsstark. Die direkten Aktionen reduzieren iPhone/PWA-Tap-Suche und fuehren zu den bestehenden Workflows, ohne neue Backend-Vertraege einzufuehren.
- **Alternatives:** Den Hinweistext unveraendert lassen (weiterhin zu passiv); den Plan-Generator automatisch oeffnen (zu aufdringlich); eine neue Wizard-Route bauen (zu gross fuer den bestaetigten Friktionspunkt).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-04 — Daily Loop Slimming macht Home zur vollen Tagesentscheidungsquelle

- **Decision:** Pulse behaelt die vollstaendige Tagesentscheidung mit Grenze, Alternative, Abschluss und Evidenz auf Home; Coach und Plan zeigen diese Tagesentscheidung nur noch als kompakte Kontext-/Aktionskarte.
- **Why:** Die frische Route-Evidence vom 2026-05-04 zeigte keine horizontalen Layoutfehler, aber die gleiche schwere Tagesentscheidung wiederholte sich auf Home, Coach und Plan. Home bleibt damit der vollstaendige Tagesloop, waehrend Coach und Plan schneller in ihre eigentlichen Alltagsaufgaben fuehren.
- **Alternatives:** Den vollen Tagesentscheidungsblock auf allen Routen belassen (zu sperrig auf iPhone/PWA); Coach komplett umsortieren (groesserer Flow-PR); zuerst Data/Settings verdichten (geringere Tagesroutine-Wirkung).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-04 — AI-Kontext-Hierarchie ersetzt lange Pflichtlektuere

- **Decision:** Pulse-Agenten starten mit `AGENTS.md` plus dem kompakten `docs/ai/*`-Arbeitsset; konkrete Roadmaps, Plandokumente, `docs/decisions.md`, lokale Skills und CI-Regeln werden nur bei passender Aufgabe erweitert.
- **Why:** Lange Pflichtlese-Listen, alte Roadmap-Prompts und Branch-/PR-Archive verbrauchen viele Tokens und erzeugen stale Entscheidungen. Die kompakte Hierarchie haelt Hard Rules, Produktqualitaet, aktuelle Gates und File-Auswahl aktuell, waehrend GitHub PRs und completed Plans die Historie tragen.
- **Alternatives:** Den kopierbaren Prompt weiter als umfassende Quelle pflegen (driftet schnell); `docs/decisions.md` immer komplett lesen (zu teuer); `docs/ai/current-focus.md` wieder als PR-Register nutzen (wird stale und dupliziert GitHub).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-02 — UI/UX Evidence nutzt ignorierte Route-Packs plus Companion Boards

- **Decision:** Pulse erzeugt UI/UX-Screenshot-Evidence ueber einen explizit aktivierten Playwright-Route-Pack unter `test-results/route-evidence/` und haelt Canva/FigJam als visuelle Companion-Artefakte, nicht als Quelle fuer Akzeptanz oder Architektur.
- **Why:** Screenshots muessen reproduzierbar sein, sollen aber keine grossen PNGs ins Repo bringen. Das Manifest dokumentiert Commit, Datum, Route, URL, Viewport und Overflow-Summary; Markdown bleibt die dauerhafte Quelle fuer Befunde und Abnahme.
- **Alternatives:** Screenshots direkt committen (Repo-Churn und Binaries); normale Smoke-Tests immer Screenshots schreiben lassen (zu viel Nebenwirkung); Canva/FigJam als verbindliche Quelle behandeln (zu leicht stale und nicht PR-reviewbar).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Settings startet mit einer Diagnosematrix

- **Decision:** Pulse zeigt in Settings vor Profil/Coach eine Diagnosematrix fuer Zugriff, PWA-Modus, Service Worker, Push, Garmin und Zertifikat sowie direkte Sprungziele zu Device, Push, Garmin, Profil und Health.
- **Why:** iPhone/VPN/PWA ist ein echter Alltagszugang, und die bisher wichtigsten Supportfragen lagen zu tief in Settings verteilt. Die Matrix macht blockierte Push-Erlaubnis, Service-Worker-Fehlen, Garmin-Blockaden und manuelle Zertifikatsgrenzen sichtbar, ohne iOS-Zertifikatvertrauen technisch vorzutaeuschen.
- **Alternatives:** Nur die bestehenden Device-/Push-Karten verbessern (weiterhin zu tief auf Mobile); Zertifikatvertrauen automatisch anzeigen (Browser/iOS liefert Pulse kein verlaessliches Signal); Garmin-Details aus Data duplizieren (zu viel Detail statt Support-Zusammenfassung).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Feedback Recovery bleibt lokal und inline

- **Decision:** Pulse nutzt fuer UI-Fehlerzustaende ein kleines `InlineFeedback`-Primitive und lokale Recovery pro Karte/Aktion statt einer globalen Toast- oder Route-Fehlerschicht.
- **Why:** Die haeufigsten Alltagsfehler betreffen einzelne Queries oder Mutations: Readiness/Load auf Home, Coach-Senden, Plan-Alternativen/-Generierung, Availability, Health-State und Garmin Backfill. Lokale Hinweise erhalten den restlichen Tagesfluss, bewahren Entwuerfe/Edits und geben direkt am betroffenen Kontext eine Retry-Aktion.
- **Alternatives:** Route-weite Fehleransicht beibehalten (zu fragil im Alltag); globale Toasts einfuehren (wichtige Recovery verschwindet ausserhalb des Kontextes); jede Karte mit eigenem Styling loesen (inkonsistent und mehr Wartung).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Daily Loop nutzt URL-State und lokale Today-Adjust-Schliessung

- **Decision:** Pulse macht Data-/Plan-Tabs und Settings-Sektionen per Query-Parameter adressierbar, haelt den Daily-Coach-Kontext auch bei bestehender Chat-Historie sichtbar, priorisiert im Plan die naechste Trainingsentscheidung vor duplizierter Tagesentscheidung und speichert `Beibehalten` fuer Today-Adjust lokal per Proposal-Signatur.
- **Why:** Home, Coach und Plan sollen als ein zusammenhaengender Tagesloop funktionieren: Uebersicht, gefuehrte Reflexion, Trainingsentscheidung und Evidenzlinks muessen ohne erneutes Suchen erreichbar bleiben. Die lokale Proposal-Signatur verhindert, dass ein bewusst abgelehnter Tagesvorschlag nach Refetch/Reload sofort wieder auftaucht, solange sich der Vorschlag nicht materiell aendert.
- **Alternatives:** Tab-/Section-State nur im React-State belassen (Links verlieren Kontext); den Coach-Tageskontext nur im leeren Chat zeigen (Daily Guidance verschwindet im Alltag); Today-Adjust per DOM-Ausblenden schliessen (Refetch bringt den Vorschlag zurueck); sofort einen serverseitigen Dismiss-Endpunkt bauen (groesserer Backend-Vertrag fuer einen UI-Slice).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Mobile UI nutzt responsive Listen und 40px-Touch-Ziele

- **Decision:** Pulse ersetzt die Data-Domainabdeckung auf Mobile durch eine Karten-/Listenansicht und setzt wiederholte mobile Aktionen route-uebergreifend auf mindestens 40px Zielhoehe; Plan-Workout-Zeilen trennen Oeffnen und `Sportart aendern` semantisch in getrennte Buttons.
- **Why:** iPhone/PWA ist ein echter Nutzungspfad, und der UI/UX-Audit hatte sowohl horizontales Data-Overflow als auch kleine wiederholte Touch-Ziele bestaetigt. Deterministische Playwright-Checks sichern nun alle Haupt-Routen gegen unbeabsichtigten horizontalen Overflow und pruefen die wichtigsten mobilen Aktionsflaechen.
- **Alternatives:** Die Tabelle per `overflow-x` scrollbar lassen (bleibt im Alltag sperrig); nur `overflow: hidden` setzen (verdeckt Inhalte statt UX zu loesen); einen breiten mobilen Redesign-Slice starten (zu gross fuer den bestaetigten Fehler).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Dependency-Security-Refresh bleibt stabil statt Drizzle-Kit-RC

- **Decision:** Pulse aktualisiert zuerst sicherheitsrelevante und risikoarme stabile Dependencies; `drizzle-kit` bleibt auf dem stabilen `latest` statt auf `1.0.0-rc.1` zu springen, obwohl dadurch ein dev-only `esbuild`-Audit-Hinweis in der Full-Audit-Ansicht verbleibt.
- **Why:** `@fastify/jwt`/`fast-jwt` und `bullmq`/`uuid` betreffen Runtime-/Produktionsrisiko und wurden aktualisiert. Der verbleibende Hinweis liegt in `drizzle-kit` ueber `@esbuild-kit/core-utils` und betrifft eine Dev-Tooling-Abhaengigkeit; `npm audit --omit=dev` ist sauber. Ein RC-Wechsel bei DB-Migrationstooling waere riskanter als der moderate dev-only Hinweis.
- **Alternatives:** `npm audit fix --force` nutzen (schlaegt eine falsche/alte `drizzle-kit`-Richtung vor); npm-Override fuer den transitiven `esbuild`-Pfad erzwingen (macht den Installationsbaum invalid); `drizzle-kit@1.0.0-rc.1` einfuehren (groesserer DB-Tooling-Major/RC-Wechsel ohne akuten Runtime-Nutzen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — UI/UX-Reibungsschluss hat Prioritaet vor neuen Feature-Wellen

- **Decision:** Die naechste Pulse-Arbeitsrichtung priorisiert evidenzbasierten UI/UX-Reibungsschluss vor neuen Produktdomaenen wie Fueling/Recovery oder Native-iOS-Evaluation.
- **Why:** Tobi hat UI/UX als aktuell wichtiger priorisiert. Der 2026-05-02 Deep Audit bestaetigt, dass die App funktional breit ist, aber noch konkrete Alltagsreibungen hat: mobile Touch-/Overflow-Probleme, fragmentierte Home/Coach/Plan-Journeys, grobe Fehlerzustaende, zu tief versteckte Settings-Diagnostik und stale Canva/Figma-Evidenz.
- **Alternatives:** Direkt Fueling/Recovery bauen (fachlich interessant, aber praferenz-gated und nicht die aktuelle Prioritaet); Native iOS starten (nicht durch PWA-Feldevidenz begruendet); abgeschlossene UX-Wellen erneut bauen (explizit verboten).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-02 — Echter iPhone-Test bestaetigt PWA/VPN als aktuellen Pfad

- **Decision:** Pulse bleibt nach dem echten iPhone/VPN/PWA-Feldtest beim lokalen Web/PWA-Modell; es wird kein Native-iOS-Scope aus dieser Evidenz abgeleitet.
- **Why:** Tobi konnte Pulse auf dem iPhone ueber VPN erreichen, zum Home-Bildschirm hinzufuegen, aus dem Home-Screen-Icon starten und Home, Coach, Plan, Insights sowie Settings nutzen. Coach-Eingabe inklusive Antwort funktionierte; die einzige bestaetigte Reibung ist die lokale Zertifikatsvertrauenskette.
- **Alternatives:** Sofort Native iOS bauen (nicht durch Feld-Evidenz begruendet); public tunnel/cloud hosting einfuehren (widerspricht lokalem Servermodell); UI-Fixes ohne beobachtete iPhone-Friktion bauen (kein belegter Bedarf).
- **Decided by:** Tobi + Codex.
- **Status:** active.

---

## 2026-05-02 — Historisches Design-Handoff liegt unter docs/design

- **Decision:** Die historische Variante-B-Designreferenz liegt unter `docs/design/handoff/` statt als Root-Ordner.
- **Why:** Das Handoff ist keine aktive App- oder Build-Oberflaeche mehr, bleibt aber als visuelle Referenz wertvoll. Unter `docs/design/` ist es klar als Dokumentation eingeordnet und stoert die Repo-Root-Navigation nicht.
- **Alternatives:** Den Ordner im Root belassen (weiterer historischer Root-Eintrag); loeschen (zu hoher Wissensverlust fuer UI/UX-Vergleiche); in aktive Figma/Canva-Artefakte umwandeln (anderer Scope).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Pulse Ops nutzt die aktive LAN-/PM2-Topologie

- **Decision:** Pulse Ops zeigt auf `https://192.168.178.46:5175` und `/api/pulse/health`, `pm2.config.js` verwaltet `pulse` plus `pulse-frontend`, `scripts/deploy.sh` startet/laedt beide Prozesse aus der PM2-Config, und das Root-Package heisst `pulse`.
- **Why:** Die App laeuft im Alltag als lokale Web/PWA ueber Vite Preview auf Port 5175 mit Backend-Proxy, nicht mehr als reine Backend-/Nginx-443-Oberflaeche. Der alte Root-Name `coaching-os-v2` war nur noch historisch und fuehrte in Ops-Ausgaben und Tests zu falscher mentaler Zuordnung.
- **Alternatives:** Nur die Pulse-Ops-URL korrigieren (PM2-Drift bleibt); den alten Package-Namen behalten (weniger Lockfile-Churn, aber weiter falsches Projektlabel); `./pulse/*`-Exports oder Native-iOS-Ops einbauen (nicht Teil des aktuellen Struktur-/Ops-Slices).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Shared Pulse Types nutzen Domain-Dateien mit Kompatibilitaets-Barrel

- **Decision:** Pulse splittet `shared/types/pulse.ts` in `shared/types/pulse/{activity,daily-loop,garmin,mental,plan,profile,push,index}.ts` und behaelt `shared/types/pulse.ts` als Barrel fuer `@coaching-os/shared/pulse`.
- **Why:** Der bisherige Pulse-Typ-Monolith war ein Merge-Konflikt-Hotspot fuer Backend, Frontend und Planarbeit. Domain-Dateien reduzieren kuenftige Konflikte, waehrend bestehende Importe stabil bleiben und schrittweise migriert werden koennen.
- **Alternatives:** Alle Consumer sofort auf Domain-Subpfade umstellen (zu grosser PR und neues Package-Export-Risiko); `shared/package.json` sofort um `./pulse/*` erweitern (nicht noetig, solange Consumer den Kompatibilitaets-Barrel nutzen); Typen im Monolith belassen (Phase 6 wuerde den Struktur-Hotspot nicht adressieren).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Settings-Health-State-UI bildet ein eigenes Feature-Modul

- **Decision:** Pulse verschiebt Health-State-Formular, aktive Status, erledigte Statushistorie und Health-State-Aktionen nach `frontend/src/features/settings/health/health-components.tsx`.
- **Why:** Health-State setzt harte Trainingsgrenzen fuer Plan, Risk Watch und Coach-Kontext und ist fachlich keine Garmin- oder Push-Einstellung. Die Settings-Route bleibt dadurch nach Phase 5 eine Orchestrierung aus klaren Einstellungsgruppen statt ein Formular-Monolith.
- **Alternatives:** Health-State im Settings-Monolith lassen (Phase 5 bleibt offen); mit Coach-Praeferenzen zusammenlegen (vermischt Praeferenzen mit harten Trainingsconstraints); zuerst generische Settings-Primitive extrahieren (groesserer Shared-UI-Slice ohne direkte fachliche Grenze).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Settings-Coach-UI bildet ein eigenes Feature-Modul

- **Decision:** Pulse verschiebt Coach-Praeferenzen, Praeferenzformular, Wochentagsauswahl und Kommunikationsstil-Anzeige nach `frontend/src/features/settings/coach/coach-components.tsx`.
- **Why:** Coach-Praeferenzen steuern Plan- und Coach-Verhalten direkt und haben eigene Query-/Mutation-Hooks. Die Settings-Route bleibt dadurch auf Gruppenstruktur, Garmin-Verbindung und den noch offenen Health-State-Cluster fokussiert.
- **Alternatives:** Coach-Praeferenzen im Settings-Monolith lassen (Phase 5 bleibt unvollstaendig); Coach- und Health-State gemeinsam verschieben (groesserer PR mit getrennten Fachgrenzen); generische Settings-Primitive vorher extrahieren (zusaetzlicher Shared-UI-Slice ohne unmittelbaren Boundary-Abschluss).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Settings-Profil-UI bildet ein eigenes Feature-Modul

- **Decision:** Pulse verschiebt Athletenprofil, Profil-Edit-Form, Garmin-Profil-Sync und Profilwert-Provenienz nach `frontend/src/features/settings/profile/profile-components.tsx`.
- **Why:** Profilwerte sind Plan-/Coach-Kontext und haben eigene Mutationen sowie Garmin-Provenienzlogik. Der Settings-Route bleiben damit nur Gruppenstruktur, Garmin-Verbindungsstatus und die noch offenen Coach-/Health-Cluster.
- **Alternatives:** Profil im Settings-Monolith lassen (Phase 5 bleibt zu grob); Profil-Sync im Parent halten und nur die Anzeige verschieben (State/Mutation bliebe verteilt); generische Row/Pill-Helfer vorher extrahieren (groesserer Shared-UI-Slice ohne direkten Feature-Fortschritt).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Settings-Push-UI bildet ein eigenes Feature-Modul

- **Decision:** Pulse verschiebt Push-Benachrichtigungen, Push-Geräteliste, Browser-Permission-Flow und PWA-Readiness nach `frontend/src/features/settings/push/push-components.tsx`.
- **Why:** Push/PWA ist ein eigenstaendiger Settings-Cluster mit Browser-APIs, Server-Push-Settings und iPhone/VPN-Readiness. `Settings.tsx` bleibt dadurch naeher an der Gruppen-Orchestrierung, waehrend geraetebezogene Logik isoliert test- und reviewbar wird.
- **Alternatives:** Push und PWA in zwei Module trennen (mehr Imports fuer zusammenhaengende Geraete-UX); Push im Settings-Monolith lassen (Phase 5 blockiert); generische Settings-Primitive zuerst extrahieren (groesserer Vorab-Refactor ohne Nutzerwert).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Data-Recovery-UI bildet ein eigenes Feature-Modul

- **Decision:** Pulse verschiebt Schlaf-, Tagesmetrik-, Recovery-Depth-, Gewichts- und Body-Composition-UI nach `frontend/src/features/data/recovery/recovery-components.tsx`.
- **Why:** Diese Tabs teilen Garmin-Koerperdaten, Bereichsfilter, Sparkline-Visualisierung und den Garmin-Domain-Hinweis. `Data.tsx` ist danach eine kleine Route mit Tab-Orchestrierung und die fachlichen Data-Cluster Coverage, Mental und Recovery liegen getrennt.
- **Alternatives:** Schlaf, Metriken und Gewicht in drei separaten PRs verschieben (kleiner, aber mehr Zwischenzustand und Import-Reibung); Recovery-Depth bei Metriken lassen und Gewicht separat behandeln (Plan-Phase bleibt unscharf); globale Components verwenden (zu domain-spezifisch).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Data-Mental-UI bildet ein eigenes Feature-Modul

- **Decision:** Pulse verschiebt gefuehrten Daily Check-in, Mental-Tags, `ThemeTimeline`-Einbettung und Mental-Trend-Chart nach `frontend/src/features/data/mental/mental-components.tsx`.
- **Why:** Mental Fitness ist fachlich ein eigener Data-Cluster mit Check-in-Mutationen, Guidance-Fragen und Verlaufsvisualisierung. `Data.tsx` bleibt dadurch staerker Route-/Tab-Orchestrierung und die naechsten Recovery-/Settings-Splits koennen kleiner bleiben.
- **Alternatives:** Mental im Page-Monolith lassen (Phase 5 bleibt nur teilweise erledigt); `ThemeTimeline` separat in `components/` orchestrieren (zerreisst den Mental-Flow); Check-in-Form und Trend getrennt verschieben (kleiner, aber mehr Import-/State-Reibung).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Coverage-Report-Ignore ist root-geankert

- **Decision:** Pulse ignoriert Coverage-Report-Artefakte nur noch ueber `/coverage/` statt jedes Verzeichnis namens `coverage/`.
- **Why:** Phase 5 legt echten Feature-Code unter `frontend/src/features/data/coverage/` ab. Das bisherige globale Pattern wuerde diesen Code unbeabsichtigt ignorieren, waehrend Root-Coverage-Reports weiterhin aus Git bleiben.
- **Alternatives:** Feature-Ordner anders nennen (weicht vom Plan und der fachlichen Sprache ab); Datei mit `git add -f` erzwingen (versteckt das strukturelle Ignore-Problem); Coverage-Reports nicht mehr ignorieren (falsch).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Data-Coverage-UI bildet ein eigenes Feature-Modul

- **Decision:** Pulse verschiebt Data-Coverage, Garmin-Domainqualitaet, Signal-Usefulness, Backfill-UI und den Garmin-Domain-Hinweis nach `frontend/src/features/data/coverage/coverage-components.tsx`.
- **Why:** Diese UI teilt Garmin-Abdeckungsdaten, Backfill-Memory, Diagnose-Logik und Datenqualitaets-Hinweise ueber mehrere Data-Tabs. `Data.tsx` behaelt Tab-Orchestrierung sowie Schlaf-, Metrik-, Gewicht- und Mental-Bereiche, waehrend Coverage/Backfill als eigener fachlicher Cluster reviewbar wird.
- **Alternatives:** Coverage im Data-Monolith lassen (Phase 5 startet nicht); nur `CoverageTab` verschieben und `GarminDomainHint` behalten (Qualitaetslogik bliebe verteilt); globale Components verwenden (zu daten-/Garmin-spezifisch).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Plan-Ziel-UI wird als Goals-Feature isoliert

- **Decision:** Pulse verschiebt Goal-Formular, Goal-Edit-Form, Goal-Card und Goal-spezifische Payload-/Race-Helfer nach `frontend/src/features/plan/goals/goal-components.tsx`.
- **Why:** Zielanlage, Race-Metadaten, Statuswechsel und Loeschen teilen eigene Mutationen und UI-Zustaende, waehrend `ZieleTab` nur noch den Tab-Zustand und die Goal-Liste orchestriert. Damit verliert `Plan.tsx` den groessten verbleibenden formularlastigen Subblock, ohne Goal-API oder sichtbares Verhalten zu aendern.
- **Alternatives:** Goal-Logik im Page-Monolith lassen (Phase 4 bleibt unvollstaendig); nur Cards verschieben und Forms behalten (Mutation-/Payload-Logik bleibt verteilt); Goals in globale Components legen (zu domain-spezifisch).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Plan-Strategie-UI bekommt eine eigene Feature-Grenze

- **Decision:** Pulse verschiebt Plan Trace, Race Command, Season Strategy und ihre kleinen Fact-/Insight-Helfer aus `frontend/src/pages/Plan.tsx` nach `frontend/src/features/plan/strategy/strategy-components.tsx`.
- **Why:** Diese Karten erklaeren Trainingsstrategie, Ziel-/Race-Kontext und Plan-Evidenz und bilden eine fachliche UI-Grenze neben Training und Goals. `Plan.tsx` bleibt fuer Route-State, Daten-Fetching, Mutationen und Tab-Orchestrierung verantwortlich.
- **Alternatives:** Strategie-Karten im Page-Monolith lassen (Phase 4 reduziert den groessten UI-Hotspot kaum); Karten in globale Components verschieben (zu domain-spezifisch); direkt Goals und Strategy in einem PR verschieben (groesserer Review- und Merge-Risiko-Slice).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Playwright folgt optionalem lokalen HTTPS

- **Decision:** Pulse bestimmt die lokale Playwright-Default-URL aus dem Vorhandensein der ungetrackten Vite-Zertifikate: mit Certs `https://127.0.0.1:5173`, ohne Certs `http://127.0.0.1:5173`. `PLAYWRIGHT_BASE_URL` bleibt der explizite Override.
- **Why:** Seit lokale TLS-Dateien nicht mehr in Git liegen, startet Vite in CI ohne Certs per HTTP. Ein fester HTTPS-Default laesst Browser-Smoke-Tests auf den falschen Webserver-Healthcheck warten und erzeugt CI-Timeouts, obwohl Build und Backend-Tests gruen sind.
- **Alternatives:** Zertifikate wieder in CI/Git bereitstellen (Secrets-/Runtime-State-Verstoss); Playwright immer auf HTTP setzen (schwaecht lokale LAN-HTTPS-Pruefung); CI-YAML separat mit Override pflegen (zusaetzliche Drift zur Vite-Config).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Plan-Training-UI bekommt eigene Feature-Komponenten

- **Decision:** Pulse verschiebt Week Strip, Workout Row, Execution Badge und Trainingslabels aus `frontend/src/pages/Plan.tsx` nach `frontend/src/features/plan/training/training-components.tsx`.
- **Why:** `Plan.tsx` bleibt Route-Orchestrierung und kann Training-Daten, Modals und Tab-Zustand weiter zusammenhalten, waehrend die wiederverwendbare Trainingslisten-UI fachlich in der Plan-Feature-Grenze lebt. Der Slice aendert keine API-Vertraege, Mutation-Flows oder sichtbares Verhalten.
- **Alternatives:** Training-UI im Page-Monolith lassen (Phase 4 bleibt halb erledigt); direkt Strategie- und Goal-Karten mitverschieben (zu grosser PR); Komponenten in `components/` ablegen (zu domain-spezifisch fuer die globale UI-Schicht).
- **Decided by:** Codex.
- **Status:** active.

## 2026-05-02 — Plan-Seite trennt reine Plan-Utilities von UI

- **Decision:** Pulse verschiebt reine Datums-, Plan-Alternativen- und Execution-Status-Helfer aus `frontend/src/pages/Plan.tsx` nach `frontend/src/features/plan/plan-utils.ts`.
- **Why:** `Plan.tsx` bleibt als Route weiterhin funktionsgleich, aber die erste Frontend-Plan-Split-Grenze reduziert Seitengröße und macht spätere Training-, Strategie- und Goal-Komponenten-Extraktionen risikoärmer. Der Slice bewegt nur pure Helpers, keine UI-Komponenten oder API-Verträge.
- **Alternatives:** Sofort alle Plan-Komponenten verschieben (zu großer PR); Utilities im Page-Monolith lassen (Phase 4 startet nicht sauber); Helper nach `pulse/` legen (fachlich Feature-spezifisch statt API-Client-Logik).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Garmin-Tages-Sync lebt in der Pulse-Service-Boundary

- **Decision:** Pulse verschiebt `syncGarminDay` nach `backend/src/pulse/services/garmin-sync-day.ts` und das Activity-Workout-Matching inklusive Feedback-Erzeugung nach `backend/src/pulse/services/workout-execution-sync.ts`. Die Legacy-Route `/api/garmin` bleibt kompatibel und re-exportiert den Tages-Sync vorerst.
- **Why:** Tagesimport, Backfill, Queue-Worker und manuelle Pulse-Syncs nutzen dieselbe Garmin-Orchestrierung. Ein Pulse-Service verhindert, dass Jobs und Skripte weiterhin von einer Fastify-Route als Service-Container abhaengen, und trennt Activity-Ausfuehrungslogik von Garmin-Transport.
- **Alternatives:** `syncGarminDay` in `backend/src/routes/garmin.ts` belassen (Route bleibt Service-Monolith); nur Imports umbiegen ohne Matching zu extrahieren (weiterhin vermischte Verantwortlichkeiten); Legacy-Route sofort entfernen (bricht `/api/garmin/*`-Kompatibilitaet).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Pulse-Plugin ist eine duenne Routen-Huelle

- **Decision:** Pulse verschiebt `/insights` und `/correlations` nach `backend/src/pulse/routes/insight-routes.ts`; `backend/src/pulse/plugin.ts` behaelt nur den JSON-Parser und die Registrierung der Pulse-Routenmodule.
- **Why:** Insights und Korrelationen teilen die Analyse-/Metric-Boundary, nicht Health-, Activity-, Garmin- oder Training-Sync. Ein duennes Plugin reduziert Merge-Konflikte, macht neue Routen reviewbarer und beendet Phase 2 der Backend-Route-Extraktion ohne Endpoint-Verhalten zu aendern.
- **Alternatives:** Insight-Routen im Plugin lassen (Restmonolith bleibt bestehen); Korrelationen in Health verschieben (vermischt Rohmetriken mit Analyse-UI); Insight und Garmin-Signalbewertung zusammenlegen (falsche fachliche Grenze).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Activity-Detail bleibt eine Activity-Boundary

- **Decision:** Pulse verschiebt `/sleep`, `/activities`, `/activities/:id` und `/activities/:id/feedback` nach `backend/src/pulse/routes/activity-routes.ts`.
- **Why:** Activity-Detail laedt zwar Garmin-Laps und HR-Zonen nach, ist aber fachlich eine Aktivitaetsansicht mit Equipment-Zuordnung, Analytics und RPE-Feedback. Der Router trennt Activity-Read/Feedback sauber von Garmin-Sync, Training-Planung und Push.
- **Alternatives:** Activity-Detail in den Garmin-Router legen (vermengt Geraete-Sync mit Activity-UI); im Plugin lassen (verhindert thin plugin); zusammen mit Insights extrahieren (unnoetig grosser Slice).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Web Push bekommt eine eigene Routen-Boundary

- **Decision:** Pulse verschiebt `/push/settings`, `/push/subscribe`, `/push/topics`, `/push/quiet-hours` und `/push/test` nach `backend/src/pulse/routes/push-routes.ts`.
- **Why:** Push-Settings, Subscription-Upsert/Delete, Topic-Preferences, Quiet Hours und VAPID-Test teilen Push-Konfiguration und Subscription-State, aber keine Activity-, Insight- oder Garmin-Logik. Ein eigener Router reduziert `plugin.ts` weiter und macht die spaetere Push-/PWA-Iteration reviewbarer.
- **Alternatives:** Push im Plugin lassen (Restmonolith bleibt groesser); Push mit Garmin/Sync mischen (falsche Betriebsgrenze); Push direkt mit Activity/Insights zusammen extrahieren (zu grosser naechster Slice).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Garmin- und Daten-Sync-Routen bilden eine Sync-Boundary

- **Decision:** Pulse verschiebt `/sync/status`, `/data-coverage`, `/garmin/coverage`, `/garmin/signal-usefulness`, `/garmin/backfill`, `/garmin/calendar/sync`, `/garmin/sync-profile` und `/garmin/sync` nach `backend/src/pulse/routes/garmin-routes.ts`.
- **Why:** Diese Endpunkte teilen Garmin-/Datenabdeckungsstatus, Backfill-Logik, Kalender-Sync und Profil-Sync. Ein gemeinsamer Sync-Router entfernt die UTC-Date- und Coverage-Helfer aus dem Plugin-Monolithen, ohne Activity-Detail oder Plan-Workout-Sync fachlich zu vermischen.
- **Alternatives:** Nur `/garmin/*` verschieben (laesst `/data-coverage` und `/sync/status` als Rest-Sync-Logik im Plugin); Activity-Detail ebenfalls verschieben (besser spaeter als Activity-Boundary); Plan-Workout-Garmin-Sync aus `training-routes.ts` herausloesen (groesserer Training/Garmin-Cross-Slice).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Training Analytics schliesst die Training-Boundary

- **Decision:** Pulse verschiebt `GET /api/pulse/training-analytics` nach `backend/src/pulse/routes/training-routes.ts` und schliesst damit den Training-Routen-Slice aus Plan, Workout, Strength, Equipment, Goals, Race, Season, Review, Nutrition und Analytics ab.
- **Why:** Training Analytics bewertet TSS, Zonen, VO2max und RPE gegen geplante Workouts und Athletenprofil. Diese Daten gehoeren fachlich zur Training-Boundary; der getrennte PR reduziert den Restmonolithen, ohne Garmin- oder Push-Routen mitzuziehen.
- **Alternatives:** Analytics im Plugin lassen (Training-Boundary bleibt unvollstaendig); separaten Analytics-Router anlegen (zusaetzliche Grenze fuer einen Training-spezifischen Endpoint); Garmin/Push direkt mitverschieben (zu grosser Slice).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Review- und Nutrition-Routen folgen der Training-Boundary

- **Decision:** Pulse verschiebt `/nutrition`, `/nutrition/:id`, `/review/latest` und `/review/generate` nach `backend/src/pulse/routes/training-routes.ts`.
- **Why:** Nutrition-Logs und Weekly Review bewerten bzw. ergaenzen Trainingseinheiten und gehoeren damit zur Training-Boundary, waehrend Push, Garmin und allgemeine Insights noch eigene Slices bleiben. Der kleine Move reduziert `plugin.ts`, ohne die komplexere Training-Analytics-Auswertung in denselben PR zu ziehen.
- **Alternatives:** Nutrition und Review im Plugin lassen (Training-Boundary bleibt unvollstaendig); Training Analytics direkt mitverschieben (groesserer Query-/Helper-Slice); separaten Nutrition-Router anlegen (mehr Modulgrenzen als aktuell noetig).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Strategy-Routen bleiben Teil der Training-Boundary

- **Decision:** Pulse verschiebt Goals, Race-Liste, Race Command und Season Strategy nach `backend/src/pulse/routes/training-routes.ts`.
- **Why:** Ziele, Rennen und Season Strategy steuern die Trainingsplanung direkt und teilen Fitness-Load-, Risk-, Availability- und Coach-Preference-Kontext mit den Plan-Routen. Als eigener Slice reduziert die Verschiebung den Plugin-Monolithen, ohne Nutrition, Review oder Analytics in denselben PR zu ziehen.
- **Alternatives:** Strategy-Routen im Plugin lassen (Training-Boundary bleibt fachlich unvollstaendig); Nutrition/Review/Analytics direkt mitverschieben (zu grosser, schwerer reviewbarer Slice); eigene `strategy-routes.ts` anlegen (zusaetzliche Modulgrenze ohne aktuellen Nutzen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Plan-/Workout-Routen gehoeren zum Training-Router

- **Decision:** Pulse verschiebt `/plan`, `/plan/workout/:id`, Workout-Detail-/Garmin-Sync, Plan-Generierung, Plan-Trace, Today-Adjustment und Week-Availability nach `backend/src/pulse/routes/training-routes.ts`; der Garmin-Kalender-Leser liegt als gemeinsam nutzbarer Service in `backend/src/pulse/services/garmin-calendar-workouts.ts`.
- **Why:** Diese Endpunkte bilden den Kern des Trainingsplans und verursachen den groessten Restblock in `plugin.ts`. Der gemeinsame Garmin-Kalender-Service verhindert, dass `plan/generate` und `/garmin/calendar/sync` denselben Calendar-Month-Code duplizieren.
- **Alternatives:** Nur die kleinen Workout-Routen verschieben (laesst die Plan-Generation als groessten Monolithen zurueck); `/garmin/calendar/sync` mitverschieben (vermischt Garmin-Boundary mit Training-Boundary); Kalender-Helfer duplizieren (Garmin-Cleanup-Drift).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Plan-Routen-Helfer ziehen vor dem Route-Move in einen Service

- **Decision:** Pulse verschiebt Plan-Route-Helfer fuer Planned-Zone-Lookup, Race-Priority-Normalisierung, ISO-Wochenlogik, Execution-Review-Anpassung, Plan-Trace-Mapping und Plan-Decision-Reconciliation nach `backend/src/pulse/services/plan-route-helpers.ts`.
- **Why:** Die verbleibenden Plan-/Workout-Routen sind der groesste Backend-Block. Vor dem eigentlichen Route-Move muessen die wiederverwendeten Helfer aus `plugin.ts`, damit der naechste PR weniger Seiteneffekte und weniger Import-Churn hat.
- **Alternatives:** Alle Helper direkt in `training-routes.ts` verschieben (zu grosser naechster PR); Helper duplizieren (Trace-/Decision-Drift); Route-Move ohne Vorbereitung (schwerer zu reviewen).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Workout-Step-Generierung ist ein Training-Service

- **Decision:** Pulse verschiebt Workout-Step-Generierung, HR-Zielbereiche und deterministische Fallback-Steps aus `backend/src/pulse/plugin.ts` nach `backend/src/pulse/services/workout-steps.ts`.
- **Why:** Plan- und Garmin-Workout-Routen brauchen dieselbe Step-Logik, inklusive LLM-Aufruf ueber `backend/src/lib/llm.ts`. Ein eigener Service reduziert den Router-Monolithen und verhindert, dass die spaetere Plan-Routen-Extraktion einen grossen Helferblock mitzieht.
- **Alternatives:** Helper route-local in `plugin.ts` lassen (weiterer Hotspot); in `training-routes.ts` duplizieren (LLM-/Fallback-Drift); LLM-Aufruf direkt in Routen verschieben (verletzt die bestehende zentrale LLM-Schicht).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Training-Routen werden in Sub-Slices extrahiert

- **Decision:** Pulse extrahiert den Training-Bereich gestaffelt: zuerst Activity-Equipment-Zuordnung, Strength Sessions und Equipment-Verwaltung nach `backend/src/pulse/routes/training-routes.ts`; Plan-/Workout-/Goal-/Race-/Season-/Review-/Nutrition-/Analytics-Endpunkte folgen in separaten PRs.
- **Why:** Der komplette Training-Block enthaelt Plan-Generierung, Garmin-Sync, Race/Season-Strategie, Nutrition und Analytics mit vielen geteilten Helfern. Ein einzelner PR waere schwer zu reviewen und regressionsanfaellig; der Strength/Equipment-Slice ist fachlich geschlossen und hat klare Service-Grenzen.
- **Alternatives:** Alles auf einmal verschieben (zu gross und konflikttraechtig); nur neue Datei anlegen ohne Routen zu bewegen (kein echter Boundary-Gewinn); Strength/Equipment in eigene Route statt `training-routes.ts` legen (mehr Module als aktuell noetig).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Check-in- und Mental-Routen bilden einen Tagesreflexions-Slice

- **Decision:** Pulse extrahiert `/checkin`, `/checkin/voice`, `/checkin/today`, `/checkin/guidance`, `/checkin/history`, `/mental/themes` und `/mental/load-overlay` nach `backend/src/pulse/routes/checkin-routes.ts`.
- **Why:** Gefuehrter Check-in, Voice-Check-in und Mental-Overlays gehoeren fachlich zum gleichen Tagesreflexions-Flow. Die Extraktion entlastet `plugin.ts`, haelt die bestehenden URL- und Response-Vertraege stabil und laesst `pulseMentalCheckins` im Plugin nur dort, wo Insights es weiter braucht.
- **Alternatives:** Mental-Endpoints separat splitten (zu kleiner Slice mit denselben Tabellen); Voice-Check-in beim Coach-Slice belassen (vermengt Chat und Check-in-Persistenz); Helper duplizieren (LLM-/PulseContext-Logik driftet).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Coach-Routen teilen Chat und Preference-Helfer

- **Decision:** Pulse extrahiert `/coach`, `/coach/history` und `/coach/preferences` nach `backend/src/pulse/routes/coach-routes.ts`; gemeinsam genutzte `normalizeCoachMessages`- und `serializeCoachPreferences`-Logik liegt in `backend/src/pulse/services/coach.ts`.
- **Why:** Coach-Endpunkte sind ein klarer Boundary-Slice, aber Voice-Check-in und Plan-/Race-/Season-Kontexte brauchen dieselben Message- und Preference-Helfer weiter. Ein kleiner Service reduziert Duplikate, ohne Endpoint-Pfade, Speicherformat oder Coach-Kontext zu veraendern.
- **Alternatives:** Helper direkt in `coach-routes.ts` kopieren (bricht andere Nutzer der Logik); Coach-Preferences im Monolithen lassen (Boundary bleibt unvollstaendig); alles in einem grossen Backend-PR extrahieren (zu konfliktanfaellig).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Daily-Loop-Routen teilen Route und Service-Logik

- **Decision:** Pulse extrahiert `/home`, `/actions`, `/outcomes/daily`, `/decisions/quality`, `/risk` inklusive Snooze/Resolve und `/briefing` nach `backend/src/pulse/routes/daily-loop-routes.ts`; gemeinsam genutzte Action-/Decision-Quality-/Status-Helfer liegen in `backend/src/pulse/services/daily-loop.ts`.
- **Why:** Daily-Loop-Endpunkte sind der zentrale Alltagsfluss und verursachen im Router besonders viel Kontextladung. Ein separater Routen-Slice reduziert Merge-Konflikte, waehrend Coach weiter dieselbe `loadDailyDecisionQuality`-Logik nutzt.
- **Alternatives:** Routenlogik direkt aus `plugin.ts` importieren (Zyklusrisiko); Decision-Quality fuer Coach duplizieren (Inkonsistenzrisiko); Risk-Snooze/Resolve im Monolithen lassen (geteilte Risk-Grenze waere wieder verstreut).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Health-Routen sind der erste Backend-Boundary-Slice

- **Decision:** Pulse extrahiert `/health`, `/readiness`, `/load`, `/health-state`, `/metrics`, `/weight` und `/profile` zuerst nach `backend/src/pulse/routes/health-routes.ts`; `backend/src/pulse/plugin.ts` registriert dieses Modul vor den restlichen bestehenden Routen.
- **Why:** Diese Endpoints haben klare Auth- und Datenzugriffsgrenzen, sind stark im Alltag sichtbar und entlasten den Router-Monolithen ohne neue Persistenz, URL-Aenderungen oder UI-Verhalten.
- **Alternatives:** Den kompletten Backend-Router in einem PR splitten (zu konflikt- und regressionsanfaellig); zuerst Training/Garmin extrahieren (mehr Seiteneffekte); nur Hilfsfunktionen verschieben (reduziert den eigentlichen Merge-Hotspot kaum).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Deploy-Script provisioniert lokale Frontend-Zertifikate

- **Decision:** `scripts/deploy.sh` sichert vor dem Fast-Forward-Pull nur server-lokales Root-CA-Material und stellt nach dem Pull fehlende `frontend/certs`-Leaf-Zertifikate mit `openssl` wieder her. Getrackte Leaf-Keys werden nicht wiederhergestellt; lokale Zertifikate bleiben Runtime-State ausserhalb von Git.
- **Why:** Der naechste Cleanup entfernt versehentlich getrackte TLS-Dateien. Ohne Deploy-Guard wuerde der erste Deploy nach diesem Merge den Vite-Frontend-Prozess ohne HTTPS-Zertifikat neu starten und `https://192.168.178.46:5175` brechen.
- **Alternatives:** Zertifikate weiter tracken (Secrets-Verstoss); PR #119 manuell mit Sonder-Deploy ausrollen (nicht wiederholbar); Vite still auf HTTP fallen lassen (bricht iPhone/PWA-Erwartung).
- **Decided by:** Codex.
- **Status:** active.

---

## 2026-05-02 — Struktur-Refactors werden in Boundary-Slices umgesetzt

- **Decision:** Pulse behandelt die Repo-Aufraeumung als gestaffelten Boundary-Refactor: zuerst `backend/src/pulse/plugin.ts` in route modules extrahieren, danach grosse Frontend-Pages in `frontend/src/features/*` zerlegen, danach `shared/types/pulse.ts` mit Kompatibilitaets-Barrel splitten. Lokale TLS-Zertifikate und private Keys bleiben ausserhalb von Git.
- **Why:** Die groessten Strukturkosten entstehen durch Monolith-Dateien, Secrets-Hygiene und Merge-Konflikte, nicht durch zu viele Ordner. Kleine, kompatible Slices erhalten Endpoint-, UI- und Shared-Type-Vertraege und lassen CI/E2E nach jedem Schritt als Sicherheitsnetz laufen.
- **Alternatives:** Alles in einer grossen Umstrukturierung verschieben (zu riskant); nur lokale Artefakte loeschen (hilft nicht gegen die echten Hotspots); Services jetzt in Subordner verschieben (viel Import-Churn, bevor der Router-Monolith geloest ist).
- **Decided by:** Codex.
- **Status:** active.

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
