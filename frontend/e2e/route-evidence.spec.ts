import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mockPulseApi } from './fixtures/pulse-api';

const routes = [
  { path: '/', label: 'home', visibleText: 'READINESS' },
  { path: '/coach', label: 'coach', visibleText: 'TAGESBRIEFING' },
  { path: '/data', label: 'data', visibleText: 'Schlaf, Metriken & Mental' },
  { path: '/data?tab=analysen', label: 'data-analysen', visibleText: 'Analysen' },
  { path: '/plan', label: 'plan', visibleText: 'Training, Ziele & Statistik' },
  { path: '/settings', label: 'settings', visibleText: 'Settings' },
] as const;

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'coaching-os-auth',
      JSON.stringify({
        state: {
          token: 'test-token',
          user: { id: 'user-1', name: 'Tobi', email: 'tobi@example.test' },
        },
        version: 0,
      }),
    );
  });
}

async function overflowSummary(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const documentScrollWidth = document.documentElement.scrollWidth;
    const overflowingNodes = Array.from(document.querySelectorAll('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent ?? '').trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.width > 0 && (item.left < -1 || item.right > viewportWidth + 1))
      .slice(0, 20);

    return {
      viewportWidth,
      documentScrollWidth,
      horizontalOverflow: documentScrollWidth > viewportWidth + 1,
      overflowingNodes,
    };
  });
}

test.describe('Route evidence screenshot pack', () => {
  test.skip(process.env.PULSE_ROUTE_EVIDENCE !== 'true', 'set PULSE_ROUTE_EVIDENCE=true to capture route screenshots');

  test('captures six core routes with manifest metadata', async ({ page, baseURL }, testInfo) => {
    await mockPulseApi(page);
    await seedAuth(page);

    const commit = currentCommit();
    const capturedAt = new Date().toISOString();
    const date = process.env.PULSE_ROUTE_EVIDENCE_DATE ?? capturedAt.slice(0, 10);
    const outputRoot = process.env.PULSE_ROUTE_EVIDENCE_DIR ?? path.join(process.cwd(), 'test-results', 'route-evidence');
    const runDir = path.join(outputRoot, `${date}-${commit}`, slug(testInfo.project.name));
    await fs.mkdir(runDir, { recursive: true });

    const screenshots: Array<{
      route: string;
      url: string;
      label: string;
      file: string;
      overflow: Awaited<ReturnType<typeof overflowSummary>>;
    }> = [];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.locator('main').getByText(route.visibleText).first()).toBeVisible();

      const overflow = await overflowSummary(page);
      const filename = `${String(screenshots.length + 1).padStart(2, '0')}-${route.label}.png`;
      const file = path.join(runDir, filename);
      await page.screenshot({ path: file, fullPage: true });
      screenshots.push({
        route: route.path,
        url: page.url(),
        label: route.label,
        file,
        overflow,
      });
    }

    const manifest = {
      capturedAt,
      date,
      commit,
      project: testInfo.project.name,
      baseURL,
      viewport: page.viewportSize(),
      screenshots,
    };

    await fs.writeFile(path.join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await fs.writeFile(
      path.join(runDir, 'README.md'),
      [
        '# Pulse Route Evidence',
        '',
        `- Date: ${date}`,
        `- Commit: ${commit}`,
        `- Project: ${testInfo.project.name}`,
        `- Base URL: ${baseURL}`,
        `- Viewport: ${manifest.viewport?.width ?? 'unknown'}x${manifest.viewport?.height ?? 'unknown'}`,
        '',
        '## Screenshots',
        '',
        ...screenshots.map((shot) => `- ${shot.route}: ${path.basename(shot.file)} (${shot.overflow.horizontalOverflow ? 'overflow' : 'no overflow'})`),
        '',
      ].join('\n'),
    );
  });
});
