# Pulse Non-Negotiables

This is the compact working set for AI sessions. `docs/decisions.md` remains the full append-only history.

## Git / Deployment

- GitHub `main` is the single source of truth.
- Mac and server are consumers. Never edit code directly on the server.
- Every session uses a feature branch and PR.
- Codex branches use `codex/<topic>`.
- Never commit directly to `main`.
- Never use `git add .`; stage explicit files only.
- Push immediately after every meaningful commit.

## Architecture

- All LLM calls go through `backend/src/lib/llm.ts`.
- No secrets in code. Never commit `.env`.
- DB migrations are additive-only: no `DROP`, no `NOT NULL` without `DEFAULT`.
- Briefing and Coach context should use the Pulse schema and shared PulseContext, not legacy Garmin/check-in tables.
- Thresholds for Readiness, TSB, HRV, and RPE belong in shared contracts, not duplicated frontend/server heuristics.

## Product Scope

- No Telegram integration. Web Push is the planned notification channel.
- No Habit Tracker. Voice check-ins plus Risk Watch cover this need.
- No Data Export unless Tobi explicitly reverses this decision.
- Completed plans are historical references only. Do not rebuild them.

## Product Quality Bar

- Optimize for daily usefulness before feature breadth.
- Garmin, training, recovery and mental-health signals must visibly influence coaching, plans and explanations.
- Planned workouts should match current data and goals; do not fill every available day by default.
- Repeated generic recommendations are a product bug unless the data genuinely supports the same answer.
- iPhone/PWA over VPN is a real usage path, so mobile touch, readable density, offline/cert friction and Settings diagnostics matter.
- Error states should be local, recoverable and action-oriented instead of collapsing whole routes.
- UI/UX work starts from evidence: route screenshots, Playwright checks, real-device notes or explicit user friction.
- For current model, dependency, security or API recommendations, verify the latest official/current source before proposing changes.

## Current Product Gates

- UI/UX Deep Friction Closure is implemented and deployed; future UI/UX work should regenerate route evidence first.
- Use `docs/superpowers/plans/2026-05-02-future-direction-roadmap.md` as the orientation for new product direction.
- Fueling & Recovery remains preference-gated; ask Tobi before implementation.
- Native iOS remains evidence-gated; local web/PWA over VPN is the current path.
- iPhone certificate trust and Push activation are manual device gates.
- Future waves may have active plans in `docs/superpowers/plans/`; do not re-plan from scratch unless `docs/decisions.md` reverses ordering.
- Do not rebuild completed plans unless Tobi explicitly reverses scope.
