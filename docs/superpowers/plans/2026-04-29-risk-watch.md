# Risk Watch — Proaktive Trend-Alarme

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
>
> **Querschnitt:** [HR-First](2026-04-28-cross-cutting-hr-first.md) — alle Risiko-Signale primär aus HR/HRV/RHR + Plan-Load, nicht aus Power.
>
> **Voraussetzung:** Phase 6 (Health States) — `pulse_health_state` existiert; Risk Watch ergänzt darum eine **prädiktive Schicht** vor dem akuten State.

**Ziel:** Pulse hat alle Daten für die Frühwarnung — RHR-Drift, HRV-Trend, CTL-Ramp, Sleep-Debt — surft sie aber nur, wenn Tobi explizit Insights öffnet. Eine *Risk Watch* erkennt Muster automatisch und meldet sich auf Home **nur wenn nötig**. Das ist die nicht-triviale Coaching-Leistung, die generische Smartwatches/Apps nicht haben.

1. **5 Risk-Regeln** über Daten, die Pulse bereits speichert.
2. **Severity-Scoring** (`info` | `warn` | `critical`) — Home-Banner nur ab `warn`.
3. **Stille Tage** sind das Default — keine False-Positives, keine täglichen „alles ok"-Pings.
4. **Coach-Engine-Integration** — laufende Risk-Watch-Items erscheinen im Briefing-Prompt-Kontext.

**Architektur:** Reine Regelschicht, kein ML, kein zusätzlicher externer Service. Neuer Service `risk-engine.ts`, ein Cron-Trigger pro Tag (an die `garmin-sync.job` anhängen, läuft sowieso), eine Tabelle `pulse_risk_signals`, ein Endpoint, eine Frontend-Card. Lebenszyklus: Signal wird täglich neu evaluiert; falls Bedingung nicht mehr erfüllt → automatisch `resolved`.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Aktuell | Lücke |
|---|---|
| RHR/HRV werden täglich gespeichert | Aber kein Trend-Alarm bei Drift |
| CTL/ATL werden berechnet (load-engine.ts) | Aber kein Schwellenwert-Alarm bei zu schneller Ramp |
| Sleep-Hours pro Nacht | Akkumulierte Schuld nicht berechnet |
| Health-States sind manuell (Tobi muss Krankheit eintragen) | Frühwarnung *vor* akuter Krankheit fehlt |
| Insights kennen Trends | Nur bei manueller Abfrage, nicht push-fähig |
| Briefing kennt heutige Tagesdaten | Nicht „seit 7 Tagen RHR +5 bpm" |

**Warum das jetzt geht:** Wir haben jetzt mindestens Phase 6+8+9 ausgeliefert — Activity-Analytics, Health-States, Recovery-Metrics liefern alle Inputs. Das war vor 2 Monaten noch nicht der Fall.

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `backend/src/db/migrations/0014_risk_signals.sql` |
| Modify | `backend/src/db/pulse-schema.ts` |
| Create | `backend/src/pulse/services/risk-engine.ts` |
| Create | `backend/src/pulse/services/risk-engine.test.ts` |
| Modify | `backend/src/jobs/garmin-sync.job.ts` (post-sync hook) |
| Modify | `backend/src/pulse/plugin.ts` (Endpoints) |
| Modify | `backend/src/pulse/services/coach-engine.ts` (Context) |
| Modify | `backend/src/jobs/briefing-generation.job.ts` (Prompt) |
| Modify | `shared/pulse.ts` |
| Create | `frontend/src/components/RiskWatchBanner.tsx` |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` |
| Modify | `frontend/src/pages/Home.tsx` |

---

## Task 1: Schema

`backend/src/db/migrations/0014_risk_signals.sql`:

```sql
CREATE TABLE IF NOT EXISTS pulse_risk_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id         VARCHAR(64) NOT NULL,         -- 'rhr_drift_7d', ...
  severity        VARCHAR(16) NOT NULL,         -- 'info' | 'warn' | 'critical'
  status          VARCHAR(16) NOT NULL DEFAULT 'active',  -- 'active' | 'resolved' | 'snoozed'
  metric_snapshot JSONB NOT NULL,               -- { value, baseline, days, ... }
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  snoozed_until   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_active
  ON pulse_risk_signals(user_id, status, severity)
  WHERE status = 'active';

