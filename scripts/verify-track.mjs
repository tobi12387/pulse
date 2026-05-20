#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const E2E_PROJECTS = ['--project=desktop-chromium', '--project=mobile-chromium'];

export const TRACKS = {
  tagesentscheidung: {
    description: 'Home/Daily Decision package gate: fast decision contracts plus one rendered Home smoke set.',
    steps: [
      {
        label: 'Contract/golden tests',
        stage: 'fast',
        command: 'node',
        args: [
          '--import',
          'tsx',
          '--test',
          'scripts/daily-decision-golden.test.ts',
          'scripts/daily-decision-signal-registry.test.ts',
          'scripts/activity-closure-evidence.test.ts',
        ],
      },
      {
        label: 'Frontend build',
        stage: 'pr',
        command: 'npm',
        args: ['run', 'build', '-w', 'frontend'],
      },
      {
        label: 'Home smoke tests',
        stage: 'release',
        command: 'npm',
        args: [
          'run',
          'test:e2e',
          '--',
          'frontend/e2e/pulse-smoke.spec.ts',
          '-g',
          'daily training surfaces use localized activity labels|Home daily decision opens strong learning calibration from Data evidence|Home daily decision opens the body goal everyday tradeoff as one safe option|Home daily decision closes completed body goal everyday tradeoffs as learning evidence|mobile Home availability intent opens a workout scenario preview|mobile Home planned workout state shows the concrete plan option without availability intents',
          ...E2E_PROJECTS,
        ],
      },
    ],
  },
  trainingsanpassung: {
    description: 'Plan/adaptation package gate: weekly decision contracts plus one rendered Plan/Data handoff smoke set.',
    steps: [
      {
        label: 'Contract/golden tests',
        stage: 'fast',
        command: 'node',
        args: [
          '--import',
          'tsx',
          '--test',
          'scripts/plan-weekly-decision-contract.test.ts',
          'scripts/data-analysis-weekly-decision.test.ts',
          'scripts/plan-change-inbox.test.ts',
          'scripts/plan-workout-progression.test.ts',
          'scripts/weekly-coach-review.test.ts',
        ],
      },
      {
        label: 'Frontend build',
        stage: 'pr',
        command: 'npm',
        args: ['run', 'build', '-w', 'frontend'],
      },
      {
        label: 'Plan smoke tests',
        stage: 'release',
        command: 'npm',
        args: [
          'run',
          'test:e2e',
          '--',
          'frontend/e2e/pulse-smoke.spec.ts',
          '-g',
          'Plan starts with the current action contract|Plan weekly decision surfaces repeated tradeoffs without applying plan or Garmin|Plan weekly decision stores a local receipt without applying plan or Garmin|Plan exposes open change signals in one inbox before detailed evidence|Data analysis opens plan impact from plan limiter evidence',
          ...E2E_PROJECTS,
        ],
      },
    ],
  },
  lernschleifen: {
    description: 'Data/learning-loop package gate: analysis contracts plus one rendered Data learning smoke set.',
    steps: [
      {
        label: 'Contract/golden tests',
        stage: 'fast',
        command: 'node',
        args: [
          '--import',
          'tsx',
          '--test',
          'scripts/data-analysis-action-contracts.test.ts',
          'scripts/daily-decision-golden.test.ts',
        ],
      },
      {
        label: 'Frontend build',
        stage: 'pr',
        command: 'npm',
        args: ['run', 'build', '-w', 'frontend'],
      },
      {
        label: 'Data analysis smoke tests',
        stage: 'release',
        command: 'npm',
        args: [
          'run',
          'test:e2e',
          '--',
          'frontend/e2e/pulse-smoke.spec.ts',
          '-g',
          'Data analysis opens decision-quality evidence from the primary learning signal|Data analysis exposes fueling evidence as a concrete learning loop|Data analysis keeps learning calibration gated until comparable fueling evidence is complete|Data analysis opens personal response evidence from the primary response signal',
          ...E2E_PROJECTS,
        ],
      },
    ],
  },
};

const TRACK_ALIASES = {
  home: 'tagesentscheidung',
  today: 'tagesentscheidung',
  daily: 'tagesentscheidung',
  tagesentscheidung: 'tagesentscheidung',
  plan: 'trainingsanpassung',
  training: 'trainingsanpassung',
  trainingsanpassung: 'trainingsanpassung',
  data: 'lernschleifen',
  learning: 'lernschleifen',
  lernschleifen: 'lernschleifen',
};

export function normalizeTrackName(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return TRACK_ALIASES[key] ?? key;
}

function printableCommand(step) {
  return [step.command, ...step.args].join(' ');
}

function spawnStep(step) {
  return new Promise((resolve, reject) => {
    const command = process.platform === 'win32' && step.command === 'npm' ? 'npm.cmd' : step.command;
    const child = spawn(command, step.args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${step.label} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`));
    });
  });
}

export async function runTrack(trackName, options = {}) {
  const normalized = normalizeTrackName(trackName);
  const config = TRACKS[normalized];
  if (!config) {
    throw new Error(`Unknown track "${trackName}". Valid tracks: ${Object.keys(TRACKS).join(', ')}`);
  }

  const steps = options.fast
    ? config.steps.filter(step => step.stage === 'fast')
    : options.pr
      ? config.steps.filter(step => step.stage === 'fast' || step.stage === 'pr')
    : options.noE2e
      ? config.steps.filter(step => !/smoke/i.test(step.label))
      : config.steps;
  const suffix = options.fast ? ':fast' : options.pr ? ':pr' : '';
  console.log(`==> verify:${normalized}${suffix}`);
  console.log(`==> ${options.fast ? 'Contract-only development gate.' : options.pr ? 'Fast Lane PR gate: contracts plus frontend build; rendered smokes run in CI.' : config.description}`);
  for (const step of steps) {
    console.log(`\n==> ${step.label}`);
    console.log(`$ ${printableCommand(step)}`);
    await spawnStep(step);
  }
  console.log(`\n==> verify:${normalized}${suffix} done`);
}

function printUsage() {
  console.log('Usage: node scripts/verify-track.mjs <tagesentscheidung|trainingsanpassung|lernschleifen> [--fast|--pr|--no-e2e]');
  console.log('Aliases: home, today, daily, plan, training, data, learning');
}

async function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }
  if (args.includes('--list')) {
    for (const [track, config] of Object.entries(TRACKS)) {
      console.log(`${track}: ${config.description}`);
    }
    return;
  }
  const trackName = args.find(arg => !arg.startsWith('-'));
  if (!trackName) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  await runTrack(trackName, { fast: args.includes('--fast'), pr: args.includes('--pr'), noE2e: args.includes('--no-e2e') });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv).catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
