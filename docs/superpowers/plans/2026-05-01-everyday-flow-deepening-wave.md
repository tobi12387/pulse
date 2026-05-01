# Everyday Flow Deepening Wave

> Stand: 2026-05-01. Neuer aktiver Plan nach UI/UX Usability Wave und Browser-Audit auf `https://192.168.178.46:5175`. Fokus: die täglichen Flows nicht nur verständlicher machen, sondern handlungsfähiger und lernender.

> Canva UX Board: editable working doc `Pulse Everyday Flow UX Board` at https://www.canva.com/d/TGL3ff3MAzXgLkE. Use it as the visual companion for route screenshots, flow notes and acceptance review, while this Markdown file remains the implementation source of truth.

> Figma/FigJam UX Toolchain Loop: claim/open at https://www.figma.com/board/pk4iHWfci7iv9ot5y76j6Z?utm_source=codex&utm_content=edit_in_figjam&oai_id=&request_id=bdcae154-00da-4adb-8a63-e66bbdf25a32. Use it as the design-system and interaction-flow surface for reusable components, states and before/after screen structure.

## Goal

1. Pulse soll morgens eine zusammenhängende Tagesführung liefern: Lage, nächste Entscheidung, Warum, Grenzen und nächster Schritt.
2. Trainingspläne sollen nicht nur angezeigt, sondern alltagstauglich angepasst werden: kürzer, leichter, verschieben, bewusst frei lassen.
3. Fehler-, Backfill- und Settings-Aktionen sollen weiter beobachtbarer werden, damit Tobi erkennt, was passiert ist und was noch offen bleibt.

## Architektur

- Kein neuer Produktbereich: kein Telegram, kein Habit-Tracker, kein Datenexport.
- LLM-Aufrufe bleiben ausschließlich über `backend/src/lib/llm.ts`.
- Coach, Home und Briefing bleiben auf PulseContext als kanonischer Kontextquelle.
- DB-Migrationen nur additive, falls eine Phase Persistenz wirklich braucht.
- Jede Phase wird als eigener `codex/<topic>` Branch mit PR, CI, Merge und Deploy umgesetzt.
- Browser Use bleibt für echte Server-QA; Playwright bleibt für versionierte Regressionen.
- Superpowers bleibt der Prozessrahmen: Pläne vor Umsetzung, TDD/Debugging bei Codeänderungen, Review vor Merge, Verification vor Completion.
- Canva ergänzt die technische Planung als visuelles UX-Board für Daily-Flow-Screens, Interaktionskritik und Review-Notizen. Canva ersetzt keine Repo-Dokumentation.
- Figma ergänzt Canva als Design-System-Arbeitsfläche: Komponenten, Varianten, Zustände, Layout-Referenzen und später Code-Connect-Mappings. Figma ersetzt weder Browser-QA noch das Repo als technische Source of Truth.

## Design Toolchain Operating Model

Each phase uses the same lightweight loop:

1. **Before implementation:** Update this plan with the exact phase goal and acceptance. Add the intended screen/flow to Canva when the change affects daily UX. Add repeated controls or new interaction states to Figma when they should become reusable design language.
2. **During implementation:** Use the matching Superpowers workflow for the task shape: `writing-plans` for multi-step phase plans, `systematic-debugging` for regressions, `test-driven-development` for feature/bug work, and `requesting-code-review` before merge.
3. **After implementation:** Run typecheck, migration guard, E2E/browser QA, update docs/decisions, merge via PR, deploy, and add the reviewed result back to Canva/Figma as the current UX reference.

The first Canva artifact for this wave is the `Pulse Everyday Flow UX Board`. It should collect the active route sequence Home -> Coach -> Plan -> Data/Insights -> Settings, plus one "open friction" lane for issues found during browser QA.

The first Figma/FigJam artifact is `Pulse UX Toolchain Loop`. It should become the visual map for how Pulse moves from Superpowers plans to Figma design-system decisions, browser QA findings, GitHub PRs and deployed UX.

