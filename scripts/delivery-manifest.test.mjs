import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDeliveryManifest, parseArgs, renderDeliveryManifest } from './delivery-manifest.mjs';

test('delivery manifest maps Home decision changes to the Tagesentscheidung gate', () => {
  const manifest = buildDeliveryManifest([
    'frontend/src/pages/Home.tsx',
    'frontend/src/pulse/daily-decision.ts',
    'scripts/daily-decision-golden.test.ts',
  ]);

  assert.equal(manifest.scope, 'product_package');
  assert.equal(manifest.track, 'tagesentscheidung');
  assert.equal(manifest.trackLabel, 'Tagesentscheidung');
  assert.ok(manifest.localChecks.includes('npm run verify:tagesentscheidung:pr'));
  assert.equal(manifest.localChecks.includes('npm run verify:tagesentscheidung'), false);
  assert.equal(manifest.deployRequired, true);
  assert.equal(manifest.autoMergeEligible, true);
  assert.equal(manifest.deliveryLane, 'fast_lane');
});

test('delivery manifest maps Plan contract changes to the Trainingsanpassung gate', () => {
  const manifest = buildDeliveryManifest([
    'frontend/src/features/plan/weekly-decision-contract.ts',
    'scripts/plan-weekly-decision-contract.test.ts',
  ]);

  assert.equal(manifest.scope, 'product_package');
  assert.equal(manifest.track, 'trainingsanpassung');
  assert.ok(manifest.localChecks.includes('npm run verify:trainingsanpassung:pr'));
  assert.equal(manifest.localChecks.includes('npm run test:scripts'), false);
  assert.ok(manifest.ciJobs.includes('browser-tests'));
});

test('delivery manifest avoids full script suite when Fast Lane track gates cover changed script tests', () => {
  const manifest = buildDeliveryManifest([
    'frontend/src/pages/Home.tsx',
    'scripts/daily-decision-golden.test.ts',
    'scripts/daily-decision-signal-registry.test.ts',
  ]);

  assert.equal(manifest.deliveryLane, 'fast_lane');
  assert.ok(manifest.localChecks.includes('npm run verify:tagesentscheidung:pr'));
  assert.equal(manifest.localChecks.includes('npm run test:scripts'), false);
});

test('delivery manifest keeps full script suite for uncovered script changes', () => {
  const manifest = buildDeliveryManifest([
    'frontend/src/pages/Home.tsx',
    'scripts/new-home-support.test.ts',
  ]);

  assert.equal(manifest.deliveryLane, 'fast_lane');
  assert.ok(manifest.localChecks.includes('npm run verify:tagesentscheidung:pr'));
  assert.ok(manifest.localChecks.includes('npm run test:scripts'));
});

test('delivery manifest maps Data learning changes to the Lernschleifen gate', () => {
  const manifest = buildDeliveryManifest([
    'frontend/src/pages/Data.tsx',
    'frontend/src/pulse/learning-calibration.ts',
    'scripts/data-analysis-action-contracts.test.ts',
  ]);

  assert.equal(manifest.scope, 'product_package');
  assert.equal(manifest.track, 'lernschleifen');
  assert.ok(manifest.localChecks.includes('npm run verify:lernschleifen:pr'));
});

test('delivery manifest keeps docs-only changes out of deploy and product gates', () => {
  const manifest = buildDeliveryManifest([
    'docs/ai/current-focus.md',
    'docs/ai/next-product-packages.md',
  ]);

  assert.equal(manifest.scope, 'docs_only');
  assert.equal(manifest.track, null);
  assert.deepEqual(manifest.localChecks, ['git diff --check']);
  assert.equal(manifest.deployRequired, false);
  assert.equal(manifest.autoMergeEligible, true);
  assert.equal(manifest.deliveryLane, 'fast_lane');
});

test('delivery manifest marks workflow, migration and dependency changes as attention risks', () => {
  const manifest = buildDeliveryManifest([
    '.github/workflows/ci.yml',
    'package-lock.json',
    'backend/src/db/migrations/0014_example.sql',
  ]);

  assert.equal(manifest.autoMergeEligible, false);
  assert.equal(manifest.deliveryLane, 'full_lane');
  assert.ok(manifest.localChecks.includes('npm run test:scripts'));
  assert.ok(manifest.localChecks.includes('npm run check:migrations'));
  assert.ok(manifest.autoMergeNotes.some(note => /workflow/i.test(note)));
  assert.ok(manifest.autoMergeNotes.some(note => /dependency/i.test(note)));
  assert.ok(manifest.autoMergeNotes.some(note => /migration/i.test(note)));
});

