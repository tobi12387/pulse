# Plan Season Contract Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `/plan` first-viewport density by making the Adaptive Season Contract show only the season decision headline by default, with detailed guardrail/intervention evidence behind `Saisonvertrag anzeigen`.

**Architecture:** Frontend-only Plan UI slice. Keep `useSeasonStrategy`, `useGoalProjection`, Garmin-safe read-only behavior and `SeasonStrategyCard` unchanged; update only the `AdaptiveSeasonContractCard` read/collapse behavior and corresponding Playwright contract.

**Tech Stack:** React, TypeScript, Playwright route evidence.

---

### Task 1: Redefine The Season Contract Visibility Contract

**Files:**
- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [ ] **Step 1: Write the failing test**

Update `Plan shows adaptive season contract from season and goal projection evidence` so the contract still shows `Saisonvertrag`, `70.3 Kraichgau`, `ca. 64%` and the headline by default, but `Naechste 14 Tage`, `Hard-Day-Cap` and `Fueling-Praxis absichern` appear only after clicking `Saisonvertrag anzeigen`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Plan shows adaptive season contract from season and goal projection evidence" --project=mobile-chromium
```

Expected: FAIL because the guardrail/intervention details are currently rendered before the disclosure opens.

### Task 2: Collapse Detailed Contract Evidence

**Files:**
- Modify: `frontend/src/features/plan/strategy/strategy-components.tsx`

- [ ] **Step 1: Keep the compact header and headline visible**

Leave the `Saisonvertrag` label, probability/status line, headline and top goal summary visible before disclosure.

- [ ] **Step 2: Move facts and intervention into the disclosure**

Render `compactFacts`, `Naechste Intervention`, detailed facts and evidence chips only while `detailsOpen` is true. Keep button text and explicit click behavior unchanged.

- [ ] **Step 3: Run the focused test**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Plan shows adaptive season contract from season and goal projection evidence" --project=mobile-chromium
```

Expected: PASS.

### Task 3: Verify And Ship

**Files:**
- Modify: `docs/decisions.md`
- Create: `docs/qa/2026-05-13-plan-season-contract-disclosure.md`

- [ ] **Step 1: Run Plan regression coverage**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Plan|season contract|season strategy" --project=desktop-chromium --project=mobile-chromium
npm run build
```

Expected: PASS.

- [ ] **Step 2: Run route evidence**

Run:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-season-contract-disclosure-final npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-plan-season-contract-disclosure-final
git diff --check
```

Expected: no horizontal overflow and clean diff.

- [ ] **Step 3: Record decision, QA, PR and deploy**

Record the disclosure decision, move this plan to completed at commit time, open PR, merge after checks, deploy to `/root/pulse`, verify server commit and capture live route evidence.
