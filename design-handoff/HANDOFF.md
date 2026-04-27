# Pulse Redesign — Handoff für Claude Code

> **Kontext:** Pulse ist eine personal coaching app (Web/Mobile, Next.js + Supabase + LLM-Backend). Dieses Dokument fasst das aktuelle Designsystem, die explorierten Dark-Mode-Varianten und konkrete Implementierungs-Tasks zusammen, damit ein Engineering-Agent (Claude Code) das Redesign gegen die existierende Codebase umsetzen kann.

---

## 1 · Status quo

- **Repo:** Next.js App-Router + Tailwind + Supabase. Pulse-spezifische Komponenten unter `app/(app)/...` und `components/`.
- **Theming:** aktuell Light Mode + sehr leichter Dark Mode (low contrast, generic).
- **Design Tokens:** definiert in `tailwind.config.ts` und `app/globals.css` (CSS custom properties).
- **Datenmodell:** Readiness, HRV/RHR, Schlaf, Workouts, Goals, Mental Check-ins, Activities (Garmin sync).

Die Dark-Mode-Erweiterung soll **additiv** sein: bestehende Light-Komponenten unangetastet, neuer Dark-Layer über CSS-Variablen + `data-theme="dark-cockpit"`.

---

## 2 · Design Direction (gewählt)

**Variante B · Performance Cockpit** — datendichte, technische Ästhetik mit Mono-Typo. Inspiration: Bloomberg Terminal, Strava Pro, Whoop Stats.

**Begründung:** Pulse-User sind ambitionierte Hobby- bis Semi-Pro-Athleten. Sie wollen Daten lesen können, nicht "wegmoderiert" bekommen. Editorial Calm war zu zurückhaltend für die Datenmenge; Mindful Pulse zu emotional für die Coaching-Genauigkeit, die wir kommunizieren wollen.

### Design-Prinzipien

1. **Daten sind der Held** — KPIs in Mono-Schrift, Sparklines per Default, Deltas immer mit Vorzeichen.
2. **Hierarchie via Dichte, nicht via Farbe** — wir benutzen **eine** Akzentfarbe (Cyan) für den primären Datenpunkt eines Screens. Alles andere ist Graustufe + semantische Farben (rot/grün/amber für Δ-Anzeigen).
3. **Keyboard-first auf Desktop** — Sidebar mit Hotkeys (1–4, ⌘,), Tabellen-Layouts, scannable rows.
4. **Mobile bleibt Mobile** — keine Mini-Desktop-Squashes; eigenes Layout, aber gleiche Tokens.

---

## 3 · Design Tokens

### Farbsystem (Dark Cockpit)

```css
:root[data-theme="dark-cockpit"] {
  /* Surface */
  --bg:        #0A0B0D;   /* canvas */
  --surface:   #12141A;   /* cards, sidebar */
  --surface-2: #1A1D26;   /* active/hover, table headers */
  --border:    #1F232A;   /* hairlines */

  /* Text */
  --text:      #E8ECF1;   /* primary */
  --text-2:    #8B95A3;   /* secondary, labels */
  --text-3:    #5C636E;   /* tertiary, captions */

  /* Accent (single primary) */
  --accent:    #5EE6CF;   /* cyan — primary data point */

  /* Semantic */
  --green:     #4ADE80;   /* positive Δ, "go", optimal */
  --amber:     #FBBF24;   /* caution, pending */
  --rose:      #F87171;   /* negative Δ, max HR, threshold */
  --blue:      #60A5FA;   /* secondary chart line */
}
```

### Typografie

| Token | Family | Use |
|---|---|---|
| `font-sans` | **Geist** (fallback Inter) | UI-copy, body text |
| `font-mono` | **JetBrains Mono** | KPI-Werte, Labels, Tabellenspalten, Hotkeys, Timestamps |

**Skala:**
- Display KPI: 28px mono, 500
- H1 / Page title: 18–22px sans, 500
- Body: 13px sans
- Label / mono caption: 10–11px mono, letter-spacing `.14em`, uppercase
- Tabelle: 11px mono

**Regel:** Jede Zahl ist Mono. Jedes Wort ist Sans. Keine Ausnahmen.

### Spacing & Radii

- Card padding: `14px 16px`
- Card gap: `12px`
- Card radius: **6px** (keine großen Radien — wir wollen technisch wirken, nicht freundlich)
- Border: immer `1px solid var(--border)` (Hairlines, keine Schatten)

### Iconografie

Minimal. Wenn überhaupt, dann 1.5px stroke, 16px viewport, monoline. Wir verzichten weitgehend auf Icons in Tabellen — Mono-Labels reichen.

---

## 4 · Komponenten-Map

Die folgenden Komponenten existieren als JSX-Mocks im Design-Projekt. Pfade hier sind **Vorschläge** für die Zielcodebase.