## Tool Responsibilities

| Tool | Role | Not Responsible For |
|---|---|---|
| Superpowers | Planning, TDD/debugging discipline, review and verification gates | Visual design source of truth |
| Figma/FigJam | Reusable component language, variants, states, layout specs, interaction diagrams | Product logic, production truth, deployment |
| Canva | Lightweight stakeholder board, screenshots, flow notes, review summaries | Component specs or code-linked design system |
| Browser/E2E | Truth for implemented behavior and responsive usability | Long-lived design documentation |
| GitHub PRs | Versioned source, CI, review, merge history | Visual collaboration canvas |

## Browser-Audit Ausgangslage

- Home → Coach funktioniert und zeigt `HEUTE TUN`, `WARUM`, `FERTIG WENN`.
- Coach Quick Prompts starten gut, aber der Tagesdialog ist noch nicht als geführtes Briefing komponiert.
- Plan priorisiert die nächste Trainingsentscheidung, bietet aber noch keine echten semantischen Anpassungen wie "leichter", "kürzer" oder "verschieben".
- Insights zeigt inzwischen hilfreiche Fehler statt rohem `Internal Server Error`, die eigentliche Ursache bleibt aber noch zu grob klassifiziert.
- Data erklärt Coverage und Backfill, zeigt aber noch keinen Verlauf echter Backfill-Läufe.
- Settings erklärt Push/Health-State besser, ist aber weiterhin lang und könnte stärker nach sicheren Aktionsgruppen geführt werden.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/pages/Coach.tsx` | Tagesbriefing-Flow, Prompt-Gruppen, Übergang Home → Coach |
| Modify | `frontend/src/pages/Home.tsx` | Daily-Flow-Brücke und klare Tagesentscheidung |
| Modify | `frontend/src/pages/Plan.tsx` | Anpassungsoptionen für nächste Einheit, Alternativen, freie Tage |
| Modify | `backend/src/pulse/plugin.ts` | Falls nötig: stabile Contracts für Plan-Alternativen, Insight-Fehler, Backfill-Verlauf |
| Modify | `frontend/src/pages/Insights.tsx` | Fehlerklassifizierung und Retry-/Datenmangel-Zustände |
| Modify | `frontend/src/pages/Data.tsx` | Backfill-Verlauf und Ausführungsbeobachtung |
| Modify | `frontend/src/pages/Settings.tsx` | Aktionsgruppen und bessere Sicherheits-/Folgekommunikation |
| Modify | `frontend/e2e/fixtures/pulse-api.ts` | Fixtures für tägliche Flows, Alternativen, Backfill-Verlauf, Fehlerklassen |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Regressionen für echte Alltagsinteraktionen |
| Modify | `docs/ai/current-focus.md` | Aktive Phase und nächste Schritte |
| Modify | `docs/decisions.md` | Scope-/Prioritätsentscheidungen |

## Phases

### 1. Coach-Guided Daily Briefing

**Status:** completed, merged and deployed via PR #69 (`codex/phase1-coach-daily-briefing`, deploy commit `a34302c`).

- Coach bekommt eine geführte Tageskarte: Lage, heutige Grenze, nächste Entscheidung, empfohlene Frage.
- Home → Coach soll nicht nur navigieren, sondern den passenden Gesprächsstart sichtbar machen.
- Quick Prompts werden nach Zweck gruppiert: "Heute entscheiden", "Plan anpassen", "Warum?".
- Acceptance:
  - Nutzer erkennt im Coach ohne Chatverlauf den heutigen roten Faden.
  - Kein Prompt sendet automatisch eine LLM-Anfrage.
  - E2E deckt Home → Coach → Prompt-Auswahl ab.

### 1.5 Core UI Chrome Consistency

**Status:** in progress via `codex/design-system-pass`.

- Introduce shared low-level chrome components for repeated app controls: `PageHeader`, `SegmentedControl`, `RangeControl`, `MiniButton`, `IconBadge`.
- Replace local Data/Plan tab bars and range pickers where they are direct duplicates.
- Replace emoji metaphors in Insights and critical status labels with line icons that match the technical cockpit language.
- Keep scope narrow: no information architecture rewrite, no new data contracts, no visual rebrand.
- Acceptance:
  - Data, Plan, Insights and Settings use the same header/control language without losing existing functionality.
  - Insights domain recognition stays fast, but no longer relies on emoji.
  - Mobile controls wrap without text clipping or layout shifts.
  - Existing E2E route smokes remain green.

### 2. Plan Alternatives 2.0

- Nächste Trainingsentscheidung bekommt semantische Anpassungen: kürzer, leichter, verschieben, frei lassen.
- Bestehender `/plan/today/proposal`-Contract und `AdjustTodayCard` werden zuerst genutzt, bevor neue Backend-Persistenz entsteht.
- Plan-UI erklärt, wann freie Tage sinnvoll sind und welche Daten in die Anpassung einfließen.
- Acceptance:
  - Nutzer kann die nächste Einheit fachlich sinnvoll anpassen, ohne zu raten, was "wechseln" bedeutet.
  - Anpassungsoptionen sind testbar und kollidieren nicht mit Plan-Generierung.

### 3. Insights Reliability & Cause Classification

- Insights trennt Fehlerursachen sichtbar: Datenmangel, LLM/Provider, Timeout/Server, Cache.
- Backend liefert kontrollierte Fehlerpayloads, soweit der aktuelle Contract das zulässt.
- UI zeigt Retry nur dort, wo Retry sinnvoll ist; Datenmangel bekommt eine konkrete Datenanforderung.
- Acceptance:
  - Kein roher Provider-/Servertext erscheint in der UI.
  - E2E deckt mindestens zwei Fehlerklassen ab.

### 4. Data Backfill Observability

- Data zeigt letzten Backfill und Vorschau/echten Lauf klarer: Zeitraum, geplant, synchronisiert, Fehler, nächste Aktion.
- Falls Persistenz nicht nötig ist, bleibt der erste Schritt lokale Snapshot-/Response-basierte Beobachtung.
- Acceptance:
  - Nach Vorschau und nach echtem Backfill ist sichtbar, ob Daten verändert wurden.
  - Fehlerhafte Tage werden priorisiert und nicht nur als langer Textblock gezeigt.

### 5. Settings Action Grouping

- Settings wird in sichere Aktionsgruppen gegliedert: Verbindung, Datenpflege, Benachrichtigungen, Profil, Health-State.
- Gefährlichere oder externe Aktionen bekommen stärkere visuelle Distanz und kurze Konsequenzzeilen.
- Acceptance:
  - Push-, Kalender-, Backfill- und Health-State-Aktionen sind nicht mehr als gleichwertige Button-Liste wahrnehmbar.
  - Mobile Settings bleibt scanbar.

## Suggested Sequence

1. Finish Core UI Chrome Consistency because the branch already exists and reduces UI drift before deeper phases.
2. Plan Alternatives 2.0.
3. Insights Reliability & Cause Classification.
4. Data Backfill Observability.
5. Settings Action Grouping.

## Current External Checks

- GitHub open PRs: none as of 2026-05-01 after checking `gh pr list`.
- Canva: `Pulse Everyday Flow UX Board` created as the active UX companion artifact.
- Figma: `Pulse UX Toolchain Loop` FigJam claim URL created; open/claim it before using it as an editable team file.
- Server baseline: Phase 1 deployed and verified on `origin/main` commit `a34302c`.

## Open Questions

- Soll der Daily Briefing Flow langfristig eher im Coach starten oder auf Home als primärem Morgenbildschirm bleiben?
- Sollen Plan-Alternativen zunächst nur UI-seitig vorbereitete Aktionen sein oder direkt echte Backend-Persistenz auslösen?
- Soll ein echter Backfill-Lauf später persistent historisiert werden, falls lokale Snapshots nicht reichen?
