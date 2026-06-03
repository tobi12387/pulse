import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildIphonePwaGateAudit,
  exitCodeForIphonePwaNextPrompt,
  parseArgs,
  renderIphonePwaFieldScaffold,
  renderIphonePwaFieldPacket,
  renderIphonePwaGateAudit,
  renderIphonePwaNextPrompt,
} from './iphone-pwa-gate-audit.mjs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function withPulseHost(host, fn) {
  const previous = process.env.PULSE_HOST;
  process.env.PULSE_HOST = host;
  try {
    fn();
  } finally {
    if (previous === undefined) {
      delete process.env.PULSE_HOST;
    } else {
      process.env.PULSE_HOST = previous;
    }
  }
}

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

const CURRENT_FIELD_RECORD = `# Pulse iPhone / VPN / PWA Real-Device QA - 2026-05-02

## Scope

- Device:
- iOS version:
- Browser / launch mode: Safari, then Home Screen PWA launch
- VPN profile: Active; exact profile not recorded
- Pulse URL: \`https://192.168.178.46:5175\`
- Server commit under test: \`9e05189\`

## Results

| Area | Expected | Result | Notes |
|---|---|---|---|
| Network | URL opens via VPN on local origin | Pass | Reached local server. |
| Certificate | No unexpected warning for the address in use | Needs follow-up | Safari showed warning. |
| Login | Auth succeeds and stays on local origin | Not applicable | No login gate. |
| Settings readiness | iPhone/PWA block truthful | Pass | Ready block looked good. |
| Add to Home Screen | Pulse launches from Home Screen | Pass | Installed. |
| Standalone mode | Settings shows standalone | Pass | Confirmed. |
| Home | Daily action fits | Pass | OK. |
| Coach | Input remains usable | Pass | OK. |
| Plan | Bottom nav safe | Pass | OK. |
| Insights | States readable | Pass | OK. |
| Push support | Permission and subscription state recorded | Partial | Not intentionally triggered. |
| Offline fallback | VPN/network disconnect fallback | Pending | |

## Issues Found

| Severity | Route | Finding | Evidence | Follow-up |
|---|---|---|---|---|
| P2 | Safari / PWA entry | Certificate chain not trusted | Safari warning | Install root CA. |
`;

const COMPLETE_FIELD_RECORD = `# Pulse iPhone / VPN / PWA Real-Device QA - complete

## Scope

- Device: iPhone 15 Pro
- iOS version: 18.5
- Browser / launch mode: Safari, then Home Screen PWA launch
- VPN profile: Active
- Pulse URL: \`https://192.168.178.46:5175\`
- Server commit under test: \`abcdef0\`

## Results

| Area | Expected | Result | Notes |
|---|---|---|---|
| Network | URL opens via VPN on local origin | Pass | Reached local server. |
| Certificate | No unexpected warning for the address in use | Pass | Trusted root CA. |
| Login | Auth succeeds and stays on local origin | Not applicable | No login gate. |
| Settings readiness | iPhone/PWA block truthful | Pass | Ready block looked good. |
| Add to Home Screen | Pulse launches from Home Screen | Pass | Installed. |
| Standalone mode | Settings shows standalone | Pass | Confirmed. |
| Home | Daily action fits | Pass | OK. |
| Coach | Input remains usable | Pass | OK. |
| Plan | Bottom nav safe | Pass | OK. |
| Insights | States readable | Pass | OK. |
| Push support | Permission and subscription state recorded | Pass | Test push arrived. |
| Offline fallback | VPN/network disconnect fallback | Pass | Fallback explained local server/VPN unavailable. |

## Issues Found

| Severity | Route | Finding | Evidence | Follow-up |
|---|---|---|---|---|
`;

