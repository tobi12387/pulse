# Web Push Notifications (PWA)

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
>
> **Status:** Ersetzt die 2026-04-29 verworfene Telegram-Phase. Push **innerhalb** der bestehenden Pulse-App, kein Drittanbieter, keine neue Channel.

**Ziel:** Pulse aktiv machen, ohne dass Tobi die App jeden Tag aktiv öffnen muss. Heute ist die App reiner Pull-Modus — Briefing existiert serverseitig, wartet aber auf Page-Load. Web Push schließt diesen Loop ohne Telegram, ohne neue Drittanbieter, ohne neue Daten-Domäne.

1. **Morgen-Push: Daily Briefing** — sobald Briefing-Job durchgelaufen ist (typisch nach Garmin-Sync 6:30–7:30).
2. **Abend-Push: Mental-Check-in-Reminder** — nur wenn heute noch kein Check-in da war.
3. **Risk-Watch-Push** — neue `critical`-Signale (siehe [risk-watch.md](2026-04-29-risk-watch.md)) werden sofort gepusht.
4. **Snooze-/Stille-Zeiten** im Settings — Tobi steuert, was und wann.

**Architektur:** Standard-Web-Push via `web-push` (npm). Service Worker im Frontend (Vite-PWA-Plugin oder Hand-rolled), Subscription-JSON wird im Backend in `pulse_push_subscriptions` gespeichert. Push-Sender als kleine Library im Backend, getriggert aus den existierenden Jobs (Briefing, Risk, Cron). Kein dedizierter Worker nötig — Push-Send hängt sich in vorhandene BullMQ-Queues ein.

**iOS-Note:** Web Push auf iOS Safari erfordert *installierte* PWA (Home-Screen-Add). Browser-Push ohne Install gibt es auf iOS nicht. Settings-Screen muss das erklären.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Aktuell | Lücke |
|---|---|
| Daily Briefing wird serverseitig generiert | Wartet auf Page-Load, kein aktiver Push |
| Coach-Chat reaktiv | Kein Tages-Anstoß für Mental-Check-in |
| Risk-Watch (kommt) feuert auf Home | Aber nur wenn Tobi die App öffnet — kein Eilfall |
| Frontend hat noch keinen Service Worker | Damit auch keine Offline-Fähigkeit |
| `pm2.config.js` läuft Vite-Dev | Service-Worker-Registration funktioniert in Vite-Dev nicht zuverlässig — Build-Pfad nutzen |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `backend/src/db/migrations/0015_push_subscriptions.sql` |
| Modify | `backend/src/db/pulse-schema.ts` |
| Create | `backend/src/lib/push.ts` (web-push Wrapper + sendNotification) |
| Modify | `backend/src/jobs/briefing-generation.job.ts` (Trigger Morgen-Push) |
| Create | `backend/src/jobs/checkin-reminder.job.ts` (Cron 19:30, falls kein Check-in heute) |
| Modify | `backend/src/pulse/services/risk-engine.ts` (Trigger Sofort-Push bei critical) |
| Modify | `backend/src/pulse/plugin.ts` (Subscription-Endpoints) |
| Create | `frontend/public/sw.js` (Service Worker) |
| Create | `frontend/public/manifest.webmanifest` |
| Create | `frontend/src/lib/push-client.ts` (Subscribe/Unsubscribe Helpers) |
| Modify | `frontend/index.html` (Manifest + SW-Registration) |
| Modify | `frontend/src/pages/Settings.tsx` (Push-Toggle + Stille-Zeiten) |
| Modify | `shared/pulse.ts` |
| Modify | `.env.example` (VAPID-Keys) |

---

## Task 1: VAPID-Keys generieren

Einmalig:

```bash
npx web-push generate-vapid-keys
```

Public-Key in `frontend/.env` als `VITE_VAPID_PUBLIC_KEY`, Private-Key in `backend/.env` als `VAPID_PRIVATE_KEY`. Subject-Mail in `.env`: `VAPID_SUBJECT=mailto:tobi.meurer@gmail.com`.

Nicht ins Repo. `.env.example` aktualisieren (mit Placeholder).

---

## Task 2: Schema

`backend/src/db/migrations/0015_push_subscriptions.sql`:

