# Bündel B — Threshold-Kanonisierung

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
>
> **Status:** Sinnvoll **nach** Bündel A, weil der gemeinsame Kontext-Builder dann auch das `bucketize()`-Helper benutzen kann. Unabhängig lauffähig.

**Ziel:** Eine **kanonische Quelle** für UI-Schwellen (TSB, Readiness, HRV, später RPE), die Server und Frontend gleichermaßen nutzen. Heute existieren in `Home.tsx` allein **drei verschiedene TSB-Schwellsätze**, und das Server-Label aus `load-engine.ts` widerspricht dem Frontend-Label um bis zu 5 Punkte. Ein Score von 62 ist server-seitig `moderate` und frontend-seitig „GUT".

1. **Eine kanonische Bucket-Definition** pro Metrik (TSB, Readiness, HRV-Status, später RPE) in `shared/`.
2. **Helper `bucketize(value, buckets)`** liefert immer Label + Color-Token konsistent.
3. **Server gibt Label/Color-Token mit aus**, Frontend rendert nur — keine eigene Klassifikation mehr.
4. **Tooltip-Texte werden aus den Buckets generiert**, nicht handgepflegt.

**Architektur:** Geteilte Konstanten in `shared/pulse-thresholds.ts`. Color als CSS-Variable-Name (`'green'`, `'amber'`, `'rose'`, `'blue'`) — Mapping auf `var(--green)` etc. passiert im Frontend. Reine Datendefinition + reine Function — keine UI-Library, kein Theme-System. Backend importiert die gleichen Buckets, computeReadinessScore + bucketize sorgen für identische Klassifikation.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Aktuell | Lücke |
|---|---|
| `Home.tsx` `tsbColor`: 25/-10 als Schwellen | `Home.tsx` Label: 10/-10/-20 als Schwellen → widersprechen sich |
| `Home.tsx` Tooltip: „-10 bis +5 optimal" | Drei Aussagen über denselben TSB-Wert |
| `load-engine.ts` Readiness-Label: 80/65/45 | `Home.tsx` Label: 80/60/40 → Score 62 ist `moderate` vs. „GUT" |
| Frontend ignoriert Server-`label`, rechnet selbst | Server-Label-Berechnung ist toter Code |
| Tooltip-Texte handgeschrieben in `Home.tsx` | Bei jeder Schwellen-Änderung 2 Stellen pflegen |
| HRV-Status-Mapping in `load-engine.ts:138-144` hardcoded | Frontend hat keinen Zugriff auf das gleiche Mapping |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `shared/pulse-thresholds.ts` |
| Create | `shared/pulse-thresholds.test.ts` |
| Modify | `backend/src/pulse/services/load-engine.ts` (Buckets nutzen) |
| Modify | `frontend/src/pages/Home.tsx` (alle Inline-Schwellen entfernen) |
| Modify | `frontend/src/pages/Data.tsx` (Readiness-Label nutzen) |
| Create | `frontend/src/lib/thresholds.tsx` (Color-Token → CSS-Variable Mapping, Tooltip-Helper) |
| Modify | ggf. `frontend/src/components/RecoveryStrip.tsx` etc. |

---

## Task 1: Kanonische Buckets

`shared/pulse-thresholds.ts`:

