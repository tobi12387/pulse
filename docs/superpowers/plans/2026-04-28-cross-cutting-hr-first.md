# Cross-Cutting: HR-First Training

> Stand 2026-04-28. **Querschnittsthema** — betrifft Phase 5 (retrofit), 6, 7, 8, 9, und alle künftigen Plan-/Activity-Features.

## Entscheidung

Tobi steuert ab sofort **primär über Puls**, Watt ist Sekundär-Info. Grund: bessere Echtzeit-Kontrolle, reflektiert systemische Tagesform, plattformunabhängig (auch ohne Powermeter z.B. auf MTB/Trail).

## Geltungsbereich

| Trainings-Typ | Steuerung | Begründung |
|---|---|---|
| Z1/Z2 Endurance (lang) | **HR primär**, RPE backup | Zone-2 = unter LT1 ist HR-definiert; HR reflektiert Wärme/Müdigkeit |
| Sweet Spot / Tempo (Z3) | **HR primär**, Watt sekundär | HR stabilisiert nach 5min, gut steuerbar |
| Threshold (Z4, 8–30 min) | **HR primär**, Watt zur Validierung | LTHR ist anchor; Watt zeigt ob HR-Drift normal |
| VO2max (3–5 min Intervalle) | **RPE primär, HR als Ergebnis** | HR lagged zu sehr für Intra-Intervall-Steuerung |
| HIIT < 90 s | **RPE/Pace primär** | HR nutzlos in der kurzen Phase |
| Race-Pacing | **HR primär** mit Pace/RPE-Cross-Check | Wettkampftauglichkeit von HR ist hoch |

## Voraussetzungen

1. **`lactateThresholdHr` muss aktuell sein.** Garmin erkennt das aber unzuverlässig. Empfehlung: 30-min-TT als Grundlage (avg HR der letzten 20 min = LTHR-Schätzer). UI-Hinweis in Settings, wenn LTHR nicht gesetzt oder älter als 6 Monate.
2. **HR-Zonen-Modell:** wir verwenden Friel's 7-Zonen-Modell auf LTHR-Basis (kompatibel zu Garmin):
   - Z1 = < 81 % LTHR
   - Z2 = 82–88 %
   - Z3 = 89–93 %
   - Z4 = 94–99 %
   - Z5a = 100–102 %
   - Z5b = 103–106 %
   - Z5c = > 106 %
   Pulse mappt seine internen Zonen 1–5 auf Z1, Z2, Z3, Z4, Z5b (= sweet spot der polarized-Praxis).
3. **MaxHR weiterhin nötig** für Garmin-Workout-Sync (Garmin braucht Cap), aber nicht für Zonen-Definition.

## Was sich in den Phasen ändert

### Phase 5 (retrofit, bereits live)
- `generateWorkoutFeedback()` in `garmin.ts`: Zone-Reference-Range ausschließlich aus HR (LTHR oder MaxHR-Fallback), Power nur als Zusatzinfo wenn vorhanden.
- Compliance-Score: prozentuale Zeit in Soll-HR-Zone, nicht in Soll-Power-Zone.

### Phase 6 (Health States & Adaptive Plan)
- AdjustTodayCard zeigt HR-Range als Primary, Power-Range als Secondary in Klammer.
- Plan-Engine-Prompt: Zonen-Definitionen als `% LTHR` formuliert.

### Phase 7 (Race Mode)
- Race-Day-Briefing: Pacing-Plan in HR (z.B. „Bike: avg HR 158, Cap 168"), Watt-Targets nur für Bike als Cross-Check.
- `predictRaceTime`: Riegel-Formel auf Pace-Basis (bestehend), HR-Drift-Penalty wenn keine konstante HR-Historie.

### Phase 8 (Activity Intelligence)
- **Aerobic Decoupling = Pa:HR** (Pace-to-Heart-Rate) für Run und EF (Pace pro 1bpm) — nicht Pw:HR.
- Bike: HR:Speed-Decoupling (analog), zusätzlich klassisches Pw:HR wenn Power vorhanden (informativ).
- Efficiency Factor: für Run = Pace pro HR; für Bike = NP/avg HR wenn Power vorhanden, sonst Speed/HR.

### Phase 9 (Recovery & Fueling)
- Sleep-Debt + HRV-Deviation kombiniert mit Tages-HR-Baseline (Ruhepuls-Drift) als „Recovery-Score" auf Home.

## Frontend-Konvention

Wo bisher `220 W (Z2)` stand, ab jetzt:

```
Z2  ·  138-148 bpm   ( 195-215 W )
```

HR-Range fett, Power-Range grau. Wenn keine Power-Daten → nur HR.

## Migrations-Notiz

Bestehende Workouts in `pulse_planned_workouts` haben `zone: int`. Wir leiten HR-Range bei Anzeige aus Profile.lthr ab — **keine Migration der Workouts nötig**. Beim Garmin-Workout-Sync (Phase 5/6 Code) wird der HR-Target-Typ verwendet statt Power-Target.

## Validierung

- LTHR-Wert plausibel (140-180 bpm Range Check)
- 7-Zonen-Map korrekt (Test mit synthetischen LTHR=160 → Z1<130, Z4 150-159)
- Plan-Engine LLM-Prompt enthält keine harten Watt-Targets mehr
- Garmin-Workout-Sync setzt `targetType: 'heart.rate.zone'` (nicht `power.zone`)
