# Daily Intelligent Action Contract v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home's primary daily decision explicitly names the top contributing domains, goal impact, Garmin execution state and safest alternative using existing Pulse data.

**Architecture:** Keep this as a frontend-first translation layer over `PulseHomeScreenData`; do not add a backend route, migration or Garmin write path. Extend `frontend/src/pulse/daily-decision.ts` with a small decision-contract view model, then render it in `DailyDecisionCard` so Home's `DecisionHero` gets the richer contract without duplicating dashboards.

**Tech Stack:** React 19, TypeScript, Vite, Playwright, existing Pulse shared contracts in `@coaching-os/shared/pulse`.

---

## Scope

This plan implements the first slice from `docs/superpowers/specs/2026-05-14-performance-operating-system-design.md`: **Daily Intelligent Action Contract v2**.

It must not:

- add database migrations;
- add backend LLM calls;
- write to Garmin;
- auto-mutate plans;
- add a new top-level route;
- build Nutrition Trend Summaries;
- build the full Everyday Adaptation Inbox.

## File Structure

- Modify `frontend/src/pulse/daily-decision.ts`: derive compact decision-contract fields from existing Home data.
- Modify `frontend/src/components/DailyDecisionCard.tsx`: render the compact decision contract in the main daily decision card.
- Modify `frontend/e2e/ux-daily-flow.spec.ts`: prove Home shows goal impact, Garmin execution state, safest alternative and top domain signals without extra action writes.
- Modify `docs/ai/current-focus.md`: replace the old spec-review gate with the selected autonomous first slice.
- Modify `docs/decisions.md`: record that Tobi granted autonomous execution and that Daily Intelligent Action Contract v2 is the first selected slice.

## Task 1: Record Autonomous Execution Gate

**Files:**
- Modify: `docs/ai/current-focus.md`
- Modify: `docs/decisions.md`

- [ ] **Step 1: Replace the manual review gate in current focus**

Change the Performance OS line in `docs/ai/current-focus.md` from:

```markdown
- Performance Operating System spec is ready for Tobi review in `docs/superpowers/specs/2026-05-14-performance-operating-system-design.md`; do not implement a follow-up slice until that spec is approved.
```

to:

```markdown
- Performance Operating System spec is merged and Tobi has granted autonomous follow-up execution. First selected slice: Daily Intelligent Action Contract v2, which should enrich Home's primary daily decision without backend, migration, plan-mutation or Garmin-write scope.
```

- [ ] **Step 2: Add newest decision-log entry**

Insert this entry immediately after the first `---` in `docs/decisions.md`:

```markdown
## 2026-05-14 — Performance-OS-Freigaben laufen autonom

- **Decision:** Tobi gibt Codex fuer den Performance-OS-Nordstern dauerhafte Autonomie: Specs, Plaene und PR-grosse Implementierungsslices duerfen ohne weitere manuelle Freigabe fortgesetzt werden, solange Pulse-Hard-Rules, PR-Flow, Safety-Gates und Verifikation eingehalten werden.
- **Why:** Das Ziel ist ein Ende-2026-Produktzustand, nicht eine einzelne Spezifikation. Manuelle Freigaben fuer jeden Zwischenschritt wuerden den Fortschritt kuenstlich blockieren; GitHub-PRs, Tests, Decisions und deploy-sichere Grenzen bleiben die Kontrollschicht.
- **Alternatives:** Nach jedem Spec oder Plan warten (zu langsam und vom Nutzer explizit aufgehoben); direkt auf `main` arbeiten (verletzt Pulse-Regeln); alle Slices in einen Gross-PR packen (zu riskant).
- **Decided by:** Tobi.
- **Status:** active.

---
```

- [ ] **Step 3: Verify docs edit**

Run:

```bash
rg -n "Autonomie|Daily Intelligent Action Contract v2|Performance Operating System spec is merged" docs/ai/current-focus.md docs/decisions.md
```

Expected: output includes the new current-focus line and the new decision entry.

- [ ] **Step 4: Commit docs gate**

Run:

```bash
git add docs/ai/current-focus.md docs/decisions.md
git commit -m "docs: record autonomous performance os execution"
```

Expected: commit succeeds with only the two docs files staged.

## Task 2: Extend The Daily Decision View Model

**Files:**
- Modify: `frontend/src/pulse/daily-decision.ts`

- [ ] **Step 1: Add the contract interfaces**

Add these exports after `DailyDecisionEvidence`:

