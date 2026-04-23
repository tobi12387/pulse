import type { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { users, garminDailyHealth } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { env } from '../lib/env.js';

const GARMIN_AUTH_URL = 'https://connect.garmin.com/oauthConfirm';
const GARMIN_TOKEN_URL = 'https://connect.garmin.com/services/auth/token/exchange';
const GARMIN_HEALTH_URL = 'https://apis.garmin.com/wellness-api/rest';

interface GarminTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export default async function garminRoutes(app: FastifyInstance) {
  // GET /api/garmin/status
  app.get('/status', { onRequest: [app.authenticate] }, async (req) => {
    const [user] = await db.select({ settings: users.settings })
      .from(users).where(eq(users.id, req.user.sub));

    const settings = user?.settings ?? {};
    const connected = !!(settings.garminAccessToken && settings.garminUserId);

    if (!connected) {
      return { connected: false, lastSync: null, syncStatus: 'never' as const, errorMessage: null };
    }

    const [latest] = await db.select({ syncedAt: garminDailyHealth.syncedAt })
      .from(garminDailyHealth)
      .where(eq(garminDailyHealth.userId, req.user.sub))
      .orderBy(desc(garminDailyHealth.syncedAt))
      .limit(1);

    const lastSync = latest?.syncedAt?.toISOString() ?? null;
    let syncStatus: 'ok' | 'stale' | 'error' | 'never' = 'never';
    if (lastSync) {
      const ageHours = (Date.now() - new Date(lastSync).getTime()) / 3_600_000;
      syncStatus = ageHours < 5 ? 'ok' : 'stale';
    }

    return { connected, lastSync, syncStatus, errorMessage: null };
  });

  // GET /api/garmin/connect — generate OAuth URL
  app.get('/connect', { onRequest: [app.authenticate] }, async () => {
    const params = new URLSearchParams({
      client_id: env.GARMIN_CLIENT_ID,
      redirect_uri: env.GARMIN_CALLBACK_URL,
      response_type: 'code',
      scope: 'HEALTH_API',
    });
    return { url: `${GARMIN_AUTH_URL}?${params}` };
  });

  // GET /api/garmin/callback — OAuth callback after Garmin redirect
  app.get('/callback', async (req, reply) => {
    const { code } = req.query as { code?: string };

    if (!code) {
      return reply.redirect('/settings?garmin=error');
    }

    // Token exchange
    const tokenRes = await fetch(GARMIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.GARMIN_CLIENT_ID,
        client_secret: env.GARMIN_CLIENT_SECRET,
        code,
        redirect_uri: env.GARMIN_CALLBACK_URL,
      }),
    });

    if (!tokenRes.ok) {
      app.log.error(`Garmin token exchange failed: ${await tokenRes.text()}`);
      return reply.redirect('/settings?garmin=error');
    }

    const tokenData = await tokenRes.json() as GarminTokenResponse;
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Get Garmin user ID
    let garminUserId: string | undefined;
    const userRes = await fetch(`${GARMIN_HEALTH_URL}/userProfile/id`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userRes.ok) {
      const userData = await userRes.json() as { userId: string };
      garminUserId = userData.userId;
    }

    // Single-user app: update the first (only) user
    const [user] = await db.select({ id: users.id, settings: users.settings }).from(users).limit(1);
    if (!user) return reply.redirect('/settings?garmin=error');

    await db.update(users)
      .set({
        settings: {
          ...(user.settings ?? {}),
          garminAccessToken: tokenData.access_token,
          garminRefreshToken: tokenData.refresh_token,
          garminTokenExpiresAt: expiresAt,
          ...(garminUserId !== undefined ? { garminUserId } : {}),
        },
      })
      .where(eq(users.id, user.id));

    app.log.info(`Garmin connected for user ${user.id}`);
    return reply.redirect('/settings?garmin=connected');
  });

  // POST /api/garmin/sync — manual sync trigger
  app.post('/sync', { onRequest: [app.authenticate] }, async (req, reply) => {
    const [user] = await db.select({ settings: users.settings })
      .from(users).where(eq(users.id, req.user.sub));

    if (!user?.settings?.garminAccessToken) {
      return reply.status(400).send({ error: 'Garmin nicht verbunden' });
    }

    const today = new Date().toISOString().split('T')[0]!;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]!;

    for (const date of [yesterday, today]) {
      await syncGarminDay(user.settings.garminAccessToken, req.user.sub, date, app);
    }

    return { synced: [yesterday, today] };
  });
}

export async function syncGarminDay(
  accessToken: string,
  userId: string,
  date: string,
  app: FastifyInstance,
): Promise<void> {
  const url = `${GARMIN_HEALTH_URL}/dailySummary/user/${userId}/forDate`;
  const params = new URLSearchParams({
    uploadStartTimeInSeconds: '0',
    uploadEndTimeInSeconds: '0',
  });

  const res = await fetch(`${url}?${params}&date=${date}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    app.log.warn(`Garmin daily summary for ${date} failed: ${res.status}`);
    return;
  }

  const data = await res.json() as {
    userDailySummaries?: Array<{
      hrMinuteMovingAverage?: number;
      hrMinuteStatus?: string;
      sleepingSeconds?: number;
      sleepingScore?: number;
      restingHeartRate?: number;
      totalSteps?: number;
      activeCalories?: number;
      minBodyBattery?: number;
      maxBodyBattery?: number;
      averageStressLevel?: number;
    }>;
  };

  const summary = data.userDailySummaries?.[0];
  if (!summary) return;

  await db.insert(garminDailyHealth).values({
    userId,
    date,
    hrvRmssd: summary.hrMinuteMovingAverage ?? null,
    hrvStatus: summary.hrMinuteStatus ?? null,
    sleepDurationH: summary.sleepingSeconds != null ? summary.sleepingSeconds / 3600 : null,
    sleepScore: summary.sleepingScore ?? null,
    restingHr: summary.restingHeartRate ?? null,
    steps: summary.totalSteps ?? null,
    caloriesActive: summary.activeCalories ?? null,
    bodyBatteryMin: summary.minBodyBattery ?? null,
    bodyBatteryMax: summary.maxBodyBattery ?? null,
    stressAvg: summary.averageStressLevel ?? null,
  }).onConflictDoUpdate({
    target: [garminDailyHealth.userId, garminDailyHealth.date],
    set: {
      hrvRmssd: summary.hrMinuteMovingAverage ?? null,
      sleepDurationH: summary.sleepingSeconds != null ? summary.sleepingSeconds / 3600 : null,
      restingHr: summary.restingHeartRate ?? null,
      steps: summary.totalSteps ?? null,
      syncedAt: new Date(),
    },
  });

  app.log.info(`[garmin-sync] ${date} ✓`);
}
