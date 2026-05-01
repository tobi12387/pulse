# Mental Check-in + Proaktiver Coach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voice-basierter täglicher Check-in im Coach-Tab, der mentale Zustände strukturiert speichert und auf der Home-Seite proaktiv vor Leistungstälern warnt.

**Architecture:** Frontend nimmt Audio auf (MediaRecorder), schickt base64-kodiertes WebM an `POST /api/pulse/checkin/voice`. Backend transkribiert via Whisper, analysiert per LLM (check-in vs. Frage, extrahiert Scores), speichert in `pulse_mental_checkins`, gibt Coach-Antwort zurück. Prognose-Engine läuft bei jedem Home-Aufruf (Redis-Cache 1h) und gibt bei negativem Trend einen Alert aus.

**Tech Stack:** Node.js/Fastify, Drizzle ORM, OpenAI Whisper API (`openai` npm), OpenRouter, Redis, React/TanStack Query, MediaRecorder API

---

## File Map

| File | Aktion | Verantwortung |
|------|--------|--------------|
| `backend/src/lib/env.ts` | Modify | OPENAI_API_KEY hinzufügen |
| `backend/src/lib/whisper.ts` | Create | Whisper-Transkription via openai package |
| `backend/src/db/pulse-schema.ts` | Modify | themes, source, coach_questions zu pulseMentalCheckins |
| `backend/src/pulse/services/coach-engine.ts` | Modify | Check-in-Erkennung + strukturierte Extraktion |
| `backend/src/pulse/services/coach-engine.test.ts` | Modify | Tests für neue check-in Logik |
| `backend/src/pulse/services/prognosis-engine.ts` | Create | HRV/Schlaf/Mental-Trend-Analyse |
| `backend/src/pulse/services/prognosis-engine.test.ts` | Create | Unit-Tests für Prognose-Logik |
| `backend/src/pulse/plugin.ts` | Modify | Voice-Endpunkt, Home-Endpunkt mit Prognose |
| `shared/types/pulse.ts` | Modify | PulsePrognosis Typ, PulseHomeScreenData erweitern, PulseMentalCheckin erweitern |
| `frontend/src/pulse/api-client.ts` | Modify | voiceCheckin API-Funktion |
| `frontend/src/pulse/hooks.ts` | Modify | useCheckinToday Hook |
| `frontend/src/pages/Coach.tsx` | Modify | MicButton, Badge, Voice-Flow |
| `frontend/src/pages/Home.tsx` | Modify | Prognose-Karte |

---

## Task 1: OpenAI env + Whisper-Client

**Files:**
- Modify: `backend/src/lib/env.ts`
- Create: `backend/src/lib/whisper.ts`

- [ ] **1.1 — OPENAI_API_KEY zu env.ts hinzufügen**

In `backend/src/lib/env.ts` in den `envSchema` Block einfügen:

```typescript
OPENAI_API_KEY: z.string().min(1).optional(), // für Whisper
```

- [ ] **1.2 — OPENAI_API_KEY in .env eintragen**

```bash
echo "OPENAI_API_KEY=sk-..." >> /root/pulse/.env
```

(Echten Key eintragen)

- [ ] **1.3 — whisper.ts erstellen**

Neue Datei `backend/src/lib/whisper.ts`:

```typescript
import OpenAI from 'openai';
import { env } from './env.js';
import { Readable } from 'node:stream';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY nicht konfiguriert');
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const buffer = Buffer.from(audioBase64, 'base64');
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'ogg';
  const filename = `audio.${ext}`;

  // openai SDK erwartet ein File-ähnliches Objekt
  const file = new File([buffer], filename, { type: mimeType });

  const response = await getClient().audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'de',
  });

  return response.text;
}
```

- [ ] **1.4 — openai npm package installieren**

```bash
cd /root/pulse/backend && npm install openai
```

- [ ] **1.5 — Build testen**

```bash
cd /root/pulse/backend && npm run build 2>&1 | tail -5
```

Erwartet: keine Fehler

- [ ] **1.6 — Commit**

```bash
cd /root/pulse && git add backend/src/lib/env.ts backend/src/lib/whisper.ts backend/package-lock.json backend/package.json
git commit -m "feat: add whisper transcription client + OPENAI_API_KEY env"
```

---

## Task 2: DB-Schema + Migration

**Files:**
- Modify: `backend/src/db/pulse-schema.ts`

- [ ] **2.1 — Migration SQL ausführen**

