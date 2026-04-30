---
name: pulse-deploy-readiness
description: Use before merging, pushing, deploying, or asking whether Pulse is ready for production/server deployment, especially after backend, migration, job, or frontend changes.
---

# Pulse Deploy Readiness

Use this skill before merge or deploy decisions.

## Source Of Truth

- GitHub `main` is the only deploy source.
- The server is a read-only mirror at `/root/pulse`.
- Never commit, branch, or edit code directly on the server.
- Deploy only after the relevant PR is merged to `main`.

## Local Readiness

Check the touched surface:

- backend changes: backend tests/build
- frontend changes: frontend build/typecheck and browser QA when useful
- migrations: `pulse-migration-guard`
- LLM behavior: confirm calls route through `backend/src/lib/llm.ts`
- docs/tooling decisions: update `docs/decisions.md`

Also run:

- `git status --short --branch`
- inspect whether unrelated dirty files remain

## PR Readiness

Before pushing or opening a PR:

- stage explicit files only
- use commit format `type: short description`
- push immediately after commit
- include tests run and any skipped checks in the PR body

## Server Deploy

Deploy command:

```bash
ssh root@192.168.178.46 "cd /root/pulse && bash scripts/deploy.sh"
```

The script should refuse dirty trees and non-`main` branches. If deployment fails, inspect logs/status through the Pulse Ops workflow rather than editing server files.