test('delivery manifest treats package script support as CI attention without runtime deploy', () => {
  const manifest = buildDeliveryManifest([
    'package.json',
    'scripts/delivery-manifest.mjs',
    'docs/ai/checklists/delivery-manifest.md',
  ]);

  assert.equal(manifest.scope, 'build_speed_support');
  assert.equal(manifest.deployRequired, false);
  assert.equal(manifest.deliveryLane, 'full_lane');
  assert.ok(manifest.localChecks.includes('npm run test:scripts'));
  assert.ok(manifest.ciJobs.includes('build'));
  assert.ok(manifest.autoMergeNotes.some(note => /package manifest/i.test(note)));
});

test('delivery manifest requires deploy for frontend public runtime assets', () => {
  const manifest = buildDeliveryManifest([
    'frontend/public/sw.js',
    'frontend/e2e/pulse-smoke.spec.ts',
  ]);

  assert.equal(manifest.scope, 'runtime_support');
  assert.equal(manifest.deployRequired, true);
  assert.ok(manifest.localChecks.includes('npm run build -w frontend'));
  assert.ok(manifest.localChecks.includes('npm run test:e2e:smoke'));
});

test('delivery manifest does not expect backend service tests for script-only support changes', () => {
  const manifest = buildDeliveryManifest([
    'scripts/delivery-manifest.mjs',
    'scripts/delivery-manifest.test.mjs',
  ]);

  assert.equal(manifest.scope, 'build_speed_support');
  assert.ok(manifest.localChecks.includes('npm run test:scripts'));
  assert.ok(manifest.ciJobs.includes('build'));
  assert.equal(manifest.ciJobs.includes('backend-tests'), false);
  assert.equal(manifest.ciJobs.includes('browser-tests'), false);
});

test('delivery manifest holds mixed product tracks for explicit review', () => {
  const manifest = buildDeliveryManifest([
    'frontend/src/pages/Home.tsx',
    'frontend/src/pages/Plan.tsx',
  ]);

  assert.equal(manifest.scope, 'mixed_product');
  assert.deepEqual(manifest.productTracks, ['tagesentscheidung', 'trainingsanpassung']);
  assert.equal(manifest.autoMergeEligible, false);
  assert.equal(manifest.deliveryLane, 'full_lane');
  assert.ok(manifest.localChecks.includes('npm run verify:tagesentscheidung'));
  assert.ok(manifest.localChecks.includes('npm run verify:trainingsanpassung'));
});

test('delivery manifest keeps full track gates when a product PR has attention risk', () => {
  const manifest = buildDeliveryManifest([
    'frontend/src/pages/Plan.tsx',
    'package.json',
  ]);

  assert.equal(manifest.scope, 'product_package');
  assert.equal(manifest.track, 'trainingsanpassung');
  assert.equal(manifest.deliveryLane, 'full_lane');
  assert.equal(manifest.autoMergeEligible, false);
  assert.ok(manifest.localChecks.includes('npm run verify:trainingsanpassung'));
  assert.equal(manifest.localChecks.includes('npm run verify:trainingsanpassung:pr'), false);
  assert.ok(manifest.localChecks.includes('npm run test:scripts'));
});

test('delivery manifest sends backend runtime changes through the full lane', () => {
  const manifest = buildDeliveryManifest([
    'backend/src/pulse/plugin.ts',
    'frontend/src/pages/Data.tsx',
  ]);

  assert.equal(manifest.deliveryLane, 'full_lane');
  assert.equal(manifest.autoMergeEligible, false);
  assert.ok(manifest.autoMergeNotes.some(note => /backend runtime/i.test(note)));
});

test('delivery manifest renders PR-ready markdown fields', () => {
  const manifest = buildDeliveryManifest(['frontend/src/pages/Plan.tsx']);
  const markdown = renderDeliveryManifest(manifest);

  assert.match(markdown, /# Delivery Manifest/);
  assert.match(markdown, /Track: Trainingsanpassung/);
  assert.match(markdown, /Delivery lane: Fast Lane/);
  assert.match(markdown, /npm run verify:trainingsanpassung:pr/);
  assert.match(markdown, /Auto-merge/);
  assert.match(markdown, /Deploy/);
});

test('delivery manifest CLI args keep flags out of explicit file lists', () => {
  const args = parseArgs([
    'node',
    'scripts/delivery-manifest.mjs',
    '--files',
    'frontend/src/pages/Plan.tsx',
    'scripts/plan-weekly-decision-contract.test.ts',
    '--format',
    'json',
  ]);

  assert.deepEqual(args.files, [
    'frontend/src/pages/Plan.tsx',
    'scripts/plan-weekly-decision-contract.test.ts',
  ]);
  assert.equal(args.format, 'json');
});
