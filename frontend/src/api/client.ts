const BASE = '/api';

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('coaching-os-auth');
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { state?: { token?: string } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const isPost = options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH';
  const body = options.body ?? (isPost ? '{}' : undefined);

  const res = await fetch(`${BASE}${path}`, { ...options, headers, body });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (body: { email: string; password: string }) =>
      request<{ token: string; user: { id: string; name: string; email: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(body) }
      ),
    logout: () =>
      request<void>('/auth/logout', { method: 'POST' }),
    me: () =>
      request<{ id: string; name: string; email: string }>('/auth/me'),
  },
  garmin: {
    status: () =>
      request<{ connected: boolean; lastSync: string | null; syncStatus: string; errorMessage: string | null }>(
        '/garmin/status'
      ),
    getConnectUrl: () =>
      request<{ url: string }>('/garmin/connect'),
    sync: () =>
      request<{ synced: string[] }>('/garmin/sync', { method: 'POST' }),
  },
  health: {
    summary: () =>
      request<{
        today: {
          date: string;
          hrvRmssd: number | null;
          hrvStatus: string | null;
          sleepDurationH: number | null;
          sleepScore: number | null;
          restingHr: number | null;
          steps: number | null;
          caloriesActive: number | null;
          bodyBatteryMin: number | null;
          bodyBatteryMax: number | null;
          stressAvg: number | null;
        } | null;
        trend7d: Array<{
          date: string;
          sleepDurationH: number | null;
          restingHr: number | null;
          bodyBatteryMax: number | null;
          steps: number | null;
        }>;
        lastSync: string | null;
        circuitOpen: boolean;
      }>('/health/summary'),
  },
  checkin: {
    today: () =>
      request<{ checkin: { id: string; date: string; energy_level: number; stress_level: number; notes: string | null } | null }>(
        '/checkin/today'
      ),
    submit: (body: { energy_level: number; stress_level: number; notes?: string }) =>
      request<{ id: string; date: string; energy_level: number; stress_level: number; notes: string | null }>(
        '/checkin',
        { method: 'POST', body: JSON.stringify(body) }
      ),
  },
  briefing: {
    latest: () =>
      request<{ briefing: { id: string; date: string; trigger_type: string; briefing_text: string; created_at: string } | null }>(
        '/briefing/latest'
      ),
  },
  chat: {
    history: () =>
      request<{ messages: Array<{ id: string; role: string; content: string; created_at: string }> }>(
        '/chat/history'
      ),
    sendMessage: (message: string) =>
      request<{ response: string }>(
        '/chat/message',
        { method: 'POST', body: JSON.stringify({ message }) }
      ),
    deleteHistory: () =>
      request<void>('/chat/history', { method: 'DELETE' }),
  },
};