-- Genau ein aktives Signal pro Regel je User (Re-Trigger updated bestehendes)
CREATE UNIQUE INDEX IF NOT EXISTS uq_risk_active_rule
  ON pulse_risk_signals(user_id, rule_id)
  WHERE status = 'active';
```

---

## Task 2: Risk-Engine — die 5 Regeln

`backend/src/pulse/services/risk-engine.ts`:

```typescript
export interface RiskSignal {
  ruleId: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;          // 'RHR seit 7 Tagen +6 bpm'
  description: string;    // 1-2 Sätze, was es heißt
  recommendation: string; // 1 Satz, was Tobi tun sollte
  metric: Record<string, unknown>;
}

export async function evaluateRiskSignals(userId: string): Promise<RiskSignal[]>;
```

Die fünf Regeln:

### Regel 1: `rhr_drift_7d`
**Bedingung:** Avg RHR der letzten 7 Tage liegt ≥4 bpm über Avg RHR der 30 Tage davor (Baseline aus Tag 8–37).
- 4–5 bpm = `warn`
- ≥6 bpm = `critical`

**Empfehlung-Template:**
- warn: „Heute Z2 reduzieren oder zur Z1 verschieben."
- critical: „Heute trainingsfrei oder kurzes Z1 (<30 min) — Erholung priorisieren."

### Regel 2: `hrv_trend_decline`
**Bedingung:** Linearer Trend der täglichen HRV-Werte über 14 Tage hat negativen Slope, und letzter 7-Tage-Avg liegt unter dem 30-Tage-Mittel der letzten 90 Tage abzüglich 1.0 σ.
- Slope-negativ + 1σ unten = `warn`
- Slope-negativ + 1.5σ unten = `critical`

### Regel 3: `ctl_ramp_overshoot`
**Bedingung:** CTL-Ramp pro Woche (delta CTL über letzte 7 Tage) übersteigt 7 / Woche. Bekannter Verletzungs-Risk-Threshold (Banister/Coggan-Literatur).
- 7–8 = `warn`
- ≥9 = `critical`

**Empfehlung:** „Diese Woche TSS auf max. {X} reduzieren — letzte 7 Tage Ramp +{Y}/Woche, Verletzungsrisiko."

### Regel 4: `sleep_debt_5d`
**Bedingung:** Summe (Soll − Ist) der Schlafstunden über die letzten 5 Tage. Soll: Tobis Profile-Wert, Default 7.5 h.
- Schuld 5–8 h = `warn`
- Schuld ≥9 h = `critical`

### Regel 5: `mental_negative_streak`
**Bedingung:** Aus `pulse_mental_checkins` der letzten 7 Einträge: avg(mood) ≤ 4/10 **oder** avg(stress) ≥ 7/10. Mindestens 3 Einträge in Window.
- 4 oder 7 (Schwelle einmal) = `info`
- Beide Schwellen oder einzeln stark abgewichen = `warn`

(Niemals `critical` — mental ist Coach-Sache, nicht Plan-Sache.)

### Severity-Aggregation

Pro Tag wird jede Regel evaluiert:
- Wenn Bedingung erfüllt: `upsert` aktives Signal (oder Update von Severity).
- Wenn Bedingung nicht mehr erfüllt: bestehendes aktives Signal → `resolved` mit `resolved_at = now()`.
- Snooze-Logik: Wenn Tobi snoozed, `status = 'snoozed', snoozed_until = +24h`.

---

## Task 3: Cron-Hook

In `garmin-sync.job.ts`: Nach erfolgreichem Sync und Activity-Analytics-Compute zusätzlich:

```typescript
await evaluateAndPersistRiskSignals(userId);
```

Idempotent — kann mehrfach am Tag laufen ohne Duplicate-Signals (siehe `uq_risk_active_rule` Index).

---

## Task 4: Endpoints

```typescript
GET    /pulse/risk           // alle aktiven Signale für aktuellen User
POST   /pulse/risk/:id/snooze   // body: { hours?: number = 24 }
POST   /pulse/risk/:id/resolve  // manuell als „verstanden" markieren
```

`GET /pulse/risk` Response:

```json
[
  {
    "id": "...",
    "ruleId": "rhr_drift_7d",
    "severity": "warn",
    "title": "Ruhepuls seit 7 Tagen erhöht",
    "description": "RHR-Schnitt der letzten 7 Tage liegt 5 bpm über deinem 30-Tage-Mittel.",
    "recommendation": "Heute Z2 reduzieren oder zur Z1 verschieben.",
    "metric": { "current": 53, "baseline": 48, "deltaBpm": 5 },
    "triggeredAt": "2026-04-29T07:14:00Z"
  }
]
```

---

## Task 5: Coach-Briefing-Integration

In `briefing-generation.job.ts`: aktive Risk-Signale an LLM-Prompt anhängen, **vor** den objektiven Daten:

```
RISIKO-SIGNALE (Risk-Engine):
- [WARN] Ruhepuls seit 7 Tagen +5 bpm über Baseline (rhr_drift_7d)
  Empfehlung: Heute Z2 reduzieren oder zur Z1 verschieben.

