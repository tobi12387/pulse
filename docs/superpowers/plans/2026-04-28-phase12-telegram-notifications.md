# Phase 12: Telegram-Notifications

> **Für agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.

**Ziel:** Pulse soll aktiv ans Handy pushen, ohne dass Tobi die App öffnet. Drei Push-Trigger, ein zwei-Wege-Bot.

1. **Morning Briefing** (07:00) — der bereits generierte Briefing-Text als Telegram-Message
2. **Check-in-Reminder** (21:00, falls heute kein Check-in) — mit "Antwort = Check-in"-Konvention
3. **Workout-Reminder** (variabel, X Stunden vor geplantem Workout) — Workout-Beschreibung + Garmin-Link
4. **Inbound Bot-Commands**: `/briefing`, `/checkin`, `/heute`, `/plan`

**Architektur:** Telegram Bot API (HTTP polling oder Webhook). Single-User, single-chat-id — kein User-Mapping nötig, chat-id im env oder DB. BullMQ-Cron-Jobs (Redis bereits da). Keine PWA, kein Apple Push, keine SMS — Telegram-Bot deckt alles ab und kostet $0.

**Repo root:** `/root/pulse`

---

## Kritische Voranalyse

| Anforderung | Ist | Soll |
|---|---|---|
| Push-Mechanismus | keiner | Telegram Bot |
| Briefing-Endpoint | `GET /briefing` cached | wiederverwendet, Job triggert ihn um 07:00 |
| Check-in über Bot | nicht möglich | `/checkin` startet kurzen Dialog |
| Coach-Chat über Bot | nicht möglich | Bonus, optional |
| chat-id Persistenz | — | `pulse_telegram_settings` (single row) |
| Cron-Infrastruktur | BullMQ existiert | wiederverwenden |

---

## File Map

| Aktion | Pfad |
|--------|------|
| Create | `backend/src/lib/telegram.ts` |
| Create | `backend/src/db/migrations/0012_telegram.sql` |
| Modify | `backend/src/db/pulse-schema.ts` |
| Create | `backend/src/jobs/telegram-cron.job.ts` |
| Create | `backend/src/jobs/telegram-webhook.job.ts` |
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `backend/src/server.ts` |
| Modify | `backend/.env` |
| Modify | `frontend/src/pages/Settings.tsx` |
| Modify | `frontend/src/pulse/api-client.ts` |

---

## Task 1: Bot-Setup & Env

**Manuell (einmalig):**
1. Tobi spricht mit `@BotFather` → erstellt Bot, bekommt Token.
2. Token in `/root/pulse/.env`: `TELEGRAM_BOT_TOKEN=...`
3. Bot starten, Tobi schreibt `/start` → Backend speichert `chat_id`.

**Webhook vs. Polling:** Webhook braucht öffentlichen HTTPS-Endpoint. Polling reicht für Single-User und ist simpler — wird in Task 4 verwendet.

---

## Task 2: DB-Schema

```sql
CREATE TABLE pulse_telegram_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  briefing_time TIME DEFAULT '07:00',
  checkin_reminder_time TIME DEFAULT '21:00',
  workout_reminder_hours_before INT DEFAULT 2,
  enabled_briefing BOOLEAN DEFAULT TRUE,
  enabled_checkin BOOLEAN DEFAULT TRUE,
  enabled_workout BOOLEAN DEFAULT TRUE,
  linked_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pulse_telegram_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  direction TEXT CHECK (direction IN ('out','in')),
  type TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

`pulse_telegram_log` für Debugging und um Doppel-Sends zu vermeiden.

---

## Task 3: Telegram-Lib

`backend/src/lib/telegram.ts`:

```typescript
const API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(chatId: number, text: string, opts?: {
  parseMode?: 'Markdown' | 'HTML';
  replyMarkup?: unknown;
}): Promise<void> { /* fetch POST sendMessage */ }

export async function getUpdates(offset: number, timeoutSec = 25): Promise<TelegramUpdate[]> {
  /* long-polling */
}

