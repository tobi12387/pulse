---
name: pulse-coding-discipline
description: Use when writing, refactoring, reviewing, or planning Pulse code or AI workflow changes where assumptions, scope, diff size, or verification criteria could affect quality.
---

# Pulse Coding Discipline

Use this skill as a Pulse-specific adaptation of the Karpathy-inspired coding-agent guidelines from `forrestchang/andrej-karpathy-skills`.

## Core Loop

1. Name assumptions before editing. If the request has multiple plausible meanings, ask or state the chosen interpretation and why it is the smallest safe one.
2. Choose the simplest change that satisfies the request. Do not add speculative configuration, abstractions, providers, routes, product scope, or recovery paths.
3. Keep the diff surgical. Touch only files needed for the request, match local style, and clean up only unused code created by your own change.
4. Turn the task into verifiable success criteria. For behavior changes, prefer a failing test or reproduction first; for docs/workflow changes, verify the affected instructions are discoverable and consistent.

## Pulse-Specific Guardrails

- Let `AGENTS.md`, `docs/ai/*`, `docs/decisions.md`, and the relevant `.codex/skills/*` files constrain the work before broad exploration.
- Do not widen product scope past current decisions: no Telegram integration, no Data Export, no server-side code edits, no direct provider SDK calls outside `backend/src/lib/llm.ts`.
- Do not use a large refactor to "make room" for a small product or workflow change.
- Do not repair unrelated old code, comments, formatting, or generated artifacts unless the user asked for that exact cleanup.
- When a simpler path conflicts with the user's implied ask, surface the tradeoff instead of silently building the larger version.

## Verification Prompts

Before calling work complete, check:

- Can every changed line be traced back to the user's request or required cleanup from that change?
- Did the change avoid new abstractions unless there are at least two real call sites or an established Pulse pattern?
- Did verification match the touched surface: focused test/build for runtime code, migration guard for DB changes, frontend QA for UI, and static consistency checks for docs/skills?
- Did any non-trivial architecture, scope, priority, or workflow decision get recorded in `docs/decisions.md`?
