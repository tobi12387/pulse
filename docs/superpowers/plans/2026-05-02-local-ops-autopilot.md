# Local Ops Autopilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single ops status path should quickly distinguish Mac-local service problems, server deploy state, frontend reachability and CI/test blockers.

**Architecture:** Extend the existing shell scripts instead of adding a new toolchain. Keep server access read-only except for the existing deploy script. Output should be explicit enough that agents stop treating missing Docker/Postgres/Redis as app regressions.

**Tech Stack:** Bash, npm scripts, Node test harness for scripts, SSH, curl, PM2.

---

## File Map

| Type | Path | Purpose |
|---|---|---|
| Create | `scripts/pulse-status.sh` | One status command with independent Mac/server sections |
| Modify | `scripts/verify-server.sh` | Keep server verification reusable by the status command |
| Modify | `scripts/verify-local.sh` | Print local service remediation before DB-bound tests |
| Modify | `scripts/dev-services.sh` | Keep Docker failure actionable and machine-readable enough for docs |
| Modify | `scripts/dev-services.test.mjs` | Script behavior tests |
| Modify | `package.json` | Add `pulse:status` command |
| Modify | `docs/ai/checklists/iphone-pwa-qa.md` | Reference the new command |
| Modify | `docs/ai/current-focus.md` | Keep local ops guidance visible |

## Task 1: Status Command Contract

- [ ] **Step 1: Write failing script tests**

  Extend `scripts/dev-services.test.mjs` or add `scripts/verify-server.test.mjs` to assert:
  - Docker missing message includes "Install/start Docker Desktop";
  - `verify-server.sh` documents backend health, frontend status, PM2 and commit checks;
  - a single npm script named `pulse:status` exists if added.

- [ ] **Step 2: Add independent status command**

  Create `scripts/pulse-status.sh` and add this package script:

  ```json
  "pulse:status": "bash scripts/pulse-status.sh"
  ```

  The script should run local Docker/Postgres/Redis status and server checks as independent sections so missing Docker does not hide server health.

- [ ] **Step 3: Verify script tests**

  Run:

  ```bash
  node --test scripts/dev-services.test.mjs
  npm run typecheck
  ```

## Task 2: Local Failure Clarity

- [ ] **Step 1: Improve `verify-local.sh` preflight output**

  Before DB connection checks, print:
  - which env file was loaded;
  - whether services are expected to be started;
  - what to run when Docker is missing.

- [ ] **Step 2: Keep DB-bound behavior strict**

  Do not skip migrations/tests silently. If services are unavailable, fail early with the exact command to run or the reason CI/server must be used.

- [ ] **Step 3: Verify local service path**

  Run:

  ```bash
  npm run services:status
  npm run verify:local:no-services
  ```

  If Docker/Postgres/Redis are unavailable on the Mac, capture the exact failure in the PR body rather than weakening the scripts.

## Task 3: Server Verification Discoverability

- [ ] **Step 1: Add docs references**

  Update `docs/ai/checklists/iphone-pwa-qa.md` and `docs/ai/current-focus.md` to point agents to the chosen one-command status path.

- [ ] **Step 2: Verify deployed status**

  Run:

  ```bash
  npm run pulse:status
  bash scripts/verify-server.sh
  ```

  Expected: server commit equals local HEAD, PM2 processes online, frontend 200, `/api/ping` ok and `/api/pulse/health` ok.

- [ ] **Step 3: Commit**

  Stage explicit files only and commit with:

  ```bash
  git commit -m "chore: clarify pulse ops status"
  ```

## Acceptance

- Agents can identify Mac service absence in the first five minutes.
- Server health and commit alignment can be checked with one documented command.
- CI/server checks stay authoritative for DB-bound tests when local services are down.
- No direct development on `/root/pulse` is introduced.