const APPENDED_FRESH_FIELD_RECORD = `${CURRENT_FIELD_RECORD}

# Pulse iPhone / VPN / PWA Real-Device QA - 2026-05-21

## Scope

- Device: iPhone 15 Pro
- iOS version: 18.5
- Browser / launch mode: Safari, then Home Screen PWA launch
- VPN profile: Active
- Pulse URL: \`https://192.168.178.46:5175\`
- Server commit under test: \`c80e463\`

## Results

| Area | Expected | Result | Notes |
|---|---|---|---|
| Network | URL opens via VPN on local origin | Pass | Reached current server. |
| Certificate | No unexpected warning for the address in use | Pass | Trusted root CA. |
| Login | Auth succeeds and stays on local origin | Not applicable | No login gate. |
| Settings readiness | iPhone/PWA block truthful | Pass | Ready block looked good. |
| Add to Home Screen | Pulse launches from Home Screen | Pass | Installed. |
| Standalone mode | Settings shows standalone | Pass | Confirmed. |
| Home | Daily action fits | Pass | OK. |
| Coach | Input remains usable | Pass | OK. |
| Plan | Bottom nav safe | Pass | OK. |
| Insights | States readable | Pass | OK. |
| Push support | Permission and subscription state recorded | Pass | Test push arrived. |
| Offline fallback | VPN/network disconnect fallback | Pass | Fallback explained local server/VPN unavailable. |

## Issues Found

| Severity | Route | Finding | Evidence | Follow-up |
|---|---|---|---|---|
`;

test('iphone pwa gate audit identifies remaining real-device gaps', () => {
  const audit = buildIphonePwaGateAudit(CURRENT_FIELD_RECORD, { evidenceFile: 'field.md' });

  assert.equal(audit.gate, 'gated');
  assert.equal(audit.fieldChecklist, 'docs/ai/checklists/iphone-pwa-qa.md');
  assert.equal(audit.scope.serverCommit, '9e05189');
  assert.equal(audit.scope.pulseUrl, 'https://192.168.178.46:5175');
  assert.equal(audit.pulseUrl, 'https://192.168.178.46:5175');
  assert.equal(audit.settingsFieldUrl, 'https://192.168.178.46:5175/settings?section=device');
  assert.deepEqual(audit.gaps.map(gap => gap.kind), [
    'certificate_trust',
    'push_activation',
    'offline_fallback',
    'device_metadata',
  ]);
  assert.equal(audit.nextAction, audit.gaps[0].nextAction);

  const rendered = renderIphonePwaGateAudit(audit);
  assert.match(rendered, /Gate: gated/);
  assert.match(rendered, /Field checklist: docs\/ai\/checklists\/iphone-pwa-qa\.md/);
  assert.match(rendered, /Settings field URL: https:\/\/192\.168\.178\.46:5175\/settings\?section=device/);
  assert.match(rendered, /Warning-free certificate trust: needs_followup/);
  assert.match(rendered, /Push activation and test push: partial/);
  assert.match(rendered, /Real iPhone VPN\/network offline fallback: pending/);
  assert.match(rendered, /Device and iOS metadata: missing/);
});

test('iphone pwa field handoff respects the configured Pulse URL', () => {
  withPulseUrl('https://pulse.local:5175/', () => {
    const audit = buildIphonePwaGateAudit(CURRENT_FIELD_RECORD, {
      evidenceFile: 'field.md',
      expectedCommit: 'abc1234',
    });

    assert.equal(audit.pulseUrl, 'https://pulse.local:5175/');
    assert.equal(audit.settingsFieldUrl, 'https://pulse.local:5175/settings?section=device');
    assert.match(
      renderIphonePwaFieldScaffold(audit),
      /Open Settings first: `https:\/\/pulse\.local:5175\/settings\?section=device`/,
    );
    assert.match(
      renderIphonePwaNextPrompt(audit),
      /Open Settings field proof: https:\/\/pulse\.local:5175\/settings\?section=device/,
    );
  });
});

