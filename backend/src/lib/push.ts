import webpush from 'web-push';
import { and, eq } from 'drizzle-orm';
import type { PushSubscription } from 'web-push';
import type { PulsePushTopics, PushTopic } from '@coaching-os/shared/pulse';
import { db } from './db.js';
import { env } from './env.js';
import { DEFAULT_PUSH_TOPICS, pulsePushSubscriptions, pulseUserProfile } from '../db/pulse-schema.js';

export type { PushTopic };

export interface PushPayload {
  topic: PushTopic;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  gone: number;
  skipped: number;
}

const TRANSIENT_FAILURE_LIMIT = 5;
const MAX_BODY_LENGTH = 140;
let vapidConfigured = false;

export function isPushConfigured(): boolean {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

function ensureVapidConfigured(): boolean {
  if (!isPushConfigured()) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT!, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
    vapidConfigured = true;
  }
  return true;
}

export function normalizePushTopics(value: unknown): PulsePushTopics {
  const raw = typeof value === 'object' && value != null ? value as Partial<PulsePushTopics> : {};
  return {
    briefing: raw.briefing ?? DEFAULT_PUSH_TOPICS.briefing,
    checkin_reminder: raw.checkin_reminder ?? DEFAULT_PUSH_TOPICS.checkin_reminder,
    risk_critical: raw.risk_critical ?? DEFAULT_PUSH_TOPICS.risk_critical,
  };
}

function timeToMinutes(value: string | null | undefined): number {
  const [h, m] = (value ?? '00:00').split(':').map(Number);
  return Math.max(0, Math.min(23, h ?? 0)) * 60 + Math.max(0, Math.min(59, m ?? 0));
}

export function isWithinQuietHours(start: string, end: string, now = new Date()): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (startMin === endMin) return false;
  if (startMin < endMin) return current >= startMin && current < endMin;
  return current >= startMin || current < endMin;
}

function truncateBody(body: string): string {
  return body.length > MAX_BODY_LENGTH ? `${body.slice(0, MAX_BODY_LENGTH - 1)}…` : body;
}

function statusCodeOf(error: unknown): number | null {
  if (typeof error !== 'object' || error == null) return null;
  const record = error as { statusCode?: unknown; status?: unknown };
  const status = record.statusCode ?? record.status;
  return typeof status === 'number' ? status : null;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushSendResult> {
  const subscriptions = await db.select().from(pulsePushSubscriptions)
    .where(and(eq(pulsePushSubscriptions.userId, userId), eq(pulsePushSubscriptions.enabled, true)));
  if (subscriptions.length === 0) return { sent: 0, failed: 0, gone: 0, skipped: 0 };
  if (!ensureVapidConfigured()) return { sent: 0, failed: 0, gone: 0, skipped: subscriptions.length };

  const [profile] = await db.select({
    topics: pulseUserProfile.pushTopics,
    quietStart: pulseUserProfile.pushQuietStart,
    quietEnd: pulseUserProfile.pushQuietEnd,
  }).from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

  const topics = normalizePushTopics(profile?.topics);
  if (!topics[payload.topic]) return { sent: 0, failed: 0, gone: 0, skipped: subscriptions.length };
  if (payload.topic !== 'risk_critical' && isWithinQuietHours(profile?.quietStart ?? '22:00', profile?.quietEnd ?? '06:30')) {
    return { sent: 0, failed: 0, gone: 0, skipped: subscriptions.length };
  }

  const data = JSON.stringify({ ...payload, body: truncateBody(payload.body) });
  let sent = 0;
  let failed = 0;
  let gone = 0;

  for (const sub of subscriptions) {
    const pushSubscription: PushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
      await webpush.sendNotification(pushSubscription, data);
      sent++;
      await db.update(pulsePushSubscriptions)
        .set({ lastSuccessAt: new Date(), lastErrorAt: null, consecutiveFailures: 0, updatedAt: new Date() })
        .where(eq(pulsePushSubscriptions.id, sub.id));
    } catch (error) {
      const status = statusCodeOf(error);
      if (status === 404 || status === 410) {
        gone++;
        await db.update(pulsePushSubscriptions)
          .set({ enabled: false, lastErrorAt: new Date(), updatedAt: new Date() })
          .where(eq(pulsePushSubscriptions.id, sub.id));
        continue;
      }
      failed++;
      const nextFailures = sub.consecutiveFailures + 1;
      await db.update(pulsePushSubscriptions)
        .set({
          enabled: nextFailures < TRANSIENT_FAILURE_LIMIT,
          lastErrorAt: new Date(),
          consecutiveFailures: nextFailures,
          updatedAt: new Date(),
        })
        .where(eq(pulsePushSubscriptions.id, sub.id));
    }
  }

  return { sent, failed, gone, skipped: 0 };
}