```ts
export type DailyDecisionSignalTone = 'green' | 'amber' | 'rose' | 'accent' | 'muted';

export interface DailyDecisionSignal {
  label: string;
  detail: string;
  tone: DailyDecisionSignalTone;
  targetPath?: string;
}

export interface DailyDecisionContract {
  goalImpact: string;
  garminExecution: string;
  safestAlternative: string;
  signals: DailyDecisionSignal[];
}
```

Extend `DailyDecision` with:

```ts
  contract: DailyDecisionContract;
```

- [ ] **Step 2: Add helper functions before `deriveDailyDecision`**

Add these helper functions near `actionResultPreview`:

```ts
function signalToneForReadiness(score: number): DailyDecisionSignalTone {
  if (score < 55) return 'rose';
  if (score < 70) return 'amber';
  if (score >= 85) return 'accent';
  return 'green';
}

function signalToneForTsb(tsb: number): DailyDecisionSignalTone {
  if (tsb < -12) return 'amber';
  if (tsb > 8) return 'green';
  return 'muted';
}

function executionSummary(workout: HomeWorkout | null, completedActivity: HomeActivity | null): string {
  if (completedActivity) return 'Garmin: Aktivitaet erledigt und bereit fuer Feedback/Planabgleich.';
  if (!workout) return 'Garmin: kein Schreibpfad fuer heute; Erholung und Check-in bleiben lokal.';
  if (workout.executionStatus === 'completed_matched') return 'Garmin: geplante Einheit erledigt und zugeordnet.';
  if (workout.executionStatus === 'garmin_scheduled') return 'Garmin: Kalender bereit; Ausfuehrung auf dem Geraet pruefbar.';
  if (workout.executionStatus === 'garmin_template') return 'Garmin: Workout-Template bereit, Kalenderstatus noch pruefen.';
  if (workout.executionStatus === 'missed') return 'Garmin: geplante Einheit wirkt verpasst; Planabgleich vor Nachholen.';
  if (workout.executionStatus === 'replaced_or_off_plan') return 'Garmin: echte Aktivitaet weicht vom Plan ab; Planwirkung pruefen.';
  return 'Garmin: Pulse plant lokal; kein automatischer Geraete-Write.';
}

function goalImpactSummary(home: PulseHomeScreenData, workout: HomeWorkout | null, completedActivity: HomeActivity | null): string {
  if (workout?.status === 'completed' || workout?.completedActivityId) {
    return 'Zielwirkung: Reiz als erledigt behandeln; Feedback macht die naechste Planung genauer.';
  }
  if (completedActivity) {
    return 'Zielwirkung: ungeplante Belastung in die naechste Planentscheidung einrechnen.';
  }
  if (workout) {
    if (workout.capabilityFit === 'too_hard') return 'Zielwirkung: Fortschritt schuetzen, aber heute keine zu harte Einheit erzwingen.';
    if (workout.capabilityFit === 'stretch') return 'Zielwirkung: kontrollierter Reiz, solange Readiness und Grenze passen.';
    if (workout.capabilityFit === 'productive') return 'Zielwirkung: produktiver Trainingsreiz im Wochenziel.';
    return 'Zielwirkung: Wochenstruktur halten, ohne Zusatzumfang zu erzwingen.';
  }
  if (home.nextWorkout) {
    return 'Zielwirkung: Erholung heute verbessert die Qualitaet der naechsten Einheit.';
  }
  return 'Zielwirkung: Erholung und mentaler Check-in halten die Routine stabil.';
}

function topSignals(home: PulseHomeScreenData, workout: HomeWorkout | null, completedActivity: HomeActivity | null, action: PulseNextBestAction | null): DailyDecisionSignal[] {
  const signals: DailyDecisionSignal[] = [
    {
      label: 'Koerper',
      detail: `Readiness ${home.readiness.score}/100`,
      tone: signalToneForReadiness(home.readiness.score),
      targetPath: '/data?tab=trends#data-recovery',
    },
    {
      label: 'Belastung',
      detail: `TSB ${home.fitnessLoad.tsb.toFixed(1)}`,
      tone: signalToneForTsb(home.fitnessLoad.tsb),
      targetPath: '/data?tab=analysis#data-plan-trace',
    },
  ];

  if (workout) {
    signals.push({
      label: 'Training',
      detail: `${activityLabel(workout.activityType)} Z${workout.zone} · ${workout.durationMin} min`,
      tone: workout.capabilityFit === 'too_hard' ? 'rose' : workout.capabilityFit === 'stretch' ? 'amber' : 'accent',
      targetPath: '/plan?tab=training',
    });
  } else if (completedActivity) {
    signals.push({
      label: 'Garmin',
      detail: completedActivityLabel(completedActivity),
      tone: 'accent',
      targetPath: activityDetailPath(completedActivity.id),
    });
  }

  if (action?.source === 'checkin' || action?.source === 'mental') {
    signals.push({
      label: 'Mental',
      detail: action.source === 'checkin' ? 'Check-in offen' : action.title,
      tone: action.priority === 'critical' ? 'rose' : action.priority === 'high' ? 'amber' : 'accent',
      targetPath: action.targetPath,
    });
  }

  return signals.slice(0, 4);
}

function buildContract({
  home,
  action,
  workout,
  completedActivity,
  alternative,
}: {
  home: PulseHomeScreenData;
  action: PulseNextBestAction | null;
  workout: HomeWorkout | null;
  completedActivity: HomeActivity | null;
  alternative: string;
}): DailyDecisionContract {
  return {
    goalImpact: goalImpactSummary(home, workout, completedActivity),
    garminExecution: executionSummary(workout, completedActivity),
    safestAlternative: alternative,
    signals: topSignals(home, workout, completedActivity, action),
  };
}
```

