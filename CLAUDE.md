# CLAUDE.md — Pulse

**Pulse** is a personal health & performance coaching system for one user (Tobi).
React/TypeScript frontend (Vite), Fastify/TypeScript backend, PostgreSQL.
Focus: endurance sport (polarized training), mental health tracking, evidence-based coaching, weight management.
Single user, single instance, single Postgres DB — do not over-engineer.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 LTS (ESM), TypeScript 5 |
| Framework | Fastify 5 |
| ORM | Drizzle ORM 0.45+ |
| Database | PostgreSQL (port 5433, DB: coaching_os_v2) |
| LLM | OpenRouter → Claude (anthropic/claude-sonnet-4-5 by default) |
| Frontend | React 19 + Vite + TanStack Query v5 + Tailwind CSS |
| Deployment | PM2 on local server, process name: `pulse` |
| Password hashing | argon2 (argon2id) |

---

## Repository Layout

| Directory | Purpose |
|-----------|---------|
| `backend/src/routes/` | Fastify API route handlers |
| `backend/src/db/` | Drizzle schema + migrations (`schema.ts`, `pulse-schema.ts`) |
| `backend/src/lib/` | Shared utilities: env, llm, auth, garmin-client |
| `backend/src/jobs/` | Background jobs |
| `frontend/src/pages/` | React pages: Home, Coach, Data, Plan, Settings |
| `frontend/src/pulse/` | Pulse-specific hooks and API wrappers |
| `frontend/src/components/` | Shared UI components |

---

## Navigation (5 flat tabs)

| Route | Page | Icon |
|-------|------|------|
| `/` | Home (Readiness, metrics, briefing, activities) | ⚡ |
| `/coach` | Coach (Chat + Garmin context) | 💬 |
| `/data` | Daten (Schlaf tab, Mental/Check-in tab) | 📊 |
| `/plan` | Plan (Training, Ziele, Review tabs) | 📅 |
| `/settings` | Settings (Garmin sync, account) | ⚙️ |

---

## Infrastructure

- **PM2 process name:** `pulse`
- **Backend script:** `/root/pulse/backend/dist/server.js`
- **Env file:** `/root/pulse/.env`
- **Backend port:** 3000
- **Database:** PostgreSQL on port 5433, database `coaching_os_v2`
- **Vite dev server:** runs from `/root/pulse/frontend`, proxies `/api` → `http://localhost:3000`
- **Git remote:** `https://github.com/tobi12387/pulse.git`

---

## Plan-Docs & Codex

- **Aktive Pläne:** `docs/superpowers/plans/` — Reihenfolge in `docs/superpowers/plans/2026-04-28-roadmap.md`.
- **Implementierte Pläne (read-only Historie):** `docs/superpowers/plans/completed/` — niemals erneut implementieren.
- **Codex-System-Prompt:** `docs/codex-system-prompt.md` ist die Codex-spezifische Variante von CLAUDE.md + AGENTS.md, mit aktueller Roadmap-Reihenfolge und „nicht mehr diskutierten" Entscheidungen (Telegram raus, Habits raus, etc.).

---

## Absolute Rules (Non-Negotiable)

1. **Never `git add .`** — always stage files explicitly by name
2. **DB migrations are additive-only** — no DROP, no NOT NULL without DEFAULT
3. **All LLM calls via `backend/src/lib/llm.ts` only**
4. **No secrets in code** — never commit `.env` files
5. **Push to GitHub after every meaningful session**
6. **After every backend change:** `cd /root/pulse/backend && npm run build && pm2 restart pulse --update-env`
7. **GitHub `main` is the single source of truth.** Mac and server are consumers — never edit code directly on the server.
8. **Every coding session goes through a feature branch + PR.** No direct commits to `main` from any tool.

---

## Build & Deploy

```bash
# Backend build + restart
cd /root/pulse/backend && npm run build && pm2 restart pulse --update-env

# Frontend dev server (LAN accessible)
cd /root/pulse/frontend && npm run dev

# Database (postgres on port 5433)
# Connection: postgresql://postgres:postgres@localhost:5433/coaching_os_v2
```

---

## Git Conventions

- Commit format: `type: short description` (feat / fix / refactor / chore / docs)
- One commit per logical unit of work
- Push immediately after commit: `cd /root/pulse && git push`

---

## Parallel Workflow (Claude Code + OpenAI Codex)

This repo is touched by **two AI coding tools in parallel** (Claude Code + Codex) plus a deploy target on the server. To avoid drift and merge pain, every session — human or AI — follows the same rules.

### Branch namespaces

| Tool / actor | Branch prefix | Example |
|---|---|---|
| Claude Code | `claude/<topic>` | `claude/focused-pascal` |
| OpenAI Codex | `codex/<topic>` | `codex/garmin-retry` |
| Manual / Tobi | `tobi/<topic>` or direct PR | `tobi/ui-cleanup` |

- Never let two tools work on `main` simultaneously.
- Each session opens a PR. Merges happen via GitHub, not via local fast-forward.

### Pre-session ritual (run at the start of every session)

```bash
git fetch --all --prune
git status                 # MUST be clean before starting
git switch <my-branch>     # or: git switch -c <prefix>/<topic> origin/main
git pull --ff-only
```

If `git status` is not clean, stop and resolve before doing anything else — that dirty file is exactly the kind of drift that breaks parallel work (see `0012_*` incident, 2026-04).

### Post-session ritual

```bash
git status                 # confirm nothing untracked is being left behind
git add <explicit files>   # never `git add .`
git commit -m "type: ..."
git push
gh pr create               # if not already open
```

### Conflict-prone files (rebase carefully)

- `backend/src/db/migrations/*.sql` — number collisions are common; renumber on merge if needed.
- `backend/src/db/schema.ts`, `backend/src/db/pulse-schema.ts` — central, expect merges.
- `package.json` / `package-lock.json` (root, `backend/`, `frontend/`) — rebase on parallel dependency adds.
- `CLAUDE.md` — coordinate edits, prefer additive sections.

### Server is a read-only mirror

- Server (`root@192.168.178.46:/root/pulse`) only ever runs `git pull` from `origin/main`.
- **Never** `git commit` on the server. **Never** create branches on the server.
- Deploy with [scripts/deploy.sh](scripts/deploy.sh) — it refuses to run on a dirty tree or non-`main` branch.

### Deploy

```bash
ssh root@192.168.178.46 "cd /root/pulse && bash scripts/deploy.sh"
```
