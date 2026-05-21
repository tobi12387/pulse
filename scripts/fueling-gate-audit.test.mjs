import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFuelingGateAudit,
  exitCodeForFuelingCandidateUrls,
  exitCodeForFuelingNewLogChecklist,
  exitCodeForFuelingNextPrompt,
  fuelingCandidateUrls,
  fuelingNewLogChecklistUsers,
  fuelingNextPromptUser,
  parseArgs,
  renderFuelingCandidateUrls,
  renderFuelingEvidencePacket,
  renderFuelingGateAudit,
  renderFuelingNewLogChecklist,
  renderFuelingNextPrompt,
  shiftIsoDate,
} from './fueling-gate-audit.mjs';

function withPulseUrl(url, fn) {
  const previous = process.env.PULSE_URL;
  process.env.PULSE_URL = url;
  try {
    fn();
  } finally {
    if (previous === undefined) {
      delete process.env.PULSE_URL;
    } else {
      process.env.PULSE_URL = previous;
    }
  }
}

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
  assert.match(audit.users[0].nextAction.targetUrl, /^https?:\/\/[^/]+\/plan\/activity\/activity-long-ride#activity-fueling-log$/);
  assert.equal(audit.users[0].nextAction.evidenceChecklist, 'docs/ai/checklists/fueling-evidence-capture.md');
  assert.deepEqual(audit.users[0].nextAction.targetLog, {
    date: '2026-05-09',
    activityName: 'Datteln Graveln',
    activityType: 'bike',
    durationMin: 398,
    carbsG: 356,
    carbsPerHour: 54,
    targetPath: '/plan/activity/activity-long-ride#activity-fueling-log',
    targetUrl: audit.users[0].nextAction.targetUrl,
    summary: '2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h)',
  });
  assert.deepEqual(audit.users[0].nextAction.options, [
    { value: 'ok', label: 'Magen ok' },
    { value: 'mild_issue', label: 'Magen leicht unruhig' },
    { value: 'issue', label: 'Magenprobleme' },
  ]);
  assert.equal(audit.users[0].completionCandidates[0].targetPath, '/plan/activity/activity-long-ride#activity-fueling-log');
  assert.equal(audit.users[0].completionCandidates[0].targetUrl, audit.users[0].nextAction.targetUrl);
  assert.equal(audit.users[0].completionCandidates[0].summary, '2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs (54 g/h)');
  assert.deepEqual(fuelingCandidateUrls(audit), [
    audit.users[0].completionCandidates[0].targetUrl,
    audit.users[0].completionCandidates[1].targetUrl,
  ]);
  assert.equal(renderFuelingCandidateUrls(audit), [
    audit.users[0].completionCandidates[0].targetUrl,
    audit.users[0].completionCandidates[1].targetUrl,
  ].join('\n'));
  assert.equal(exitCodeForFuelingCandidateUrls(audit), 0);
  assert.deepEqual(fuelingNewLogChecklistUsers(audit), [audit.users[0]]);
  assert.equal(exitCodeForFuelingNewLogChecklist(audit), 0);
  assert.equal(fuelingNextPromptUser(audit), audit.users[0]);
  assert.equal(exitCodeForFuelingNextPrompt(audit), 0);

  const rendered = renderFuelingGateAudit(audit);
  assert.match(rendered, /Comparable complete logs: 0\/3/);
  assert.match(rendered, /Existing logs completable now: 2/);
  assert.match(rendered, /New complete long-session logs still needed after completion candidates: 1/);
  assert.match(rendered, /Next action: GI-Komfort ergaenzen \(Waehle die echte Magenreaktion am vorhandenen langen Carb-Log; nichts aus Notizen, Route, RPE, g\/h oder Ergebnis ableiten\.\)/);
  assert.match(rendered, /Evidence checklist: docs\/ai\/checklists\/fueling-evidence-capture\.md/);
  assert.match(rendered, /Next action target: 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\)/);
  assert.match(rendered, /Next action path: \/plan\/activity\/activity-long-ride#activity-fueling-log/);
  assert.match(rendered, /Next action URL: https?:\/\/[^\s]+\/plan\/activity\/activity-long-ride#activity-fueling-log/);
  assert.match(rendered, /Strukturierte GI-Komfort-Werte: ok=Magen ok, mild_issue=Magen leicht unruhig, issue=Magenprobleme/);
  assert.match(rendered, /Datteln Graveln/);
  assert.match(rendered, /356 g \(54 g\/h\)/);
  assert.match(rendered, /can count after GI comfort/);
  assert.match(rendered, /\/plan\/activity\/activity-z2-ride#activity-fueling-log/);

  const packet = renderFuelingEvidencePacket(audit);
  assert.match(packet, /# Fueling Evidence Packet/);
  assert.match(packet, /Next action: GI-Komfort ergaenzen - Waehle die echte Magenreaktion am vorhandenen langen Carb-Log; nichts aus Notizen, Route, RPE, g\/h oder Ergebnis ableiten\./);
  assert.match(packet, /Next target: 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\)/);
  assert.match(packet, /Next URL: https?:\/\/[^\s]+\/plan\/activity\/activity-long-ride#activity-fueling-log/);
  assert.match(packet, /Existing candidates to close first:/);
  assert.match(packet, /1\. 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\)/);
  assert.match(packet, /Path: \/plan\/activity\/activity-long-ride#activity-fueling-log/);
  assert.match(packet, /URL: https?:\/\/[^\s]+\/plan\/activity\/activity-long-ride#activity-fueling-log/);
  assert.match(packet, /2\. 2026-05-04 - Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs \(23 g\/h\)/);
  assert.match(packet, /Missing: GI comfort/);
  assert.match(packet, /GI comfort options: ok=Magen ok, mild_issue=Magen leicht unruhig, issue=Magenprobleme/);
  assert.match(packet, /Choose GI comfort only from the real stomach response/);
  assert.match(packet, /Rerun after each save: npm run audit:fueling-gate -- --today 2026-05-21/);
  assert.match(packet, /New complete long-session logs still needed: 1/);

  const checklist = renderFuelingNewLogChecklist(audit);
  assert.match(checklist, /# Fueling New Long-Session Log Checklist/);
  assert.match(checklist, /Needed after existing candidates: 1 complete long-session log/);
  assert.match(checklist, /Existing candidates to close first: 2/);
  assert.match(checklist, /1\. 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\)/);
  assert.match(checklist, /URL: https?:\/\/[^\s]+\/plan\/activity\/activity-long-ride#activity-fueling-log/);
  assert.match(checklist, /2\. 2026-05-04 - Datteln - Radfahren - Z2 - bike - 80 min - 30 g carbs \(23 g\/h\)/);
  assert.match(checklist, /Missing: GI comfort/);
  assert.match(checklist, /Activity\/date and duration context from the real long endurance session/);
  assert.match(checklist, /During-activity carbs with enough detail to compute g\/h/);
  assert.match(checklist, /Structured GI comfort from the real stomach response: ok=Magen ok, mild_issue=Magen leicht unruhig, issue=Magenprobleme\./);
  assert.match(checklist, /Infer GI comfort from notes, route, RPE, g\/h, result, pace or how the workout looks afterward/);
  assert.match(checklist, /Rerun after capture: npm run audit:fueling-gate -- --today 2026-05-21/);

  const nextPrompt = renderFuelingNextPrompt(audit);
  assert.match(nextPrompt, /# Fueling Next Evidence Prompt/);
  assert.match(nextPrompt, /Target: 2026-05-09 - Datteln Graveln - bike - 398 min - 356 g carbs \(54 g\/h\)/);
  assert.match(nextPrompt, /URL: https?:\/\/[^\s]+\/plan\/activity\/activity-long-ride#activity-fueling-log/);
  assert.match(nextPrompt, /Question: Welche echte Magenreaktion hattest du bei diesem vorhandenen langen Carb-Log\?/);
  assert.match(nextPrompt, /- ok = Magen ok/);
  assert.match(nextPrompt, /- mild_issue = Magen leicht unruhig/);
  assert.match(nextPrompt, /- issue = Magenprobleme/);
  assert.match(nextPrompt, /After saving this target, another existing completion candidate remains: 1/);
  assert.match(nextPrompt, /Do not infer it from notes, route, RPE, carbs per hour, result, pace or how the workout looks afterward/);
  assert.match(nextPrompt, /Rerun after save: npm run audit:fueling-gate -- --today 2026-05-21/);
});

test('fueling gate packet respects a configured Pulse URL', () => {
  withPulseUrl('https://pulse.local:5175/', () => {
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
    ], { today: '2026-05-21' });

    const packet = renderFuelingEvidencePacket(audit);
    assert.equal(
      audit.users[0].nextAction.targetUrl,
      'https://pulse.local:5175/plan/activity/activity-long-ride#activity-fueling-log',
    );
    assert.equal(
      audit.users[0].completionCandidates[0].targetUrl,
      'https://pulse.local:5175/plan/activity/activity-long-ride#activity-fueling-log',
    );
    assert.match(packet, /Next URL: https:\/\/pulse\.local:5175\/plan\/activity\/activity-long-ride#activity-fueling-log/);
    assert.match(packet, /URL: https:\/\/pulse\.local:5175\/plan\/activity\/activity-long-ride#activity-fueling-log/);
  });
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
  assert.deepEqual(fuelingCandidateUrls(audit), []);
  assert.equal(renderFuelingCandidateUrls(audit), '');
  assert.equal(exitCodeForFuelingCandidateUrls(audit), 1);
  assert.deepEqual(fuelingNewLogChecklistUsers(audit), []);
  assert.equal(exitCodeForFuelingNewLogChecklist(audit), 1);
  assert.equal(fuelingNextPromptUser(audit), null);
  assert.equal(exitCodeForFuelingNextPrompt(audit), 1);
  assert.match(renderFuelingNewLogChecklist(audit), /No new complete long-session log is currently needed/);
  assert.match(renderFuelingNextPrompt(audit), /Fueling evidence is ready; no manual next prompt is needed/);
  assert.match(renderFuelingGateAudit(audit), /trend summaries can be enabled/);
});

test('fueling gate audit CLI args accept handoff-only modes', () => {
  assert.deepEqual(parseArgs([
    'node',
    'scripts/fueling-gate-audit.mjs',
    '--today',
    '2026-05-21',
    '--next-prompt',
    '--candidate-urls',
    '--new-log-checklist',
  ]), {
    today: '2026-05-21',
    since: null,
    userId: null,
    databaseUrl: null,
    envFile: null,
    packet: false,
    nextPrompt: true,
    candidateUrls: true,
    newLogChecklist: true,
    json: false,
  });
});