```sql
CREATE TABLE IF NOT EXISTS pulse_push_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL UNIQUE,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  device_label    VARCHAR(64),                      -- 'iPhone 15 Pro' optional, vom UA
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  last_success_at TIMESTAMPTZ,
  last_error_at   TIMESTAMPTZ,
  consecutive_failures INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_user_enabled
  ON pulse_push_subscriptions(user_id) WHERE enabled = TRUE;

-- Stille-Zeiten und Topic-Toggles im User-Profile
ALTER TABLE pulse_user_profile
  ADD COLUMN IF NOT EXISTS push_topics JSONB
    DEFAULT '{"briefing":true,"checkin_reminder":true,"risk_critical":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS push_quiet_start TIME DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS push_quiet_end   TIME DEFAULT '06:30';
```

---

## Task 3: Backend — push-Library

`backend/src/lib/push.ts`:

```typescript
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export type PushTopic = 'briefing' | 'checkin_reminder' | 'risk_critical';

export interface PushPayload {
  topic: PushTopic;
  title: string;
  body: string;
  url?: string;        // wird beim Click in der PWA geöffnet
  tag?: string;        // dedupliziert auf dem Device
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; gone: number }>;
```

Behavior:
- Liest Subscriptions, filtert nach `enabled` und User-Topic-Toggle.
- Quiet-Hours-Check: Wenn aktuell in Quiet-Window und `topic !== 'risk_critical'` → defer (für Briefing: max bis Quiet-End). `risk_critical` ignoriert Quiet-Hours.
- Bei `webpush.sendNotification()`-Error 404/410 (Subscription gone) → `enabled = false` setzen.
- Bei transient errors (5xx) → `consecutive_failures++`, ab 5 → `enabled = false`.
- Bei Erfolg → `last_success_at = now()`, `consecutive_failures = 0`.

---

## Task 4: Backend — Subscription-Endpoints

```
POST   /pulse/push/subscribe       body: { endpoint, keys: { p256dh, auth }, deviceLabel? }
DELETE /pulse/push/subscribe       body: { endpoint }
GET    /pulse/push/topics          → { briefing, checkin_reminder, risk_critical }
PATCH  /pulse/push/topics          body: { briefing?, checkin_reminder?, risk_critical? }
PATCH  /pulse/push/quiet-hours     body: { start: 'HH:MM', end: 'HH:MM' }
POST   /pulse/push/test            → sendet Test-Push an alle aktiven Subs
```

---

## Task 5: Trigger-Punkte

### 5.1 Daily Briefing
In `briefing-generation.job.ts` am Ende von `processBriefingJob`:

```typescript
await sendPushToUser(userId, {
  topic: 'briefing',
  title: 'Daily Briefing',
  body: briefing.length > 140 ? briefing.slice(0, 137) + '…' : briefing,
  url: '/',
  tag: `briefing-${date}`,
});
```

Tag-Deduplikation: ein Briefing pro Tag, nicht mehrfach.

### 5.2 Check-in-Reminder
Neuer Cron-Job `checkin-reminder.job.ts`. Lauf um 19:30 lokal:
- Wenn heute kein `pulse_mental_checkins`-Eintrag existiert UND `push_topics.checkin_reminder == true`:
- `sendPushToUser(userId, { topic: 'checkin_reminder', title: 'Wie war dein Tag?', body: 'Kurzer Mental-Check-in (30s).', url: '/coach', tag: 'checkin-...' })`

### 5.3 Risk-Watch Critical
In `risk-engine.ts` nach `upsert` eines neuen `critical`-Signals:
- Wenn das Signal NEU war (kein `severity == 'critical'` für selbe `rule_id` aktiv vorher): Push.
- `sendPushToUser(userId, { topic: 'risk_critical', title: signal.title, body: signal.recommendation, url: '/', tag: `risk-${signal.ruleId}` })`

---

## Task 6: Frontend — Service Worker

`frontend/public/sw.js`:

```javascript
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      data: { url: data.url ?? '/' },
      icon: '/icon-192.png',
      badge: '/badge-72.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((wins) => {
      const url = event.notification.data?.url ?? '/';
      const existing = wins.find(w => w.url.includes(self.location.origin));
      if (existing) { existing.focus(); return existing.navigate(url); }
      return clients.openWindow(url);
    })
  );
});
```

