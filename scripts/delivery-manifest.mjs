#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TRACKS = {
  tagesentscheidung: {
    label: 'Tagesentscheidung',
    gate: 'npm run verify:tagesentscheidung',
    patterns: [
      /^frontend\/src\/pages\/Home\.tsx$/,
      /^frontend\/src\/pulse\/daily-decision/,
      /^frontend\/src\/pulse\/daily-decision-signal-registry/,
      /^scripts\/daily-decision-/,
      /^scripts\/activity-closure-evidence\.test\.ts$/,
      /^frontend\/src\/pages\/ActivityDetail\.tsx$/,
      /^frontend\/src\/features\/activity\//,
    ],
  },
  trainingsanpassung: {
    label: 'Trainingsanpassung',
    gate: 'npm run verify:trainingsanpassung',
    patterns: [
      /^frontend\/src\/pages\/Plan\.tsx$/,
      /^frontend\/src\/features\/plan\//,
      /^scripts\/plan-/,
      /^scripts\/weekly-coach-review\.test\.ts$/,
      /^scripts\/data-analysis-weekly-decision\.test\.ts$/,
    ],
  },
  lernschleifen: {
    label: 'Lernschleifen',
    gate: 'npm run verify:lernschleifen',
    patterns: [
      /^frontend\/src\/pages\/Data\.tsx$/,
      /^frontend\/src\/pulse\/learning-calibration/,
      /^frontend\/src\/pulse\/fueling-learning/,
      /^frontend\/src\/features\/data\//,
      /^scripts\/data-analysis-action-contracts\.test\.ts$/,
      /^scripts\/resilience-guidance\.test\.ts$/,
    ],
  },
};

