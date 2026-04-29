# Pulse — Decision Log

> **Pflicht-Datei für AI-Tools (Claude Code + Codex):** Jede nicht-triviale
> Entscheidung — Architektur, Scope, Priorität, technische Wahl —
> bekommt einen Eintrag hier, **bevor** die Session endet. Wenn eine
> Entscheidung nur im Chat besprochen wird, ist sie nicht passiert.
>
> Format pro Eintrag:
> - **Decision:** was entschieden wurde (1 Zeile)
> - **Why:** der Grund (1–3 Sätze)
> - **Alternatives:** verworfene Optionen, kurz
> - **Decided by:** Tobi / Claude Code / Codex (+ PR/Chat-Link, falls vorhanden)
> - **Status:** `active` | `superseded by [link]` | `reversed [date]`
>
> **Newest first.** Append-only — bestehende Einträge nie editieren,
> stattdessen neuen Eintrag mit Status `superseded` oder `reversed`
> anlegen.

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
