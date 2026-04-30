# AGENTS.md — Pulse

This file is read by **OpenAI Codex** (and any AGENTS.md-aware AI tool).
It is the active single source of truth for AI-agent workflow rules in this repo.

> **Codex-System-Prompt-Slot:** ein dünner Pointer-Prompt reicht — Codex liest diese AGENTS.md beim Session-Start automatisch. Vorlage zum Kopieren in [docs/codex-system-prompt.md](docs/codex-system-prompt.md). Hard Rules, Roadmap, Entscheidungen leben in diesem Repo (AGENTS.md, docs/decisions.md, docs/superpowers/plans/) — nicht im Prompt-Slot.

---

## Hard rules (must)

1. **Single source of truth = GitHub `main`.** The Mac repo and the server (`/root/pulse` on `192.168.178.46`) are consumers. Never edit code directly on the server.
2. **Every session = feature branch + PR.** No direct commits to `main` from any tool.
3. **Branch namespace for Codex: `codex/<topic>`.** Manual work uses `tobi/<topic>`. Do not work directly on `main`.
4. **Never `git add .`** — stage files explicitly by name.
5. **DB migrations are additive-only.** No `DROP`, no `NOT NULL` without `DEFAULT`. Filename pattern: `NNNN_description.sql` in `backend/src/db/migrations/`.
6. **All LLM calls go through `backend/src/lib/llm.ts`.** No direct provider SDK calls elsewhere.
7. **No secrets in code.** Never commit `.env`. The server `.env` lives at `/root/pulse/.env`.
8. **Push immediately after commit.**
9. **Persist non-trivial decisions in [`docs/decisions.md`](docs/decisions.md)** — every architecture, scope or priority call must be appended (newest first) before the session ends. Read this file before non-trivial work to know what is no longer up for debate.

---

## Token-efficient AI context

Before broad code exploration, read the compact AI working set:

1. [`docs/ai/session-brief.md`](docs/ai/session-brief.md)
2. [`docs/ai/current-focus.md`](docs/ai/current-focus.md)
3. [`docs/ai/non-negotiables.md`](docs/ai/non-negotiables.md)
4. [`docs/ai/context-map.md`](docs/ai/context-map.md)

Use `docs/decisions.md` as the full decision history, not as the first place to re-read every past decision.

## Project-level Codex skills

Pulse-specific Codex skills live in `.codex/skills/` and are part of this repo's working context:

- `pulse-session-ritual` — session start/end workflow and branch hygiene.
- `pulse-migration-guard` — additive-only Drizzle/Postgres migration checks.
- `pulse-pr-review` — Pulse-specific review risks and non-negotiables.
- `pulse-frontend-qa` — React/Vite route and responsive QA workflow.
- `pulse-deploy-readiness` — pre-merge, push and server deploy readiness.

Use these skills when their descriptions match the task before falling back to generic workflows.

---

## Pre-session ritual (run every time before starting work)

```bash
git fetch --all --prune
git status                            # MUST be clean — if not, stop and resolve
git switch -c codex/<topic> origin/main
```

If `git status` shows untracked files or modifications you did not make: investigate before starting. A previous Codex run or manual work may have left work behind. Do **not** `git stash` or `rm` blindly.

## Post-session ritual

```bash
git status                            # confirm nothing untracked is left behind
git add <explicit files>              # never `git add .`
git commit -m "type: ..."
git push -u origin codex/<topic>
gh pr create --base main --head codex/<topic> --title "..." --body "..."
```

Commit-message format: `type: short description` where type ∈ `feat | fix | refactor | chore | docs | test`.

---

## Conflict-prone files (rebase carefully when these change in parallel)

- `backend/src/db/migrations/*.sql` — number collisions are common. If your branch's `0013_*.sql` conflicts on rebase because main already has a `0013_*.sql`, **renumber yours** to the next free number.
- `backend/src/db/schema.ts`, `backend/src/db/pulse-schema.ts`
- `package.json` / `package-lock.json` (root, `backend/`, `frontend/`)
- `AGENTS.md` — additive-only sections preferred unless a prior workflow decision is explicitly reversed.

---

## Server / deploy

- Server is a **read-only mirror** of `origin/main`. Never `git commit` or `git checkout -b` on the server.
- Deploy: `ssh root@192.168.178.46 "cd /root/pulse && bash scripts/deploy.sh"`. The script refuses to run on a dirty tree or off `main`.
- Backend: PM2 process `pulse`, runs `/root/pulse/backend/dist/server.js` on port 3000.
- Frontend dev server: PM2 process `pulse-frontend` (Vite), proxies `/api` → `http://localhost:3000`.
- DB: PostgreSQL on port 5433, database `coaching_os_v2`, connection `postgresql://postgres:postgres@localhost:5433/coaching_os_v2`.

---

## Stack quick-reference

| Layer | Tech |
|---|---|
| Runtime | Node 22 LTS (ESM), TypeScript 5 |
| Backend | Fastify 5, Drizzle ORM 0.45+ |
| Frontend | React 19, Vite, TanStack Query v5, Tailwind |
| LLM | OpenRouter → `anthropic/claude-sonnet-4-5` (default) |
| Auth | argon2id |

---

## Repository layout

| Directory | Purpose |
|---|---|
| `backend/src/routes/` | Fastify API route handlers |
| `backend/src/db/` | Drizzle schema + migrations (`schema.ts`, `pulse-schema.ts`) |
| `backend/src/lib/` | Shared utilities: env, llm, auth, garmin-client |
| `backend/src/jobs/` | Background jobs |
| `frontend/src/pages/` | React pages: Home, Coach, Data, Plan, Insights, Settings |
| `frontend/src/pulse/` | Pulse-specific hooks and API wrappers |
| `frontend/src/components/` | Shared UI components |

---

## Navigation

| Route | Page |
|---|---|
| `/` | Home (Readiness, metrics, briefing, activities) |
| `/coach` | Coach (Chat + Garmin context) |
| `/data` | Daten (Schlaf tab, Mental/Check-in tab) |
| `/plan` | Plan (Training, Ziele, Review, Statistik tabs) |
| `/insights` | Insights (KI-Analyse, Trends, Narrativ) |
| `/settings` | Settings (Garmin sync, account) |

---

## Plan-Doc-Status

`docs/superpowers/plans/` enthält **aktive** Pläne — implementiere die in der durch `2026-04-28-roadmap.md` definierten Reihenfolge.

`docs/superpowers/plans/completed/` enthält **bereits implementierte** Pläne als historische Referenz. **Nicht erneut implementieren** — siehe `completed/README.md`.

---

## Non-negotiable decisions (excerpt from [`docs/decisions.md`](docs/decisions.md))

- **No Telegram integration.** Phase 12 was dropped 2026-04-29; Web Push (PWA) is the planned replacement.
- **No Habit-Tracker.** Phase 10 covers Strength + Equipment only. Habits are covered by voice check-in + Risk Watch.
- **Briefing job reads from `pulse_daily_metrics` and `pulse_mental_checkins`** (Pulse schema), never from the legacy `garmin_daily_health` / `check_ins` tables. Migration is part of Bündel A.
