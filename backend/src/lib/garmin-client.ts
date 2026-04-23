import { env } from './env.js';

// garmin-connect is CommonJS — dynamic import avoids ESM interop issues
const { GarminConnect } = await import('garmin-connect').then((m: any) => m.default ?? m);

let client: any = null;
let lastLoginAt = 0;
const SESSION_TTL_MS = 50 * 60 * 1000;

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
