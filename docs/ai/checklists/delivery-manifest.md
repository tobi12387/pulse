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
- Local gates: the matching `npm run verify:<track>` command plus script, migration, build or smoke checks when touched files need them.
- CI attention: expected CI jobs from the same path logic used by the repo.
- Auto-merge: eligible only when no workflow, dependency, migration, deploy, LLM or mixed-track risk is detected.
- Deploy: required only for runtime app code or dependency changes; docs/tooling-only changes normally do not deploy.

## PR Body Fields

Copy the rendered fields into the PR body and then replace the outcome placeholder:

- `Track`
- `Package outcome`
- `Local checks`
- `Auto-merge`
- `Deploy`

If the manifest says `mixed_product` or `hold for review`, either split the PR or explain why the coupled package is intentional.
