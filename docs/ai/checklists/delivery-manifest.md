# Delivery Manifest

Use this before opening a PR when scope, local gates, auto-merge eligibility or deploy need to be decided quickly.

## Command

```bash
npm run delivery:manifest
```

For examples, reviews or tests without relying on git state:

```bash
npm run delivery:manifest -- --files frontend/src/pages/Plan.tsx scripts/plan-weekly-decision-contract.test.ts
npm run delivery:manifest -- --format json
```

## What It Decides

- Scope: product package, mixed product, build-speed support, docs-only or runtime support.
- Track: `Tagesentscheidung`, `Trainingsanpassung`, `Lernschleifen` or none.
- Delivery lane: `Fast Lane` for one-track/docs/support changes without backend, shared-contract, dependency, migration, workflow, deploy or LLM attention risk; `Full Lane` when any of those risks is present.
- Local gates: the matching `npm run verify:<track>` command plus script, migration, build or smoke checks when touched files need them.
- CI attention: expected CI jobs from the same path logic used by the repo.
- Auto-merge: eligible only in `Fast Lane`; `Full Lane` PRs should wait for explicit CI/review attention.
- Deploy: required only for runtime app code or dependency changes; docs/tooling-only changes normally do not deploy.

## PR Body Fields

Copy the rendered fields into the PR body and then replace the outcome placeholder:

- `Track`
- `Delivery lane`
- `Package outcome`
- `Local checks`
- `Auto-merge`
- `Deploy`

If the manifest says `Full Lane`, `mixed_product` or `hold for review`, either split the PR or explain why the coupled package is intentional. Fast Lane PRs should be opened with auto-merge once the listed local checks are green; intervene only when CI goes red.
