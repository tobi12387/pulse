# Design: Mental Check-in + Proaktiver Coach

**Datum:** 2026-04-26  
**Status:** Approved

---

## Ziel

Tobi soll täglich seine mentale Verfassung intuitiv per Sprache erfassen können. Der Coach analysiert die Eingabe, stellt gezielte Nachfragen und speichert den Zustand strukturiert. Auf Basis der akkumulierten Daten (HRV, Schlaf, mentale Werte) erkennt das System Muster und warnt proaktiv vor kommenden Leistungs- oder Stimmungstälern.

---

## Schicht 1 — Eingabe (Voice Check-in im Coach-Tab)

### Mikrofon-Button
- Neuer Mikrofon-Button neben dem bestehenden Texteingabefeld im Coach-Tab
- **Gedrückt halten → sprechen → loslassen** — analog zu WhatsApp Sprachnachrichten
- Aufnahme läuft clientseitig via `MediaRecorder` API (WebM/Opus)
- Nach Loslassen: Audio-Blob wird an neuen Backend-Endpunkt `POST /api/pulse/checkin/voice` geschickt

### Transkription
- Backend schickt Audio an **OpenAI Whisper API** (`whisper-1`, language: `de`)
- Rückgabe: Transkript als Text
- Fallback: wenn Whisper-API nicht verfügbar, Fehlermeldung im Chat ("Transkription fehlgeschlagen, bitte als Text eingeben")

### Check-in-Erkennung durch LLM
Das LLM analysiert das Transkript mit einem System-Prompt der unterscheidet:
- **Check-in:** User beschreibt Befinden, Stimmung, Energie, Tagesgeschehen, Stressoren → strukturiert speichern + Nachfragen
- **Frage/Auftrag:** normaler Coach-Flow, kein Check-in gespeichert

### Nachfragen
Nach einem erkannten Check-in stellt das LLM **gezielte Nachfragen** — so viele wie nötig um ein vollständiges Bild zu bekommen, basierend auf dem was im Transkript unklar oder relevant erscheint. Beispiele:
- "Du hast Rückenprobleme erwähnt — schon länger oder nur heute?"
- "Wie viel steht heute noch an bei der Arbeit?"

Antworten des Users (Text oder Voice) fließen in den gespeicherten Check-in ein.

### Badge-Erinnerung
- Coach-Tab zeigt einen roten Badge-Punkt wenn für heute noch kein Check-in existiert
- Badge verschwindet nach erstem Check-in des Tages
- Prüfung: `GET /api/pulse/checkin/today` — bereits vorhanden, wird erweitert

---

## Schicht 2 — Analyse & Speicherung

### Erweiterung `pulse_mental_checkins`
Die Tabelle hat bereits `mood`, `energy`, `stress`, `motivation` (Integer 1–10) und `notes` (text). Diese bleiben unverändert. Neue nullable Spalten:

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `themes` | text[] | Erkannte Themen (z.B. ["Arbeit", "Schlaf", "Rücken"]) |
| `source` | text | `'voice'` oder `'text'`, default `'text'` |
| `coach_questions` | jsonb | Gestellte Nachfragen + Antworten als Array |

`notes` übernimmt das vollständige Transkript + Nachfrage-Antworten.  
Das LLM extrahiert `mood`, `energy`, `stress`, `motivation` als Integer 1–10 und gibt sie als strukturiertes JSON zurück (parallel zur Chat-Antwort, nicht sichtbar für User).

### Migration
Additive DB-Migration — keine bestehenden Spalten werden geändert.

---

## Schicht 3 — Prognose & Proaktiver Coach

### Prognose-Engine (`pulse/services/prognosis-engine.ts`)
Neue Service-Funktion die täglich (oder bei jedem Home-Screen-Aufruf) läuft:

**Inputs:**
- Letzte 14 Tage `pulse_daily_metrics` (HRV, Schlaf, Body Battery, Stress)
- Letzte 14 Tage `pulse_mental_checkins` (mood, energy, stress)
- Aktuelle Trainingslast (`pulse_activities`, CTL/ATL/TSB)

**Logik:**
1. Trend-Analyse: lineare Regression über HRV der letzten 7 Tage → fallend?
2. Mentaler Score: Durchschnitt mood + energy der letzten 5 Tage → unter Baseline?
3. Trainingsbelastung: TSB stark negativ + HRV fallend → Überlastungsrisiko
4. Kombiniertes Signal: wenn ≥2 Faktoren negativ → Prognose-Alert generieren

**Output:** `{ alert: boolean, message: string, horizon_days: number, factors: string[] }`

### Darstellung auf Home-Screen
- Wenn `alert: true`: Coach-Karte auf Home-Screen unterhalb des Readiness-Scores
- Dunkelblau/grün Gradient, klar als Coach-Hinweis erkennbar
- Zeigt: was erkannt wurde, konkrete Empfehlung, Datenbasis (transparent)
- Karte ist dismissible (wird für 24h ausgeblendet wenn weggeklickt)
- Kein Alert: keine Karte, kein Lärm

### Caching
- Prognose wird beim Home-Screen-Load berechnet, max. 1x pro Stunde neu berechnet (Redis-Cache)
- Kein separater Cronjob nötig

---

## Technische Architektur

```
Frontend (Coach-Tab)
  └── MicButton → MediaRecorder → Audio-Blob
        └── POST /api/pulse/checkin/voice
              ├── Whisper API → Transkript
              ├── LLM: check-in detection + extraction (JSON)
              ├── DB: INSERT/UPDATE pulse_mental_checkins
              └── LLM: Chat-Antwort + Nachfragen → SSE stream

Frontend (Home-Tab)
  └── GET /api/pulse/home
        └── prognosis-engine.ts → { alert, message, factors }
              └── Redis cache (1h TTL)
```

---

## Was nicht in diesem Scope ist

- Push-Notifications (kann später ergänzt werden)
- Ernährungserfassung via Voice
- Historische Stimmungs-Charts in der Data-Page (Folgefeature)
- Apple Health Integration

---

## Erfolgskriterien

1. User kann per Sprache in <10 Sekunden einen Check-in starten
2. Das LLM erkennt zuverlässig Check-in vs. Frage (manuell validiert)
3. Prognose-Alert erscheint wenn HRV >3 Tage fällt + mentaler Score unter Baseline
4. Badge verschwindet nach Check-in — kein Neustart nötig
