# Bündel A — Single Source of Truth (Context Unification)

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
>
> **Status:** Vor Bündel B/C und vor [Risk Watch](2026-04-29-risk-watch.md) implementieren — beides hängt am gemeinsamen Context-Builder.

**Ziel:** Beenden, dass **Briefing** und **Coach Chat** auf zwei verschiedenen Datenwelten und mit zwei verschiedenen Kontext-Tiefen arbeiten. Heute liest der Briefing-Job aus dem Legacy-Schema (`garmin_daily_health`, `check_ins`) und kennt weder CTL/ATL/TSB noch Readiness, Health-States, kommende Workouts oder Recovery-Metriken — der Coach-Chat-Endpoint baut sich denselben Kontext jeden Request neu zusammen, mit eigener Inline-Logik.

1. **Ein geteilter Context-Builder** `buildPulseContextFor(userId, date)` als einzige Quelle der Wahrheit für „was weiß die App heute über Tobi".
2. **Briefing migrieren** von `garmin_daily_health`/`check_ins` auf `pulse_daily_metrics`/`pulse_mental_checkins` — und auf den vollen Context-Builder.
3. **Coach-Plugin migrieren** von Inline-Fetches auf den Context-Builder (~150 Zeilen Code-Reduktion).
4. **Legacy-Routes auditieren**: `routes/health-data.ts`, `routes/chat.ts` lesen ebenfalls aus alter Welt — entweder migrieren oder entfernen, falls nicht mehr Frontend-konsumiert.

**Architektur:** Neue Lib `backend/src/pulse/lib/pulse-context.ts`. Reine Server-Lib, keine HTTP-Schicht. Tests via Mock-DB. Risk-Engine (zukünftig) und Insight-Engine (heute Inline-Fetches) konsumieren später denselben Builder. Kein neuer Cache hier — Caching kommt in Bündel C.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Aktuell | Lücke |
|---|---|
| `briefing-generation.job.ts` liest `garmin_daily_health` + `check_ins` | Voice-Check-ins / Mental-Check-ins aus `pulse_mental_checkins` landen nie im Briefing-Prompt |
| `briefing-generation.job.ts` Prompt: nur Schlaf/HRV/RHR/Battery + 2 Skalen | Kein CTL/ATL/TSB, kein Readiness, kein nächster Workout, keine Health-States |
| `coach-engine.ts` Prompt: Readiness, CTL/ATL/TSB, Profile, recent activities, upcoming workouts, Recovery | Funktioniert — aber inline in `plugin.ts` zusammengebaut, ~150 Zeilen Fetches |
| `garmin-sync.job.ts` schreibt parallel in `garmin_daily_health` UND `pulse_daily_metrics` | Doppelarbeit + Risiko, dass beide Tabellen auseinanderlaufen |
| `routes/health-data.ts` (`GET /health/summary`) liest nur Legacy-Welt | Frontend-Konsument unklar — Audit-Frage |
| `routes/chat.ts` (`/chat/*`) liest nur Legacy-Welt | Frontend-Konsument unklar — Audit-Frage; vermutlich obsolet seit Pulse-Coach |

**Warum jetzt:** Risk Watch und Web Push (geplant) werden den gleichen Kontext brauchen. Wenn wir das nicht jetzt vereinheitlichen, multipliziert sich die Inline-Fetch-Schicht weiter.

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `backend/src/pulse/lib/pulse-context.ts` |
| Create | `backend/src/pulse/lib/pulse-context.test.ts` |
| Modify | `backend/src/jobs/briefing-generation.job.ts` |
| Modify | `backend/src/jobs/briefing-generation.job.test.ts` |
| Modify | `backend/src/pulse/plugin.ts` (`/coach` Endpoint nutzt Builder) |
| Modify | `backend/src/pulse/services/coach-engine.ts` (Typ ggf. anpassen) |
| Modify | `shared/pulse.ts` (PulseContext-Typ exportieren falls Frontend ihn braucht — vermutlich nicht) |
| Audit  | `backend/src/routes/health-data.ts` — entscheiden: migrieren oder entfernen |
| Audit  | `backend/src/routes/chat.ts` — entscheiden: migrieren oder entfernen |
| Modify | ggf. Routes löschen + Frontend-Konsumenten umstellen |

---

## Task 1: PulseContext-Typ

`backend/src/pulse/lib/pulse-context.ts` (Definitionen):

