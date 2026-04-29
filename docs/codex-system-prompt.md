# Codex System Prompt — Pulse

> **Update 2026-04-29:** Diese Datei war früher ein langer ~150-Zeilen-Prompt
> mit doppelter Roadmap und Hard Rules. Da Codex `AGENTS.md` automatisch beim
> Session-Start lädt und alle übrigen Regeln/Entscheidungen jetzt zuverlässig
> in den Repo-Files leben (`CLAUDE.md`, `docs/decisions.md`, Roadmap, Plan-Docs),
> reicht ein **dünner Pointer-Prompt**. Single Source of Truth bleibt das Repo.

---

## Pointer-Prompt für Codex (kopieren)

```
Repo: tobi12387/pulse. Du arbeitest parallel mit Claude Code.

Pflichtlektüre in dieser Reihenfolge — bevor du irgendetwas implementierst:

  1. AGENTS.md im Repo-Root
  2. CLAUDE.md im Repo-Root
  3. docs/decisions.md
  4. docs/superpowers/plans/2026-04-28-roadmap.md
  5. das konkrete Plan-Doc zu deiner Aufgabe in docs/superpowers/plans/

Pläne unter docs/superpowers/plans/completed/ sind bereits implementiert —
NICHTS aus diesem Ordner erneut bauen.

Branch-Namespace: codex/<topic>. Niemals direkt nach main pushen, immer
PR via gh pr create. Vor jeder Session: git fetch && git status (clean!),
dann git switch -c codex/<topic> origin/main.

Nach jeder nicht-trivialen Entscheidung (Architektur, Scope, Priorität)
einen Eintrag in docs/decisions.md anlegen, bevor die Session endet.

Aufgabe: <hier deine konkrete Aufgabe einfügen, z.B. "Implementiere Bündel A
laut docs/superpowers/plans/2026-04-29-bundle-a-context-unification.md">.
```

---

## Warum so kurz?

| | Langer gepasteter Prompt | Pointer-Prompt |
|---|---|---|
| Tokens / Session | ~2000 | ~80 |
| Auto-aktuell | nur wenn du re-pastest | ja, Codex liest aktuelle Files |
| Wartung | manuell synchron halten | keine |
| Schutz gegen Doc-Drift | keiner | CI-Check `.github/workflows/docs-sync.yml` |

Der lange Prompt war nur sinnvoll, wenn Codex die Repo-Files nicht zuverlässig
gelesen hat. Mit `AGENTS.md` (auto-load) + `decisions.md` (Pflicht-Entscheidungslog)
+ CI-Sync-Check ist das Repo selbst die Wahrheit, und der Prompt ist nur noch
ein Wegweiser.

## Wartung

- **Roadmap-Änderungen:** in `docs/superpowers/plans/2026-04-28-roadmap.md` → Codex sieht es beim nächsten Session-Start.
- **Hard-Rule-Änderungen:** in `AGENTS.md` und `CLAUDE.md`. Der CI-Check prüft, dass beide konsistent bleiben.
- **Entscheidungen:** in `docs/decisions.md` (newest first). Pflicht für jede AI-Session.
- **Diese Datei:** nur ändern, wenn sich der Pointer-Prompt selbst ändern soll. Inhaltliche Regeln gehören nicht hierher.
