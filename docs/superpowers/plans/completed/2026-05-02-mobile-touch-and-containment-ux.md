# Mobile Touch And Containment UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Start with the failing/weak evidence, then patch the smallest UI surfaces.

**Goal:** Remove confirmed mobile overflow and make repeated iPhone actions easier to hit without changing Pulse's quiet cockpit visual language.

**Architecture:** Add deterministic mobile layout checks, then fix the current route surfaces in place. Prefer responsive variants and shared control sizing over broad restyling. Desktop behavior must remain compatible.

**Tech Stack:** React/Vite, CSS in `frontend/src/index.css`, feature components under `frontend/src/features/`, Playwright E2E.

---

## Context

The 2026-05-02 audit found one confirmed horizontal overflow on iPhone: the Data `Domain-Abdeckung` table. It also found many small touch targets on mobile: route tabs, range buttons, Plan arrows, Settings actions and the Coach history clear action.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `frontend/src/features/data/coverage/coverage-components.tsx` | Replace or adapt the mobile coverage table so it does not overflow |
| Modify | `frontend/src/pages/Coach.tsx` | Make the history clear action touchable and safe |
| Modify | `frontend/src/pages/Plan.tsx` | Improve compact tab/actions/arrows where still route-local |
| Modify | `frontend/src/features/plan/training/training-components.tsx` | Make week/day and workout row actions accessible on touch |
| Modify | `frontend/src/features/settings/push/push-components.tsx` | Normalize push/PWA action sizes |
| Modify | `frontend/src/features/settings/profile/profile-components.tsx` | Normalize compact edit/open actions |
| Modify | `frontend/src/features/settings/health/health-components.tsx` | Normalize compact health-state controls |
| Modify | `frontend/src/index.css` | Add shared mobile touch/container helpers if needed |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Add mobile overflow and touch-target regression checks |

## Task 1: Lock The Current Mobile Failure

- [x] Add a Playwright helper that checks `document.documentElement.scrollWidth <= clientWidth + 1` for iPhone-sized routes.
- [x] Run it against `/`, `/coach`, `/data`, `/plan`, `/insights`, `/settings`.
- [x] Keep the `/data` failure visible before the table fix.

## Task 2: Replace The Mobile Coverage Table

- [x] Keep the desktop `Domain-Abdeckung` table for wide screens.
- [x] Add a mobile card/list layout that shows the same domains (`Metriken`, `Schlaf`, `Aktivitaet`, `Gewicht`) without `minWidth: 520`.
- [x] Preserve status, cause and action copy.
- [x] Confirm `/data` no longer has unintended horizontal overflow on iPhone width.

## Task 3: Normalize Mobile Touch Targets

- [x] Establish a route-level rule: primary mobile actions should be at least `40px` high; compact segmented controls should be visually compact but sit inside a reliable touch row.
- [x] Update Coach `Verlauf loeschen` from tiny text button to a real action target with clear destructive copy/state.
- [x] Update Data/Plan/Insights tab and range buttons so repeated tapping is comfortable.
- [x] Update Plan arrows and small per-row actions so they are button semantics with accessible names.
- [x] Update Settings edit/open/push actions and checkbox rows so the whole row or label is clickable where appropriate.

## Task 4: Verify

- [x] Run `npm run typecheck`.
- [x] Run `npm run test:e2e -- --grep "Mobile navigation|Data|Plan|Coach|Settings|Insights"`.
- [x] Capture iPhone screenshots for `/data`, `/plan`, `/settings` after the patch.
- [x] Record any remaining intentional horizontal scroll explicitly in the QA note; otherwise it should be zero.

## QA Evidence

- `npm run typecheck` passed on 2026-05-02.
- `npm run test:e2e -- --grep "Mobile navigation|Data|Plan|Coach|Settings|Insights"` passed with 75 passed and 1 skipped on 2026-05-02.
- iPhone screenshots were captured at `/private/tmp/pulse-mobile-touch-containment/data.png`, `/private/tmp/pulse-mobile-touch-containment/plan.png`, and `/private/tmp/pulse-mobile-touch-containment/settings.png`.
- No intentional horizontal scroll remains for the checked mobile routes.

## Acceptance

- `/data` has no unintended horizontal overflow at `390x844`.
- No high-frequency mobile action remains as a tiny text-only target.
- Existing E2E coverage remains green.
- The visual language stays compact and work-focused; this is not a redesign.
