import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('delivery intake renders a track package starting point with fast and release gates', async () => {
  assert.equal(existsSync(new URL('./delivery-intake.mjs', import.meta.url)), true);

  const { buildDeliveryIntake, renderDeliveryIntake } = await import('./delivery-intake.mjs');
  const intake = buildDeliveryIntake({
    track: 'plan',
    outcome: 'Plan makes weekly decisions easier to confirm on mobile.',
  });

  assert.equal(intake.track, 'trainingsanpassung');
  assert.equal(intake.trackLabel, 'Trainingsanpassung');
  assert.equal(intake.packageOutcome, 'Plan makes weekly decisions easier to confirm on mobile.');
  assert.equal(intake.developmentGate, 'npm run verify:trainingsanpassung:fast');
  assert.equal(intake.prGate, 'npm run verify:trainingsanpassung:pr');
  assert.equal(intake.releaseGate, 'npm run verify:trainingsanpassung');
  assert.equal(intake.deliveryManifest, 'npm run delivery:manifest');
  assert.ok(intake.packageShape.some(item => /3-5/.test(item)));
  assert.ok(intake.evidence.some(item => /route evidence/i.test(item)));

  const markdown = renderDeliveryIntake(intake);
  assert.match(markdown, /# Delivery Intake/);
  assert.match(markdown, /Trainingsanpassung \(trainingsanpassung\)/);
  assert.match(markdown, /# Delivery Intake\n\n- Track:/);
  assert.match(markdown, /## Package Shape\n-/);
  assert.match(markdown, /npm run verify:trainingsanpassung:fast/);
  assert.match(markdown, /npm run verify:trainingsanpassung:pr/);
  assert.match(markdown, /npm run verify:trainingsanpassung/);
  assert.match(markdown, /Package outcome/);
});

test('delivery intake CLI args require a track and preserve the outcome text', async () => {
  assert.equal(existsSync(new URL('./delivery-intake.mjs', import.meta.url)), true);

  const { parseArgs } = await import('./delivery-intake.mjs');
  const args = parseArgs([
    'node',
    'scripts/delivery-intake.mjs',
    '--track',
    'data',
    '--outcome',
    'Data explains whether learning evidence changes today or stays watch context.',
  ]);

  assert.equal(args.track, 'data');
  assert.equal(args.outcome, 'Data explains whether learning evidence changes today or stays watch context.');
});

test('delivery intake warns that nutrition trend packages remain evidence-gated', async () => {
  const { buildDeliveryIntake, renderDeliveryIntake } = await import('./delivery-intake.mjs');
  const intake = buildDeliveryIntake({
    track: 'lernschleifen',
    outcome: 'Nutrition trend summaries explain stable fueling learning.',
  });

  assert.equal(intake.track, 'lernschleifen');
  assert.equal(intake.gateReminders.length, 2);
  assert.match(intake.gateReminders[0], /audit:fueling-gate/);
  assert.match(intake.gateReminders[0], /3\/3 comparable complete/);
  assert.match(intake.gateReminders[1], /evidence capture/);

  const markdown = renderDeliveryIntake(intake);
  assert.match(markdown, /## Gate Reminders/);
  assert.match(markdown, /Fueling gate is closed/);
});

test('delivery intake warns that iPhone PWA reliability needs current real-device evidence', async () => {
  const { buildDeliveryIntake, renderDeliveryIntake } = await import('./delivery-intake.mjs');
  const intake = buildDeliveryIntake({
    track: 'tagesentscheidung',
    outcome: 'iPhone PWA field reliability fixes offline fallback.',
  });

  assert.equal(intake.gateReminders.length, 2);
  assert.match(intake.gateReminders[0], /audit:iphone-pwa-gate/);
  assert.match(intake.gateReminders[0], /current real-device evidence/);
  assert.match(intake.gateReminders[1], /does not close/);

  const markdown = renderDeliveryIntake(intake);
  assert.match(markdown, /Simulated WebKit or Chromium evidence/);
});

test('package scripts expose delivery intake as the standard package starter', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(packageJson.scripts['delivery:intake'], 'node scripts/delivery-intake.mjs');
});
