# iPhone VPN & PWA Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulse should be usable from an iPhone over the local VPN with reliable layout, installable PWA metadata, predictable push/offline behavior and clear Settings diagnostics.

**Architecture:** The server remains local on `192.168.178.46`; no public hosting or cloud tunnel is introduced by this plan. Frontend changes are defensive and browser-oriented: safe-area support, dynamic viewport units, service-worker registration and diagnostics. Push activation remains a user action. If Build Web Apps becomes visible in Codex tools, use it as an extra PWA/mobile QA layer; Build iOS Apps is reserved for a later native-wrapper evaluation, not for this local web/PWA baseline.

**Tech Stack:** React/Vite, Web App Manifest, Service Worker, Playwright Chromium/WebKit, local HTTPS via Vite/PM2/Nginx.

---

## Context

The app is already reachable locally via `https://192.168.178.46:5175`. Vite is configured for LAN access and relative `/api` calls. The gaps are mostly iPhone-specific:

- TLS certificate coverage is local-IP oriented; VPN DNS names or alternate VPN IPs may show iOS certificate warnings.
- Layout uses fixed mobile top/bottom bars without `safe-area-inset-*`.
- Coach uses `height: calc(100vh - 8rem)`, which is brittle on iOS Safari/PWA with keyboard.
- Manifest and service worker exist, but the manifest is minimal and the service worker is only registered during push activation.
- E2E mobile coverage is Chromium/Pixel only, not WebKit/iPhone-style.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/index.css` | Safe-area variables, dynamic viewport utilities, app shell classes |
| Modify | `frontend/src/components/Layout.tsx` | Safe-area topbar/bottomnav and stable content padding |
| Modify | `frontend/src/pages/Coach.tsx` | iOS-safe chat height and input visibility |
| Modify | `frontend/src/main.tsx` | Register service worker at app start |
| Create | `frontend/src/lib/service-worker.ts` | Progressive service-worker registration helper |
| Modify | `frontend/public/sw.js` | Push plus install/activate/fetch baseline |
| Modify | `frontend/public/manifest.webmanifest` | PWA id/scope/categories/icon metadata |
| Modify | `frontend/index.html` | Apple touch metadata and viewport fit |
| Modify | `frontend/src/pages/Settings.tsx` | iPhone/VPN/PWA readiness diagnostics |
| Modify | `playwright.config.ts` | WebKit/iPhone-oriented project if available |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Safe-area/PWA/mobile smoke coverage |

## Task 1: Safe-Area Layout Baseline

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/pages/Coach.tsx`
- Test: `frontend/e2e/pulse-usability.spec.ts`

- [ ] **Step 1: Write failing mobile layout test**

Extend `Mobile navigation and tabs keep core labels readable` or add `iPhone layout keeps nav and coach input visible`. Use the mobile project and assert:

- bottom nav is within viewport;
- Settings link is visible;
- Coach textarea is visible after `/coach` load.

Run:

```bash
npm run test:e2e -- --grep "iPhone layout|Mobile navigation"
```

Expected before implementation: the new Coach/input safe-area assertion is fragile or fails on WebKit/iPhone project.

- [ ] **Step 2: Add CSS variables and classes**

Add root variables for:

- `--safe-top: env(safe-area-inset-top, 0px)`;
- `--safe-bottom: env(safe-area-inset-bottom, 0px)`;
- `--mobile-topbar-height: 44px`;
- `--mobile-bottomnav-height: 56px`.

Create `.pulse-app-shell`, `.pulse-mobile-topbar`, `.pulse-page-shell`, `.pulse-mobile-bottom-nav` and `.pulse-coach-shell` utilities.

- [ ] **Step 3: Use classes in Layout and Coach**

Replace `h-screen`/fixed heights with `100dvh` classes and safe-area-aware topbar/bottomnav. Coach uses `min-height: 0` flex behavior rather than `calc(100vh - 8rem)`.

- [ ] **Step 4: Verify and commit**

```bash
npm run typecheck
npm run test:e2e -- --grep "Mobile navigation|Coach"
git add frontend/src/index.css frontend/src/components/Layout.tsx frontend/src/pages/Coach.tsx frontend/e2e/pulse-usability.spec.ts
git commit -m "feat: prepare pulse layout for iphone safe areas"
```