```bash
docker exec coaching-os-v2-postgres-1 psql -U postgres -d coaching_os_v2 -c "
ALTER TABLE pulse_mental_checkins
  ADD COLUMN IF NOT EXISTS themes       text[]  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source       text    DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS coach_questions jsonb DEFAULT NULL;
"
```

Erwartet: `ALTER TABLE`

- [ ] **2.2 — Drizzle-Schema aktualisieren**

In `backend/src/db/pulse-schema.ts` die `pulseMentalCheckins` Table-Definition erweitern. Bestehende Zeilen bleiben, neue anhängen vor der closing `}`:

```typescript
// vorher endet die Table mit:
  notes:      text('notes'),
  createdAt:  timestamp('created_at').notNull().defaultNow(),

// ersetzen durch:
  notes:           text('notes'),
  themes:          text('themes').array(),
  source:          text('source').default('text'),
  coachQuestions:  jsonb('coach_questions'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
```

- [ ] **2.3 — Shared Types erweitern**

In `shared/types/pulse.ts` das `PulseMentalCheckin` Interface erweitern:

```typescript
export interface PulseMentalCheckin {
  id: string;
  userId: string;
  date: string;
  mood: number;
  energy: number;
  stress: number;
  motivation: number;
  notes: string | null;
  themes: string[] | null;          // neu
  source: string;                    // neu
  coachQuestions: Array<{            // neu
    question: string;
    answer: string | null;
  }> | null;
  createdAt: string;
}
```

Außerdem `PulsePrognosis` Interface und `PulseHomeScreenData` erweitern:

```typescript
export interface PulsePrognosis {
  alert: boolean;
  message: string;
  horizon_days: number;
  factors: string[];
}

// In PulseHomeScreenData: prognosis Feld ergänzen
export interface PulseHomeScreenData {
  date: string;
  readiness: PulseReadiness;
  todayMetrics: PulseDailyMetrics | null;
  fitnessLoad: PulseFitnessLoad;
  recentActivities: PulseActivity[];
  nextWorkout: PulsePlannedWorkout | null;
  prognosis: PulsePrognosis;          // neu
}
```

- [ ] **2.4 — Build testen**

```bash
cd /root/pulse/backend && npm run build 2>&1 | tail -5
cd /root/pulse/frontend && npx tsc --noEmit 2>&1 | tail -5
```

Erwartet: keine Fehler

- [ ] **2.5 — Commit**

```bash
cd /root/pulse && git add backend/src/db/pulse-schema.ts shared/types/pulse.ts
git commit -m "feat: extend pulse_mental_checkins schema + PulsePrognosis type"
```

---

## Task 3: Coach-Engine — Check-in-Erkennung + Extraktion

**Files:**
- Modify: `backend/src/pulse/services/coach-engine.ts`
- Modify: `backend/src/pulse/services/coach-engine.test.ts`

- [ ] **3.1 — Test schreiben (failing)**

In `backend/src/pulse/services/coach-engine.test.ts` folgende Tests hinzufügen:

```typescript
import { classifyAndExtractCheckin } from './coach-engine.js';

describe('classifyAndExtractCheckin', () => {
  it('erkennt einen Check-in und extrahiert Scores', async () => {
    const result = await classifyAndExtractCheckin(
      'Ich fühl mich heute ziemlich müde, hab schlecht geschlafen, Rücken schmerzt etwas. Stimmung geht so.'
    );
    expect(result.isCheckin).toBe(true);
    expect(result.extraction).toBeDefined();
    expect(result.extraction!.mood).toBeGreaterThanOrEqual(1);
    expect(result.extraction!.mood).toBeLessThanOrEqual(10);
    expect(result.extraction!.themes).toContain('Schlaf');
  });

  it('erkennt eine Frage als kein Check-in', async () => {
    const result = await classifyAndExtractCheckin(
      'Wie viele Kilometer sollte ich diese Woche laufen?'
    );
    expect(result.isCheckin).toBe(false);
    expect(result.extraction).toBeUndefined();
  });
});
```

- [ ] **3.2 — Test ausführen (soll fehlschlagen)**

```bash
cd /root/pulse/backend && npm test -- --reporter=verbose src/pulse/services/coach-engine.test.ts 2>&1 | tail -15
```

Erwartet: FAIL — `classifyAndExtractCheckin is not a function`

- [ ] **3.3 — Neue Typen + Funktion in coach-engine.ts implementieren**

In `backend/src/pulse/services/coach-engine.ts` hinzufügen:

