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

## Absolute Rules (Non-Negotiable)

1. **Never `git add .`** — always stage files explicitly by name
2. **DB migrations are additive-only** — no DROP, no NOT NULL without DEFAULT
3. **All LLM calls via `backend/src/lib/llm.ts` only**
4. **No secrets in code** — never commit `.env` files
5. **Push to GitHub after every meaningful session**
6. **After every backend change:** `cd /root/pulse/backend && npm run build && pm2 restart pulse --update-env`

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
