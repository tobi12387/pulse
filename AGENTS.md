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

Before broad code exploration, read the compact AI working set and then expand only by task:

1. [`docs/ai/session-brief.md`](docs/ai/session-brief.md)
2. [`docs/ai/current-focus.md`](docs/ai/current-focus.md)
3. [`docs/ai/next-product-packages.md`](docs/ai/next-product-packages.md)
4. [`docs/ai/non-negotiables.md`](docs/ai/non-negotiables.md)
5. [`docs/ai/context-map.md`](docs/ai/context-map.md)

Do not re-read long histories by default. Use:

- `docs/ai/current-focus.md` for the current snapshot, not a PR archive.
- `docs/ai/next-product-packages.md` for the hard Performance-OS backlog order.
- `docs/ai/non-negotiables.md` for active constraints and product-quality rules.
- `docs/ai/context-map.md` to pick the smallest relevant files.
- `docs/decisions.md` only for recent, disputed, reversed or architectural context.

## Performance-OS build discipline

Default to weekly, package-shaped product work instead of isolated micro-slices. A good runtime PR should normally advance one package with 3-5 tightly related changes that share the same evidence and verification surface, for example Home completion learning, Plan weekly decision control, or Data analysis-to-action translation. Use a smaller micro-slice only for urgent fixes, regressions, CI/deploy repair, docs-only workflow updates, or when the package would otherwise mix unrelated ownership boundaries.

The hard Performance-OS backlog order lives in [`docs/ai/next-product-packages.md`](docs/ai/next-product-packages.md). Read that file every session and take the first unshipped package unless Tobi explicitly reprioritizes or a regression/CI/deploy repair takes precedence.

Every new product slice must name which track it serves. Work that does not serve one of these tracks is deferred unless Tobi explicitly reprioritizes it.

For `frontend/src/pulse/daily-decision.ts` and other Daily Decision contract logic, prefer fast unit/golden tests for signal priority, CTA target, safest option and goal impact before adding Playwright. Use Playwright for 1-2 rendered route/click-path smokes per package, not as the default proof for every signal branch.

Use the track-specific verification shortcuts as the default local gate for product packages. There are three levels:

- `npm run verify:tagesentscheidung`
- `npm run verify:trainingsanpassung`
- `npm run verify:lernschleifen`

- `npm run verify:<track>:fast` is the contract-only development loop.
- `npm run verify:<track>:pr` is the Fast Lane local PR gate: fast contracts plus frontend build, with rendered smoke coverage left to PR CI unless the slice specifically needs local browser proof.
- `npm run verify:<track>` is the Full Lane/release gate: contracts, frontend build and one focused desktop/mobile smoke set.

Use `npm run delivery:manifest` to choose the local gate from changed files. Fast Lane product PRs normally run the `:pr` gate locally, enable auto-merge, and let CI's `browser-tests` smoke be the rendered release proof. Full Lane PRs, high-risk UI changes, and slices where rendered behavior is the point should run the full matching command or explicitly explain any skipped browser proof.

Before opening a PR, run `npm run delivery:manifest` (or `npm run delivery:manifest -- --files <paths...>` while planning) to choose the track, delivery lane, local gates, expected CI attention, auto-merge eligibility and deploy requirement from the actual changed files. Use the rendered fields in the PR body instead of re-deriving this from chat history.

When adding or changing multiple Home decision signals, move toward a small data-driven signal registry/priority table instead of adding more one-off conditionals. Keep the implementation incremental, but do not knowingly deepen the bespoke signal maze when a local registry would make the next package safer.

When the manifest says `Fast Lane`, local checks are green and CI has no special review risk, prefer GitHub auto-merge instead of actively waiting in chat. `Full Lane` PRs wait for explicit CI/review attention. Inspect and fix failed checks. Deploy runtime changes only after the PR is merged to `main`; docs-only/planning-only PRs normally do not need server deploy.

## Project-level Codex skills

Pulse-specific Codex skills live in `.codex/skills/` and are part of this repo's working context:

- `pulse-session-ritual` — session start/end workflow and branch hygiene.
- `pulse-coding-discipline` — Pulse-adapted coding-agent discipline: explicit assumptions, simplest sufficient change, surgical diffs, and verifiable success criteria.
- `pulse-migration-guard` — additive-only Drizzle/Postgres migration checks.
- `pulse-pr-review` — Pulse-specific review risks and non-negotiables.
- `pulse-frontend-qa` — React/Vite route and responsive QA workflow.
- `pulse-deploy-readiness` — pre-merge, push and server deploy readiness.

