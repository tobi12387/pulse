# Home + Plan Desktop Cleanup

## Goal

Make the desktop Plan page calmer and more consistent with Home by removing visible duplicate daily-decision copy. Home owns the daily decision. Plan owns weekly planning, execution trust, adaptation inbox and review.

## Benchmark Notes

- Garmin Daily Suggested Workouts are a day-of recommendation based on training status, load/load focus, VO2 max, recovery, sleep and recent workouts, and the suggestion disappears after completion. Pulse takeaway: the daily decision should live on Heute and should not keep presenting itself as open once the day is closed. Source: <https://support.garmin.com/en-US/?faq=oYknGZ910l1pfBNzkDHX6A>
- Garmin Training Readiness is continuously recalculated from acute load, HRV, recovery time, sleep score/history and stress history. Pulse takeaway: readiness evidence supports the daily decision, but should not be duplicated as a second planner narrative. Source: <https://support.garmin.com/en-CA/?faq=hsKqNlQksk0Q6Zf1EbIjO9>
- TrainerRoad TrainNow is explicitly a day-of tool using recent training history and filters for duration/type; it is not a replacement for a structured plan. Pulse takeaway: spontaneous options belong near the daily decision, while Plan should stay calendar/structure oriented. Source: <https://support.trainerroad.com/hc/en-us/articles/360057075531-TrainNow-Overview>
- TrainingPeaks centers device execution around structured workouts on the calendar and Garmin sync, including a future sync window. Pulse takeaway: Plan should make calendar/device status concrete, not repeat daily coaching copy. Source: <https://help.trainingpeaks.com/hc/en-us/articles/115000325647-Structured-Workout-sync-and-Manual-Export>
- Oura separates Today as the most timely surface from Vitals/My Health detail. Pulse takeaway: Heute may be concise and dynamic, while deeper evidence should live in Data/Plan detail areas. Source: <https://support.ouraring.com/hc/en-us/articles/42987005571859-How-to-Use-the-Oura-App>
- Athletica adjusts plans after completed workouts and manual athlete/coach interventions. Pulse takeaway: Plan should expose plan-change/adaptation consequences, not another daily hero. Source: <https://support.athletica.ai/hc/en-us/articles/24843044366235-How-does-Athletica-adjust-training-plans>
- Intervals.icu frames planning as calendar, workout builder, season planning and device/platform sync. Pulse takeaway: desktop Plan should feel like a weekly planner/workbench. Source: <https://www.intervals.icu/features/plan/>

## Current Evidence

- Desktop before evidence: `/tmp/pulse-home-plan-desktop-before/2026-05-14-2f68d14/desktop-chromium/06-plan.png`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-home-plan-desktop-before`
- Result: no horizontal overflow, but the first desktop viewport repeats the daily action contract: `Heute trainieren`, `Plan-Aktion`, `Warum jetzt`, `Nach dem Klick`, then the week strip and season cards.

## Design Decision

For this PR-sized slice:

1. Keep the existing top-level Plan tabs and query ids. Do not add or rename tabs yet; that deserves its own IA slice because tests and user muscle memory currently rely on `Training`.
2. Keep the primary Plan action visible, but collapse the explanatory `Warum jetzt` / `Nach dem Klick` text into an explicit disclosure.
3. Apply the same visible-density rule to the TodayOptions fallback inside Plan.
4. Keep Home's daily decision contract unchanged. Home remains the place where the daily reasoning is shown directly.
5. Keep all plan/Garmin writes explicit; this is a presentation-only cleanup.

## TDD Plan

1. Add a desktop Playwright test proving Plan does not visibly show `Warum jetzt` / `Nach dem Klick` by default in the primary Plan action, but reveals them after opening the disclosure.
2. Update existing Plan action expectations to assert disclosure availability instead of always-visible explanation text.
3. Implement the smallest component changes in `frontend/src/pages/Plan.tsx` and `frontend/src/components/TodayOptionsCard.tsx`.
4. Run focused desktop tests, build, and route evidence.
