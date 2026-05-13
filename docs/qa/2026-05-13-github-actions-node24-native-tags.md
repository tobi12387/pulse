# 2026-05-13 GitHub Actions Node 24 Native Tags

## Scope

- Branch: `codex/ci-upgrade-node24-actions`
- Surface: `.github/workflows/ci.yml`, `.github/workflows/docs-sync.yml`, `.github/workflows/migrations.yml`
- Goal: Replace the temporary Node 24 force opt-in with Node-24-native action tags so CI no longer depends on forcing Node-20 actions.

## Finding

PR #337 proved that Pulse workflows run under Node 24, but GitHub still emitted warnings because the workflow referenced actions whose current tags target Node 20. Official/current sources show:

- `actions/checkout@v6` is Node-24-based.
- `actions/setup-node@v6` is Node-24-based.
- `dorny/paths-filter@v4` is the Node-24 major release.
- GitHub's Node 20 deprecation notice recommends Node 24 testing before the June 2, 2026 default switch.

## What Changed

- Updated `actions/checkout@v4` to `actions/checkout@v6` in all workflows.
- Updated `actions/setup-node@v4` to `actions/setup-node@v6` in CI.
- Updated `dorny/paths-filter@v3` to `dorny/paths-filter@v4` in CI.
- Removed `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` because native Node 24 tags should no longer need it.
- Kept project build/test `node-version: 22`.

## Verification

- `ruby -e 'require "yaml"; Dir[".github/workflows/*.{yml,yaml}"].each { |f| YAML.load_file(f); puts f }'`
  - Passed locally.
- `git diff --check`
  - Passed locally.
- GitHub PR checks are the acceptance gate because runner warnings originate inside GitHub Actions.

## Sources

- GitHub `actions/checkout` README/release page
- GitHub `actions/setup-node` releases
- GitHub Marketplace `dorny/paths-filter`
- GitHub Changelog: Node 20 deprecation for Actions runners
