# Pulse Redesign — Variante B (Performance Cockpit)

Dieser Ordner enthält **alles, was Claude Code braucht**, um das Variante-B-Design gegen die Pulse-Codebase umzusetzen.

## Inhalt

```
handoff-claude-code/
├── README.md            ← du bist hier
├── HANDOFF.md           ← Spec: Tokens, Komponenten-Map, Datentypen, Sprints, offene Fragen
├── preview.html         ← öffne im Browser, um alle Screens lebend zu sehen
└── mocks/
    ├── variant-b.jsx          Topbar, Sidebar, Home (Dashboard), Coach
    ├── variant-b-plan.jsx     Plan: WeekStrip, WorkoutTable, Goals, Mini-Review
    ├── variant-b-data.jsx     Data, Activity Detail, Weekly Review
    ├── variant-b-mobile.jsx   Mobile-Layout (390×844): Home, Coach, Data
    ├── data.jsx               Beispiel-State für alle Screens
    └── icons.jsx              Optional — Icon-Stubs
```

## Empfohlener Claude-Code-Prompt

```
Lies handoff-claude-code/HANDOFF.md für Designsystem, Tokens, Komponenten-Map
und Sprint-Reihenfolge.

Die JSX-Mocks unter handoff-claude-code/mocks/ sind die visuelle Wahrheit:
inline styles statt Tailwind, ABER alle Werte (Farben, Spacing, Typo) sind
1:1 das, was im Production-Code rauskommen soll.

Öffne handoff-claude-code/preview.html im Browser, um die Screens live zu sehen,
bevor du anfängst. Stelle dann die Fragen aus §8 von HANDOFF.md, BEVOR du Code
schreibst.

Dann: Sprint 1, Task 1 — CSS-Variablen + Theme-Switcher gegen die existierende
tailwind.config.ts und app/globals.css.
```

## Wichtige Hinweise zum Lesen der Mocks

- **Inline styles** sind nur für die Mock-Phase. Im echten Code → Tailwind-Classes oder CSS-Module mit den Tokens aus HANDOFF.md §3.
- **`window.B_THEME`** im variant-b.jsx ist die Single Source of Truth für Mock-Tokens. In Production → CSS Custom Properties (siehe HANDOFF.md §3).
- **Komponenten-Namen** mit `B`-Präfix sind Mock-Internals (BStatCard, BSpark, etc.). Das `B` darf in Production weg — die Ziel-Pfade stehen in HANDOFF.md §4.
- **Sample data** in `data.jsx` ist nur Anschauung. Echtes Datenmodell siehe HANDOFF.md §6 (TypeScript types).
- **React 18 + Babel-Standalone** im preview.html sind nur fürs Anschauen. Production läuft natürlich nativ in Next.js.

## Was NICHT in diesem Bundle ist

- `variant-a.jsx`, `variant-c.jsx` — explorierte Alternativen, verworfen
- Design Canvas, Tweaks Panel — Tooling, irrelevant für Production
- `index.html` / `app.jsx` aus dem Designprojekt — nur zur Exploration

Wenn etwas fehlt, frag im Designprojekt nach.