| Mock-Komponente | Ziel-Pfad | Notes |
|---|---|---|
| `BTopbar` | `components/cockpit/Topbar.tsx` | Logo, Sync-Status, Date, User. Sticky. |
| `BSide` | `components/cockpit/Sidebar.tsx` | Nav (Dashboard / Coach / Data / Plan / Settings). Hotkeys. |
| `BStatCard` | `components/cockpit/StatCard.tsx` | `{ label, value, unit, sub, delta, deltaColor, spark, sparkColor, accent }` |
| `BSpark` | `components/cockpit/Sparkline.tsx` | SVG polyline, optional fill. |
| `BWeekStrip` | `components/plan/WeekStrip.tsx` | 7-Tage-Kalenderstreifen mit Zone-Bar. |
| `BWorkoutTable` | `components/plan/WorkoutTable.tsx` | Geplante Workouts, Status-Pill. |
| `BGoalsPanel` | `components/plan/GoalsPanel.tsx` | Goal mit Progress-Bar, Status-Dot. |
| `BActivityChart` | `components/activity/HrPowerChart.tsx` | HR + Power Overlay, Interval-Shading. |
| `BSplitsTable` | `components/activity/SplitsTable.tsx` | Splits mit Inline-Bar pro Pace. |
| `BZoneDistribution` | `components/activity/ZoneDistribution.tsx` | HR-Zonen Stack-Bar. |
| `BSleepBars` | `components/data/SleepStagesChart.tsx` | Stack-Bar pro Tag (Deep/REM/Light/Awake). |
| `BCheckinPanel` | `components/data/CheckinPanel.tsx` | 4 Slider-Reihen (10er-Skala). |
| `BDailyLog` | `components/review/DailyLog.tsx` | Tabellen-Row pro Tag. |
| `VariantB_Mobile` | `app/(app)/m/page.tsx` + `components/cockpit/Mobile*` | Eigenes Mobile-Layout, gleiche Tokens. |

---

## 5 · Screens & Routes

| Route | Mock | Beschreibung |
|---|---|---|
| `/dashboard` | `VariantB_Home` | Readiness + Today's Workout + CTL/ATL/TSB + Recent + Activity-Tabelle |
| `/coach` | `VariantB_Coach` | Live-Briefing + Reasoning + Chat |
| `/plan` | `VariantB_Plan` | Tabs: Training / Ziele / Review. WeekStrip + WorkoutTable + GoalsPanel + ReviewMini |
| `/data` | `VariantB_Data` | Schlaf-Stats (4 KPIs + Stack-Bar) + Mental Check-in + Mental-Trend |
| `/activity/[id]` | `VariantB_Activity` | KPI-Strip + HR/Power-Chart + Splits + Zone-Distribution |
| `/review/[week]` | `VariantB_Review` | KPI-Strip + Narrative + Wins/Watch + Daily Log |

Mobile (separate routes oder responsive break):
- `/m/dashboard`, `/m/coach`, `/m/data`, `/m/plan`

---

## 6 · State-Anforderungen

### Daten-Slices die in jedem Screen erwartet werden

```ts
type Readiness = { score: number; status: 'optimal'|'good'|'caution'|'rest'; trend7d: number[] };
type Vitals = { hrv: { value: number; delta: number; baseline: number };
                rhr: { value: number; delta: number; baseline: number };
                sleep: { hours: number; score: number; deep: number; rem: number; light: number; awake: number } };
type Form = { ctl: number; atl: number; tsb: number; deltaCtl: number; deltaAtl: number; chart7d: { ctl: number; atl: number; tsb: number }[] };
type Workout = { id: string; date: string; type: string; zone: 1|2|3|4|5; duration: number; distance?: number;
                 status: 'planned'|'today'|'completed'|'skipped'; tss?: number };
type Goal = { id: string; title: string; description?: string; progress: number; status: 'active'|'paused'|'completed'; targetDate: string };
type Checkin = { date: string; mood: number; energy: number; stress: number; motivation: number; note?: string };
type Activity = { id: string; date: string; type: string; duration: number; distance?: number; tss?: number;
                  hrAvg?: number; powerAvg?: number; elevation?: number;
                  splits?: { km: number; pace: string; hr: number; power: number; gain: number }[];
                  zoneDistribution?: { z: 1|2|3|4|5; pct: number }[] };
type Review = { week: string; workoutsDone: number; workoutsPlanned: number; totalTss: number; deltaCtl: number;
                avgHrv: number; avgSleep: number; narrative: string; wins: string[]; watch: string[];
                dailyLog: { day: string; date: string; sleep: number; hrv: number; tss: number; mood: number; workout: string }[] };
```

Sources: Garmin sync (workouts, vitals), Supabase (goals, checkins, narrative), LLM (narrative, briefing reasoning).

---

## 7 · Implementierungs-Reihenfolge

Vorgeschlagen für 1–2 Sprints:

### Sprint 1 — Foundation
1. CSS-Variablen + Theme-Switcher (`data-theme`).
2. `Topbar` + `Sidebar` + Layout-Shell.
3. `StatCard` + `Sparkline` als Atoms.
4. Dashboard (`/dashboard`) — komplett gegen real data.

### Sprint 2 — Plan + Data + Detail
5. `Plan` mit `WeekStrip`, `WorkoutTable`, `GoalsPanel`.
6. `Data` mit `SleepStagesChart`, `CheckinPanel`.
7. `Activity` Detail-Page.
8. `Review` (kann LLM-generated narrative in v1 mocken).

### Sprint 3 — Mobile + Polish
9. Mobile Routes (oder responsive bei Breakpoint < 720px).
10. Hotkeys, Loading states, Empty states, Error states.

---

## 8 · Open Questions an User

- [ ] Soll der Light Mode bleiben + Theme-Toggle, oder wird Dark Mode zum Default?
- [ ] Mobile als separate Routes (`/m/*`) oder responsive auf gleicher Route?
- [ ] LLM-Narrative für Wochen-Review — pre-computed (cron) oder on-demand?
- [ ] Activity-Detail: laden wir GPX/streams oder nur Aggregate?
- [ ] Goal-Modell: brauchen wir Sub-Tasks / Milestones, oder reicht flat?

---

## 9 · Was Claude Code als Erstes braucht

1. **Read access** zum Repo (oder Import via GitHub Tool).
2. Diese Datei (`HANDOFF.md`).
3. Die Mock-Files: `src/variant-b*.jsx` + `Pulse Redesign.html` zur visuellen Referenz.
4. Antworten auf §8.

Dann startet Claude Code mit Sprint 1, Task 1.

---

*Generiert aus Design-Exploration · 26.04.2026*
