# Backend Change Checklist

- Route contracts are explicit and typed.
- Shared coaching context comes from PulseContext where applicable.
- LLM calls go through `backend/src/lib/llm.ts`.
- Migrations are additive-only.
- Cache invalidation is considered for write paths.
- Tests cover new pure logic or risky route behavior.
- `npm run build` or the relevant backend test command was run.

