import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildIphonePwaGateAudit,
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
  assert.match(rendered, /Warning-free certificate trust: needs_followup/);
  assert.match(rendered, /Push activation and test push: partial/);
  assert.match(rendered, /Real iPhone VPN\/network offline fallback: pending/);
  assert.match(rendered, /Device and iOS metadata: missing/);
});

test('iphone pwa gate audit opens when all manual gates are recorded', () => {
  const audit = buildIphonePwaGateAudit(COMPLETE_FIELD_RECORD, { evidenceFile: 'field.md' });

  assert.equal(audit.gate, 'ready');
  assert.deepEqual(audit.gaps, []);
  assert.equal(audit.nextAction, null);
  assert.match(renderIphonePwaGateAudit(audit), /All manual iPhone\/PWA field gates are recorded as pass/);
});

test('package exposes iphone pwa gate audit as the standard command', () => {
  assert.equal(packageJson.scripts['audit:iphone-pwa-gate'], 'node scripts/iphone-pwa-gate-audit.mjs');
});
