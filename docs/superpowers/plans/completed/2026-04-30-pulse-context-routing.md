# PulseContext Routing

**Goal:** Coach, Voice-Check-in, Live-Briefing und UI-Caches sollen denselben kanonischen PulseContext nutzen.

1. Typed Coach Chat liest und schreibt `pulse_coach_sessions` statt Legacy `chat_messages`.
2. Live-Briefing baut seinen Prompt aus `PulseContext`, wie der Briefing-Job.
3. Mutationen, die PulseContext verändern, invalidieren serverseitige und frontendseitige Briefing-/Home-/Coach-Kontexte zuverlässig.

## Architektur

- Kein Rebuild alter completed-Pläne und keine neue Produktfläche.
- Legacy `/api/chat/*` bleibt vorerst kompatibel, wird aber nicht mehr von der Coach-UI genutzt.
- Live-Briefing nutzt dieselbe Prompt-Builder-Strecke wie der Background-Briefing-Job. Race-Day-Logik bleibt als Spezialpfad erhalten.
- Briefing-Cache-Keys müssen unter `pulse:${userId}:...` liegen, damit `invalidateUser(userId)` sie löscht.

## File Map

| Typ | Datei |
|---|---|
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `backend/src/pulse/lib/pulse-cache.ts` |
| Modify | `backend/src/pulse/lib/pulse-context.ts` |
| Modify | `backend/src/jobs/briefing-generation.job.ts` |
| Modify | `backend/src/pulse/plugin.test.ts` |
| Modify | `backend/src/routes/chat.ts` |
| Modify | `backend/src/routes/chat.test.ts` |
| Modify | `frontend/src/pulse/api-client.ts` |
| Modify | `frontend/src/pulse/hooks.ts` |
| Modify | `frontend/src/pages/Coach.tsx` |
| Modify | `docs/decisions.md` |
| Modify | `docs/ai/current-focus.md` |

## Tasks

1. **Pulse coach history:** Ergänze `GET /api/pulse/coach/history` und `DELETE /api/pulse/coach/history` auf Basis der neuesten `pulse_coach_sessions`-Session.
2. **Briefing convergence:** Exportiere den Briefing-Systemprompt, baue Live-Briefings mit `buildCachedPulseContextFor()` + `buildBriefingUserContentRich()`, und verschiebe den Live-Briefing-Cache auf ein `pulse:${userId}:briefing:${date}`-Muster.
3. **Cache invalidation:** Invaliderung bei Risk-Snooze/Resolve und Check-in/Plan-relevanten Frontend-Mutationen auf Home, Readiness/Load, Briefing, Risk und Coach-History ausweiten.
4. **Coach UI:** Entferne Legacy-Chat-Aufrufe aus `Coach.tsx`; nutze Pulse-API, Pulse Query Keys und dieselbe Session-History für Text und Voice.
5. **Verification:** Fokus auf Build, Migrationcheck, betroffene Backend-Tests und GitHub CI.

## Acceptance

- Coach-UI ruft keine `/api/chat/*` Endpoints mehr auf.
- Text- und Voice-Nachrichten erscheinen in derselben Pulse-Coach-History.
- Live-Briefing nutzt PulseContext inklusive Risk/RPE/Recovery-Kontext.
- Check-in, Risk-Aktionen und relevante Plan-Änderungen lassen veraltete Briefings nicht im Client oder Redis hängen.
