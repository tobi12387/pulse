import { env } from './env.js';

// garmin-connect is CommonJS — dynamic import avoids ESM interop issues
const { GarminConnect } = await import('garmin-connect').then((m: any) => m.default ?? m);

let client: any = null;
let lastLoginAt = 0;
const SESSION_TTL_MS = 50 * 60 * 1000;
const GARMIN_CONNECT_API_BASE = 'https://connectapi.garmin.com';

export async function getGarminClient(): Promise<any> {
  const now = Date.now();
  if (client && now - lastLoginAt < SESSION_TTL_MS) {
    return client;
  }

  const gc = new GarminConnect({ username: env.GARMIN_EMAIL, password: env.GARMIN_PASSWORD });
  await gc.login(env.GARMIN_EMAIL, env.GARMIN_PASSWORD);
  client = gc;
  lastLoginAt = now;
  return gc;
}

type GarminRawClient = {
  get?: (url: string) => Promise<unknown>;
  client?: {
    get?: (url: string) => Promise<unknown>;
    post?: (url: string, body: unknown) => Promise<unknown>;
    delete?: (url: string) => Promise<unknown>;
  };
};

function rawClient(gc: GarminRawClient) {
  if (!gc.client) throw new Error('Garmin raw client unavailable');
  return gc.client;
}

async function rawGet(gc: GarminRawClient, url: string): Promise<unknown> {
  if (typeof gc.get === 'function') return gc.get(url);
  const client = rawClient(gc);
  if (!client.get) throw new Error('Garmin raw GET unavailable');
  return client.get(url);
}

async function rawClientGet(gc: GarminRawClient, url: string): Promise<unknown> {
  const client = rawClient(gc);
  if (!client.get) throw new Error('Garmin client GET unavailable');
  return client.get(url);
}

async function rawClientPost(gc: GarminRawClient, url: string, body: unknown): Promise<unknown> {
  const client = rawClient(gc);
  if (!client.post) throw new Error('Garmin client POST unavailable');
  return client.post(url, body);
}

async function rawClientDelete(gc: GarminRawClient, url: string): Promise<unknown> {
  const client = rawClient(gc);
  if (!client.delete) throw new Error('Garmin client DELETE unavailable');
  return client.delete(url);
}

export const garminApi = {
  getDailyUserSummary(gc: GarminRawClient, displayName: string, date: string): Promise<unknown> {
    const encodedName = encodeURIComponent(displayName);
    return rawClientGet(gc, `${GARMIN_CONNECT_API_BASE}/usersummary-service/usersummary/daily/${encodedName}?calendarDate=${date}`);
  },

  getActivitySplits(gc: GarminRawClient, activityId: string): Promise<unknown> {
    return rawGet(gc, `${GARMIN_CONNECT_API_BASE}/activity-service/activity/${activityId}/splits`);
  },

  getActivityHrTimeInZones(gc: GarminRawClient, activityId: string): Promise<unknown> {
    return rawGet(gc, `${GARMIN_CONNECT_API_BASE}/activity-service/activity/${activityId}/hrTimeInZones`);
  },

  scheduleWorkout(gc: GarminRawClient, workoutId: string, date: string): Promise<unknown> {
    return rawClientPost(gc, `${GARMIN_CONNECT_API_BASE}/workout-service/schedule/${workoutId}`, { date });
  },

  getWorkout(gc: GarminRawClient, workoutId: string): Promise<unknown> {
    return rawClientGet(gc, `${GARMIN_CONNECT_API_BASE}/workout-service/workout/${workoutId}`);
  },

  deleteWorkout(gc: GarminRawClient, workoutId: string): Promise<unknown> {
    return rawClientDelete(gc, `${GARMIN_CONNECT_API_BASE}/workout-service/workout/${workoutId}`);
  },

  deleteWorkoutSchedule(gc: GarminRawClient, scheduleId: string): Promise<unknown> {
    return rawClientDelete(gc, `${GARMIN_CONNECT_API_BASE}/workout-service/schedule/${scheduleId}`);
  },

  getCalendarMonth(gc: GarminRawClient, year: number, zeroBasedMonth: number): Promise<unknown> {
    return rawClientGet(gc, `${GARMIN_CONNECT_API_BASE}/calendar-service/year/${year}/month/${zeroBasedMonth}`);
  },
};