```typescript
export interface CheckinExtraction {
  mood:       number; // 1-10
  energy:     number; // 1-10
  stress:     number; // 1-10
  motivation: number; // 1-10
  themes:     string[];
  followUpQuestions: string[];
}

export interface CheckinClassification {
  isCheckin:  boolean;
  extraction: CheckinExtraction | undefined;
  coachReply: string;
}

const CHECKIN_SYSTEM_PROMPT = `Du bist Pulse, ein persönlicher Gesundheits- und Leistungscoach.

Analysiere die Nachricht des Nutzers und bestimme:
1. Ist dies ein Check-in (der Nutzer beschreibt seine aktuelle Befindlichkeit, Energie, Stimmung, Stressoren, Tagesgeschehen)?
2. Oder ist dies eine Frage oder ein Auftrag?

Antworte AUSSCHLIESSLICH mit folgendem JSON-Format (kein Markdown, kein Text davor oder danach):

{
  "isCheckin": true/false,
  "extraction": {          // nur wenn isCheckin=true
    "mood":       5,       // 1-10: wie gut fühlt sich der Nutzer emotional
    "energy":     6,       // 1-10: physische und mentale Energie
    "stress":     4,       // 1-10: Stresslevel (10 = maximal gestresst)
    "motivation": 7,       // 1-10: Motivation und Antrieb
    "themes":     ["Schlaf", "Rücken", "Arbeit"],  // erkannte Themen, auf Deutsch
    "followUpQuestions": ["Seit wann hast du Rückenschmerzen?"]  // gezielte Nachfragen
  },
  "coachReply": "Ich höre, dass du dich heute müde fühlst..."  // natürliche Coach-Antwort auf Deutsch
}

Bei isCheckin=false: extraction weglassen, coachReply ist normale Antwort auf die Frage.`;

export async function classifyAndExtractCheckin(text: string): Promise<CheckinClassification> {
  const raw = await llmComplete(CHECKIN_SYSTEM_PROMPT, text, SMART_MODEL);

  try {
    const parsed = JSON.parse(raw) as {
      isCheckin: boolean;
      extraction?: CheckinExtraction;
      coachReply: string;
    };
    return {
      isCheckin:  parsed.isCheckin ?? false,
      extraction: parsed.isCheckin ? parsed.extraction : undefined,
      coachReply: parsed.coachReply ?? '',
    };
  } catch {
    // JSON-Parse-Fehler → als Frage behandeln, rohe Antwort nutzen
    return { isCheckin: false, extraction: undefined, coachReply: raw };
  }
}
```

- [ ] **3.4 — Tests ausführen**

```bash
cd /root/pulse/backend && npm test -- src/pulse/services/coach-engine.test.ts 2>&1 | tail -10
```

Erwartet: alle Tests PASS

- [ ] **3.5 — Commit**

```bash
cd /root/pulse && git add backend/src/pulse/services/coach-engine.ts backend/src/pulse/services/coach-engine.test.ts
git commit -m "feat: add check-in classification + structured extraction to coach-engine"
```

---

## Task 4: Voice-Endpunkt

**Files:**
- Modify: `backend/src/pulse/plugin.ts`

- [ ] **4.1 — Import whisper.ts in plugin.ts**

Oben in `backend/src/pulse/plugin.ts` hinzufügen:

```typescript
import { transcribeAudio } from '../lib/whisper.js';
import { classifyAndExtractCheckin } from './services/coach-engine.js';
```

- [ ] **4.2 — Voice-Endpunkt implementieren**

In `backend/src/pulse/plugin.ts` nach dem bestehenden `POST /checkin` Endpunkt einfügen:

