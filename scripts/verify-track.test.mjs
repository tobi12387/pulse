import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { TRACKS, normalizeTrackName } from './verify-track.mjs';

test('track verify configs cover all Performance-OS tracks with fast gates', () => {
  assert.deepEqual(Object.keys(TRACKS), ['tagesentscheidung', 'trainingsanpassung', 'lernschleifen']);

  assert.equal(normalizeTrackName('Tagesentscheidung'), 'tagesentscheidung');
  assert.equal(normalizeTrackName('Trainingsanpassung'), 'trainingsanpassung');
  assert.equal(normalizeTrackName('Lernschleifen'), 'lernschleifen');

  for (const [track, config] of Object.entries(TRACKS)) {
    assert.ok(config.description.length > 10, `${track} needs a useful description`);
    assert.equal(config.steps.length, 3, `${track} should stay fast: contract tests, frontend build, one smoke command`);
    assert.match(config.steps[0].label, /contract|golden/i);
    assert.equal(config.steps[1].command, 'npm');
    assert.deepEqual(config.steps[1].args, ['run', 'build', '-w', 'frontend']);
    assert.match(config.steps[2].label, /smoke/i);
    assert.ok(config.steps[2].args.includes('--project=desktop-chromium'));
    assert.ok(config.steps[2].args.includes('--project=mobile-chromium'));
  }

  assert.ok(TRACKS.tagesentscheidung.steps[0].args.includes('scripts/daily-decision-golden.test.ts'));
  assert.ok(TRACKS.tagesentscheidung.steps[0].args.includes('scripts/daily-decision-signal-registry.test.ts'));
  assert.match(TRACKS.tagesentscheidung.steps[2].args.join(' '), /Home/);

  assert.ok(TRACKS.trainingsanpassung.steps[0].args.includes('scripts/plan-weekly-decision-contract.test.ts'));
  assert.ok(TRACKS.trainingsanpassung.steps[0].args.includes('scripts/data-analysis-weekly-decision.test.ts'));
  assert.match(TRACKS.trainingsanpassung.steps[2].args.join(' '), /Plan/);

  assert.ok(TRACKS.lernschleifen.steps[0].args.includes('scripts/data-analysis-action-contracts.test.ts'));
  assert.match(TRACKS.lernschleifen.steps[2].args.join(' '), /Data analysis/);
});

test('track verify configs expose contract-only fast gates for development loops', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  for (const [track, config] of Object.entries(TRACKS)) {
    assert.equal(
      packageJson.scripts[`verify:${track}:fast`],
      `node scripts/verify-track.mjs ${track} --fast`,
      `${track} needs a package script for its contract-only development gate`,
    );

    const fastSteps = config.steps.filter(step => step.stage === 'fast');
    assert.equal(fastSteps.length, 1, `${track} should have exactly one fast step`);
    assert.match(fastSteps[0].label, /contract|golden/i);
    assert.equal(fastSteps[0].command, 'node');
    assert.deepEqual(fastSteps[0].args.slice(0, 3), ['--import', 'tsx', '--test']);
  }
});

test('track verify configs expose contract-plus-build PR gates before CI smokes', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  for (const [track, config] of Object.entries(TRACKS)) {
    assert.equal(
      packageJson.scripts[`verify:${track}:pr`],
      `node scripts/verify-track.mjs ${track} --pr`,
      `${track} needs a package script for its Fast Lane PR gate`,
    );

    const prSteps = config.steps.filter(step => step.stage === 'fast' || step.stage === 'pr');
    assert.equal(prSteps.length, 2, `${track} PR gate should stay to contracts plus frontend build`);
    assert.match(prSteps[0].label, /contract|golden/i);
    assert.equal(prSteps[0].command, 'node');
    assert.deepEqual(prSteps[0].args.slice(0, 3), ['--import', 'tsx', '--test']);
    assert.match(prSteps[1].label, /frontend build/i);
    assert.equal(prSteps[1].command, 'npm');
    assert.deepEqual(prSteps[1].args, ['run', 'build', '-w', 'frontend']);
    assert.equal(
      prSteps.some(step => /smoke/i.test(step.label)),
      false,
      `${track} PR gate should leave rendered smoke coverage to CI for Fast Lane PRs`,
    );
  }
});
