#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

function usage() {
  return [
    'Usage: node scripts/route-evidence-summary.mjs [evidence-root]',
    '',
    'Default evidence-root: test-results/route-evidence',
  ].join('\n');
}

function findManifestFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name === 'manifest.json') {
        files.push(fullPath);
      }
    }
  }
  walk(root);
  return files.sort();
}

function screenshotHasOverflow(screenshot) {
  return Boolean(
    screenshot?.overflow?.horizontalOverflow
    || screenshot?.horizontalOverflow?.horizontalOverflow
    || screenshot?.horizontalOverflow === true,
  );
}

function overflowNodes(screenshot) {
  return screenshot?.overflow?.overflowingNodes
    ?? screenshot?.horizontalOverflow?.overflowingNodes
    ?? [];
}

function summarizeManifest(file) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
  const overflowScreenshots = screenshots.filter(screenshotHasOverflow);
  return {
    file,
    date: manifest.date ?? 'unknown-date',
    commit: manifest.commit ?? 'unknown-commit',
    project: manifest.project ?? path.basename(path.dirname(file)),
    baseURL: manifest.baseURL ?? manifest.baseUrl ?? 'unknown-base-url',
    screenshotCount: screenshots.length,
    overflowScreenshots,
  };
}

function printSummary(root, summaries) {
  console.log('# Route Evidence Summary');
  console.log('');
  console.log(`Root: ${root}`);
  console.log(`Manifests: ${summaries.length}`);
  console.log('');

  for (const summary of summaries) {
    console.log(`## ${summary.project} (${summary.date} - ${summary.commit})`);
    console.log(`- base: ${summary.baseURL}`);
    console.log(`- screenshots: ${summary.screenshotCount}`);
    console.log(`- overflow: ${summary.overflowScreenshots.length}`);
    if (summary.overflowScreenshots.length > 0) {
      for (const screenshot of summary.overflowScreenshots) {
        const nodes = overflowNodes(screenshot)
          .slice(0, 3)
          .map(node => `${node.tag ?? 'node'} "${String(node.text ?? '').slice(0, 48)}"`)
          .join('; ');
        console.log(`  - ${screenshot.route ?? screenshot.url ?? screenshot.label}: ${nodes || 'overflow nodes unavailable'}`);
      }
    }
    console.log(`- manifest: ${summary.file}`);
    console.log('');
  }

  const totalOverflow = summaries.reduce((sum, summary) => sum + summary.overflowScreenshots.length, 0);
  if (totalOverflow === 0) {
    console.log('No horizontal overflow recorded. Review the screenshots manually before opening a UI/UX implementation slice.');
  } else {
    console.log('Horizontal overflow recorded. Fix the affected route before adding new UI/UX scope.');
  }
}

try {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    console.log(usage());
    process.exit(0);
  }

  const root = path.resolve(args[0] ?? path.join(process.cwd(), 'test-results', 'route-evidence'));
  if (!statSync(root).isDirectory()) {
    throw new Error(`Evidence root is not a directory: ${root}`);
  }

  const manifests = findManifestFiles(root);
  if (manifests.length === 0) {
    throw new Error(`No manifest.json files found under ${root}`);
  }

  printSummary(root, manifests.map(summarizeManifest));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