```typescript
// POST /api/pulse/checkin/voice
app.post('/checkin/voice', { onRequest: [app.authenticate] }, async (req, reply) => {
  const schema = z.object({
    audio:    z.string().min(1),   // base64
    mimeType: z.string().default('audio/webm'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Anfrage' });

  const userId = req.user.sub;
  const today  = new Date().toISOString().split('T')[0]!;

  // 1. Transkription
  let transcript: string;
  try {
    transcript = await transcribeAudio(parsed.data.audio, parsed.data.mimeType);
  } catch (err) {
    app.log.error(`[voice-checkin] Whisper error: ${err}`);
    return reply.status(502).send({ error: 'Transkription fehlgeschlagen, bitte als Text eingeben.' });
  }

  // 2. Check-in-Erkennung + Extraktion
  const classification = await classifyAndExtractCheckin(transcript);

  // 3. Falls Check-in: in DB speichern
  let checkinId: string | null = null;
  if (classification.isCheckin && classification.extraction) {
    const ex = classification.extraction;
    const [existing] = await db.select({ id: pulseMentalCheckins.id, notes: pulseMentalCheckins.notes })
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));

    if (existing) {
      // Update: Anhängen an bestehenden Check-in (Nachfrage-Antwort)
      const updatedNotes = [existing.notes, transcript].filter(Boolean).join('\n---\n');
      await db.update(pulseMentalCheckins)
        .set({
          mood:       ex.mood,
          energy:     ex.energy,
          stress:     ex.stress,
          motivation: ex.motivation,
          themes:     ex.themes,
          notes:      updatedNotes,
          source:     'voice',
        })
        .where(eq(pulseMentalCheckins.id, existing.id));
      checkinId = existing.id;
    } else {
      const [inserted] = await db.insert(pulseMentalCheckins).values({
        userId,
        date:       today,
        mood:       ex.mood,
        energy:     ex.energy,
        stress:     ex.stress,
        motivation: ex.motivation,
        themes:     ex.themes,
        notes:      transcript,
        source:     'voice',
        coachQuestions: ex.followUpQuestions.map(q => ({ question: q, answer: null })),
      }).returning({ id: pulseMentalCheckins.id });
      checkinId = inserted!.id;
    }
  }

  // 4. Coach-Antwort in Session speichern
  const userMsg: PulseCoachMessage  = { role: 'user',      content: transcript,                    timestamp: new Date().toISOString() };
  const botMsg:  PulseCoachMessage  = { role: 'assistant', content: classification.coachReply,     timestamp: new Date().toISOString() };

  const [session] = await db.select({ id: pulseCoachSessions.id, messages: pulseCoachSessions.messages })
    .from(pulseCoachSessions)
    .where(eq(pulseCoachSessions.userId, userId))
    .orderBy(desc(pulseCoachSessions.lastMessageAt))
    .limit(1);

  if (session) {
    const msgs = session.messages as PulseCoachMessage[];
    await db.update(pulseCoachSessions)
      .set({ messages: [...msgs.slice(-20), userMsg, botMsg], lastMessageAt: new Date() })
      .where(eq(pulseCoachSessions.id, session.id));
  } else {
    await db.insert(pulseCoachSessions).values({ userId, messages: [userMsg, botMsg] });
  }

  return {
    transcript,
    reply:     classification.coachReply,
    isCheckin: classification.isCheckin,
    followUpQuestions: classification.extraction?.followUpQuestions ?? [],
    checkinId,
  };
});
```

- [ ] **4.3 — Build + Restart**

```bash
cd /root/pulse/backend && npm run build 2>&1 | tail -3 && pm2 restart pulse --update-env
```

Erwartet: Build erfolgreich, PM2 online

- [ ] **4.4 — Endpunkt manuell testen**

```bash
# Kurzen Test-Audio-Blob als base64 senden (leerer 1s WebM)
curl -s -X POST http://localhost:3000/api/pulse/checkin/voice \
  -H "Content-Type: application/json" \
  -d '{"audio":"GkXfo59ChoEBQveBAULygQRC84EIQoKEd2ZmhhczlGCCgQJzxYgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","mimeType":"audio/webm"}' 2>&1
```

Erwartet: `{"error":"Transkription fehlgeschlagen..."}` oder echte Antwort wenn Key gesetzt

- [ ] **4.5 — Commit**

```bash
cd /root/pulse && git add backend/src/pulse/plugin.ts
git commit -m "feat: add POST /api/pulse/checkin/voice endpoint"
```

---

## Task 5: Prognose-Engine

**Files:**
- Create: `backend/src/pulse/services/prognosis-engine.ts`
- Create: `backend/src/pulse/services/prognosis-engine.test.ts`

- [ ] **5.1 — Tests schreiben (failing)**