```typescript
export interface PulseContext {
  userId: string;
  date: string;                                // YYYY-MM-DD
  todayMetrics: PulseDailyMetricsRow | null;   // pulse_daily_metrics für heute
  todayCheckin: PulseMentalCheckinRow | null;  // pulse_mental_checkins für heute
  fitnessLoad: PulseFitnessLoad;               // CTL/ATL/TSB
  readiness:   PulseReadiness;                 // score, components, label
  recovery:    PulseRecoverySnapshot | null;   // sleep-debt, hrv-deviation (>=3 Tage Daten)
  profile:     PulseUserProfileRow | null;     // FTP, MaxHR, etc.
  activeHealthStates: PulseHealthStateRow[];   // status='active'
  recentActivities:   PulseActivitySummary[];  // letzte 10
  upcomingWorkouts:   PulsePlannedWorkoutSummary[];  // nächste 3
  metrics14d: PulseDailyMetricsRow[];          // für Trends
  checkins14d: PulseMentalCheckinRow[];        // für Trends
  latestWeight: { weightKg: number; date: string; trend30d: number | null } | null;
  nextRace?: PulseRaceContext | null;          // optional, falls aktive Goal mit raceDate
}
```

Alle Sub-Typen aus `shared/pulse.ts` re-exportieren oder einmalig hier definieren.

---

## Task 2: buildPulseContextFor()

```typescript
export async function buildPulseContextFor(
  userId: string,
  date: string,                  // YYYY-MM-DD, default = heute
): Promise<PulseContext>;
```

**Implementation:** alle Fetches in `Promise.all`. Reihenfolge:

1. `pulseDailyMetrics` für `date` (LIMIT 1)
2. `pulseMentalCheckins` für `date` (LIMIT 1)
3. `computeFitnessLoad(userId, date)` → `fitnessLoad`
4. `pulseUserProfile` (LIMIT 1)
5. `pulseHealthState` mit `status = 'active'`
6. Aktivitäten: 60d für FitnessLoad **bereits in (3) gemacht**, zusätzlich 10 letzte für `recentActivities`
7. `pulsePlannedWorkouts` mit `status = 'planned'`, `plannedDate >= date`, ORDER BY date LIMIT 3
8. `pulseDailyMetrics` 14d (für Trends)
9. `pulseMentalCheckins` 14d
10. `pulseWeightLog` 35 Tage (für `trend30d`)
11. `recovery-metrics.computeRecovery(daily)` falls ≥3 Tage Daten

**Anschließend:**

```typescript
const mentalScore = todayCheckin
  ? ((todayCheckin.mood + todayCheckin.energy + todayCheckin.motivation) / 3) * 10
  : null;

const readiness = computeReadinessScore({
  sleepHours:     todayMetrics?.sleepHours ?? null,
  hrvStatus:      todayMetrics?.hrvStatus ?? null,
  bodyBatteryMax: todayMetrics?.bodyBatteryMax ?? null,
  stressAvg:      todayMetrics?.stressAvg ?? null,
  mentalScore,
  tsb:            fitnessLoad.tsb,
});
```

**Idempotent + reine Function** — keine Side-Effects, kein Caching in dieser Schicht.

---

## Task 3: Briefing-Job migrieren

`briefing-generation.job.ts`:

1. `import { buildPulseContextFor } from '../pulse/lib/pulse-context.js';`
2. `garminDailyHealth`/`checkIns`-Imports entfernen.
3. `processBriefingJob`:

```typescript
const ctx = await buildPulseContextFor(userId, date);
const userContent = buildBriefingUserContentRich(ctx, triggerType);
const briefingText = await llmComplete(systemPrompt, userContent, SMART_MODEL);
```

4. `buildBriefingUserContentRich(ctx, triggerType)`:

```typescript
function buildBriefingUserContentRich(ctx: PulseContext, trigger: string): string {
  return [
    `== HEUTE (${ctx.date}) ==`,
    formatMetrics(ctx.todayMetrics),
    formatCheckin(ctx.todayCheckin, trigger),
    '',
    `== TRAININGSBELASTUNG ==`,
    `CTL ${ctx.fitnessLoad.ctl} | ATL ${ctx.fitnessLoad.atl} | TSB ${ctx.fitnessLoad.tsb}`,
    `Readiness: ${ctx.readiness.score}/100 (${ctx.readiness.label})`,
    '',
    formatActiveHealthStates(ctx.activeHealthStates),
    formatNextWorkout(ctx.upcomingWorkouts[0]),
    formatRecovery(ctx.recovery),
    '',
    'Erstelle das Briefing — 3-5 Sätze, konkret und umsetzbar. Wenn Health-State aktiv ist, das *muss* das Briefing adressieren.',
  ].filter(Boolean).join('\n');
}
```

5. `garmin_snapshot` und `checkin_snapshot` in `daily_briefings`-Insert: jetzt aus `ctx.todayMetrics` und `ctx.todayCheckin` (Pulse-Welt) statt Legacy. Tabelle bleibt — nur Inhalt der Snapshots wechselt.

