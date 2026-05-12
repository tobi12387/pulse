# Garmin Execution Chain UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/plan?tab=execution` explain the Garmin path as one compact chain from Pulse plan to Garmin template, calendar, readback, repeat structure and completed execution.

**Architecture:** Frontend-only and read-only on load. Reuse the existing `GET /api/pulse/garmin/execution-diff` response and existing explicit repair mutations; do not add backend endpoints, migrations, automatic writes or another Settings diagnostic block. Keep the UI calm by replacing summary stat boxes with one compact stage strip plus one next-action row above existing details.

**Tech Stack:** React/Vite, TanStack Query hooks in `frontend/src/pulse/hooks.ts`, shared Pulse Garmin execution types from `@coaching-os/shared/pulse`, Playwright E2E, Node test runner via `tsx --test`.

---

### Task 1: Pure Garmin Chain Model

**Files:**
- Create: `frontend/src/features/plan/garmin-execution-chain-model.ts`
- Create: `scripts/garmin-execution-chain.test.ts`

- [ ] **Step 1: Write failing model tests**

Create `scripts/garmin-execution-chain.test.ts` with tests that import `buildGarminExecutionChain` and verify:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { PulseGarminExecutionDiffRow } from '../shared/types/pulse/index.ts';
import { buildGarminExecutionChain } from '../frontend/src/features/plan/garmin-execution-chain-model.ts';

function row(overrides: Partial<PulseGarminExecutionDiffRow>): PulseGarminExecutionDiffRow {
  return {
    workoutId: overrides.workoutId ?? 'w1',
    plannedDate: overrides.plannedDate ?? '2026-05-13',
    title: overrides.title ?? 'Rad - Z2 - 75 min',
    status: overrides.status ?? 'ready',
    summary: overrides.summary ?? 'Auf Garmin bereit.',
    local: overrides.local ?? { garminWorkoutId: 'gw-1', garminScheduledId: 'sched-1' },
    remote: overrides.remote ?? { workoutId: 'gw-1', scheduledId: 'sched-1', lastSeenAt: '2026-05-12T08:00:00.000Z' },
    repeatAudit: overrides.repeatAudit ?? null,
    repairActions: overrides.repairActions ?? [],
  };
}

test('builds an all-ready execution chain without proposing a write action', () => {
  const chain = buildGarminExecutionChain([
    row({ workoutId: 'ready', status: 'ready' }),
    row({ workoutId: 'done', status: 'completed' }),
  ]);

  assert.equal(chain.overallState, 'ok');
  assert.equal(chain.nextAction.action, null);
  assert.match(chain.nextAction.title, /bereit/i);
  assert.equal(chain.stages.find(stage => stage.id === 'template')?.state, 'ok');
  assert.equal(chain.stages.find(stage => stage.id === 'calendar')?.state, 'ok');
  assert.equal(chain.stages.find(stage => stage.id === 'execution')?.value, '1/2');
});

test('prioritizes missing templates before calendar and repeat repair', () => {
  const chain = buildGarminExecutionChain([
    row({
      workoutId: 'missing-template',
      title: 'Rad - VO2',
      status: 'missing_template',
      local: { garminWorkoutId: null, garminScheduledId: null },
      remote: { workoutId: null, scheduledId: null, lastSeenAt: null },
      repairActions: ['upload_template'],
    }),
    row({
      workoutId: 'missing-calendar',
      status: 'missing_calendar',
      remote: { workoutId: 'gw-2', scheduledId: null, lastSeenAt: '2026-05-12T08:00:00.000Z' },
      repairActions: ['schedule_calendar'],
    }),
  ]);

  assert.equal(chain.overallState, 'attention');
  assert.equal(chain.nextAction.action, 'upload_template');
  assert.equal(chain.nextAction.workoutId, 'missing-template');
  assert.equal(chain.stages.find(stage => stage.id === 'template')?.state, 'attention');
  assert.equal(chain.stages.find(stage => stage.id === 'calendar')?.state, 'attention');
});