`frontend/public/manifest.webmanifest`:

```json
{
  "name": "Pulse",
  "short_name": "Pulse",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Zwei Icons aus vorhandenen Logo-Assets exportieren (192px, 512px PNG).

In `index.html`:
```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Pulse" />
```

---

## Task 7: Frontend — Subscribe-Helper

`frontend/src/lib/push-client.ts`:

```typescript
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration>;

export async function subscribeToPush(): Promise<PushSubscription | null>;
export async function unsubscribeFromPush(): Promise<void>;
export async function getPushPermissionState(): Promise<NotificationPermission>;
```

Logik:
- `ensureServiceWorker()` registriert `/sw.js`, wartet auf `ready`.
- `subscribeToPush()`:
  - Permission anfragen (`Notification.requestPermission()`).
  - `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VITE_VAPID_PUBLIC_KEY })`.
  - Result an Backend `POST /pulse/push/subscribe`.

---

## Task 8: Frontend — Settings-UI

In `Settings.tsx` neue Sektion „Benachrichtigungen":

```
┌────────────────────────────────────────────────┐
│ BENACHRICHTIGUNGEN                              │
├────────────────────────────────────────────────┤
│ [ • ] Push aktivieren                  [Test]  │
│                                                 │
│ Themen                                          │
│ [✓] Daily Briefing            (06:30–08:00)    │
│ [✓] Check-in Reminder         (19:30)          │
│ [✓] Risiko-Warnungen          (sofort)         │
│                                                 │
│ Stille Zeiten                                   │
│  Von [22:00]  bis  [06:30]                     │
│                                                 │
│ Geräte (2)                                      │
│  · iPhone 15 Pro – aktiv seit 28.04.            │
│  · Mac Safari    – aktiv seit 27.04.   [×]     │
└────────────────────────────────────────────────┘
```

iOS-Hinweis-Box wenn auf iOS Safari ohne Install:
> „Auf iPhone musst du Pulse zuerst zum Home-Bildschirm hinzufügen, um Push zu erhalten."

---

## Task 9: Tests

- `backend/src/lib/push.test.ts`:
  - Quiet-Hour-Check (briefing wird deferred, risk_critical nicht)
  - Topic-Filter (deaktivierter topic → kein send)
  - 410-Response → subscription disabled
- `backend/src/jobs/checkin-reminder.job.test.ts`:
  - Push nur, wenn kein Check-in heute
  - Push nicht, wenn `checkin_reminder == false`
- `backend/src/pulse/plugin.test.ts`: Subscription-CRUD + Auth.

---

## Task 10: Privacy / Sicherheit

- Body-Texte nie länger als 140 Zeichen, keine PII außer dem Briefing-Auszug (akzeptabel — Tobi-only).
- VAPID-Keys nicht ins Repo. `.env.example` mit Placeholder. `.env` ist via `.gitignore` ausgeschlossen (existiert bereits).
- Subscription-Endpoint-URL ist sensibel (würde Push erlauben falls geleakt) — daher in `pulse_push_subscriptions` nur User-ownership-gebunden zugreifbar.

---

## Acceptance

- [ ] `npm run web-push:generate` erzeugt VAPID-Keys, sind im Server-`.env`
- [ ] Service Worker registriert sich auf Build-Frontend (Test mit `npm run build && npm run preview`)
- [ ] Subscribe-Flow auf iPhone-PWA und Mac-Safari funktioniert
- [ ] Daily Briefing löst Push aus, deduppt korrekt (Tag = `briefing-DATE`)
- [ ] Check-in-Reminder feuert nur bei fehlendem Check-in
- [ ] Risk-Critical ignoriert Quiet-Hours, Briefing respektiert sie
- [ ] Settings-Toggle deaktiviert Topic, Subscription bleibt enabled
- [ ] Bei 410-Response wird Subscription `enabled=false`, Settings zeigt Re-Subscribe-Hinweis
- [ ] Test-Push-Button funktioniert
- [ ] Keine Push wenn `enabled = false` für alle Subs eines Users