export interface TelegramUpdate { update_id: number; message?: { chat: { id: number }; text?: string; from?: { username?: string } } }
```

Dünne Wrapper, keine externe Lib.

---

## Task 4: Cron-Jobs (BullMQ)

`backend/src/jobs/telegram-cron.job.ts`:

```typescript
// 3 separate repeatable jobs
const briefingJob = await queue.add('briefing', { userId }, {
  repeat: { pattern: '0 7 * * *', tz: 'Europe/Berlin' }
});
const checkinJob = await queue.add('checkin-reminder', { userId }, {
  repeat: { pattern: '0 21 * * *', tz: 'Europe/Berlin' }
});
const workoutJob = await queue.add('workout-reminder', { userId }, {
  repeat: { pattern: '0 * * * *', tz: 'Europe/Berlin' }   // jede Stunde checken
});
```

**Worker-Logik:**

- **briefing**: ruft internen `GET /pulse/briefing` (mit Service-Token) → schickt Text via `sendMessage`. Idempotent durch `pulse_telegram_log` (heute schon gesendet?).
- **checkin-reminder**: prüft, ob heute Check-in fehlt → wenn ja, schickt "Wie war dein Tag? Antworte hier mit Stimmung/Energie/Stress/Motivation oder ✅ wenn du es schon in der App eingetragen hast."
- **workout-reminder**: lädt nächsten Workout für heute, falls in `workout_reminder_hours_before` Stunden → schickt Beschreibung. Idempotent.

---

## Task 5: Polling-Worker für Inbound

`backend/src/jobs/telegram-webhook.job.ts` als langlebiger Worker, kein BullMQ-Job:

```typescript
let offset = 0;
while (true) {
  const updates = await getUpdates(offset, 25);
  for (const u of updates) {
    offset = u.update_id + 1;
    if (!u.message?.text) continue;
    await handleInbound(u.message.chat.id, u.message.text);
  }
}
```

`handleInbound`:

| Eingang | Aktion |
|---|---|
| `/start` | speichert chat_id wenn Username matched, antwortet "verbunden" |
| `/briefing` | wie Cron-Briefing |
| `/heute` | nächster Workout heute oder Rest-Tag-Hinweis |
| `/checkin` | startet Check-in-Dialog (s.u.) |
| `/plan` | nächste 7 Tage als Liste |
| Freitext | wenn aktiver Check-in-Dialog → parse; sonst ignoriert oder an Coach-Engine |

**Check-in-Dialog (state in Redis, key `tg:checkin:{chatId}`):**

```
Bot: Wie ist deine Stimmung heute? (1-10)
User: 7
Bot: Energie?
User: 6
Bot: Stress?
User: 4
Bot: Motivation?
User: 8
Bot: Notizen? (oder "skip")
User: Beine müde
Bot: ✓ gespeichert. Stimmung 7 / Energie 6 / Stress 4 / Motivation 8.
```

---

## Task 6: Backend-Endpoints für Settings-UI

- `GET /pulse/telegram/status` → `{ linked: boolean; chatId?: number; settings?: TelegramSettings }`
- `POST /pulse/telegram/start-link` → returns `{ token: string; deeplink: string }` für `/start link_<token>` → einmalig 10min gültig
- `POST /pulse/telegram/settings` → Times/Toggles
- `POST /pulse/telegram/test` → schickt Test-Message
- `DELETE /pulse/telegram` → unlink

---

## Task 7: Settings-UI

In `Settings.tsx` neue Card "Telegram":

- **Nicht verbunden:** "Verbinden"-Button → erzeugt deeplink (`https://t.me/<botname>?start=link_<token>`), zeigt QR-Code (svg via qrcode lib oder server-side gen)
- **Verbunden:** Status, Test-Button, Toggles für 3 Notification-Typen, Zeit-Picker für Briefing/Check-in, Stunden-Slider für Workout-Reminder
- **Unlink-Button** mit confirm

---

## Task 8: Sicherheit & Rate-Limiting

- Bot-Commands nur akzeptieren von gespeicherter `chat_id` (oder bei `/start link_<token>` matching token).
- Telegram API hat eigene Limits — pro chat 1 msg/sec ist easy einhaltbar.
- `pulse_telegram_log` rotation: löschen nach 90 Tagen.

---

## Acceptance

- [ ] `/start link_<token>` linkt einen Bot zu Tobis User
- [ ] Um 07:00 lokal kommt Briefing aufs Handy
- [ ] Um 21:00 kommt Check-in-Reminder, *nur* wenn heute kein Check-in
- [ ] 2h vor Workout kommt Reminder mit Beschreibung
- [ ] `/heute` antwortet mit aktuellem Tagesplan
- [ ] Check-in via Bot erstellt korrekten DB-Eintrag in `pulse_mental_checkin`
- [ ] Settings-UI zeigt Status, kann Zeiten ändern, Test-Message schicken
- [ ] Polling-Worker überlebt PM2-Restart (kein Memory-Leak in 24h)
- [ ] Doppel-Sends verhindert durch `pulse_telegram_log`
