import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MOCK_TODAY, mockPulseApi } from './fixtures/pulse-api';

const routes = [
  { path: '/', label: 'home', visibleText: 'READINESS' },
  { path: '/coach', label: 'coach', visibleText: 'TAGESBRIEFING' },
  { path: '/data', label: 'data', visibleText: 'Schlaf, Metriken, Mental & Analysen' },
  { path: '/data?tab=mental', label: 'data-mental', visibleText: 'Quick Check-in' },
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
  test.setTimeout(60_000);

  test('captures core routes with manifest metadata', async ({ page, baseURL }, testInfo) => {
    await page.clock.setFixedTime(new Date(`${MOCK_TODAY}T08:00:00+02:00`));
    await mockPulseApi(page, { checkinToday: { checkin: null } });
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

    async function capture(
      route: { path: string; label: string; visibleText: string },
      verify?: () => Promise<void>,
    ) {
      await page.goto(route.path);
      await expect(page.locator('main').getByText(route.visibleText).first()).toBeVisible();
      await verify?.();
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

    for (const route of routes) {
      await capture(route, route.label === 'data-analysen'
        ? async () => {
            const qualityCard = page.getByTestId('power-data-quality');
            await expect(qualityCard).toBeVisible();
            await expect(qualityCard).toContainText('Nur Lap-Approximation');
            await expect(page.getByTestId('power-duration-summary')).toContainText('Durability limited');
          }
        : undefined);
    }

    if (testInfo.project.name === 'mobile-chromium') {
      await mockPulseApi(page, { checkinToday: { checkin: null }, todayOptionsState: 'unplanned_trainable' });
      await capture(
        { path: '/', label: 'home-mobile-intent', visibleText: 'READINESS' },
        async () => {
          await expect(page.getByTestId('today-availability-intent')).toBeVisible();
        },
      );

      await mockPulseApi(page, { checkinToday: { checkin: null }, todayOptionsState: 'completed_activity' });
      await capture(
        { path: '/', label: 'home-completed-no-intent', visibleText: 'READINESS' },
        async () => {
          await expect(page.getByTestId('today-availability-intent')).toHaveCount(0);
        },
      );

      await mockPulseApi(page, { checkinToday: { checkin: null }, todayOptionsState: 'recovery_protect' });
      await capture(
        { path: '/', label: 'home-recovery-no-intent', visibleText: 'READINESS' },
        async () => {
          await expect(page.getByTestId('today-availability-intent')).toHaveCount(0);
        },
      );

      await mockPulseApi(page, { checkinToday: { checkin: null }, todayOptionsState: 'unplanned_trainable' });
      await capture(
        {
          path: '/plan?tab=training&source=mobile-intent&scenario=workout&activityType=bike&zone=1&durationMin=60&description=Heute%2060%20min%20moeglich%3B%20Pulse%20prueft%20Auswirkung%20auf%20Woche%20und%20Garmin.#plan-scenario-preview',
          label: 'plan-mobile-intent-scenario',
          visibleText: 'Training, Ziele & Statistik',
        },
        async () => {
          const scenarioCard = page.getByTestId('plan-scenario-preview-card');
          await expect(scenarioCard).toBeVisible();
          await expect(scenarioCard).toBeInViewport();
          await expect(page.getByRole('heading', { name: /Training, Ziele|Szenario/i }).first()).toBeVisible();
          await expect(page.getByTestId('plan-scenario-entry-context')).toBeVisible();
          await expect(page.getByTestId('plan-scenario-entry-context')).toBeInViewport();
          await expect(scenarioCard).toContainText('Mobile Quick Decision');
          await expect(scenarioCard).not.toContainText('155 km');
          await expect(scenarioCard).not.toContainText('423 min');
        },
      );
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
