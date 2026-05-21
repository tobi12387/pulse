import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildIphonePwaGateAudit,
  renderIphonePwaFieldPacket,
  renderIphonePwaGateAudit,
} from './iphone-pwa-gate-audit.mjs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

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

test('iphone pwa gate audit identifies remaining real-device gaps', () => {
  const audit = buildIphonePwaGateAudit(CURRENT_FIELD_RECORD, { evidenceFile: 'field.md' });

  assert.equal(audit.gate, 'gated');
  assert.equal(audit.fieldChecklist, 'docs/ai/checklists/iphone-pwa-qa.md');
  assert.equal(audit.scope.serverCommit, '9e05189');
  assert.equal(audit.scope.pulseUrl, 'https://192.168.178.46:5175');
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
  assert.match(rendered, /Warning-free certificate trust: needs_followup/);
  assert.match(rendered, /Push activation and test push: partial/);
  assert.match(rendered, /Real iPhone VPN\/network offline fallback: pending/);
  assert.match(rendered, /Device and iOS metadata: missing/);
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

  const packet = renderIphonePwaFieldPacket(audit);
  assert.match(packet, /# iPhone \/ PWA Field Evidence Packet/);
  assert.match(packet, /Expected current commit: abc1234/);
  assert.match(packet, /Server commit under test: 9e05189/);
  assert.match(packet, /Server verify command: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server/);
  assert.match(packet, /Server recovery packet: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet/);
  assert.match(packet, /Server recovery runbook: docs\/ai\/checklists\/deploy-auth-recovery\.md/);
  assert.match(packet, /Open field gaps: 5/);
  assert.match(packet, /1\. Current main field evidence \(stale\)/);
  assert.match(packet, /2\. Warning-free certificate trust \(needs followup\)/);
  assert.match(packet, /Verify the server mirror before recording new current evidence: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server/);
  assert.match(packet, /If SSH fails before server Git\/PM2\/health checks, run the read-only recovery packet first: PULSE_EXPECTED_COMMIT=abc1234 npm run verify:server -- --packet/);
  assert.match(packet, /Follow docs\/ai\/checklists\/deploy-auth-recovery\.md before continuing the iPhone field run/);
  assert.match(packet, /Use a real iPhone over the VPN\/local network path/);
  assert.match(packet, /simulated WebKit or Chromium evidence does not close this gate/);
  assert.match(packet, /never transfer rootCA-key\.pem or any \*-key\.pem file/);
  assert.match(packet, /Record the run in field\.md, including Server commit under test: abc1234/);
  assert.match(packet, /Rerun after recording: npm run audit:iphone-pwa-gate -- --expected-commit abc1234/);
  assert.match(packet, /Evidence record scaffold:/);
  assert.match(packet, /- Device: <iPhone model>/);
  assert.match(packet, /- iOS version: <iOS version>/);
  assert.match(packet, /- Browser \/ launch mode: Safari, then Home Screen PWA launch/);
  assert.match(packet, /- Pulse URL: `https:\/\/192\.168\.178\.46:5175`/);
  assert.match(packet, /- Server commit under test: `abc1234`/);
  assert.match(packet, /\| Push support \| Permission and subscription state recorded when deliberately triggered \| <Pass\/Partial\/Pending\/Needs follow-up\/Fail\/Not applicable> \| <observed result> \|/);
  assert.match(packet, /\| Offline fallback \| Disconnecting VPN\/network shows local server\/VPN unavailable fallback \| <Pass\/Partial\/Pending\/Needs follow-up\/Fail\/Not applicable> \| <observed result> \|/);
});

test('iphone pwa gate audit opens when all manual gates match the expected commit', () => {
  const audit = buildIphonePwaGateAudit(COMPLETE_FIELD_RECORD, {
    evidenceFile: 'field.md',
    expectedCommit: 'abcdef0',
  });

  assert.equal(audit.gate, 'ready');
  assert.equal(audit.commitStatus, 'current');
  assert.deepEqual(audit.gaps, []);
  assert.match(renderIphonePwaGateAudit(audit), /Field commit status: current/);
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
