# Pulse AI Context Map

Use this map to load the smallest useful context for a task.

## Always Relevant

| Need | Read |
|---|---|
| Hard rules | `AGENTS.md`, `docs/ai/non-negotiables.md` |
| Current work | `docs/ai/current-focus.md` |
| File selection | this file, then `rg` |
| Roadmap / active plans | `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md`, then concrete plan |
| Decisions | `docs/decisions.md` newest entries only when needed |
| Concrete feature | Matching file in `docs/superpowers/plans/` |
| Coding discipline | `.codex/skills/pulse-coding-discipline/SKILL.md` for non-trivial coding, review, refactor, planning, or AI-workflow changes |
| Structure refactors | Fresh `rg --files` / file counts first; historical only: `docs/ai/project-structure-audit.md`, `docs/superpowers/plans/completed/2026-05-02-structure-boundary-cleanup.md` |
| UI/UX evidence | `docs/qa/route-evidence-pack.md`, then focused route/e2e files |
| Prompt template | `docs/codex-system-prompt.md` |
| Repo-local Codex skills | `.codex/skills/` |
| Docs/rule CI | `.github/workflows/docs-sync.yml` |

Do not read historical archives by default. Use `docs/superpowers/plans/completed/` only for regression comparison or when the user asks about history.

## Backend

| Need | Start With |
|---|---|
| Pulse routes | `backend/src/pulse/plugin.ts` |
| Pulse context | `backend/src/pulse/lib/pulse-context.ts` |
| Readiness | `backend/src/pulse/lib/pulse-context.ts`, `backend/src/pulse/services/load-engine.ts` |
| Load / CTL / ATL / TSB | `backend/src/pulse/services/load-engine.ts` |
| Thresholds | `shared/types/pulse-thresholds.ts` |
| LLM calls | `backend/src/lib/llm.ts` |
| Background jobs | `backend/src/jobs/` |
| DB schema | `backend/src/db/pulse-schema.ts`, `backend/src/db/schema.ts` |
| Migrations | `backend/src/db/migrations/` |

## Frontend

| Need | Start With |
|---|---|
| Pulse API wrapper | `frontend/src/pulse/api-client.ts` |
| Pulse hooks | `frontend/src/pulse/hooks.ts` |
| Home dashboard | `frontend/src/pages/Home.tsx` |
| Coach | `frontend/src/pages/Coach.tsx` |
| Data | `frontend/src/pages/Data.tsx` |
| Plan | `frontend/src/pages/Plan.tsx` |
| Settings | `frontend/src/pages/Settings.tsx` |
| Shared UI | `frontend/src/components/` |

## Docs / Planning

| Need | Start With |
|---|---|
| PR readiness | `docs/ai/checklists/pr-ready.md` |
| Backend change guard | `docs/ai/checklists/backend-change.md` |
| Frontend/mobile guard | `docs/ai/checklists/frontend-change.md` |
| iPhone/PWA QA | `docs/ai/checklists/iphone-pwa-qa.md` |
| Garmin sync boundaries | `docs/ai/garmin-sync-inventory.md` |
| Broad structure cleanup | Fresh `rg --files` / file counts; historical context in `docs/ai/project-structure-audit.md` |

## Search Patterns

- Find endpoint consumers: `rg "pulseApi\\.|usePulse|useReadiness|useFitnessLoad" frontend/src`
- Find cache invalidation points: `rg "invalidateUser|check-in|sync|health-state" backend/src`
- Find legacy table reads: `rg "garmin_daily_health|check_ins" backend/src`
- Find LLM calls: `rg "chatCompletion|OpenRouter|llm" backend/src`
- Find plan references: `rg "Phase|Bundle|Buendel|Risk|RPE|Push" docs/superpowers/plans`