test('surfaces repeat repair as the next action when templates and calendar are present', () => {
  const chain = buildGarminExecutionChain([
    row({
      workoutId: 'repeat',
      status: 'broken_repeat',
      repeatAudit: {
        status: 'repair_needed',
        summary: 'Pulse erwartet 3x, Garmin zeigt 0x.',
        localRepeatGroups: 1,
        localRepeatIterations: 3,
        remoteRepeatGroups: 1,
        remoteRepeatIterations: 0,
        remoteInvalidRepeatGroups: 1,
      },
      repairActions: ['repair_repeat'],
    }),
  ]);

  assert.equal(chain.nextAction.action, 'repair_repeat');
  assert.equal(chain.stages.find(stage => stage.id === 'repeats')?.state, 'attention');
  assert.match(chain.stages.find(stage => stage.id === 'repeats')?.summary ?? '', /Wiederholungen/);
});
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm run test:frontend-logic -- scripts/garmin-execution-chain.test.ts
```

Expected: fail because `garmin-execution-chain-model.ts` does not exist.

- [ ] **Step 3: Implement pure model**

Create `frontend/src/features/plan/garmin-execution-chain-model.ts` with:

```ts
import type {
  PulseGarminExecutionDiffRow,
  PulseGarminExecutionRepairAction,
} from '@coaching-os/shared/pulse';

export type GarminExecutionChainStageId = 'template' | 'calendar' | 'readback' | 'repeats' | 'execution';
export type GarminExecutionChainState = 'ok' | 'attention' | 'info';

export interface GarminExecutionChainStage {
  id: GarminExecutionChainStageId;
  label: string;
  value: string;
  state: GarminExecutionChainState;
  summary: string;
}

export interface GarminExecutionChainNextAction {
  title: string;
  summary: string;
  workoutId: string | null;
  workoutTitle: string | null;
  action: PulseGarminExecutionRepairAction | null;
}

export interface GarminExecutionChain {
  overallState: GarminExecutionChainState;
  stages: GarminExecutionChainStage[];
  nextAction: GarminExecutionChainNextAction;
}

const ACTION_PRIORITY: PulseGarminExecutionRepairAction[] = [
  'upload_template',
  'schedule_calendar',
  'repair_repeat',
  'delete_stale_remote',
];