## Task 2: PWA Install And Offline Baseline

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/public/sw.js`
- Modify: `frontend/public/manifest.webmanifest`
- Modify: `frontend/index.html`
- Test: `frontend/e2e/pulse-smoke.spec.ts`

- [ ] **Step 1: Add PWA smoke tests**

Test that:

- `/manifest.webmanifest` has `id`, `scope`, `start_url`, `display`, `theme_color`;
- `/sw.js` is reachable;
- app runtime does not throw when `serviceWorker.register` is unavailable.

- [ ] **Step 2: Register service worker at app start**

Create a tiny helper if needed, for example `frontend/src/lib/service-worker.ts`, or register in `main.tsx`:

- only in production-like browser contexts;
- no hard failure if service workers are unavailable;
- push subscription still remains behind Settings action.

- [ ] **Step 3: Add service-worker baseline**

`sw.js` should include:

- `install` with `skipWaiting`;
- `activate` with `clients.claim`;
- minimal navigation fallback that returns a short offline HTML response when a navigation request fails;
- existing push and notification click behavior unchanged.

- [ ] **Step 4: Enrich manifest and head**

Add `id`, `scope`, `orientation`, `categories`, `description`, `apple-mobile-web-app-status-bar-style`, `mobile-web-app-capable` and `viewport-fit=cover`. If PNG icons are added, keep them generated assets and list exact paths.

- [ ] **Step 5: Verify and commit**

```bash
npm run typecheck
npm run test:e2e -- --grep "manifest|service worker|renders"
git add frontend/src/main.tsx frontend/public/sw.js frontend/public/manifest.webmanifest frontend/index.html frontend/e2e/pulse-smoke.spec.ts
git commit -m "feat: add pulse pwa install baseline"
```

## Task 3: VPN And Device Diagnostics In Settings

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/e2e/pulse-usability.spec.ts`

- [ ] **Step 1: Add diagnostics copy and tests**

Settings should show a compact local access block:

- current origin host;
- HTTPS status;
- standalone/PWA display mode;
- push support;
- short iPhone/VPN note: local server stays on `192.168.178.46`; VPN must route that LAN address or a certificate-covered hostname.

- [ ] **Step 2: Keep it non-alarming**

This block is informational. It must not claim iPhone push support unless browser APIs confirm it. It must not ask for public hosting.

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck
npm run test:e2e -- --grep "Settings|iPhone|PWA"
git add frontend/src/pages/Settings.tsx frontend/e2e/pulse-usability.spec.ts
git commit -m "feat: show iphone vpn readiness in settings"
```

## Task 4: WebKit/iPhone QA Gate

**Files:**
- Modify: `playwright.config.ts`
- Modify: `frontend/e2e/pulse-smoke.spec.ts`
- Modify: `docs/ai/checklists/iphone-pwa-qa.md`

- [ ] **Step 1: Add optional WebKit project**

Add an `iphone-webkit` Playwright project using `devices['iPhone 15']` or closest installed device. If CI cannot support WebKit reliably, keep it opt-in via `PULSE_E2E_WEBKIT=true` and document manual command.

- [ ] **Step 2: Write checklist**

Create a manual QA checklist for real iPhone over VPN:

- open `https://192.168.178.46:5175`;
- login;
- add to Home Screen;
- verify Home, Coach, Plan, Settings;
- verify bottom nav, Coach keyboard, push support state;
- do not trigger Garmin calendar sync unless intentionally repairing workouts.

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck
npm run test:e2e -- --grep "renders|Mobile navigation"
git add playwright.config.ts frontend/e2e/pulse-smoke.spec.ts docs/ai/checklists/iphone-pwa-qa.md
git commit -m "test: add iphone pwa qa gate"
```

## Acceptance

- iPhone Safari/PWA layout avoids notch/home-indicator overlap.
- Coach input remains visible and usable with dynamic viewport changes.
- Manifest and service worker support install/offline baseline without forcing push subscription.
- Settings makes VPN/iPhone readiness understandable.
- The local server model remains unchanged: no public tunnel, no cloud deployment requirement.