Use these skills when their descriptions match the task before falling back to generic workflows.

## Codex operating discipline

For non-trivial coding, review, refactor, planning, or AI-workflow changes, apply the repo-local `pulse-coding-discipline` skill. The intended adaptation of the Karpathy-inspired agent guidelines is:

- **Think before editing:** surface assumptions, ambiguity, and tradeoffs before choosing an implementation path.
- **Simplicity within the package:** solve the selected Performance-OS package with the simplest coherent set of changes. Do not shrink shared-evidence work into repeated one-signal micro-slices, but also do not add speculative scope, configurability, integrations, or abstractions.
- **Surgical package changes:** touch only files needed for the chosen package, match existing style, and clean up only unused code created by your own change.
- **Goal-driven execution:** define concrete success criteria and verify them with the narrowest relevant checks before claiming completion.

These rules complement, but do not replace, the Pulse hard rules above. When they conflict, the hard rules and explicit user instructions win.

---

## Pre-session ritual (run every time before starting work)

When this Codex session runs on the server host where `/root/pulse` is also the
deploy mirror, keep `/root/pulse` on clean `main` and create the Codex branch in
an isolated worktree instead of switching the mirror itself:

```bash
cd /root/pulse
git fetch --all --prune
git status                            # MUST be clean on main
node scripts/codex-worktree.mjs <topic>
cd /tmp/pulse-codex-<topic>
```

Use the direct branch ritual only from a non-server development checkout where
switching branches cannot move the deployed mirror away from `main`:

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

Update `docs/ai/current-focus.md` only when the durable work queue, manual gates or next recommendation changes. Keep completed detail out of this file; use decisions, GitHub PRs, completed plans and `docs/ai/next-product-packages.md` instead.

---

## Conflict-prone files (rebase carefully when these change in parallel)

- `backend/src/db/migrations/*.sql` — number collisions are common. If your branch's `0013_*.sql` conflicts on rebase because main already has a `0013_*.sql`, **renumber yours** to the next free number.
- `backend/src/db/schema.ts`, `backend/src/db/pulse-schema.ts`
- `package.json` / `package-lock.json` (root, `backend/`, `frontend/`)
- `AGENTS.md` — additive-only sections preferred unless a prior workflow decision is explicitly reversed.

---

## Server / deploy

- Server is a **read-only mirror** of `origin/main`. Never `git commit` or `git checkout -b` on the server.
- Deploy after the relevant PR is merged to `main`. Preferred remote command: `ssh root@192.168.178.46 "cd /root/pulse && bash scripts/deploy.sh"`.
- If direct host auth fails but the configured alias works, use `ssh pulse-server "cd /root/pulse && bash scripts/deploy.sh"`.
- If Codex is already running on the Pulse server host, it may run `cd /root/pulse && bash scripts/deploy.sh` directly as a deploy operation. Do not edit, branch or commit in `/root/pulse`; the script refuses dirty trees and non-`main` branches.
- Backend: PM2 process `pulse`, runs `/root/pulse/backend/dist/server.js` on port 3000.
- Frontend dev server: PM2 process `pulse-frontend` (Vite), proxies `/api` → `http://localhost:3000`.
- DB: PostgreSQL on port 5433, database `coaching_os_v2`, connection `postgresql://postgres:postgres@localhost:5433/coaching_os_v2`.

---

## Plan-Doc-Status

`docs/superpowers/plans/` enthält aktuelle Orientierung, aktive Pläne und einzelne historische Roadmaps. Nutze `docs/ai/current-focus.md` und den passenden Roadmap-/Plan-Doc, um die aktuelle Reihenfolge zu bestimmen.

`docs/superpowers/plans/completed/` enthält **bereits implementierte** Pläne als historische Referenz. **Nicht erneut implementieren** — siehe `completed/README.md`.

## Canonical product constraints

- **No Telegram integration.** Web Push is the notification channel.
- **No Data Export** unless Tobi explicitly reverses this decision.
- Briefing and Coach context use Pulse schema data such as `pulse_daily_metrics` and `pulse_mental_checkins`, not legacy Garmin/check-in tables.

Active scope and product rules live in [`docs/ai/non-negotiables.md`](docs/ai/non-negotiables.md). Do not copy decision excerpts into this file; use [`docs/decisions.md`](docs/decisions.md) as the append-only decision history.
