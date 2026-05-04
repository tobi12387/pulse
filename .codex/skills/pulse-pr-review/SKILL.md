---
name: pulse-pr-review
description: Use when reviewing Pulse changes, checking a branch before commit or PR, responding to review feedback, or looking for regressions in backend, frontend, AI, health data, or workflow changes.
---

# Pulse PR Review

Use a code-review posture: findings first, ordered by severity, with tight file and line references.

## Pulse-Specific Checks

- All LLM calls must go through `backend/src/lib/llm.ts`.
- No secrets, `.env`, tokens, or server-local credentials in code.
- No direct edits or assumptions about `/root/pulse` server state.
- DB migrations must pass `pulse-migration-guard`.
- Briefing and Coach context should use shared Pulse context and Pulse schema, not legacy `garmin_daily_health` or `check_ins`.
- Readiness, TSB, HRV, RPE, and related thresholds should live in shared contracts, not duplicated frontend/server heuristics.
- No Telegram or Habit Tracker work unless Tobi explicitly reverses prior decisions.
- No Data Export work unless Tobi explicitly reverses prior decisions.
- Daily-use recommendations must show how Garmin, training, recovery, plan, and mental signals influenced them when relevant.
- Repeated generic plans or coaching answers are product risks unless the underlying data genuinely did not change.
- iPhone/PWA over VPN is a real usage path; mobile density, touch targets, offline/cert/push diagnostics, and recoverable errors matter.
- For model, dependency, security, or external API guidance, verify current official sources before recommending changes.

## Review Flow

1. Inspect changed files:
   - `git diff --stat`
   - `git diff -- <specific paths>`
2. Search for risky patterns:
   - `rg "chatCompletion|OpenRouter|anthropic|openai|llm" backend/src`
   - `rg "garmin_daily_health|check_ins" backend/src`
   - `rg "DROP|NOT NULL|\\.env|process\\.env" backend/src frontend/src shared`
3. Compare frontend API expectations with backend response contracts.
4. Check tests for the behavior changed, not just snapshots or compile success.
5. Recommend focused follow-up only when it reduces real risk.

## Output

- If there are findings, lead with them.
- If there are no findings, say so and mention residual test gaps.
- Keep summaries secondary to actionable risks.
