# Settings Diagnostics Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use pulse-frontend-qa and superpowers:executing-plans. This plan extends the active mobile field work; do not duplicate the existing real-device checklist.

**Goal:** Make Settings the fastest place to understand whether Pulse is reachable, installable, push-ready and Garmin-ready on the current device.

**Architecture:** Keep Settings as route orchestration over feature components. Add a top-level diagnostics summary and URL-backed section navigation, then feed it from existing browser capability checks and Pulse backend health/status endpoints. Do not invent unavailable iOS detection; label manual/certificate limitations honestly.

**Tech Stack:** React/Vite, existing Settings feature components, browser service worker/push APIs, Pulse health/Garmin endpoints, Playwright E2E.

---

## Context

The real iPhone test confirmed that Pulse is reachable over VPN and can launch from the Home Screen, but Safari still shows a certificate warning unless the local certificate chain is trusted. Settings currently reports readiness, but the most relevant PWA/push/device state appears below profile and coach settings on iPhone.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/pages/Settings.tsx` | Add top-level diagnostics summary, anchors and section routing |
| Modify | `frontend/src/features/settings/push/push-components.tsx` | Clarify PWA, service worker, push support, permission and subscription states |
| Modify | `frontend/src/features/settings/profile/profile-components.tsx` | Keep profile actions secondary to device diagnostics on mobile |
| Modify | `frontend/src/pulse/*` | Add API wrapper only if a needed status endpoint already exists |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Add Settings diagnostics matrix states |
| Modify | `docs/ai/checklists/iphone-pwa-qa.md` | Keep manual evidence steps aligned |
| Modify | `docs/qa/2026-05-02-iphone-pwa-real-device.md` | Record follow-up evidence if tested |

## Task 1: Add Settings Section Routing

- [x] Support `?section=device|push|garmin|profile|coach|health|equipment`.
- [x] Scroll or focus the requested section after route load.
- [x] Add compact section shortcuts near the top on mobile.

## Task 2: Add A Device Access Summary

- [x] Show current URL/reachability context in plain language.
- [x] Show whether the app appears to run as browser tab or installed PWA.
- [x] Show service worker readiness.
- [x] Show push support, permission and subscription state as separate rows.
- [x] Show certificate trust as a manual/local-network note; do not claim automatic iOS trust detection.

## Task 3: Clarify Push States

- [x] Split ambiguous "not enabled" into explicit states: unsupported browser, denied permission, service worker unavailable, server config missing, ready but inactive, subscribed.
- [x] Keep the test-push action disabled or explanatory when prerequisites are missing.
- [x] Add a user-visible recovery path for denied permission or missing PWA mode.

## Task 4: Tie Garmin Readiness Into The Same Matrix

- [x] Add a Garmin row that links directly to coverage/backfill status.
- [x] Ensure stale/blocked provider state is summarized without duplicating the full Data page.
- [x] Link to `/data?tab=coverage` once URL-backed tabs exist.

## Verification

- [x] `npm run typecheck`
- [x] `npm run test:e2e -- --grep "Settings|PWA|Push|Garmin"`
- [x] Manual iPhone Settings pass after deployment if certificate/push states are changed.

## QA Evidence

- RED: new Settings diagnostics matrix E2E cases failed before implementation because no top-level matrix existed.
- GREEN: `npm run typecheck` passed.
- GREEN: `npm run test:e2e -- --grep "Settings diagnostics matrix"` passed with 4 tests.
- GREEN: `npm run test:e2e -- --grep "Settings|PWA|Push|Garmin"` passed with 32 tests.
- Real iPhone certificate trust remains a manual field gate; this slice labels it honestly instead of claiming automatic iOS trust detection.

## Acceptance

- On iPhone, device/PWA/push readiness is visible near the top of Settings.
- Support links can land directly on the relevant Settings section.
- Push readiness is specific enough to explain what the user can do next.
- Certificate limitations are honest and do not imply a browser capability Pulse cannot detect.