- [ ] **Step 3: Wire completed-workout decisions**

Inside the completed planned workout branch, add:

```ts
    const contract = buildContract({
      home,
      action,
      workout: completedWorkout,
      completedActivity: completedActivityFor(home, completedWorkout),
      alternative,
    });
```

Then include `contract,` in that returned object.

- [ ] **Step 4: Wire off-plan activity decisions**

Inside the off-plan activity branch, add:

```ts
    const contract = buildContract({
      home,
      action,
      workout: null,
      completedActivity: offPlanActivity,
      alternative,
    });
```

Then include `contract,` in that returned object.

- [ ] **Step 5: Wire open daily decisions**

Before the final return, add:

```ts
  const decisionWorkout = home.todayWorkout?.plannedDate === home.date ? home.todayWorkout : null;
  const contract = buildContract({
    home,
    action,
    workout: decisionWorkout,
    completedActivity: null,
    alternative,
  });
```

Then include `contract,` in the final returned object.

- [ ] **Step 6: Run focused typecheck**

Run:

```bash
npm run build -w frontend
```

Expected before Task 3 may still pass or fail only if `DailyDecisionCard` has not consumed the new field incorrectly. After Task 3 it must pass.

## Task 3: Render The Contract In DailyDecisionCard

**Files:**
- Modify: `frontend/src/components/DailyDecisionCard.tsx`

- [ ] **Step 1: Add tone helper**

Add after `priorityColor`:

```ts
function signalToneColor(tone: DailyDecision['contract']['signals'][number]['tone']): string {
  if (tone === 'green') return 'var(--green)';
  if (tone === 'amber') return 'var(--amber)';
  if (tone === 'rose') return 'var(--rose)';
  if (tone === 'accent') return 'var(--accent)';
  return 'var(--text-3)';
}
```

- [ ] **Step 2: Add renderer for top signals**

Add near `evidenceItems`:

```tsx
function contractSignalItems({
  signals,
  onActivate,
}: {
  signals: DailyDecision['contract']['signals'];
  onActivate?: (path: string) => void;
}) {
  if (signals.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
      {signals.map(signal => {
        const content = (
          <>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: signalToneColor(signal.tone), letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {signal.label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.35, overflowWrap: 'anywhere' }}>
              {signal.detail}
            </span>
          </>
        );
        if (signal.targetPath && onActivate) {
          return (
            <button
              key={`${signal.label}-${signal.detail}`}
              type="button"
              onClick={() => onActivate(signal.targetPath!)}
              style={{
                minHeight: 44,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                padding: '7px 8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {content}
            </button>
          );
        }
        return (
          <div
            key={`${signal.label}-${signal.detail}`}
            style={{
              minHeight: 44,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              padding: '7px 8px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 5,
            }}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Add visible decision logic block**

Inside `detailsOpen && (...)`, before the existing `showDeferredResultPreview` block, insert:

```tsx
              <div data-testid="daily-decision-contract">
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.1em', textTransform: labelCase === 'upper' ? 'uppercase' : 'none', marginBottom: 7 }}>
                  {label('Warum diese Aktion?', labelCase)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contractSignalItems({ signals: decision.contract.signals, onActivate })}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
                    {[
                      ['Zielwirkung', decision.contract.goalImpact],
                      ['Garmin', decision.contract.garminExecution],
                      ['Sicherste Option', decision.contract.safestAlternative],
                    ].map(([title, detail]) => (
                      <div key={title} style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '8px 9px', background: 'var(--surface-2)' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                          {title}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                          {detail}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
```

- [ ] **Step 4: Keep first viewport calm**

Do not render `daily-decision-contract` outside `detailsOpen` in this slice. The primary card still leads with title, reason, next step and one action; the richer operating-system explanation becomes explicit under `Details & Evidenz anzeigen`.

- [ ] **Step 5: Run frontend build**

Run:

```bash
npm run build -w frontend
```

Expected: exit 0.

## Task 4: Add Daily Flow Regression Coverage

**Files:**
- Modify: `frontend/e2e/ux-daily-flow.spec.ts`

- [ ] **Step 1: Add planned-workout contract test**

After `Home renders exactly one main daily decision card`, add:

```ts
test('Home daily decision details expose top signals goal impact Garmin state and safest option', async ({ page }) => {
  await page.goto('/');

  const decision = page.getByTestId('daily-decision-card');
  await decision.getByRole('button', { name: /Details & Evidenz/i }).click();

  const contract = page.getByTestId('daily-decision-contract');
  await expect(contract).toContainText('Warum diese Aktion?');
  await expect(contract).toContainText('Koerper');
  await expect(contract).toContainText('Readiness 78/100');
  await expect(contract).toContainText('Belastung');
  await expect(contract).toContainText('TSB 4.0');
  await expect(contract).toContainText('Zielwirkung');
  await expect(contract).toContainText('Wochenstruktur halten');
  await expect(contract).toContainText('Garmin');
  await expect(contract).toContainText('Pulse plant lokal');
  await expect(contract).toContainText('Sicherste Option');
  await expect(contract).toContainText('Einheit locker halten');
});
```

- [ ] **Step 2: Add completed/off-plan Garmin contract assertion**

In `Home no-training daily decision opens the missing check-in before Coach support`, after details are opened, add:

```ts
  await expect(page.getByTestId('daily-decision-contract')).toContainText('Garmin: kein Schreibpfad fuer heute');
```

- [ ] **Step 3: Run focused e2e**

Run:

```bash
npm run test:e2e -- frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium
```

Expected: the new and existing daily-flow tests pass.

## Task 5: Final Verification And PR

**Files:**
- All files touched above

- [ ] **Step 1: Run docs and whitespace checks**

Run:

```bash
rg -n '[T]BD|TO''DO|implement[ ]later|fill[ ]in|place''holder|\\?\\?' docs/superpowers/plans/2026-05-14-daily-intelligent-action-contract-v2.md docs/ai/current-focus.md docs/decisions.md
git diff --check
```

Expected: `rg` returns no matches; `git diff --check` exits 0.

- [ ] **Step 2: Run frontend build**

Run:

```bash
npm run build -w frontend
```

Expected: exit 0.

- [ ] **Step 3: Run focused Playwright regression**

Run:

```bash
npm run test:e2e -- frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium
```

Expected: all tests in `ux-daily-flow.spec.ts` pass.

- [ ] **Step 4: Review diff**

Run:

```bash
git diff --stat
git diff -- frontend/src/pulse/daily-decision.ts frontend/src/components/DailyDecisionCard.tsx frontend/e2e/ux-daily-flow.spec.ts docs/ai/current-focus.md docs/decisions.md docs/superpowers/plans/2026-05-14-daily-intelligent-action-contract-v2.md
```

Expected: the diff only contains the planned frontend contract, tests, current-focus/decision docs and this implementation plan.

- [ ] **Step 5: Commit**

Run:

```bash
git add frontend/src/pulse/daily-decision.ts frontend/src/components/DailyDecisionCard.tsx frontend/e2e/ux-daily-flow.spec.ts docs/ai/current-focus.md docs/decisions.md docs/superpowers/plans/2026-05-14-daily-intelligent-action-contract-v2.md
git commit -m "feat: expose daily intelligent action contract"
```

Expected: commit succeeds.

- [ ] **Step 6: Push and create PR**

Run:

```bash
git push -u origin codex/daily-intelligent-action-plan
gh pr create --base main --head codex/daily-intelligent-action-plan --draft --title "feat: expose daily intelligent action contract" --body "$(cat <<'PR'
## Summary
- enrich Home's daily decision details with top domain signals, goal impact, Garmin execution state and safest option
- keep the first viewport action-focused while making operating-system evidence explicit on demand
- record autonomous Performance-OS execution and add the implementation plan

## Verification
- npm run build -w frontend
- npm run test:e2e -- frontend/e2e/ux-daily-flow.spec.ts --project=desktop-chromium
- git diff --check
PR
)"
```

Expected: push succeeds and GitHub returns the PR URL.