**Risiko:** `daily_briefings.garmin_snapshot` ist `JSONB`, also flexibles Schema — kein Migrations-Bedarf.

---

## Task 4: Coach-Plugin-Endpoint migrieren

In `plugin.ts`, `app.post('/coach', ...)`:

Vorher: ~150 Zeilen Inline-Fetches (Promise.all von 10 Queries) + Inline-Berechnungen.

Nachher:

```typescript
const ctx = await buildPulseContextFor(userId, today);
const coachCtx = mapPulseContextToCoachContext(ctx);   // adapter, falls Coach-Engine-Typ leicht abweicht
const reply = await getCoachReplyRich(coachCtx, userMessage, conversationHistory);
```

Adapter-Funktion `mapPulseContextToCoachContext(ctx: PulseContext): CoachFullContext` — dünn, oder `CoachFullContext` direkt durch `PulseContext` ersetzen, wenn Form passt.

**Verifikation:** vorher/nachher Snapshot-Test — gleicher LLM-Prompt-Output für identischen DB-State.

---

## Task 5: Legacy-Routes-Audit

Frontend-Audit:

```bash
grep -rn "api\.health\|/health/summary" frontend/src
grep -rn "api\.chat\.\|/chat/" frontend/src
```

Drei mögliche Outcomes:

**Outcome A — beide Routes ungenutzt:** Routes löschen (`routes/health-data.ts`, `routes/chat.ts`), `app.register`-Zeilen aus `server.ts` entfernen. Tabellen `garmin_daily_health` und `check_ins` bleiben, weil `garmin-sync.job` sie noch schreibt (siehe Task 6).

**Outcome B — Routes genutzt, Frontend liest aktiv:** Routes auf Pulse-Schema migrieren (`pulse_daily_metrics`, `pulse_mental_checkins`).

**Outcome C — Mix:** kombiniert.

---

## Task 6: Doppelte Schreibwege beenden

`routes/garmin.ts:304-322` schreibt in **beide** Tabellen. Sobald Briefing+Coach migriert sind:

- Wenn Outcome A aus Task 5: `garmin_daily_health`-Insert kann entfernt werden — keine Konsumenten mehr. (Tabelle bleibt vorerst zur Sicherheit.)
- Wenn Outcome B/C: Insert bleibt bis Legacy-Routes auch migriert sind.

**Markieren** in `routes/garmin.ts` mit Kommentar:
```typescript
// LEGACY: garmin_daily_health write — entfernen sobald letzter Konsument auf pulse_daily_metrics migriert.
```

---

## Task 7: `garmin-sync.job.ts` `checkGarminAlarms` migrieren

Funktion liest aktuell `garminDailyHealth` für Alarm-Detection. Auf `pulseDailyMetrics` umstellen — Spaltennamen sind teilweise anders (`sleep_duration_h` → `sleep_hours`).

---

## Task 8: Tests

`pulse-context.test.ts`:
- Voller Context wird zusammengebaut, alle Felder gesetzt
- Wenn `pulse_daily_metrics` für heute fehlt: `todayMetrics === null`, restliche Felder ok
- Wenn keine Aktivitäten: `recentActivities = []`, `fitnessLoad = { ctl: 0, atl: 0, tsb: 0 }`
- Aktive vs. resolved Health-States: nur active im Context

`briefing-generation.job.test.ts`:
- Snapshot-Test des LLM-User-Contents bei voll bestücktem Context
- Keine alten `garminDailyHealth`-Imports mehr

`plugin.test.ts` (`/coach`):
- LLM-Prompt enthält Readiness, CTL/ATL/TSB, kommende Workouts, Health-States — vorher schon getestet, nachher gleicher Test gegen den Builder.

---

## Acceptance

- [ ] `pulse-context.ts` exportiert `PulseContext` und `buildPulseContextFor`
- [ ] Briefing-Job liest 0 Spalten aus `garmin_daily_health` / `check_ins` (Code-Grep zeigt 0 Treffer)
- [ ] Briefing-Prompt enthält CTL/ATL/TSB, Readiness, aktive Health-States, nächstes Workout
- [ ] `/coach`-Endpoint nutzt den Builder, Inline-Fetch-Block ist weg (LOC-Reduktion ≥100)
- [ ] Snapshot-Test für LLM-User-Content stabil
- [ ] `garmin-sync.job` Alarm-Check liest aus `pulse_daily_metrics`
- [ ] Legacy-Routes (`/health/*`, `/chat/*`) entweder migriert oder entfernt — dokumentiert in PR-Body welcher Outcome
- [ ] Wenn Routes entfernt: Frontend hat keine 404-Calls mehr (manueller Smoke-Test)
- [ ] Bestehende Briefings in der DB bleiben funktional (Snapshot-JSONB ist flexibel)