OBJEKTIVE DATEN: ...
```

Coach-Prompt-Anweisung erweitern: „Wenn ein Risk-Signal `critical` ist, *muss* das Briefing es adressieren — nicht beschönigen."

---

## Task 6: Coach-Chat-Kontext

In `coach-engine.ts` → `buildRichSystemPrompt(ctx)`: aktive Risk-Signale unter eigenem Header. Coach kann sie in Antworten referenzieren („Du hattest gestern noch das RHR-Signal — das passt zu dem, was du gerade beschreibst.").

---

## Task 7: Frontend — RiskWatchBanner

Neue Komponente `RiskWatchBanner.tsx`. Auf `Home.tsx` direkt **unter** `HealthStateBanner`, nur wenn ≥1 aktives Signal mit Severity ≥ `warn`.

```
┌──────────────────────────────────────────────────┐
│  ⚠ RISIKO-SIGNALE  (2)                    [▼]  │
├──────────────────────────────────────────────────┤
│  ⚠ Ruhepuls seit 7 Tagen erhöht       [warn]   │
│    +5 bpm über deinem 30-Tage-Mittel.            │
│    → Heute Z2 reduzieren oder zur Z1 verschieben.│
│                          [ Snooze 24h ] [ Ok ]   │
│                                                  │
│  ⚠ CTL-Ramp diese Woche zu steil      [warn]   │
│    +8.2/Woche (Schwelle 7).                      │
│    → TSS diese Woche unter 380 halten.           │
│                          [ Snooze 24h ] [ Ok ]   │
└──────────────────────────────────────────────────┘
```

UI-Detail:
- Default kollabiert bei ≥3 Signalen.
- Severity-Color: warn=`var(--amber)`, critical=`var(--rose)`, info=`var(--text-3)`.
- Info-Severity wird **nicht** auf Home gezeigt — nur in Insights/Detail.
- „Ok" (Resolve) nur erlaubt wenn `severity == 'info'` oder Tobi will explizit; bei warn/critical: nur Snooze.

---

## Task 8: Tests

`risk-engine.test.ts`:
- Regel 1 (RHR-Drift): synthetische 30+7 Tage Daten, +4/+6 → warn/critical.
- Regel 2 (HRV-Trend): linear absteigend → warn.
- Regel 3 (CTL-Ramp): TSS-Sequenz mit Ramp 9 → critical.
- Regel 4 (Sleep-Debt): 5 Tage je 5h Schlaf bei Soll 8h → critical (15 h Schuld).
- Regel 5 (Mental): 4 von 7 mood ≤ 4 → warn.
- Resolve-Flow: Signal aktiv → Bedingung weg → automatisch resolved.
- Snooze: nicht erneut getriggert während snoozed_until.

`plugin.test.ts`: Endpoints mit auth + ownership.

---

## Acceptance

- [ ] Tabelle existiert, unique-active-Index funktioniert (kein Duplicate)
- [ ] Risk-Engine läuft als Post-Sync-Hook automatisch nach Garmin-Sync
- [ ] Synthetische Test-Daten triggern alle 5 Regeln korrekt
- [ ] Briefing-Prompt enthält aktive Signale, Coach erwähnt sie
- [ ] Home zeigt Banner nur bei ≥1 warn/critical Signal
- [ ] Snooze 24h verhindert Re-Surfacing am gleichen Tag
- [ ] Auto-Resolve wenn Bedingung wegfällt (kein manuelles Aufräumen nötig)
- [ ] Bei 0 Signalen ist Home-Layout unverändert (kein leerer Banner-Slot)
- [ ] Mental-Regel feuert nicht critical (Designentscheidung dokumentiert)