Neue Datei `backend/src/pulse/services/prognosis-engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeLinearTrend, buildPrognosis } from './prognosis-engine.js';

describe('computeLinearTrend', () => {
  it('erkennt fallenden Trend', () => {
    const values = [50, 48, 45, 43, 40, 38, 35];
    expect(computeLinearTrend(values)).toBeLessThan(0);
  });

  it('erkennt steigenden Trend', () => {
    const values = [35, 38, 40, 43, 45, 48, 50];
    expect(computeLinearTrend(values)).toBeGreaterThan(0);
  });

  it('gibt 0 bei weniger als 3 Werten zurück', () => {
    expect(computeLinearTrend([40, 42])).toBe(0);
  });
});

describe('buildPrognosis', () => {
  it('gibt alert=true bei fallender HRV + erhöhtem Stress', () => {
    const result = buildPrognosis({
      hrv7d:      [55, 52, 50, 47, 44, 42, 39],
      mentalLast5: [{ mood: 5, energy: 4 }, { mood: 4, energy: 4 }, { mood: 4, energy: 3 }, { mood: 3, energy: 3 }, { mood: 3, energy: 3 }],
      tsb: -18,
    });
    expect(result.alert).toBe(true);
    expect(result.factors.length).toBeGreaterThanOrEqual(2);
  });

  it('gibt alert=false bei guten Werten', () => {
    const result = buildPrognosis({
      hrv7d:      [45, 46, 47, 48, 47, 48, 49],
      mentalLast5: [{ mood: 7, energy: 8 }, { mood: 8, energy: 7 }, { mood: 7, energy: 8 }, { mood: 8, energy: 8 }, { mood: 7, energy: 7 }],
      tsb: 5,
    });
    expect(result.alert).toBe(false);
  });
});
```

- [ ] **5.2 — Tests ausführen (soll fehlschlagen)**

```bash
cd /root/pulse/backend && npm test -- src/pulse/services/prognosis-engine.test.ts 2>&1 | tail -10
```

Erwartet: FAIL — Module not found

- [ ] **5.3 — prognosis-engine.ts implementieren**

Neue Datei `backend/src/pulse/services/prognosis-engine.ts`:

```typescript
import { db } from '../../lib/db.js';
import { redis } from '../../lib/redis.js';
import { pulseDailyMetrics, pulseMentalCheckins, pulseActivities } from '../../db/pulse-schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';
import type { PulsePrognosis } from '@coaching-os/shared/pulse';

const CACHE_TTL_SECONDS = 3600; // 1h

export function computeLinearTrend(values: number[]): number {
  if (values.length < 3) return 0;
  const n = values.length;
  const sumX  = values.reduce((s, _, i) => s + i, 0);
  const sumY  = values.reduce((s, v) => s + v, 0);
  const sumXY = values.reduce((s, v, i) => s + i * v, 0);
  const sumX2 = values.reduce((s, _, i) => s + i * i, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

export function buildPrognosis(input: {
  hrv7d:       number[];
  mentalLast5: Array<{ mood: number; energy: number }>;
  tsb:         number;
}): PulsePrognosis {
  const factors: string[] = [];

  // 1. HRV-Trend
  const hrvTrend = computeLinearTrend(input.hrv7d);
  if (hrvTrend < -1.5) factors.push('HRV fällt seit mehreren Tagen');

  // 2. Mentaler Durchschnitt
  if (input.mentalLast5.length >= 3) {
    const avgMental = input.mentalLast5.reduce((s, m) => s + (m.mood + m.energy) / 2, 0) / input.mentalLast5.length;
    if (avgMental < 5.0) factors.push('Mentale Energie und Stimmung unter Baseline');
  }

  // 3. Trainingsbelastung
  if (input.tsb < -15) factors.push('Hohe akkumulierte Trainingsbelastung (TSB negativ)');

  const alert = factors.length >= 2;

  let message = '';
  let horizon_days = 0;
  if (alert) {
    horizon_days = 2 + Math.floor(Math.abs(hrvTrend));
    message = `Muster erkannt: mögliches Leistungstief in ~${horizon_days} Tagen. ` +
      `${factors.join(', ')}. Empfehlung: Intensität reduzieren, Schlaf priorisieren.`;
  }

  return { alert, message, horizon_days, factors };
}

export async function getPrognosis(userId: string): Promise<PulsePrognosis> {
  const cacheKey = `prognosis:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as PulsePrognosis;

  const since14d = new Date(Date.now() - 14 * 86_400_000).toISOString().split('T')[0]!;

  const [metrics, checkins] = await Promise.all([
    db.select({
      date:      pulseDailyMetrics.date,
      hrvRmssd:  pulseDailyMetrics.hrvRmssd,
    }).from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since14d)))
      .orderBy(pulseDailyMetrics.date),

    db.select({
      mood:   pulseMentalCheckins.mood,
      energy: pulseMentalCheckins.energy,
      date:   pulseMentalCheckins.date,
    }).from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since14d)))
      .orderBy(desc(pulseMentalCheckins.date))
      .limit(5),
  ]);

  // TSB aus letztem verfügbaren Fitness-Load (einfach: letzter Wert)
  const { computeFitnessLoad } = await import('./load-engine.js');
  const today = new Date().toISOString().split('T')[0]!;
  const load  = await computeFitnessLoad(userId, today);

  const hrv7d = metrics
    .slice(-7)
    .map(m => m.hrvRmssd)
    .filter((v): v is number => v !== null);

  const result = buildPrognosis({
    hrv7d,
    mentalLast5: checkins.map(c => ({ mood: c.mood, energy: c.energy })),
    tsb: load.tsb,
  });

  await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
  return result;
}
```

- [ ] **5.4 — Tests ausführen**

```bash
cd /root/pulse/backend && npm test -- src/pulse/services/prognosis-engine.test.ts 2>&1 | tail -10
```

Erwartet: alle Tests PASS

- [ ] **5.5 — Commit**

```bash
cd /root/pulse && git add backend/src/pulse/services/prognosis-engine.ts backend/src/pulse/services/prognosis-engine.test.ts
git commit -m "feat: add prognosis engine with HRV trend + mental score analysis"
```

---

## Task 6: Home-Endpunkt + Shared Types

**Files:**
- Modify: `backend/src/pulse/plugin.ts`

- [ ] **6.1 — getPrognosis in Home-Endpunkt integrieren**

In `backend/src/pulse/plugin.ts` oben neuen Import hinzufügen:

```typescript
import { getPrognosis } from './services/prognosis-engine.js';
```

Im `GET /home` Handler den `Promise.all` Block erweitern. Aktuell sind `metrics`, `mental`, `recentActivities`, `nextWorkout` und `fitnessLoad` separate awaits. `getPrognosis` parallel dazu ausführen:

```typescript
// Nach den bestehenden DB-Abfragen, vor dem return, hinzufügen:
const prognosis = await getPrognosis(userId);