export function buildGarminExecutionChain(rows: PulseGarminExecutionDiffRow[]): GarminExecutionChain {
  const total = rows.length;
  const templateReady = rows.filter(row => row.local.garminWorkoutId || row.remote.workoutId).length;
  const calendarReady = rows.filter(row => row.local.garminScheduledId || row.remote.scheduledId || row.status === 'ready' || row.status === 'completed').length;
  const readbackKnown = rows.filter(row => row.remote.workoutId || row.remote.scheduledId || row.status === 'completed').length;
  const repeatAttention = rows.filter(row => row.status === 'broken_repeat' || row.repeatAudit?.status === 'repair_needed').length;
  const repeatUnknown = rows.filter(row => row.repeatAudit?.status === 'unverified').length;
  const completed = rows.filter(row => row.status === 'completed').length;
  const attentionRows = rows.filter(row => row.repairActions.length > 0 || ['missing_template', 'missing_calendar', 'broken_repeat', 'stale'].includes(row.status));

  const nextRow = [...attentionRows].sort((a, b) => {
    const aRank = Math.min(...a.repairActions.map(action => ACTION_PRIORITY.indexOf(action)).filter(rank => rank >= 0), 99);
    const bRank = Math.min(...b.repairActions.map(action => ACTION_PRIORITY.indexOf(action)).filter(rank => rank >= 0), 99);
    return aRank - bRank;
  })[0] ?? null;
  const nextAction = nextRow?.repairActions
    .slice()
    .sort((a, b) => ACTION_PRIORITY.indexOf(a) - ACTION_PRIORITY.indexOf(b))[0] ?? null;

  return {
    overallState: attentionRows.length > 0 ? 'attention' : total > 0 ? 'ok' : 'info',
    stages: [
      {
        id: 'template',
        label: 'Vorlage',
        value: total > 0 ? `${templateReady}/${total}` : '0',
        state: rows.some(row => row.status === 'missing_template') ? 'attention' : total > 0 ? 'ok' : 'info',
        summary: rows.some(row => row.status === 'missing_template')
          ? 'Mindestens eine Garmin-Workout-Vorlage fehlt.'
          : 'Garmin-Workout-Vorlagen sind für den sichtbaren Check vorhanden.',
      },
      {
        id: 'calendar',
        label: 'Kalender',
        value: total > 0 ? `${calendarReady}/${total}` : '0',
        state: rows.some(row => row.status === 'missing_calendar' || row.status === 'stale') ? 'attention' : total > 0 ? 'ok' : 'info',
        summary: rows.some(row => row.status === 'missing_calendar' || row.status === 'stale')
          ? 'Mindestens ein Garmin-Kalendertermin fehlt oder weicht ab.'
          : 'Kalendertermine sind im Readback schlüssig.',
      },
      {
        id: 'readback',
        label: 'Readback',
        value: total > 0 ? `${readbackKnown}/${total}` : '0',
        state: rows.some(row => row.status === 'unknown') ? 'info' : total > 0 ? 'ok' : 'info',
        summary: rows.some(row => row.status === 'unknown')
          ? 'Garmin konnte einzelne Einheiten nicht eindeutig zurückmelden.'
          : 'Pulse kann die Garmin-Zuordnung lesend nachvollziehen.',
      },
      {
        id: 'repeats',
        label: 'Repeats',
        value: repeatAttention > 0 ? `${repeatAttention} offen` : repeatUnknown > 0 ? `${repeatUnknown} offen` : 'ok',
        state: repeatAttention > 0 ? 'attention' : repeatUnknown > 0 ? 'info' : total > 0 ? 'ok' : 'info',
        summary: repeatAttention > 0
          ? 'Wiederholungen brauchen Reparatur, bevor die Einheit sauber ausgeführt werden kann.'
          : repeatUnknown > 0
            ? 'Wiederholungen sind noch nicht vollständig verifiziert.'
            : 'Wiederholungen sind unauffällig oder nicht relevant.',
      },
      {
        id: 'execution',
        label: 'Ausführung',
        value: total > 0 ? `${completed}/${total}` : '0',
        state: completed > 0 ? 'ok' : 'info',
        summary: completed > 0
          ? 'Mindestens eine geplante Einheit wurde bereits mit Garmin-Ausführung abgeglichen.'
          : 'Noch keine abgeschlossene Ausführung im geprüften Fenster.',
      },
    ],
    nextAction: nextRow
      ? {
          title: nextAction === 'upload_template'
            ? 'Vorlage zuerst hochladen'
            : nextAction === 'schedule_calendar'
              ? 'Kalendertermin schließen'
              : nextAction === 'repair_repeat'
                ? 'Wiederholungen reparieren'
                : 'Abweichenden Alttermin entfernen',
          summary: `${nextRow.title}: ${nextRow.summary}`,
          workoutId: nextRow.workoutId,
          workoutTitle: nextRow.title,
          action: nextAction,
        }
      : {
          title: total > 0 ? 'Garmin-Pfad bereit' : 'Keine offenen Garmin-Prüfungen',
          summary: total > 0
            ? 'Vorlage, Kalender, Readback und Wiederholungsstruktur sind für den sichtbaren Zeitraum schlüssig.'
            : 'Im geprüften Fenster gibt es keine geplanten Pulse-Workouts, die auf Garmin kontrolliert werden müssen.',
          workoutId: null,
          workoutTitle: null,
          action: null,
        },
  };
}
```

- [ ] **Step 4: Verify green**

Run:

```bash
npm run test:frontend-logic -- scripts/garmin-execution-chain.test.ts
```

Expected: pass.

### Task 2: Compact Chain UI In Plan Execution

**Files:**
- Modify: `frontend/src/components/GarminExecutionTrustPanel.tsx`
- Modify: `frontend/e2e/pulse-usability.spec.ts`
- Modify: `frontend/e2e/plan-no-garmin-write.spec.ts`

- [ ] **Step 1: Write failing UI assertions**

Add assertions to existing Plan execution tests:

```ts
const chain = page.getByTestId('garmin-execution-chain');
await expect(chain).toContainText('Vorlage');
await expect(chain).toContainText('Kalender');
await expect(chain).toContainText('Readback');
await expect(chain).toContainText('Repeats');
await expect(chain).toContainText('Ausführung');
await expect(page.getByTestId('garmin-execution-next-action')).toContainText('Wiederholungen reparieren');
```

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan Ausführung shows Garmin execution trust" --workers=1
```

