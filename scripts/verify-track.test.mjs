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
    assert.equal(fastSteps[0].command, './node_modules/.bin/tsx');
  }
});
