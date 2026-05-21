import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFuelingGateAudit,
  renderFuelingGateAudit,
  shiftIsoDate,
} from './fueling-gate-audit.mjs';

test('shiftIsoDate offsets an ISO date without local timezone drift', () => {
  assert.equal(shiftIsoDate('2026-05-21', -120), '2026-01-21');
});

test('fueling gate audit names existing long carb logs before new logs', () => {
  const audit = buildFuelingGateAudit([
    {
      userId: 'user-a',
      date: '2026-05-09',
      context: 'during',
      activityId: 'activity-long-ride',
      activityName: 'Datteln Graveln',
      activityType: 'bike',
      durationSec: 398 * 60,
      carbsG: 356,
      giComfort: null,
    },
    {
      userId: 'user-a',
      date: '2026-05-04',
      context: 'during',
      activityId: 'activity-z2-ride',
      activityName: 'Datteln - Radfahren - Z2',
      activityType: 'bike',
      durationSec: 80 * 60,
      carbsG: 30,
      giComfort: null,
    },
    {
      userId: 'user-a',
      date: '2026-05-02',
      context: 'during',
      activityId: 'activity-short',
      activityName: 'Kurz locker',
      activityType: 'bike',
      durationSec: 45 * 60,
      carbsG: 20,
      giComfort: 'ok',
    },
  ], { today: '2026-05-21' });

  assert.equal(audit.users.length, 1);
  assert.equal(audit.users[0].gate, 'gated');
  assert.equal(audit.users[0].comparableCompleteLogs, 0);
  assert.equal(audit.users[0].completableNow, 2);
  assert.equal(audit.users[0].newLogsStillNeeded, 1);
  assert.equal(audit.users[0].nextAction.kind, 'complete_gi_comfort');
  assert.equal(audit.users[0].nextAction.targetPath, '/plan/activity/activity-long-ride#activity-fueling-log');
  assert.deepEqual(audit.users[0].nextAction.options, [
    { value: 'ok', label: 'Magen ok' },
    { value: 'mild_issue', label: 'Magen leicht unruhig' },
    { value: 'issue', label: 'Magenprobleme' },
  ]);
  assert.equal(audit.users[0].completionCandidates[0].targetPath, '/plan/activity/activity-long-ride#activity-fueling-log');

  const rendered = renderFuelingGateAudit(audit);
  assert.match(rendered, /Comparable complete logs: 0\/3/);
  assert.match(rendered, /Existing logs completable now: 2/);
  assert.match(rendered, /New complete long-session logs still needed after completion candidates: 1/);
  assert.match(rendered, /Next action: GI-Komfort ergaenzen \(Add structured GI comfort \(ok, mild_issue, issue\) to an existing long carb log\.\)/);
  assert.match(rendered, /Next action path: \/plan\/activity\/activity-long-ride#activity-fueling-log/);
  assert.match(rendered, /Structured GI comfort values: ok=Magen ok, mild_issue=Magen leicht unruhig, issue=Magenprobleme/);
  assert.match(rendered, /Datteln Graveln/);
  assert.match(rendered, /356 g \(54 g\/h\)/);
  assert.match(rendered, /can count after GI comfort/);
  assert.match(rendered, /\/plan\/activity\/activity-z2-ride#activity-fueling-log/);
});

test('fueling gate audit opens after three comparable complete logs', () => {
  const audit = buildFuelingGateAudit([
    { userId: 'user-a', date: '2026-05-13', context: 'during', activityType: 'bike', durationSec: 130 * 60, carbsG: 125, giComfort: 'ok' },
    { userId: 'user-a', date: '2026-05-10', context: 'during', activityType: 'bike', durationSec: 115 * 60, carbsG: 105, giComfort: 'ok' },
    { userId: 'user-a', date: '2026-05-04', context: 'during', activityType: 'run', durationSec: 80 * 60, carbsG: 50, giComfort: 'mild_issue' },
  ], { today: '2026-05-21' });

  assert.equal(audit.users[0].gate, 'ready');
  assert.equal(audit.users[0].comparableCompleteLogs, 3);
  assert.equal(audit.users[0].nextAction, null);
  assert.match(renderFuelingGateAudit(audit), /trend summaries can be enabled/);
});