Expected: fail because the chain and next-action test ids do not exist yet.

- [ ] **Step 2: Implement UI**

In `GarminExecutionTrustPanel.tsx`:
- import `buildGarminExecutionChain`;
- compute `const chain = useMemo(() => buildGarminExecutionChain(rows), [rows]);`;
- replace the three summary stat boxes with a compact `data-testid="garmin-execution-chain"` stage strip;
- add `data-testid="garmin-execution-next-action"` below the strip;
- if `chain.nextAction.action` is non-null, show exactly one primary repair button that calls the existing `handleRepair` for the matching row and action;
- keep existing details visible below the next action.

- [ ] **Step 3: Verify UI**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan Ausführung shows Garmin execution trust|Plan Ausführung repair actions" --workers=1
npm run qa:plan:no-garmin-write
```

Expected: all selected tests pass and read-only load still does not call POST endpoints.

### Task 3: Docs, QA, And Roadmap Closeout

**Files:**
- Modify: `docs/decisions.md`
- Modify: `docs/ai/current-focus.md`
- Modify: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`
- Move: `docs/superpowers/plans/2026-05-12-garmin-execution-chain-ui.md` to `docs/superpowers/plans/completed/2026-05-12-garmin-execution-chain-ui.md`
- Modify: `docs/superpowers/plans/completed/README.md`
- Create: `docs/qa/2026-05-12-garmin-execution-chain-ui.md`

- [ ] **Step 1: Record decision**

Add newest-first decision:

```md
## 2026-05-12 — Garmin Execution Chain UI bleibt Frontend-Orchestrierung

- **Decision:** Garmin Execution Chain UI wird als kompakter Frontend-Chain-Strip auf `/plan?tab=execution` umgesetzt und nutzt nur den bestehenden Execution-Diff plus explizite Repair-Aktionen.
- **Why:** Die Grundlagen fuer Template, Kalender, Readback, Repeat-Audit und Repair existieren bereits; der offene Nutzen ist eine ruhigere Orientierung, nicht neue Garmin-Schreiblogik.
- **Alternatives:** Neue Route `Ausfuehrung` (mehr Navigation vor Evidenz); automatische Reparaturen beim Laden (bricht Kontrollvertrag); weitere Settings-Diagnosekarten (erhoeht Dichte).
- **Decided by:** Codex.
- **Status:** active.
```

- [ ] **Step 2: Verify and document QA**

Run:

```bash
npm run test:frontend-logic -- scripts/garmin-execution-chain.test.ts
npm run build -w frontend
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan Ausführung shows Garmin execution trust|Plan Ausführung repair actions" --workers=1
npm run qa:plan:no-garmin-write
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-garmin-execution-chain npm run qa:ux-evidence
```

Create QA doc with exact commands and overflow manifest counts.

- [ ] **Step 3: Commit**

Stage explicit files only and commit:

```bash
git add docs/ai/current-focus.md docs/decisions.md docs/qa/2026-05-12-garmin-execution-chain-ui.md docs/superpowers/plans/2026-05-02-future-direction-roadmap.md docs/superpowers/plans/completed/README.md docs/superpowers/plans/completed/2026-05-12-garmin-execution-chain-ui.md frontend/e2e/plan-no-garmin-write.spec.ts frontend/e2e/pulse-usability.spec.ts frontend/src/components/GarminExecutionTrustPanel.tsx frontend/src/features/plan/garmin-execution-chain-model.ts scripts/garmin-execution-chain.test.ts
git commit -m "feat: clarify garmin execution chain"
```

Expected: commit succeeds on `codex/garmin-execution-chain`.
