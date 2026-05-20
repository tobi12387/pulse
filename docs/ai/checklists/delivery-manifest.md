# Delivery Manifest

Use this before opening a PR when scope, local gates, auto-merge eligibility or deploy need to be decided quickly.

Use `delivery:intake` at package start when the track and outcome are known but the PR shape is still being formed.

## Command

```bash
npm run delivery:manifest
```

Start a package with:

```bash
npm run delivery:intake -- --track trainingsanpassung --outcome "Plan makes weekly decisions easier to confirm"
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
- Local gates: Fast Lane product PRs use the matching `npm run verify:<track>:pr` gate; Full Lane product PRs use the full `npm run verify:<track>` gate. Script, migration, build or smoke checks are added when touched files need them. Covered track contract-test files do not add the full `npm run test:scripts` suite because the `:pr` gate already runs them.
- CI attention: expected CI jobs from the same path logic used by the repo. Script-only changes use the build/script-guard job and do not start backend service tests unless backend, shared, package, dependency or workflow files changed.
- Auto-merge: eligible only in `Fast Lane`; `Full Lane` PRs should wait for explicit CI/review attention.
- Deploy: required only for runtime app code or dependency changes; docs/tooling-only changes normally do not deploy.

## Development Vs PR Gates

- During implementation, use the contract-only fast gate first: `npm run verify:<track>:fast`.
- Before Fast Lane PRs, use the manifest-selected PR gate: `npm run verify:<track>:pr`. It runs contracts plus frontend build and leaves rendered smoke proof to CI.
- Before Full Lane PRs, high-risk UI work or slices where local browser behavior is the proof, use the full track gate from the manifest: `npm run verify:<track>`.
- Keep route evidence or Playwright evidence focused on the package behavior; full route evidence is for UI/UX packages or fresh friction discovery.

## PR Body Fields

Copy the rendered fields into the PR body and then replace the outcome placeholder:

- `Track`
- `Delivery lane`
- `Package outcome`
- `Local checks`
- `Auto-merge`
- `Deploy`

If the manifest says `Full Lane`, `mixed_product` or `hold for review`, either split the PR or explain why the coupled package is intentional. Fast Lane PRs should be opened with auto-merge once the listed local `:pr` checks are green; intervene only when CI goes red.