test('iphone pwa gate audit gates stale field evidence against the expected commit', () => {
  const audit = buildIphonePwaGateAudit(CURRENT_FIELD_RECORD, {
    evidenceFile: 'field.md',
    expectedCommit: 'abc1234',
  });

  assert.equal(audit.gate, 'gated');
  assert.equal(audit.expectedCommit, 'abc1234');
  assert.equal(audit.commitStatus, 'stale');
  assert.equal(audit.serverVerifyCommand, 'PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server');
  assert.equal(audit.serverRecoveryPacketCommand, 'PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet');
  assert.equal(audit.settingsFieldUrl, 'https://192.168.178.46:5175/settings?section=device');
  assert.deepEqual(audit.gaps.map(gap => gap.kind), [
    'current_commit_evidence',
    'certificate_trust',
    'push_activation',
    'offline_fallback',
    'device_metadata',
  ]);
  assert.match(audit.gaps[0].detail, /Field record tested 9e05189, expected abc1234/);
  assert.match(audit.gaps[0].nextAction, /record Server commit under test: abc1234/);

  const rendered = renderIphonePwaGateAudit(audit);
  assert.match(rendered, /Expected current commit: abc1234/);
  assert.match(rendered, /Field commit status: stale/);
  assert.match(rendered, /Current main field evidence: stale/);

  const scaffold = renderIphonePwaFieldScaffold(audit);
  assert.match(scaffold, /^## Field Run Checklist/);
  assert.doesNotMatch(scaffold, /```/);
  assert.match(scaffold, /Verify server mirror first: `PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server`/);
  assert.match(scaffold, /If SSH fails before server checks: `PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet`/);
  assert.match(scaffold, /Use a real iPhone over the VPN\/local network path/);
  assert.match(scaffold, /Open Settings first: `https:\/\/192\.168\.178\.46:5175\/settings\?section=device`; record Device, iOS version, App-Stand, PWA mode, Push state and certificate state/);
  assert.match(scaffold, /Append this field run to field\.md/);
  assert.match(scaffold, /After recording, rerun: `npm run audit:iphone-pwa-gate -- --expected-commit abc1234`/);
  assert.match(scaffold, /Open field gaps to resolve:/);
  assert.match(scaffold, /1\. Current main field evidence \(stale\): Verify the server mirror is on abc1234, rerun the real iPhone checklist and record Server commit under test: abc1234\./);
  assert.match(scaffold, /2\. Warning-free certificate trust \(needs followup\): Install and trust only frontend\/certs\/rootCA\.pem on the iPhone/);
  assert.match(scaffold, /5\. Device and iOS metadata \(missing\): Record the iPhone model and iOS version/);
  assert.match(scaffold, /## Scope/);
  assert.match(scaffold, /- Device: <iPhone model>/);
  assert.match(scaffold, /- iOS version: <iOS version>/);
  assert.match(scaffold, /- Browser \/ launch mode: Safari, then Home Screen PWA launch/);
  assert.match(scaffold, /- Pulse URL: `https:\/\/192\.168\.178\.46:5175`/);
  assert.match(scaffold, /- Settings field URL: `https:\/\/192\.168\.178\.46:5175\/settings\?section=device`/);
  assert.match(scaffold, /- Server commit under test: `abc1234`/);
  assert.match(scaffold, /\| Push support \| Permission and subscription state recorded when deliberately triggered \| <Pass\/Partial\/Pending\/Needs follow-up\/Fail\/Not applicable> \| <observed result> \|/);
  assert.match(scaffold, /\| Offline fallback \| Disconnecting VPN\/network shows local server\/VPN unavailable fallback \| <Pass\/Partial\/Pending\/Needs follow-up\/Fail\/Not applicable> \| <observed result> \|/);

  assert.equal(exitCodeForIphonePwaNextPrompt(audit), 0);
  const nextPrompt = renderIphonePwaNextPrompt(audit);
  assert.match(nextPrompt, /# iPhone \/ PWA Next Field Prompt/);
  assert.match(nextPrompt, /Expected current commit: abc1234/);
  assert.match(nextPrompt, /Settings field URL: https:\/\/192\.168\.178\.46:5175\/settings\?section=device/);
  assert.match(nextPrompt, /First open gap: Current main field evidence \(stale\)/);
  assert.match(nextPrompt, /Next action: Verify the server mirror is on abc1234, rerun the real iPhone checklist and record Server commit under test: abc1234\./);
  assert.match(nextPrompt, /Recording target:/);
  assert.match(nextPrompt, /In the new Scope, set Server commit under test to abc1234\./);
  assert.match(nextPrompt, /Copy App runtime commit under test from the observed Settings App-Stand on the real iPhone\/PWA\./);
  assert.match(nextPrompt, /Treat previous Server commit 9e05189 as previous evidence, not as values for the new field run\./);
  assert.match(nextPrompt, /Verify server mirror first: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server/);
  assert.match(nextPrompt, /Open Settings field proof: https:\/\/192\.168\.178\.46:5175\/settings\?section=device/);
  assert.match(nextPrompt, /Full field scaffold: npm run audit:iphone-pwa-gate -- --expected-commit abc1234 --scaffold/);
  assert.match(nextPrompt, /Use a real iPhone over the VPN\/local network path/);
  assert.match(nextPrompt, /Never transfer rootCA-key\.pem or any \*-key\.pem file to the phone/);

  const packet = renderIphonePwaFieldPacket(audit);
  assert.match(packet, /# iPhone \/ PWA Field Evidence Packet/);
  assert.match(packet, /Expected current commit: abc1234/);
  assert.match(packet, /Settings field URL: https:\/\/192\.168\.178\.46:5175\/settings\?section=device/);
  assert.match(packet, /Server commit under test: 9e05189/);
  assert.match(packet, /Server verify command: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server/);
  assert.match(packet, /Server recovery packet: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet/);
  assert.match(packet, /Server recovery runbook: docs\/ai\/checklists\/deploy-auth-recovery\.md/);
  assert.match(packet, /Open field gaps: 5/);
  assert.match(packet, /1\. Current main field evidence \(stale\)/);
  assert.match(packet, /2\. Warning-free certificate trust \(needs followup\)/);
  assert.match(packet, /Verify the server mirror before recording new current evidence: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server/);
  assert.match(packet, /If this field run is intentionally pinned to a known deployed\/runtime commit, rerun this packet with `--expected-commit <short>` before recording evidence/);
  assert.match(packet, /If SSH fails before server Git\/PM2\/health checks, run the read-only recovery packet first: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet/);
  assert.match(packet, /Follow docs\/ai\/checklists\/deploy-auth-recovery\.md before continuing the iPhone field run/);
  assert.match(packet, /Use a real iPhone over the VPN\/local network path/);
  assert.match(packet, /simulated WebKit or Chromium evidence does not close this gate/);
  assert.match(packet, /Open Settings first: https:\/\/192\.168\.178\.46:5175\/settings\?section=device; record Device, iOS version, App-Stand, PWA mode, Push state and certificate state/);
  assert.match(packet, /never transfer rootCA-key\.pem or any \*-key\.pem file/);
  assert.match(packet, /Record the run in field\.md, including Server commit under test: abc1234/);
  assert.match(packet, /Rerun after recording: npm run audit:iphone-pwa-gate -- --expected-commit abc1234/);
  assert.match(packet, /Evidence record scaffold:/);
  assert.match(packet, /```markdown\n## Field Run Checklist/);
  assert.match(packet, /Open field gaps to resolve:/);
  assert.match(packet, /- Device: <iPhone model>/);
  assert.match(packet, /- iOS version: <iOS version>/);
  assert.match(packet, /- Browser \/ launch mode: Safari, then Home Screen PWA launch/);
  assert.match(packet, /- Pulse URL: `https:\/\/192\.168\.178\.46:5175`/);
  assert.match(packet, /- Settings field URL: `https:\/\/192\.168\.178\.46:5175\/settings\?section=device`/);
  assert.match(packet, /- Server commit under test: `abc1234`/);
  assert.match(packet, /\| Push support \| Permission and subscription state recorded when deliberately triggered \| <Pass\/Partial\/Pending\/Needs follow-up\/Fail\/Not applicable> \| <observed result> \|/);
  assert.match(packet, /\| Offline fallback \| Disconnecting VPN\/network shows local server\/VPN unavailable fallback \| <Pass\/Partial\/Pending\/Needs follow-up\/Fail\/Not applicable> \| <observed result> \|/);
});

test('iphone pwa field handoffs treat app runtime as observed Settings App-Stand', () => {
  const audit = buildIphonePwaGateAudit(CURRENT_FIELD_RECORD, {
    evidenceFile: 'field.md',
    expectedCommit: 'abc1234',
    expectedRuntimeCommit: 'runtime1',
    fieldRuntimeCommit: 'oldruntime',
  });

  assert.equal(audit.expectedRuntimeCommit, 'runtime1');
  assert.equal(audit.fieldRuntimeCommit, 'oldruntime');

  const scaffold = renderIphonePwaFieldScaffold(audit);
  assert.match(scaffold, /App-runtime comparison target: `runtime1`; record the observed Settings `App-Stand` in Scope\./);
  assert.match(scaffold, /Do not copy the comparison target into `App runtime commit under test` unless Settings shows that exact `App-Stand`\./);
  assert.match(scaffold, /- App runtime commit under test: <copy observed Settings App-Stand; comparison target runtime1>/);
  assert.doesNotMatch(scaffold, /- App runtime commit under test: `runtime1`/);

  const packet = renderIphonePwaFieldPacket(audit);
  assert.match(packet, /Expected app runtime commit: runtime1/);
  assert.match(packet, /Record the run in field\.md, including Server commit under test: abc1234 and observed Settings App-Stand as App runtime commit under test \(expected runtime1\)\./);

  const nextPrompt = renderIphonePwaNextPrompt(audit);
  assert.match(nextPrompt, /expected app runtime commit: runtime1/);
  assert.match(nextPrompt, /Expected app runtime commit runtime1 is only the comparison target; do not paste it unless Settings shows that exact App-Stand\./);
  assert.match(nextPrompt, /Treat previous Server commit 9e05189, previous Settings App-Stand oldruntime as previous evidence, not as values for the new field run\./);
  assert.match(nextPrompt, /Record the observed Settings App-Stand as App runtime commit under test/);
  assert.match(nextPrompt, /Record Device, iOS version, Server commit under test and observed Settings App-Stand as App runtime commit under test/);
});

test('iphone pwa gate audit rejects unreplaced App-Stand scaffold placeholders', () => {
  const fieldRecord = COMPLETE_FIELD_RECORD.replace(
    'Server commit under test: `abcdef0`',
    [
      'Server commit under test: `abcdef0`',
      'App runtime commit under test: <copy observed Settings App-Stand; comparison target runtime1>',
    ].join('\n- '),
  );
  const audit = buildIphonePwaGateAudit(fieldRecord, {
    evidenceFile: 'field.md',
    expectedCommit: 'abcdef0',
    expectedRuntimeCommit: 'runtime1',
  });

  assert.equal(audit.gate, 'gated');
  assert.equal(audit.commitStatus, 'current');
  assert.equal(audit.scope.appRuntimeCommit, '<copy observed Settings App-Stand; comparison target runtime1>');
  assert.equal(audit.fieldRuntimeCommit, null);
  assert.deepEqual(audit.gaps.map(gap => gap.kind), ['app_runtime_evidence']);
  assert.match(audit.gaps[0].detail, /still contains the App-Stand scaffold placeholder/);
  assert.match(audit.gaps[0].nextAction, /replace the placeholder with the observed App-Stand commit/);

  const rendered = renderIphonePwaGateAudit(audit);
  assert.match(rendered, /Observed Settings App-Stand: missing/);
  assert.doesNotMatch(rendered, /Field app runtime commit: <copy observed/);
});

test('iphone pwa gate audit rejects unreplaced device metadata placeholders', () => {
  const fieldRecord = COMPLETE_FIELD_RECORD
    .replace('Device: iPhone 15 Pro', 'Device: <iPhone model>')
    .replace('iOS version: 18.5', 'iOS version: <iOS version>');
  const audit = buildIphonePwaGateAudit(fieldRecord, {
    evidenceFile: 'field.md',
    expectedCommit: 'abcdef0',
  });

  assert.equal(audit.gate, 'gated');
  assert.equal(audit.commitStatus, 'current');
  assert.equal(audit.scope.device, '<iPhone model>');
  assert.equal(audit.scope.iosVersion, '<iOS version>');
  assert.deepEqual(audit.gaps.map(gap => gap.kind), ['device_metadata']);
  assert.match(audit.gaps[0].detail, /Missing metadata: Device, iOS version/);
  assert.match(audit.gaps[0].nextAction, /Record the iPhone model and iOS version/);

  const rendered = renderIphonePwaGateAudit(audit);
  assert.match(rendered, /Device: <iPhone model>/);
  assert.match(rendered, /iOS version: <iOS version>/);
  assert.match(rendered, /Device and iOS metadata: missing/);
});

test('iphone pwa gate audit evaluates the latest appended field run as one record', () => {
  const audit = buildIphonePwaGateAudit(APPENDED_FRESH_FIELD_RECORD, {
    evidenceFile: 'field.md',
    expectedCommit: 'c80e463',
  });

  assert.equal(audit.gate, 'ready');
  assert.equal(audit.commitStatus, 'current');
  assert.equal(audit.scope.serverCommit, 'c80e463');
  assert.equal(audit.scope.device, 'iPhone 15 Pro');
  assert.equal(audit.scope.iosVersion, '18.5');
  assert.deepEqual(audit.gaps, []);
  assert.equal(audit.results.find(result => result.area === 'Certificate')?.status, 'pass');
  assert.equal(audit.results.find(result => result.area === 'Push support')?.status, 'pass');
  assert.equal(audit.results.find(result => result.area === 'Offline fallback')?.status, 'pass');
});

test('iphone pwa gate audit accepts docs-only server drift when app runtime matches', () => {
  const fieldRecord = COMPLETE_FIELD_RECORD.replace(
    'Server commit under test: `abcdef0`',
    'Server commit under test: `docsold`',
  );
  const audit = buildIphonePwaGateAudit(fieldRecord, {
    evidenceFile: 'field.md',
    expectedCommit: 'docsnew',
    runtimeCommitFor: ref => ({
      docsold: 'runtime1',
      docsnew: 'runtime1',
    })[ref] ?? null,
  });

  assert.equal(audit.gate, 'ready');
  assert.equal(audit.commitStatus, 'current_runtime');
  assert.equal(audit.expectedRuntimeCommit, 'runtime1');
  assert.equal(audit.fieldRuntimeCommit, 'runtime1');
  assert.deepEqual(audit.gaps, []);

  const rendered = renderIphonePwaGateAudit(audit);
  assert.match(rendered, /Expected current commit: docsnew/);
  assert.match(rendered, /Expected app runtime commit: runtime1/);
  assert.match(rendered, /Field app runtime commit: runtime1/);
  assert.match(rendered, /Field commit status: current_runtime/);

  const packet = renderIphonePwaFieldPacket(audit);
  assert.match(packet, /Expected app runtime commit: runtime1/);
  assert.match(packet, /Field app runtime commit: runtime1/);
  assert.match(packet, /All manual iPhone\/PWA field gates are recorded as pass for the expected commit/);

  const scaffold = renderIphonePwaFieldScaffold(audit);
  assert.match(scaffold, /- App runtime commit under test: <copy observed Settings App-Stand; comparison target runtime1>/);

  const nextPrompt = renderIphonePwaNextPrompt(audit);
  assert.match(nextPrompt, /Expected app runtime commit: runtime1/);
  assert.match(nextPrompt, /Field app runtime commit: runtime1/);
});

test('iphone pwa gate audit reads an explicit field app runtime commit from Scope', () => {
  const fieldRecord = COMPLETE_FIELD_RECORD.replace(
    'Server commit under test: `abcdef0`',
    [
      'Server commit under test: `docsold`',
      'App runtime commit under test: `runtime1`',
    ].join('\n- '),
  );
  const audit = buildIphonePwaGateAudit(fieldRecord, {
    evidenceFile: 'field.md',
    expectedCommit: 'docsnew',
    expectedRuntimeCommit: 'runtime1',
  });

  assert.equal(audit.gate, 'ready');
  assert.equal(audit.commitStatus, 'current_runtime');
  assert.equal(audit.scope.serverCommit, 'docsold');
  assert.equal(audit.scope.appRuntimeCommit, 'runtime1');
  assert.equal(audit.expectedRuntimeCommit, 'runtime1');
  assert.equal(audit.fieldRuntimeCommit, 'runtime1');
  assert.deepEqual(audit.gaps, []);

  const rendered = renderIphonePwaGateAudit(audit);
  assert.match(rendered, /Expected app runtime commit: runtime1/);
  assert.match(rendered, /Field app runtime commit: runtime1/);
});

test('iphone pwa gate audit preserves configured server SSH host in handoff commands', () => {
  withPulseHost('pulse-server', () => {
    const audit = buildIphonePwaGateAudit(CURRENT_FIELD_RECORD, {
      evidenceFile: 'field.md',
      expectedCommit: 'abc1234',
    });

    assert.equal(audit.serverVerifyCommand, 'PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server');
    assert.equal(audit.serverRecoveryPacketCommand, 'PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet');

    const packet = renderIphonePwaFieldPacket(audit);
    assert.match(packet, /Server verify command: PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server/);
    assert.match(packet, /Server recovery packet: PULSE_HOST=pulse-server PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet/);
    assert.match(packet, /Rerun after recording: PULSE_HOST=pulse-server npm run audit:iphone-pwa-gate -- --expected-commit abc1234/);
  });
});

test('iphone pwa gate audit CLI args accept scaffold mode', () => {
  assert.deepEqual(parseArgs([
    'node',
    'scripts/iphone-pwa-gate-audit.mjs',
    '--expected-commit',
    'abc1234',
    '--scaffold',
  ]), {
    file: 'docs/qa/2026-05-02-iphone-pwa-real-device.md',
    expectedCommit: 'abc1234',
    packet: false,
    nextPrompt: false,
    scaffold: true,
    json: false,
  });
});

test('iphone pwa gate audit opens when all manual gates match the expected commit', () => {
  const audit = buildIphonePwaGateAudit(COMPLETE_FIELD_RECORD, {
    evidenceFile: 'field.md',
    expectedCommit: 'abcdef0',
  });

  assert.equal(audit.gate, 'ready');
  assert.equal(audit.commitStatus, 'current');
  assert.deepEqual(audit.gaps, []);
  assert.equal(exitCodeForIphonePwaNextPrompt(audit), 1);
  assert.match(renderIphonePwaGateAudit(audit), /Field commit status: current/);
  assert.match(renderIphonePwaNextPrompt(audit), /All manual iPhone\/PWA field gates are recorded as pass for the expected commit/);
  const packet = renderIphonePwaFieldPacket(audit);
  assert.match(packet, /All manual iPhone\/PWA field gates are recorded as pass for the expected commit/);
  assert.doesNotMatch(packet, /Evidence record scaffold:/);
});

test('iphone pwa gate audit opens when all manual gates are recorded', () => {
  const audit = buildIphonePwaGateAudit(COMPLETE_FIELD_RECORD, { evidenceFile: 'field.md' });

  assert.equal(audit.gate, 'ready');
  assert.equal(audit.fieldChecklist, 'docs/ai/checklists/iphone-pwa-qa.md');
  assert.deepEqual(audit.gaps, []);
  assert.equal(audit.nextAction, null);
  assert.match(renderIphonePwaGateAudit(audit), /All manual iPhone\/PWA field gates are recorded as pass/);
});

test('package exposes iphone pwa gate audit as the standard command', () => {
  assert.equal(packageJson.scripts['audit:iphone-pwa-gate'], 'node scripts/iphone-pwa-gate-audit.mjs');
});
