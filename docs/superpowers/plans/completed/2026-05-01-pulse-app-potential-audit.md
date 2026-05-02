# Pulse App Potential & Gap Audit

> Stand: 2026-05-01 after PR #78. This is a planning audit, not an implementation spec. It orders the next work so future sessions do not reopen broad feature brainstorming before closing the daily-use loop.

## Executive Summary

Pulse is strongest where it already connects Garmin, readiness, plan, Coach and feedback. The remaining leverage is not adding a new dashboard. It is closing loops:

1. Planned workout appears on Garmin and is visibly linked to the performed activity.
2. Garmin data is preserved deeply enough to explain recovery and execution quality.
3. Home/Coach choose one daily decision and remember whether it was handled.
4. iPhone/VPN/PWA access is reliable enough to make Pulse a daily tool away from the Mac.
5. Insights explain their evidence instead of standing apart as narrative analysis.

## Current Strengths

- Plan engine already considers availability, goals, TSB, RPE, health states, risk signals and race context.
- Data Coverage and Backfill are visible and safer than a blind "load everything" button.
- Settings groups Garmin, profile, push, data maintenance and health-state actions.
- Web Push exists and has server VAPID configuration.
- Garmin workout repeat sync was fixed in PR #78; repeat groups now need a follow-up sync when Garmin rate limiting has cooled down.
- Playwright smoke/usability tests cover core routes, mobile labels and several trust states.

## Highest-Impact Gaps

| Rank | Gap | Why It Matters | Recommended Plan |
|---|---|---|---|
| 1 | Activity raw data can be overwritten by detail cache | Future analytics may lose Garmin summary evidence | `2026-05-01-garmin-data-enrichment-wave.md` Task 1 |
| 2 | Planned-vs-executed state is not explicit enough | User cannot fully trust whether Edge/watch execution was recognized | Garmin Execution Reconciliation |
| 3 | iPhone safe-area/PWA baseline is incomplete | Daily use over VPN will be fragile on the device Tobi wants to use | `2026-05-01-iphone-pwa-readiness.md` |
| 4 | Recovery depth is underused | Garmin already exposes sleep/stress/body-battery drivers Pulse does not explain | Garmin Recovery Data Depth |
| 5 | Home/Coach actions lack durable closure | Repeated recommendations feel generic even when data changes | `2026-05-01-decision-closure-coach-memory-wave.md` |
| 6 | Insights lack evidence links | Narrative trust is weaker without data basis/time windows | Daily Intelligence phase 4 |
| 7 | Garmin API architecture has two paths | Direct client plus sidecar increases drift and debugging cost | Garmin Sync Architecture Cleanup |
| 8 | iPhone/WebKit QA is missing | Chromium mobile does not catch Safari/PWA keyboard/safe-area behavior | iPhone QA Gate |

## Garmin Data Opportunities

Live read-only inventory and official Garmin developer pages indicate the following useful domains:

- Sleep Need, next Sleep Need, sleep score components, movement, restless moments.
- Sleep HR, sleep stress, sleep Body Battery, overnight HRV epochs.
- Respiration and breathing disruption during sleep.
- Body Battery charge/drain/high/low/wake and dynamic event list.
- Stress distribution: low/medium/high/rest/activity durations and qualifier.
- Intensity minutes, highly active/active/sedentary seconds, floors and distance.
- Activity training load, training effect labels/messages, IF, best power windows, power zones, temperature, respiration, split summaries.
- Profile settings: available training days, preferred long days, VO2max by sport, LTHR, auto-detected threshold/FTP flags.

Official references:

- Garmin Health API: https://developer.garmin.com/gc-developer-program/health-api/
- Garmin Activity API: https://developer.garmin.com/gc-developer-program/activity-api/
- Garmin Connect Developer overview: https://developer.garmin.com/gc-developer-program/overview/

## iPhone/VPN/PWA Readiness

The local-server strategy remains valid:

- Server stays local at `192.168.178.46`.
- iPhone reaches Pulse through VPN into the home network.
- Public hosting is not required for the current project.

Required preparation:

- Verify certificate coverage for the exact VPN address/hostname Tobi uses.
- Add safe-area support for notch/home indicator.
- Use dynamic viewport units for Coach and app shell.
- Register service worker outside Push activation.
- Add install/offline baseline.
- Add Settings diagnostics for current origin, HTTPS, standalone mode and push support.
- Add WebKit/iPhone-ish QA gate and a real-device checklist.

## Product Opportunities After Daily Intelligence

| Sequence | Theme | Why Now/Then |
|---|---|---|
| 1 | Garmin Data Enrichment & Execution | Needed before plan learning can be trusted |
| 2 | iPhone VPN & PWA Readiness | Makes Pulse usable in the daily context Tobi wants |
| 3 | Plan Personalization Loop | Builds on execution and richer recovery data |
| 4 | Daily Decision Center | Home/Coach can then act on reliable execution and learning state |
| 5 | Insight Evidence Links | Turns narrative into auditable coaching |
| 6 | Decision Closure & Coach Memory | Prevents stale repeated recommendations |
| 7 | Return-to-Training Protocols | Uses health-state/risk/recovery depth for illness/injury comeback |
| 8 | Race Week Command Center | Valuable once daily decision and execution loops are stable |
| 9 | Fueling & Strength Progression | Useful depth after the core daily loop is reliable |

## Integrated Next Sequence

1. **Docs hygiene and iPhone/PWA baseline**: update stale focus docs, add safe-area/service-worker fundamentals.
2. **Garmin raw preservation**: prevent further data loss before adding more Garmin fields.
3. **Garmin execution reconciliation**: close the watch/Edge execution loop.
4. **Recovery data depth**: normalize richer sleep, stress and Body Battery drivers.
5. **Plan personalization loop**: use execution, RPE, recovery, goals and free-day logic visibly.
6. **Daily decision center**: make Home/Coach converge on one action.
7. **Insight evidence links**: show data basis/time windows.
8. **Decision closure and coach memory**: make recommendations stateful and preference-aware.
9. **Deep UI/UX flow audit**: use Browser/Figma/Canva after the above flows exist.

## Tooling Notes

- **Superpowers:** keep as the implementation/process gate for plans, TDD, debugging and verification.
- **Browser Use:** use for deployed daily-flow checks on `https://192.168.178.46:5175`.
- **Figma:** use for reusable component states, safe-area/mobile patterns and design-system decisions.
- **Canva:** keep as a lightweight visual review board for screenshots, flow friction and stakeholder notes.
- **Build Web Apps:** use for PWA/mobile-web QA once visible in Codex tools.
- **Build iOS Apps:** evaluate later only if a native wrapper becomes necessary; current product direction is local web/PWA over VPN.

## Non-Goals

- No Telegram.
- No habit tracker.
- No data export.
- No public cloud deployment unless Tobi later reverses the local-server decision.
- No broad Garmin live probing while rate limited.
