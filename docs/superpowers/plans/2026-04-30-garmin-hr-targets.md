# Garmin HR Targets

**Goal:** HR-first soll nicht nur in Workout-Beschreibungen stehen, sondern bis in strukturierte Steps und Garmin-Workout-Targets durchgereicht werden.

1. `WorkoutStep` bekommt optionale HR-Zielbereiche in bpm.
2. Step-Generierung normalisiert jede Ausdauer-Einheit auf HR-first Targets aus LTHR oder MaxHR-Fallback.
3. Garmin-Workout-JSON nutzt `heart.rate.zone`/HR-Targets statt `no.target` fuer Run/Bike/Hike-Steps.

## Architektur

- Keine Migration: `steps` ist JSONB und kann optionale Felder aufnehmen.
- LLM darf Step-Texte und Struktur vorschlagen, aber HR-Ziele werden deterministisch serverseitig gesetzt.
- Schwimmen/Kraft bleiben ohne HR-Target, weil Garmin-Zielarten dort uneinheitlich sind und Pulse hier aktuell keine belastbare Zielsteuerung hat.
- Bestehende Upload- und Calendar-Sync-Flows bleiben erhalten.

## File Map

| Typ | Datei |
|---|---|
| Modify | `shared/types/pulse.ts` |
| Modify | `backend/src/db/pulse-schema.ts` |
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `frontend/src/components/WorkoutDetailModal.tsx` |
| Modify | `backend/src/pulse/plugin.test.ts` |
| Modify | `docs/decisions.md` |
| Modify | `docs/ai/current-focus.md` |

## Tasks

1. **Step Contract:** Fuege optionale `targetHrMinBpm`/`targetHrMaxBpm` und `targetLabel` zu `WorkoutStep` hinzu.
2. **Deterministic HR Targets:** Berechne Step-Zielbereiche aus Zone + LTHR oder MaxHR-Fallback; haenge sie auch dann an, wenn LLM keine bpm-Werte liefert.
3. **Garmin Export:** Erzeuge Garmin-Step-Targets fuer Ausdauer-Steps mit Heart-Rate-Zonen oder Custom-HR-Ranges; keine `no.target` fuer Run/Bike-Zielsteps.
4. **UI:** Zeige HR-Zielbereiche im Workout-Detail pro Step an.
5. **Tests:** Decke Plan-Detail-Generierung und Garmin-Upload-Payload mit HR-Targets ab.

## Acceptance

- Neue Workout-Details enthalten HR-Zielbereiche pro Run/Bike/Hike-Step.
- Garmin-Upload-Payload fuer Run/Bike/Hike enthaelt `heart.rate.zone` oder HR-Range statt `no.target`.
- Schwimmen/Kraft bleiben uploadbar ohne HR-Ziel.
- Typecheck und relevante Backend-Tests laufen gruen.
