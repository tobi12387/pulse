# Pulse UI/UX Deep Friction Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for implementation slices with independent files, or superpowers:executing-plans for one slice at a time. Do not rebuild completed UX waves under `docs/superpowers/plans/completed/`.

**Goal:** Turn the current Pulse UI from a set of capable routes into one low-friction daily operating loop on desktop and iPhone/PWA.

**Architecture:** Keep the existing React/Vite/PWA architecture and local-server/VPN model. Prefer narrow, evidence-backed changes: mobile containment, daily-flow priority, URL-backed navigation, local error recovery, Settings diagnostics and design evidence refresh. Do not introduce native iOS, public hosting or new product domains as part of this roadmap.

**Tech Stack:** React 19, Vite, TanStack Query v5, Tailwind/CSS modules in `frontend/src/index.css`, Playwright E2E, Canva/Figma companion artifacts, GitHub PR workflow.

---

## Evidence Base

- Audit report: `docs/qa/2026-05-02-ui-ux-deep-audit.md`
- Real iPhone field evidence: `docs/qa/2026-05-02-iphone-pwa-real-device.md`
- Existing mobile field plan: `docs/superpowers/plans/2026-05-02-mobile-field-reliability-wave.md`
- Current orientation: `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`

## Product Principles

1. **Daily loop first.** Home, Coach and Plan should feel like one continuous decision flow.
2. **Evidence before redesign.** Every UI change should be grounded in a route screenshot, DOM audit, E2E gap, field note or user-reported friction.
3. **Mobile touch is a product requirement.** Pulse is only useful if Tobi can use it comfortably on iPhone over VPN.
4. **Settings is a support surface.** Device, PWA, push and Garmin diagnostics need to be reachable without deep scrolling.
5. **Visual companions stay current.** Canva/Figma are useful only when they reflect the deployed app and the current daily flows.

## Prioritized Work

| Rank | Wave | Why It Comes Here | Implementation Plan |
|---|---|---|---|
| 1 | Mobile Touch And Containment | It contains the only confirmed browser overflow and the most obvious repeated-use touch friction. | `2026-05-02-mobile-touch-and-containment-ux.md` |
| 2 | Daily Loop Route Priority | It addresses the core product promise: one useful daily decision across Home, Coach and Plan. | `2026-05-02-daily-loop-route-priority-ux.md` |
| 3 | Feedback Resilience | It prevents one failed query or mutation from making the whole app feel unreliable. | `2026-05-02-feedback-resilience-ux.md` |
| 4 | Settings Diagnostics Matrix | It turns current iPhone/PWA/certificate/push friction into a supportable Settings experience. | `2026-05-02-settings-diagnostics-matrix.md` |
| 5 | UX Evidence Toolchain Refresh | It keeps Canva, Figma/FigJam, screenshots and WebKit/PWA checks aligned with the deployed app. | `2026-05-02-ux-evidence-toolchain-refresh.md` |

## Non-Goals

- Do not rebuild completed UX waves.
- Do not introduce Telegram, data export or habit tracking.
- Do not start native iOS unless PWA field evidence later proves a concrete blocker.
- Do not move code onto the Ubuntu server directly; GitHub `main` remains the source of truth.
- Do not treat Canva/Figma as implementation sources unless the current app screenshots and state notes are refreshed first.

## Acceptance

- Each implementation slice has a deterministic Playwright or type/build verification path.
- Mobile route screenshots show no unintended horizontal overflow.
- Daily Home/Coach/Plan flow can be tested as one scenario.
- Settings can deep-link to the sections a user actually needs during support.
- Canva/Figma companion work is explicitly marked as current, stale or blocked by preview approval.