```typescript
export type ColorToken = 'green' | 'amber' | 'rose' | 'blue' | 'text-2' | 'text-3';

export interface Bucket {
  min: number;                   // inklusive Untergrenze
  label: string;                 // sichtbares Label
  shortLabel?: string;           // optional, für enge UI
  color: ColorToken;
  description: string;           // Tooltip-Text
}

// TSB ist beidseitig gefährlich (overreached oder übertrainiert)
export const TSB_BUCKETS: Bucket[] = [
  { min: 25,         label: 'sehr frisch',  color: 'amber',
    description: 'Untertraining oder Detraining-Risiko — zu lange in TSB > 25 = Form-Verlust.' },
  { min: 5,          label: 'frisch',       color: 'green',
    description: 'Erholt, gute Tage für Schlüsseleinheiten oder Wettkampf.' },
  { min: -10,        label: 'optimal',      color: 'green',
    description: 'Ausgewogen — nominale Trainingszone, hohes Adaptions-Potenzial.' },
  { min: -20,        label: 'aufbauend',    color: 'amber',
    description: 'Akkumulierte Belastung — funktional, aber Schlüsseleinheiten reduzieren.' },
  { min: -Infinity,  label: 'übermüdet',    color: 'rose',
    description: 'Hohe akute Ermüdung — Verletzungsrisiko. Erholungs-Tage priorisieren.' },
];

// Readiness 0-100, nur Untergrenzen
export const READINESS_BUCKETS: Bucket[] = [
  { min: 80, label: 'optimal',  shortLabel: 'OPTIMAL', color: 'green',
    description: 'Vollständig erholt — Z4/Z5 möglich.' },
  { min: 65, label: 'gut',      shortLabel: 'GUT',     color: 'green',
    description: 'Gut erholt — Plan wie geplant.' },
  { min: 45, label: 'mäßig',    shortLabel: 'MÄSSIG',  color: 'amber',
    description: 'Anzeichen von Müdigkeit — Intensität reduzieren.' },
  { min: 0,  label: 'erholen',  shortLabel: 'ERHOLEN', color: 'rose',
    description: 'Erholungs-Tag — Z1/Aktiv-Recovery oder frei.' },
];

// HRV-Status (Garmin enums)
export const HRV_STATUS_MAP: Record<string, { score: number; label: string; color: ColorToken }> = {
  above_normal: { score: 100, label: 'überdurchschnittlich', color: 'green'  },
  balanced:     { score: 80,  label: 'ausgewogen',           color: 'green'  },
  normal:       { score: 80,  label: 'normal',               color: 'green'  },
  below_normal: { score: 50,  label: 'unter Norm',           color: 'amber'  },
  poor:         { score: 25,  label: 'schwach',              color: 'rose'   },
};

// RPE 1-10 (für RPE-Plan, vorbereitet)
export const RPE_BUCKETS: Bucket[] = [
  { min: 8, label: 'sehr hart',   color: 'rose',  description: 'Maximale Anstrengung, Z4/Z5 typisch.' },
  { min: 6, label: 'fordernd',    color: 'amber', description: 'Z3-Tempo-Bereich, sustainable max ~30min.' },
  { min: 4, label: 'mittel',      color: 'green', description: 'Z2-Endurance, sustainable.' },
  { min: 1, label: 'locker',      color: 'blue',  description: 'Z1/Recovery, leicht zu unterhalten.' },
];

export function bucketize(value: number, buckets: Bucket[]): Bucket {
  for (const b of buckets) {
    if (value >= b.min) return b;
  }
  return buckets[buckets.length - 1]!;
}
```

---

## Task 2: Server-Integration (load-engine)

`load-engine.ts:165-168` durch Lookup ersetzen:

```typescript
import { READINESS_BUCKETS, bucketize } from '@coaching-os/shared/pulse-thresholds';

// in computeReadinessScore:
const bucket = bucketize(score, READINESS_BUCKETS);
return {
  score,
  components: { sleep, hrv, tsb, battery, mental, stress },
  label: bucket.label,             // 'optimal' | 'gut' | 'mäßig' | 'erholen'
  shortLabel: bucket.shortLabel,   // für UI
  color: bucket.color,             // 'green' | 'amber' | 'rose'
};
```

`PulseReadiness`-Typ in `shared/pulse.ts` um `shortLabel` und `color` erweitern (additiv).

---

## Task 3: Frontend Color-Helper

`frontend/src/lib/thresholds.tsx`:

```typescript
import type { ColorToken } from '@coaching-os/shared/pulse-thresholds';

export const COLOR_VAR: Record<ColorToken, string> = {
  green:  'var(--green)',
  amber:  'var(--amber)',
  rose:   'var(--rose)',
  blue:   'var(--blue)',
  'text-2': 'var(--text-2)',
  'text-3': 'var(--text-3)',
};

export function colorOf(token: ColorToken): string {
  return COLOR_VAR[token];
}
```

