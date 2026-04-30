# Plan Intelligence Depth

**Goal:** Wochenplaene sollen weniger repetitiv sein und staerker aus Tobis Ziel, aktueller Form und subjektivem RPE entstehen.

1. Die deterministische Plan-Engine waehlt Sportarten und harte Reize zielbezogen statt ueber eine starre Phasenrotation.
2. Jede erzeugte Einheit bekommt eine HR-first Basisbeschreibung mit konkreter Pulsrange, auch wenn LLM-Enrichment ausfaellt.
3. Hohe RPE-Werte aus kuerzlichen leichten Einheiten wirken als Safety-Signal: weniger Dichte, keine harten Reize.

## Architektur

- Keine neue UI-Flaeche und keine Migration in diesem Slice.
- Bestehende `planDecision.reasons` bleiben der sichtbare Erklaerkanal fuer freie Tage und Safety-Entscheidungen.
- LLM bleibt nur Beschreibungsschicht; Trainingsstruktur und Safety-Regeln bleiben deterministisch testbar.
- Bestehende Health-State-, Risk-Watch- und Race-Taper-Safeties bleiben Vorranglogik.

## File Map

| Typ | Datei |
|---|---|
| Modify | `backend/src/pulse/services/plan-engine.ts` |
| Modify | `backend/src/pulse/services/plan-engine.test.ts` |
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `docs/decisions.md` |
| Modify | `docs/ai/current-focus.md` |

## Tasks

1. **Goal Profile:** Erweitere den Plan-Input um Zielmetadaten (`metrics`, Race-Disziplin/Distanz) und leite daraus Sportmix + bevorzugte harte Sportart ab.
2. **RPE Safety:** Werte kuerzliche RPE-Feedbacks aus; RPE >= 8 auf Z1/Z2 oder mehrere hohe RPEs reduzieren Sessionzahl und blockieren Z4/Z5.
3. **HR-first fallback:** Generiere Basisbeschreibungen mit HR-Range aus LTHR oder MaxHR-Fallback, bevor das LLM Beschreibungen anreichert.
4. **Route wiring:** Reiche RPE, geplante Zone und Zielmetadaten aus `/api/pulse/plan/generate` und Availability-Regeneration in die Plan-Engine durch.
5. **Tests:** Decke FTP/Bike-Fokus, Run/Triathlon-Race-Fokus, RPE-Intensity-Block und HR-Beschreibungs-Fallback ab.

## Acceptance

- FTP-Ziele erzeugen bike-lastigere Wochen und platzieren harte Reize auf Bike-Einheiten.
- Lauf- oder Triathlon-Race-Ziele erzeugen sichtbare Sport-Spezifik statt identischer Standardrotation.
- Nach einer leichten Einheit mit RPE >= 8 entstehen keine Z4/Z5-Einheiten in der Folgewoche.
- Workouts haben auch bei leerer LLM-Antwort eine sinnvolle HR-first Beschreibung.