// Im return-Objekt ergänzen:
return {
  date: today,
  readiness,
  todayMetrics: metrics ? { /* bestehend */ } : null,
  fitnessLoad,
  recentActivities: recentActivities.map(/* bestehend */),
  nextWorkout: nextWorkout ? { /* bestehend */ } : null,
  prognosis,   // neu
};
```

- [ ] **6.2 — Build + Test**

```bash
cd /root/pulse/backend && npm run build 2>&1 | tail -3 && pm2 restart pulse --update-env
sleep 3 && curl -s http://localhost:3000/api/pulse/home | python3 -m json.tool 2>&1 | grep -A 5 "prognosis"
```

Erwartet: `"prognosis": { "alert": false/true, "message": "...", ... }`

- [ ] **6.3 — Commit**

```bash
cd /root/pulse && git add backend/src/pulse/plugin.ts
git commit -m "feat: include prognosis in home endpoint"
```

---

## Task 7: Frontend — API + Hooks

**Files:**
- Modify: `frontend/src/pulse/api-client.ts`
- Modify: `frontend/src/pulse/hooks.ts`

- [ ] **7.1 — voiceCheckin in api-client.ts**

In `frontend/src/pulse/api-client.ts` neue Funktion hinzufügen:

```typescript
export const pulseApi = {
  // ... bestehende Einträge ...

  checkin: {
    voice: (audio: string, mimeType: string) =>
      request<{
        transcript: string;
        reply: string;
        isCheckin: boolean;
        followUpQuestions: string[];
        checkinId: string | null;
      }>('/pulse/checkin/voice', {
        method: 'POST',
        body: JSON.stringify({ audio, mimeType }),
      }),

    today: () =>
      request<{ checkin: { id: string; date: string } | null }>('/pulse/checkin/today'),
  },
};
```

(`request` ist die bestehende Hilfsfunktion in dieser Datei — prüfe den genauen Import-Namen und passe ggf. an)

- [ ] **7.2 — useCheckinToday Hook in hooks.ts**

In `frontend/src/pulse/hooks.ts` hinzufügen:

```typescript
export function useCheckinToday() {
  return useQuery({
    queryKey: ['pulse', 'checkin', 'today'],
    queryFn: pulseApi.checkin.today,
    staleTime: 60_000,
  });
}
```

- [ ] **7.3 — Prüfen ob /api/pulse/checkin/today bereits existiert**

```bash
curl -s http://localhost:3000/api/pulse/checkin/today 2>&1
```

Falls 404: Endpunkt in `backend/src/pulse/plugin.ts` ergänzen:

```typescript
app.get('/checkin/today', { onRequest: [app.authenticate] }, async (req) => {
  const userId = req.user.sub;
  const today  = new Date().toISOString().split('T')[0]!;
  const [checkin] = await db.select({ id: pulseMentalCheckins.id, date: pulseMentalCheckins.date })
    .from(pulseMentalCheckins)
    .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));
  return { checkin: checkin ?? null };
});
```

- [ ] **7.4 — Build testen**

```bash
cd /root/pulse/frontend && npx tsc --noEmit 2>&1 | tail -5
```

Erwartet: keine Fehler

- [ ] **7.5 — Commit**

```bash
cd /root/pulse && git add frontend/src/pulse/api-client.ts frontend/src/pulse/hooks.ts backend/src/pulse/plugin.ts
git commit -m "feat: add voice checkin API client + useCheckinToday hook"
```

---

## Task 8: Frontend — Coach-Tab mit MicButton + Badge

**Files:**
- Modify: `frontend/src/pages/Coach.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **8.1 — MicButton in Coach.tsx implementieren**

