# Codex System Prompt — Pulse

> **Update 2026-04-29:** Diese Datei war früher ein langer ~150-Zeilen-Prompt
> mit doppelter Roadmap und Hard Rules. Da Codex `AGENTS.md` automatisch beim
> Session-Start lädt und alle übrigen Regeln/Entscheidungen jetzt zuverlässig
> in den Repo-Files leben (`AGENTS.md`, `docs/decisions.md`, Roadmap, Plan-Docs),
> reicht ein **dünner Pointer-Prompt**. Single Source of Truth bleibt das Repo.

---

## Pointer-Prompt für Codex (kopieren)

```
Repo: tobi12387/pulse. Du arbeitest als Codex-Agent.

Pflichtlektüre in dieser Reihenfolge — bevor du irgendetwas implementierst:

  1. AGENTS.md im Repo-Root
  2. docs/ai/session-brief.md
  3. docs/ai/current-focus.md
  4. docs/ai/non-negotiables.md
  5. docs/ai/context-map.md
  6. das konkrete Plan-Doc zu deiner Aufgabe in docs/superpowers/plans/
  7. docs/decisions.md nur fuer aktuelle, strittige oder architektonische Historie

Pläne unter docs/superpowers/plans/completed/ sind bereits implementiert —
NICHTS aus diesem Ordner erneut bauen.

Branch-Namespace: codex/<topic>. Niemals direkt nach main pushen, immer
PR via gh pr create. Vor jeder Session: git fetch && git status (clean!),
dann git switch -c codex/<topic> origin/main.

Nach jeder nicht-trivialen Entscheidung (Architektur, Scope, Priorität)
einen Eintrag in docs/decisions.md anlegen, bevor die Session endet.

Aufgabe: <hier deine konkrete Aufgabe einfügen. Nutze docs/ai/context-map.md,
um das kleinste passende Plan- oder Source-Set zu finden>.
```

---

## Warum so kurz?

| | Langer gepasteter Prompt | Pointer-Prompt |
|---|---|---|
| Tokens / Session | ~2000 | ~120 |
| Auto-aktuell | nur wenn du re-pastest | ja, Codex liest aktuelle Files |
| Wartung | manuell synchron halten | keine |
| Schutz gegen Doc-Drift | keiner | CI-Check `.github/workflows/docs-sync.yml` |

Der lange Prompt war nur sinnvoll, wenn Codex die Repo-Files nicht zuverlässig
gelesen hat. Mit `AGENTS.md` (auto-load) + `decisions.md` (Pflicht-Entscheidungslog)
+ CI-Sync-Check ist das Repo selbst die Wahrheit, und der Prompt ist nur noch
ein Wegweiser.

## Wartung

- **Aktueller Arbeitsfokus:** in `docs/ai/current-focus.md`.
- **Roadmap-Änderungen:** in `docs/ai/current-focus.md` und dem dort genannten aktiven Roadmap-/Plan-Doc.
- **Hard-Rule-Änderungen:** in `AGENTS.md`. Der CI-Check prüft zentrale Marker in dieser Datei.
- **Entscheidungen:** in `docs/decisions.md` (newest first). Pflicht für jede AI-Session.
- **Diese Datei:** nur ändern, wenn sich der Pointer-Prompt selbst ändern soll. Inhaltliche Regeln gehören nicht hierher.
