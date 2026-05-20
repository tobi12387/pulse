# 2026-05-21 Home Calibration Review Clarity

## Evidence

- Branch: `codex/route-evidence-refresh`
- Baseline commit: `2dbafcc`
- Before command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-next-evidence npm run qa:ux-evidence`
- Before screenshots:
  - `/tmp/pulse-2026-05-21-next-evidence/2026-05-20-2dbafcc/mobile-chromium/11-home-free-command.png`
  - `/tmp/pulse-2026-05-21-next-evidence/2026-05-20-2dbafcc/mobile-chromium/12-home-completed-command.png`
- After command: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-home-calibration-after npm run qa:ux-evidence`
- After screenshots:
  - `/tmp/pulse-2026-05-21-home-calibration-after/2026-05-20-2dbafcc/mobile-chromium/11-home-free-command.png`
  - `/tmp/pulse-2026-05-21-home-calibration-after/2026-05-20-2dbafcc/mobile-chromium/12-home-completed-command.png`
- Summary command: `npm run qa:ux-summary -- /tmp/pulse-2026-05-21-home-calibration-after`
- Result: 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow.

## Finding

Fresh mobile route evidence showed two related Home clarity problems:

- A no-training day led with `Lernkalibrierung` and changed the CTA to `Kalibrierung prüfen`, but the `Nächster Schritt` detail still described the generic mental check-in fallback.
- A completed Garmin day with no open feedback showed `Heute fertig`, but `Heute entscheidet` still led with `Lernkalibrierung` instead of the actual completed activity.

This is a `Tagesentscheidung` friction: Home should keep the daily command coherent. If a signal owns the CTA, the next-step detail must describe that signal. If the day is already in review/closure state with nothing open, learning calibration should stay out of the lead.

## Scope

- Let signal-driven CTA overrides also own the visible next-step detail and prompt completion text.
- Keep learning calibration eligible for active days when it changes the daily action.
- Suppress learning calibration as a leading signal on completed/review days, so completed activity, feedback or fueling closure remains the daily lead.
- Keep detailed learning evidence in Data; no hidden Plan or Garmin write is introduced.

## Verification

```bash
node --import tsx --test scripts/daily-decision-golden.test.ts
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-21-home-calibration-after npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-21-home-calibration-after
```

Manual screenshot checks:

- `11-home-free-command.png` now shows `Kalibrierung prüfen` with calibration-specific next-step detail instead of check-in fallback text.
- `12-home-completed-command.png` now leads with `Garmin: Rennrad Grundlage · 70 min · 26 km` and keeps `Heute fertig` as the next-step state.

## Product Conclusion

This evidence unlocked a narrow Home contract fix, not a new product package. The wider backlog remains gated by comparable nutrition logs, real-device iPhone/PWA evidence, new route/user friction or Tobi direction.
