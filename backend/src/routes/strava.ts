import type { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { pulseStravaTokens, pulseUserProfile } from '../db/pulse-schema.js';
import { eq } from 'drizzle-orm';
import { env } from '../lib/env.js';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API = 'https://www.strava.com/api/v3';

function redirectUri(): string {
  return env.STRAVA_REDIRECT_URI ?? `${env.APP_URL}/api/strava/callback`;
}

async function stravaFetch(accessToken: string, path: string): Promise<any> {
  const res = await fetch(`${STRAVA_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava API ${path}: ${res.status}`);
  return res.json();
}

async function refreshAccessToken(userId: string): Promise<string> {
  const [row] = await db.select().from(pulseStravaTokens).where(eq(pulseStravaTokens.userId, userId));
  if (!row) throw new Error('Keine Strava-Verbindung gefunden');

  if (new Date(row.expiresAt) > new Date(Date.now() + 60_000)) return row.accessToken;

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type:    'refresh_token',
      refresh_token: row.refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Token-Refresh fehlgeschlagen: ${res.status}`);
  const data = await res.json() as any;

  await db.update(pulseStravaTokens)
    .set({ accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(data.expires_at * 1000), updatedAt: new Date() })
    .where(eq(pulseStravaTokens.userId, userId));

  return data.access_token as string;
}

export default async function stravaRoutes(app: FastifyInstance) {
  // GET /api/strava/status
  app.get('/status', { onRequest: [app.authenticate] }, async (req) => {
    if (!env.STRAVA_CLIENT_ID) return { configured: false, connected: false };
    const [row] = await db.select({ athleteId: pulseStravaTokens.athleteId, expiresAt: pulseStravaTokens.expiresAt })
      .from(pulseStravaTokens)
      .where(eq(pulseStravaTokens.userId, req.user.sub));
    return {
      configured: true,
      connected: !!row,
      athleteId: row?.athleteId ?? null,
      expiresAt: row?.expiresAt?.toISOString() ?? null,
    };
  });

  // GET /api/strava/auth-url — returns the Strava OAuth URL (authenticated API call)
  app.get('/auth-url', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!env.STRAVA_CLIENT_ID) return reply.status(503).send({ error: 'Strava nicht konfiguriert' });

    const state = app.jwt.sign({ sub: req.user.sub }, { expiresIn: '10m' });
    const params = new URLSearchParams({
      client_id:       env.STRAVA_CLIENT_ID,
      redirect_uri:    redirectUri(),
      response_type:   'code',
      approval_prompt: 'auto',
      scope:           'read,profile:read_all,activity:read',
      state,
    });
    return { url: `${STRAVA_AUTH_URL}?${params}` };
  });

  // POST /api/strava/exchange — frontend calls this after receiving code from Strava
  app.post('/exchange', async (req: any, reply) => {
    const { code, state } = req.body as { code?: string; state?: string };
    if (!code || !state) return reply.status(400).send({ error: 'code und state erforderlich' });

    let userId: string;
    try {
      const payload = app.jwt.verify<{ sub: string }>(state);
      userId = payload.sub;
    } catch {
      return reply.status(401).send({ error: 'Ungültiger state' });
    }

    if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
      return reply.status(503).send({ error: 'Strava nicht konfiguriert' });
    }

    const tokenRes = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      app.log.error(`[strava] token exchange failed: ${tokenRes.status} ${body}`);
      return reply.status(502).send({ error: 'Token-Exchange fehlgeschlagen' });
    }

    const tokenData = await tokenRes.json() as any;
    await db.insert(pulseStravaTokens).values({
      userId,
      accessToken:  tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt:    new Date(tokenData.expires_at * 1000),
      athleteId:    tokenData.athlete?.id ?? null,
      updatedAt:    new Date(),
    }).onConflictDoUpdate({
      target: pulseStravaTokens.userId,
      set: {
        accessToken:  tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt:    new Date(tokenData.expires_at * 1000),
        athleteId:    tokenData.athlete?.id ?? null,
        updatedAt:    new Date(),
      },
    });

    app.log.info(`[strava] connected user ${userId}, athlete ${tokenData.athlete?.id}`);
    return { connected: true, athleteId: tokenData.athlete?.id ?? null };
  });

  // GET /api/strava/callback — Strava redirects here after user approves
  app.get('/callback', async (req: any, reply) => {
    const { code, state, error } = req.query as Record<string, string>;

    const frontendBase = env.APP_URL.replace(':3000', ':5174').replace('localhost', '192.168.178.46');

    if (error) return reply.redirect(`${frontendBase}/settings?strava=error&msg=${encodeURIComponent(error)}`);
    if (!code || !state) return reply.redirect(`${frontendBase}/settings?strava=error&msg=missing_params`);

    let userId: string;
    try {
      const payload = app.jwt.verify<{ sub: string }>(state);
      userId = payload.sub;
    } catch {
      return reply.redirect(`${frontendBase}/settings?strava=error&msg=invalid_state`);
    }

    if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
      return reply.redirect(`${frontendBase}/settings?strava=error&msg=not_configured`);
    }

    const tokenRes = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      app.log.error(`[strava] token exchange failed: ${tokenRes.status}`);
      return reply.redirect(`${frontendBase}/settings?strava=error&msg=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json() as any;
    await db.insert(pulseStravaTokens).values({
      userId,
      accessToken:  tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt:    new Date(tokenData.expires_at * 1000),
      athleteId:    tokenData.athlete?.id ?? null,
      updatedAt:    new Date(),
    }).onConflictDoUpdate({
      target: pulseStravaTokens.userId,
      set: {
        accessToken:  tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt:    new Date(tokenData.expires_at * 1000),
        athleteId:    tokenData.athlete?.id ?? null,
        updatedAt:    new Date(),
      },
    });

    app.log.info(`[strava] connected user ${userId}, athlete ${tokenData.athlete?.id}`);
    return reply.redirect(`${frontendBase}/settings?strava=connected`);
  });

  // POST /api/strava/sync-profile — pull FTP, zones, update pulse_user_profile
  app.post('/sync-profile', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!env.STRAVA_CLIENT_ID) return reply.status(503).send({ error: 'Strava nicht konfiguriert' });

    const userId = req.user.sub;
    const token = await refreshAccessToken(userId);

    const [athlete, zonesRaw] = await Promise.all([
      stravaFetch(token, '/athlete'),
      stravaFetch(token, '/athlete/zones').catch(() => null),
    ]);

    const ftp: number | null = athlete.ftp ?? null;
    const weight: number | null = athlete.weight ?? null;

    // Max HR from Strava HR zones: zone 5 lower bound ÷ 0.90 ≈ maxHR
    let maxHrFromZones: number | null = null;
    const hrZones: Array<{ min: number; max: number }> = zonesRaw?.heart_rate?.zones ?? [];
    if (hrZones.length >= 5) {
      const z5min = hrZones[4]?.min;
      if (z5min && z5min > 0) maxHrFromZones = Math.round(z5min / 0.90);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (ftp != null)             updates.ftpWatts = ftp;
    if (maxHrFromZones != null)  updates.maxHrBpm = maxHrFromZones;

    await db.insert(pulseUserProfile)
      .values({ userId, ...updates } as any)
      .onConflictDoUpdate({ target: pulseUserProfile.userId, set: updates as any });

    const powerZones: Array<{ min: number; max: number }> = zonesRaw?.power?.zones ?? [];

    return {
      synced: { ftp, weight, maxHrFromZones },
      hrZones,
      powerZones,
    };
  });

  // DELETE /api/strava/disconnect
  app.delete('/disconnect', { onRequest: [app.authenticate] }, async (req) => {
    await db.delete(pulseStravaTokens).where(eq(pulseStravaTokens.userId, req.user.sub));
    return { disconnected: true };
  });
}