---

## Task 4: Frontend Home.tsx

Ersetzen:

```typescript
// VORHER
const readinessColor =
  data.readiness.score >= 80 ? 'var(--green)' :
  data.readiness.score >= 60 ? 'var(--accent)' :
  ...

const readinessLabel =
  data.readiness.score >= 80 ? 'OPTIMAL' :
  ...

const tsbColor =
  fl.tsb > 25    ? 'var(--amber)' :
  fl.tsb >= -10  ? 'var(--green)' : 'var(--rose)';

// in form-card:
{fl.tsb > 10 ? 'frisch' : fl.tsb >= -10 ? 'optimal' : ...}
```

durch:

```typescript
import { TSB_BUCKETS, bucketize } from '@coaching-os/shared/pulse-thresholds';
import { colorOf } from '@/lib/thresholds';

const readinessColor  = colorOf(data.readiness.color);
const readinessLabel  = data.readiness.shortLabel;
const tsbBucket       = bucketize(fl.tsb, TSB_BUCKETS);
const tsbColor        = colorOf(tsbBucket.color);
```

Form-Label im Form-Card → `tsbBucket.label`.

---

## Task 5: Tooltip-Generation

Tooltips aus Buckets generieren statt handgepflegt:

```typescript
function bucketTooltip(metric: 'TSB' | 'Readiness'): TooltipDef {
  const buckets = metric === 'TSB' ? TSB_BUCKETS : READINESS_BUCKETS;
  return {
    title: metric,
    what: METRIC_DESCRIPTIONS[metric],
    ranges: buckets.map(b => ({ label: b.label, min: b.min, color: b.color, description: b.description })),
  };
}
```

UI rendert kompakte Range-Liste:

```
┌───────────────────────────────────┐
│ TSB · Training Stress Balance     │
├───────────────────────────────────┤
│ Form = CTL − ATL.                 │
│                                   │
│ ≥ +25  sehr frisch  ⚠ Detraining │
│ ≥ +5   frisch       ✓             │
│ ≥ −10  optimal      ✓             │
│ ≥ −20  aufbauend    ⚠             │
│ <  −20 übermüdet    ⚠ Risiko     │
└───────────────────────────────────┘
```

CTL/RHR/HRV/Schlaf-Tooltips bleiben handgepflegt, weil sie keine Schwellen haben (sind reine Erklärungstexte).

---

## Task 6: Tests

`pulse-thresholds.test.ts`:

- `bucketize(62, READINESS_BUCKETS).label === 'erholen'` (62 < 65) — Test fängt explizit den Status-Quo-Bug ab
- `bucketize(-15, TSB_BUCKETS).label === 'aufbauend'` (-15 ≥ -20)
- `bucketize(-25, TSB_BUCKETS).color === 'rose'`
- `bucketize(80, READINESS_BUCKETS).shortLabel === 'OPTIMAL'`

`load-engine.test.ts`: `computeReadinessScore`-Output enthält `shortLabel` und `color` aus Bucket.

---

## Acceptance

- [ ] `shared/pulse-thresholds.ts` exportiert TSB/Readiness/HRV/RPE-Buckets + `bucketize`
- [ ] `Home.tsx` enthält 0 hardcoded Readiness/TSB-Schwellen (Code-Grep)
- [ ] `Data.tsx` Readiness-Anzeige nutzt Server-Labels
- [ ] Score 62 zeigt überall „mäßig" (nicht „GUT" auf Frontend, „moderate" auf Server)
- [ ] TSB = -15 zeigt überall „aufbauend" mit `amber`-Farbe
- [ ] Tooltips für TSB und Readiness aus Buckets generiert (1 Stelle der Wahrheit)
- [ ] Frontend importiert nur das geteilte Modul, nicht die internen load-engine-Strukturen
- [ ] Bestehende Tests grün, neue Tests für `bucketize` grün