`frontend/src/pages/Coach.tsx` komplett ersetzen:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/api/client';
import { pulseApi } from '@/pulse/api-client';
import { usePulseHome, useCheckinToday } from '@/pulse/hooks';
import { Button } from '@/components/ui/button';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]!); // strip data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function MicButton({ onResult }: { onResult: (transcript: string, reply: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading]     = useState(false);
  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const qc = useQueryClient();

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    chunksRef.current = [];
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob   = new Blob(chunksRef.current, { type: 'audio/webm' });
      const base64 = await blobToBase64(blob);
      setLoading(true);
      try {
        const res = await pulseApi.checkin.voice(base64, 'audio/webm');
        onResult(res.transcript, res.reply);
        if (res.isCheckin) {
          void qc.invalidateQueries({ queryKey: ['pulse', 'checkin', 'today'] });
        }
      } catch {
        onResult('', 'Transkription fehlgeschlagen — bitte als Text eingeben.');
      } finally {
        setLoading(false);
      }
    };
    mediaRef.current = mr;
    mr.start();
    setRecording(true);
  }, [onResult, qc]);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    setRecording(false);
  }, []);

  return (
    <button
      type="button"
      onMouseDown={start}
      onMouseUp={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      disabled={loading}
      aria-label={recording ? 'Aufnahme läuft' : 'Sprachaufnahme starten'}
      className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors self-end ${
        recording
          ? 'bg-red-500 text-white animate-pulse'
          : loading
          ? 'bg-muted text-muted-foreground'
          : 'bg-muted text-foreground hover:bg-muted/80'
      }`}
    >
      {loading ? '…' : '🎙'}
    </button>
  );
}

export default function Coach() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: home } = usePulseHome();
  const m = home?.todayMetrics;

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['chat-history'],
    queryFn: () => api.chat.history(),
  });

  const sendMessage = useMutation({
    mutationFn: (message: string) => api.chat.sendMessage(message),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chat-history'] }),
  });

  const clearHistory = useMutation({
    mutationFn: () => api.chat.deleteHistory(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chat-history'] }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [historyData?.messages.at(-1)?.id]);

  function handleSend() {
    const msg = input.trim();
    if (!msg || sendMessage.isPending) return;
    setInput('');
    sendMessage.mutate(msg);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleVoiceResult(_transcript: string, _reply: string) {
    // History neu laden — Backend hat Transcript + Reply bereits gespeichert
    void queryClient.invalidateQueries({ queryKey: ['chat-history'] });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex gap-4 px-1 py-2 border-b border-border text-xs text-muted-foreground mb-2 overflow-x-auto shrink-0">
        <span>Schlaf {m?.sleepHours != null ? `${m.sleepHours.toFixed(1)}h` : '–'}</span>
        <span>HRV {m?.hrvRmssd != null ? `${m.hrvRmssd.toFixed(0)} ms` : '–'}</span>
        <span>Batterie {m?.bodyBatteryMax ?? '–'}%</span>
        <span>Schritte {m?.steps != null ? `${(m.steps / 1000).toFixed(1)}k` : '–'}</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-4">Lade Verlauf…</p>}
        {!isLoading && historyData?.messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Drücke 🎙 und sprich — oder stell eine Frage.
          </p>
        )}
        {historyData?.messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
              msg.role === 'user' ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {sendMessage.isPending && (
          <div className="flex justify-end">
            <div className="bg-primary/50 text-primary-foreground rounded-xl px-3 py-2 text-sm">…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border pt-3 space-y-2 shrink-0">
        <div className="flex gap-2">
          <MicButton onResult={handleVoiceResult} />
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Stell dem Coach eine Frage…"
            rows={2}
            maxLength={2000}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            aria-label="Senden"
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground self-end"
          >
            →
          </Button>
        </div>
        <button
          type="button"
          onClick={() => clearHistory.mutate()}
          disabled={clearHistory.isPending}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Verlauf löschen
        </button>
      </div>
    </div>
  );
}
```

- [ ] **8.2 — Badge in Layout.tsx implementieren**

In `frontend/src/components/Layout.tsx`:

1. Import hinzufügen:
```typescript
import { useCheckinToday } from '@/pulse/hooks';
```

2. Im `Layout` Komponenten-Body hinzufügen:
```typescript
const { data: checkinData } = useCheckinToday();
const hasCheckin = !!checkinData?.checkin;
```

3. Im NavLink für `/coach` den Badge rendern. Den bestehenden `NavLink` für coach ersetzen:
```typescript
<NavLink key="/coach" to="/coach" end={false}
  className={({ isActive }) =>
    `relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs transition-colors ${
      isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
    }`
  }
>
  <span className="relative text-lg leading-none">
    💬
    {!hasCheckin && (
      <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-red-500 rounded-full" />
    )}
  </span>
  <span>Coach</span>
</NavLink>
```

Die anderen NavLinks bleiben als generisches `NAV_ITEMS.map(...)` — nur den Coach-Link separat rendern oder das Map durch individuelle Links ersetzen.

- [ ] **8.3 — TypeScript-Check**

```bash
cd /root/pulse/frontend && npx tsc --noEmit 2>&1 | tail -10
```

Erwartet: keine Fehler

- [ ] **8.4 — Commit**

```bash
cd /root/pulse && git add frontend/src/pages/Coach.tsx frontend/src/components/Layout.tsx
git commit -m "feat: add voice mic button to coach tab + checkin badge in nav"
```

---

## Task 9: Frontend — Home Prognose-Karte

**Files:**
- Modify: `frontend/src/pages/Home.tsx`

- [ ] **9.1 — Prognose-Karte in Home.tsx einbauen**

In `frontend/src/pages/Home.tsx` nach dem Readiness-Block (nach der ersten Card) folgendes einfügen:

```typescript
// Im JSX, nach der Readiness-Card, vor den Metriken:
{data.prognosis.alert && !dismissed && (
  <div className="relative rounded-xl p-4 text-sm text-white"
    style={{ background: 'linear-gradient(135deg, #1e3a5f, #1e4a3f)' }}
  >
    <button
      onClick={() => {
        setDismissed(true);
        localStorage.setItem('prognosis-dismissed', new Date().toDateString());
      }}
      className="absolute top-2 right-3 text-white/50 hover:text-white text-xs"
      aria-label="Schließen"
    >✕</button>
    <div className="text-[10px] text-white/60 mb-1 font-medium tracking-widest">⚡ PULSE COACH</div>
    <p className="leading-relaxed">{data.prognosis.message}</p>
    <div className="mt-2 text-[10px] text-white/50">
      Basierend auf: {data.prognosis.factors.join(' · ')}
    </div>
  </div>
)}
```

Außerdem `dismissed` State hinzufügen (oben in der Komponente):

```typescript
const [dismissed, setDismissed] = useState<boolean>(() => {
  return localStorage.getItem('prognosis-dismissed') === new Date().toDateString();
});
```

- [ ] **9.2 — TypeScript-Check + Build**

```bash
cd /root/pulse/frontend && npx tsc --noEmit 2>&1 | tail -5
cd /root/pulse/backend && npm run build 2>&1 | tail -3
```

Erwartet: keine Fehler

- [ ] **9.3 — Backend neu starten + End-to-End testen**

```bash
pm2 restart pulse --update-env
sleep 3 && curl -s http://localhost:3000/api/pulse/home | python3 -m json.tool | grep -A 6 '"prognosis"'
```

- [ ] **9.4 — Commit + Push**

```bash
cd /root/pulse && git add frontend/src/pages/Home.tsx
git commit -m "feat: add proactive prognosis card to home screen"
git push
```

---

## Abschluss-Check (nach allen Tasks)

- [ ] Mikrofon-Button erscheint im Coach-Tab links neben der Texteingabe
- [ ] Gedrückt halten → rotes pulsierendes Icon → loslassen → Transkript erscheint als User-Nachricht
- [ ] Coach antwortet mit Nachfragen wenn Check-in erkannt
- [ ] Badge auf Coach-Tab erscheint wenn kein Check-in heute — verschwindet nach Check-in
- [ ] `GET /api/pulse/home` enthält `prognosis` Objekt
- [ ] Prognose-Karte erscheint auf Home wenn `alert: true`
- [ ] Karte kann für heute dismissed werden
- [ ] Alle Backend-Tests grün: `cd /root/pulse/backend && npm test`
