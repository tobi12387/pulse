#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

import { normalizeTrackName } from './verify-track.mjs';

const TRACKS = {
  tagesentscheidung: {
    label: 'Tagesentscheidung',
    surface: 'Home/Daily Decision',
  },
  trainingsanpassung: {
    label: 'Trainingsanpassung',
    surface: 'Plan weekly decision',
  },
  lernschleifen: {
    label: 'Lernschleifen',
    surface: 'Data learning loop',
  },
};

function normalizeOutcome(value) {
  const outcome = String(value ?? '').trim();
  return outcome || '<one user-facing package outcome>';
}

export function buildDeliveryIntake(options = {}) {
  const track = normalizeTrackName(options.track);
  const config = TRACKS[track];
  if (!config) {
    throw new Error(`Unknown track "${options.track ?? ''}". Valid tracks: ${Object.keys(TRACKS).join(', ')}`);
  }

  return {
    track,
    trackLabel: config.label,
    packageOutcome: normalizeOutcome(options.outcome),
    surface: config.surface,
    developmentGate: `npm run verify:${track}:fast`,
    prGate: `npm run verify:${track}:pr`,
    releaseGate: `npm run verify:${track}`,
    deliveryManifest: 'npm run delivery:manifest',
    packageShape: [
      'Shape the PR as 3-5 tightly related changes with one user-facing outcome.',
      'Keep the first implementation loop on fast contract/golden tests.',
      'Use the PR gate before Fast Lane PRs; use the release gate when the manifest marks Full Lane or local smoke proof is needed.',
    ],
    evidence: [
      'Use explicit user friction or fresh route evidence for UI/UX work.',
      'Use Playwright only for the rendered route or click-path smoke that proves the package.',
      'Copy delivery manifest fields into the PR body before enabling auto-merge.',
    ],
  };
}

export function renderDeliveryIntake(intake) {
  const list = items => items.map(item => `- ${item}`).join('\n');

  return [
    '# Delivery Intake',
    '',
    `- Track: ${intake.trackLabel} (${intake.track})`,
    `- Surface: ${intake.surface}`,
    `- Package outcome: ${intake.packageOutcome}`,
    `- Development gate: \`${intake.developmentGate}\``,
    `- PR gate: \`${intake.prGate}\``,
    `- Release gate: \`${intake.releaseGate}\``,
    `- Delivery manifest: \`${intake.deliveryManifest}\``,
    '',
    '## Package Shape',
    list(intake.packageShape),
    '',
    '## Evidence',
    list(intake.evidence),
    '',
    '## PR Body Starter',
    `- Track: ${intake.trackLabel} (${intake.track})`,
    '- Delivery lane: copy from `npm run delivery:manifest`',
    `- Package outcome: ${intake.packageOutcome}`,
    `- Local checks: \`${intake.developmentGate}\`, \`${intake.prGate}\`, \`${intake.deliveryManifest}\``,
    '- Auto-merge: copy from `npm run delivery:manifest`',
    '- Deploy: copy from `npm run delivery:manifest`',
  ].join('\n');
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { track: null, outcome: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--track') {
      result.track = args[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--outcome') {
      result.outcome = args[index + 1] ?? null;
      index += 1;
    }
  }
  return result;
}

function printUsage() {
  console.log('Usage: node scripts/delivery-intake.mjs --track <tagesentscheidung|trainingsanpassung|lernschleifen> [--outcome "..."]');
  console.log('Aliases: home, today, daily, plan, training, data, learning');
}

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    return;
  }

  const args = parseArgs(argv);
  if (!args.track) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log(renderDeliveryIntake(buildDeliveryIntake(args)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
