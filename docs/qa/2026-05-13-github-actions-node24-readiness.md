# 2026-05-13 GitHub Actions Node 24 Readiness

## Scope

- Branch: `codex/ci-node24-actions-readiness`
- Surface: `.github/workflows/ci.yml`, `.github/workflows/docs-sync.yml`, `.github/workflows/migrations.yml`
- Goal: Remove the recurring GitHub Actions Node 20 deprecation warning by testing the upcoming Node 24 action runtime before GitHub forces it.

## Finding

After PR #336 merged to `main`, GitHub Actions emitted warnings that `actions/checkout@v4`, `actions/setup-node@v4` and `dorny/paths-filter@v3` currently run on Node 20. GitHub's warning says Node 24 becomes the default on June 2, 2026 and Node 20 is removed on September 16, 2026.

## What Changed

- Added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` at workflow level for CI.
- Added the same opt-in for docs-sync and migrations workflows.
- Kept project build/test runtime at Node 22 so this PR only changes GitHub Action execution runtime.

## Verification

- `ruby -e 'require "yaml"; Dir[".github/workflows/*.{yml,yaml}"].each { |f| YAML.load_file(f); puts f }'`
  - Passed: all workflow YAML files parsed.
- `git diff --check`
  - Passed.
- GitHub PR checks proved the workflows run under Node 24, but GitHub still emitted warnings while Node-20-targeting action tags were forced to Node 24.

## Follow-Up

- The native action-tag upgrade is tracked in `docs/qa/2026-05-13-github-actions-node24-native-tags.md`.
