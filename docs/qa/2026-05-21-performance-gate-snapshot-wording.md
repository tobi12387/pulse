# 2026-05-21 - Performance Gate Snapshot Wording

## Trigger

After PR #600, `main` moved from the recorded gate snapshot commit `5477d49` to
`4a0c7bc`. The live audit on `4a0c7bc` still shows the same open gates, but
durable AI context that says "current commit is 5477d49" invites another
docs-only hash refresh.

## Current Evidence

Commands run on `4a0c7bc`:

```bash
npm run audit:performance-gates -- --today 2026-05-21
npm run audit:performance-next -- --today 2026-05-21
```

Result:

- Overall gate: `gated`, with 3 open gates.
- Expected server commit resolved live as `4a0c7bc`.
- Next unblock remains Fueling learning.
- Fueling remains 0/3 comparable complete logs with two existing GI-comfort
  candidates and one new complete long-session log still needed afterward.
- iPhone/PWA remains stale because the field record tested `9e05189`; the live
  audit now asks for current-commit field evidence against `4a0c7bc`.
- Server verify still fails at SSH preflight before Git/PM2/health checks.

## Change

- `docs/ai/current-focus.md` now treats
  `docs/qa/2026-05-21-current-gates-5477d49.md` as a recorded evidence
  snapshot and tells agents to rerun the live audit for the current expected
  commit.
- `docs/ai/next-product-packages.md` now says to use live audit output for the
  exact current hash instead of creating docs-only hash-refresh PRs.

## Conclusion

This does not open a product package or close any gate. It reduces future
handoff churn while preserving the strict evidence rule: live gate decisions
come from the audit commands, and historical QA notes keep their recorded
commit.