const AREA_PATTERNS = {
  workflow: [/^\.github\/workflows\//],
  docs: [/^docs\//, /^AGENTS\.md$/],
  scripts: [/^scripts\//],
  backend: [/^backend\//],
  frontend: [/^frontend\//, /^playwright\.config\.ts$/],
  shared: [/^shared\//],
  packageManifest: [/^package\.json$/, /^frontend\/package\.json$/, /^backend\/package\.json$/, /^shared\/package\.json$/],
  dependencies: [/^package-lock\.json$/, /^frontend\/package-lock\.json$/, /^backend\/package-lock\.json$/, /^shared\/package-lock\.json$/],
  migrations: [/^backend\/src\/db\/migrations\//, /^backend\/drizzle\.config\.ts$/],
  deployOps: [/^scripts\/deploy\.sh$/, /^scripts\/verify-server\.sh$/, /^scripts\/pulse-status\.sh$/, /^ecosystem\.config/],
  llm: [/^backend\/src\/lib\/llm\.ts$/, /^backend\/src\/.*llm/i],
};

function normalizePath(file) {
  return String(file ?? '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\.\//, '');
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function matchesAny(file, patterns) {
  return patterns.some(pattern => pattern.test(file));
}

function changedFilesFromGit(baseRef = 'origin/main') {
  const commands = [
    ['diff', '--name-only', '--diff-filter=ACMRTD', `${baseRef}...HEAD`],
    ['diff', '--name-only', '--diff-filter=ACMRTD'],
    ['diff', '--cached', '--name-only', '--diff-filter=ACMRTD'],
    ['ls-files', '--others', '--exclude-standard'],
  ];
  const files = [];
  for (const args of commands) {
    try {
      const output = execFileSync('git', args, { encoding: 'utf8' });
      files.push(...output.split('\n'));
    } catch {
      // A branch may not have the requested base yet; the CLI still supports --files.
    }
  }
  return unique(files.map(normalizePath).filter(Boolean)).sort();
}

function hasArea(file, area) {
  return matchesAny(file, AREA_PATTERNS[area] ?? []);
}

function trackMatchesForFile(file) {
  return Object.entries(TRACKS)
    .filter(([, config]) => matchesAny(file, config.patterns))
    .map(([track]) => track);
}

export function buildDeliveryManifest(files, options = {}) {
  const changedFiles = unique(files.map(normalizePath).filter(Boolean)).sort();
  const areas = Object.fromEntries(
    Object.keys(AREA_PATTERNS).map(area => [area, changedFiles.some(file => hasArea(file, area))]),
  );
  const trackHits = new Map();
  for (const file of changedFiles) {
    for (const track of trackMatchesForFile(file)) {
      const list = trackHits.get(track) ?? [];
      list.push(file);
      trackHits.set(track, list);
    }
  }
  const productTracks = Array.from(trackHits.keys());
  const runtimeAppChange = changedFiles.some(file =>
    hasArea(file, 'backend')
    || hasArea(file, 'frontend')
    || hasArea(file, 'shared')
    || hasArea(file, 'dependencies'));
  const docsOnly = changedFiles.length > 0 && changedFiles.every(file => hasArea(file, 'docs'));
  const supportOnly = changedFiles.length > 0 && productTracks.length === 0 && changedFiles.every(file =>
    hasArea(file, 'docs') || hasArea(file, 'scripts') || hasArea(file, 'packageManifest') || hasArea(file, 'workflow'));

  const scope = productTracks.length > 1
    ? 'mixed_product'
    : productTracks.length === 1
      ? 'product_package'
      : docsOnly
        ? 'docs_only'
        : supportOnly
          ? 'build_speed_support'
          : runtimeAppChange
            ? 'runtime_support'
            : 'unknown';

  const checks = new Set(['git diff --check']);
  if (productTracks.length > 0) {
    for (const track of productTracks) checks.add(TRACKS[track].gate);
  }
  if (areas.scripts || areas.workflow || areas.packageManifest || options.includeScriptTests) checks.add('npm run test:scripts');
  if (areas.migrations) checks.add('npm run check:migrations');
  if (changedFiles.some(file => /^backend\//.test(file))) checks.add('npm run build -w shared && npm run build -w backend');
  if (changedFiles.some(file => /^backend\/src\//.test(file))) checks.add('npm test');
  if (changedFiles.some(file => /^frontend\//.test(file)) && productTracks.length === 0) checks.add('npm run build -w frontend');
  if (changedFiles.some(file => /^frontend\/e2e\//.test(file)) && productTracks.length === 0) checks.add('npm run test:e2e:smoke');
  if (changedFiles.some(file => /^shared\//.test(file)) && productTracks.length === 0) checks.add('npm run build');

  const ciJobs = ['changes'];
  const ciRuntime = runtimeAppChange || areas.scripts || areas.workflow || areas.packageManifest;
  if (ciRuntime) ciJobs.push('build');
  if (areas.backend || areas.shared || areas.dependencies || areas.packageManifest || areas.scripts || areas.workflow) ciJobs.push('backend-tests');
  if (areas.frontend || areas.shared || areas.dependencies || areas.packageManifest || areas.workflow) ciJobs.push('browser-tests');
  ciJobs.push('build-and-test');

  const riskReasons = [];
  if (productTracks.length > 1) riskReasons.push('Touches multiple product tracks; split or explain package coupling.');
  if (areas.workflow) riskReasons.push('Changes GitHub workflow behavior.');
  if (areas.packageManifest) riskReasons.push('Changes package manifest scripts or dependency declarations.');
  if (areas.dependencies) riskReasons.push('Changes dependency lockfile.');
  if (areas.migrations) riskReasons.push('Touches database migrations; apply migration guard.');
  if (areas.deployOps) riskReasons.push('Touches deploy/server ops scripts.');
  if (areas.llm) riskReasons.push('Touches LLM routing; confirm all provider calls stay behind backend/src/lib/llm.ts.');

  const deployRequired = changedFiles.some(file =>
    /^backend\//.test(file)
    || /^frontend\/src\//.test(file)
    || /^shared\//.test(file)
    || hasArea(file, 'dependencies'));

  return {
    files: changedFiles,
    scope,
    track: productTracks.length === 1 ? productTracks[0] : null,
    trackLabel: productTracks.length === 1 ? TRACKS[productTracks[0]].label : null,
    productTracks,
    trackEvidence: Object.fromEntries(trackHits),
    areas: Object.fromEntries(Object.entries(areas).filter(([, value]) => value)),
    localChecks: Array.from(checks),
    ciJobs: unique(ciJobs),
    autoMergeEligible: riskReasons.length === 0,
    autoMergeNotes: riskReasons.length > 0 ? riskReasons : ['Local checks green and CI has no special attention risk.'],
    deployRequired,
    deployNote: deployRequired
      ? 'Deploy after merge because runtime app code or dependencies changed.'
      : 'No server deploy required for docs/tooling-only changes.',
  };
}

export function renderDeliveryManifest(manifest) {
  const trackLine = manifest.trackLabel
    ? `${manifest.trackLabel} (${manifest.track})`
    : manifest.productTracks.length > 1
      ? `mixed: ${manifest.productTracks.join(', ')}`
      : 'none';
  const list = (items) => items.map(item => `- \`${item}\``).join('\n') || '- none';
  const plainList = (items) => items.map(item => `- ${item}`).join('\n') || '- none';

  return [
    '# Delivery Manifest',
    '',
    `- Scope: ${manifest.scope}`,
    `- Track: ${trackLine}`,
    `- Auto-merge: ${manifest.autoMergeEligible ? 'eligible when listed local checks and CI are green' : 'hold for review'}`,
    `- Deploy: ${manifest.deployRequired ? 'required after merge' : 'not required'}`,
    '',
    '## Changed Files',
    list(manifest.files),
    '',
    '## Local Gates',
    list(manifest.localChecks),
    '',
    '## Expected CI Jobs',
    list(manifest.ciJobs),
    '',
    '## Attention Notes',
    plainList(manifest.autoMergeNotes),
    '',
    '## PR Body Fields',
    `- Track: ${trackLine}`,
    '- Package outcome: <one user-facing outcome or support outcome>',
    `- Local checks: ${manifest.localChecks.map(check => `\`${check}\``).join(', ') || 'none'}`,
    `- Auto-merge: ${manifest.autoMergeEligible ? 'yes, if CI is green' : 'no, see attention notes'}`,
    `- Deploy: ${manifest.deployRequired ? manifest.deployNote : manifest.deployNote}`,
  ].join('\n');
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { files: null, format: 'markdown', base: 'origin/main' };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--format') {
      result.format = args[index + 1] ?? result.format;
      index += 1;
      continue;
    }
    if (arg === '--base') {
      result.base = args[index + 1] ?? result.base;
      index += 1;
      continue;
    }
    if (arg === '--files') {
      const files = [];
      while (args[index + 1] && !args[index + 1].startsWith('--')) {
        files.push(args[index + 1]);
        index += 1;
      }
      result.files = files;
    }
  }
  return result;
}

function printUsage() {
  console.log('Usage: node scripts/delivery-manifest.mjs [--base origin/main] [--format markdown|json] [--files <path> ...]');
}

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    return;
  }
  const options = parseArgs(argv);
  const files = options.files ?? changedFilesFromGit(options.base);
  const manifest = buildDeliveryManifest(files);
  if (options.format === 'json') {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }
  console.log(renderDeliveryManifest(manifest));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv);
}
