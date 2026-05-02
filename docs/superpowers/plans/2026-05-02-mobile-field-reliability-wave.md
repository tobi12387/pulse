# Mobile Field Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulse should be dependable on Tobi's iPhone over VPN: reachable, installable, readable, push-aware and easy to diagnose without changing the local-server model.

**Architecture:** Keep Pulse as a local web/PWA app served from `192.168.178.46` through VPN. Treat native iOS, public hosting and cloud tunnels as later evaluation gates, not current implementation. Add evidence capture and diagnostics before adding platform complexity.

**Tech Stack:** React/Vite PWA, Playwright Chromium/WebKit, PM2/Nginx local deploy, GitHub PR workflow.

---

## Context

The iPhone/PWA baseline is implemented: safe-area layout, app-start service worker registration, enriched manifest, Settings diagnostics, optional WebKit project and manual evidence record exist. The remaining work is field reliability: prove it on the real device, keep diagnostics current and make recurring server/browser failures visible before they become confusing UI failures.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `docs/qa/2026-05-02-iphone-pwa-real-device.md` | Record real iPhone/VPN/PWA evidence |
| Modify | `docs/ai/checklists/iphone-pwa-qa.md` | Keep the manual checklist aligned with the current app |
| Modify | `frontend/src/pages/Settings.tsx` | Improve local access diagnostics if real-device findings require it |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Preserve any issue found on iPhone as deterministic browser coverage |
| Modify | `scripts/verify-server.sh` | Add local checks only if deployment evidence is hard to gather repeatedly |
| Modify | `docs/ai/current-focus.md` | Keep current manual gates and next implementation wave visible |

## Task 1: Real iPhone Evidence Capture

- [x] **Step 1: Run the real-device checklist**

  On Tobi's iPhone, with VPN active:
  - open `https://192.168.178.46:5175`;
  - confirm certificate behavior;
  - if an auth gate appears, log in;
  - open Home, Coach, Plan, Insights, Settings;
  - add to Home Screen;
  - reopen from the Home Screen icon;
  - test Coach keyboard visibility;
  - open Settings and record PWA/push support state.

- [x] **Step 2: Fill the evidence record**

  Update `docs/qa/2026-05-02-iphone-pwa-real-device.md` with:
  - device model and iOS version if known;
  - VPN route result;
  - certificate result;
  - Add-to-Home-Screen result;
  - route results;
  - push support and actual enablement status;
  - exact frictions observed.

- [x] **Step 3: Commit evidence and checklist alignment**

  ```bash
  git add docs/qa/2026-05-02-iphone-pwa-real-device.md docs/ai/checklists/iphone-pwa-qa.md docs/superpowers/plans/2026-05-02-mobile-field-reliability-wave.md
  git commit -m "docs: record iphone pwa field evidence"
  ```

## Task 2: Diagnostics Follow-Up From Real Device

- [x] **Step 1: Convert each real-device friction into one deterministic check**

  2026-05-02 field result: no layout, keyboard, route or Settings-readiness issue surfaced that needs a deterministic browser regression test. The only real friction is local certificate trust on iOS, which is an operations/certificate-installation follow-up rather than a UI patch.

  If the iPhone exposes a layout or browser issue, add a Playwright test before changing UI. Examples:
  - bottom nav hidden behind home indicator -> mobile layout test;
  - Coach input hidden after focus -> Coach visibility test;
  - Settings misreports PWA mode -> diagnostics test.

- [ ] **Step 2: Patch the smallest UI/diagnostic surface**

  Keep fixes local:
  - `frontend/src/index.css` for safe-area or viewport issues;
  - `frontend/src/components/Layout.tsx` for shell layout;
  - `frontend/src/pages/Coach.tsx` for keyboard/input issues;
  - `frontend/src/pages/Settings.tsx` for diagnostics copy or capability detection.

- [ ] **Step 3: Verify and commit**

  ```bash
  npm run typecheck
  npm run test:e2e -- --grep "Mobile navigation|Coach|Settings|PWA"
  git add frontend/src/index.css frontend/src/components/Layout.tsx frontend/src/pages/Coach.tsx frontend/src/pages/Settings.tsx frontend/e2e/pulse-usability.spec.ts
  git commit -m "fix: harden iphone pwa diagnostics"
  ```

  Stage only files that actually changed.

## Task 3: Push Activation Field Check

- [ ] **Step 1: Check the actual device state**

  In Settings on the iPhone:
  - confirm whether Push is supported;
  - if supported, enable Push deliberately;
  - record browser/PWA mode and permission result;
  - do not claim iOS push works if the browser APIs do not confirm it.

- [ ] **Step 2: Add a visible failure reason when field evidence exposes ambiguity**

  If the Settings panel only says "not enabled" but the real reason is unsupported browser, denied permission or missing service worker readiness, split the label into:
  - `nicht unterstützt`;
  - `Berechtigung verweigert`;
  - `Service Worker nicht bereit`;
  - `bereit, aber nicht aktiviert`.

- [ ] **Step 3: Verify and commit**

  ```bash
  npm run typecheck
  npm run test:e2e -- --grep "Push|Settings"
  git add frontend/src/pages/Settings.tsx frontend/e2e/pulse-usability.spec.ts docs/qa/2026-05-02-iphone-pwa-real-device.md
  git commit -m "feat: clarify iphone push readiness"
  ```

## Task 4: Local Operations Runbook

- [x] **Step 1: Document the known-good local operating model**

  Update `docs/ai/checklists/iphone-pwa-qa.md` with a short operations section that records:
  - GitHub `main` is source of truth;
  - server `/root/pulse` is deploy mirror only;
  - frontend URL is `https://192.168.178.46:5175`;
  - backend health is `/api/pulse/health`;
  - PM2 processes are `pulse` and `pulse-frontend`;
  - Docker/Postgres/Redis limitations on the Mac must be called out when local DB tests cannot run.

- [x] **Step 2: Add a quick verification command section**

  Include commands for:
  - deployed health;
  - frontend HTTP status;
  - PM2 status;
  - E2E smoke.

- [x] **Step 3: Verify and commit**

  ```bash
  npm run typecheck
  git diff --check
  git add docs/ai/current-focus.md docs/qa/2026-05-02-iphone-pwa-real-device.md docs/ai/checklists/iphone-pwa-qa.md
  git commit -m "docs: clarify mobile field operations"
  ```

## Acceptance

- Real iPhone/VPN/PWA evidence is recorded in the repo.
- Any real-device issue becomes a deterministic regression check.
- Settings explains local access, PWA mode and push readiness without overstating capabilities.
- The local-server/VPN strategy remains intact; no public tunnel or native iOS app is introduced.
