# Settings Profile Preferences Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Settings profile density by keeping Garmin-relevant athlete metrics visible while moving rarely changed Fueling & Recovery preference details behind an explicit disclosure.

**Architecture:** Frontend-only UI slice. `AthleteProfileCard` keeps the existing edit form and Garmin profile-sync behavior; only the read-only preference summary gets a compact collapsed state. Existing Playwright mocks and Settings tests provide the behavior contract.

**Tech Stack:** React, TypeScript, CSS, Playwright.

---

### Task 1: Add The Mobile Density Contract

**Files:**
- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [ ] **Step 1: Write the failing test**

Add a Settings mobile test that opens `/settings?section=profile`, scopes the `Athletenprofil` card, asserts the primary metric rows and Garmin automatic actions are visible, asserts detailed preference rows (`Produkte`, `Einschränkungen`, `Carbs`, `Sodium`, `Körpergewicht`) are not visible by default, then clicks `Fueling & Recovery anzeigen` and asserts those rows appear.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Settings keeps Fueling and Recovery preferences collapsed in profile read mode" --project=mobile-chromium
```

Expected: FAIL because the detailed preference rows are currently visible before any disclosure click.

### Task 2: Implement The Read-Only Disclosure

**Files:**
- Modify: `frontend/src/features/settings/profile/profile-components.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add component state**

Add `const [preferencesOpen, setPreferencesOpen] = useState(false);` inside `AthleteProfileCard`.

- [ ] **Step 2: Replace the read-only preference block**

Render a compact `Fueling & Recovery` header with the existing readiness pill and a button labeled `Fueling & Recovery anzeigen` / `Fueling & Recovery ausblenden`. Only render the detailed preference rows when `preferencesOpen` is true. Keep the edit form unchanged.

- [ ] **Step 3: Keep mobile spacing quiet**

Use existing `settings-profile-fueling-block` styles and add only the smallest necessary helper class if the button/header needs stable wrapping.

- [ ] **Step 4: Run the focused test**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Settings keeps Fueling and Recovery preferences collapsed in profile read mode" --project=mobile-chromium
```

Expected: PASS.

### Task 3: Verify Settings Regression Surface

**Files:**
- Modify: `docs/decisions.md`
- Create: `docs/qa/2026-05-13-settings-profile-preferences-disclosure.md`

- [ ] **Step 1: Run focused Settings tests**

Run:

```bash
npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Settings" --project=desktop-chromium --project=mobile-chromium
```

Expected: PASS.

- [ ] **Step 2: Run build and route evidence**

Run:

```bash
npm run build
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-settings-profile-preferences-disclosure-final npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-settings-profile-preferences-disclosure-final
git diff --check
```

Expected: build succeeds, route evidence has no horizontal overflow, diff check is clean.

- [ ] **Step 3: Record decision and QA evidence**

Add a newest-first decision explaining that secondary profile preferences are disclosed by default, then write a short QA note with commands and evidence paths.

- [ ] **Step 4: Commit, PR, merge and deploy**

Stage only touched files explicitly, commit, push, open PR, wait for/inspect checks, squash-merge to `main`, deploy with `scripts/deploy.sh`, verify server commit, then run live route evidence against `https://192.168.178.46:5175`.
