# 2026-05-27 - Top-App Command Surfaces

## Scope

Route-wide UI/UX follow-up after the top-app shell redesign, focused on the repeated command surfaces that still felt like heavy cards:

- Home `Heute im Fokus` / Daily Decision
- Data `Naechste Datenluecke`
- Plan `Wochenentscheidung`

This pass changes hierarchy and density only. It does not change Daily Decision, Data, Plan, Garmin, LLM or write behavior.

## Before Evidence

Baseline command:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-card-redesign-baseline npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-card-redesign-baseline
```

Summary:

- desktop Chromium: 9 screenshots, 0 horizontal overflow
- mobile Chromium: 17 screenshots, 0 horizontal overflow
- commit under evidence: `55dc23e`

Manual finding:

- Home shell was clearer, but the decision card still gave reason, CTA, continuity and readiness similar visual mass.
- Data primary action was correct but still read as a large bordered task card on mobile.
- Plan repeated the same weekly choice across option cards and active preview, making the weekly decision feel heavier than the actual next click.

## Change

- Make card shells flatter by default so route sections read as quiet work surfaces instead of stacked panels.
- Give Daily Decision primary/support actions stable classes, clamp the mobile leading factor, and keep the first mobile view focused on one action plus one reason.
- Keep Data's safe Fueling/action order intact, but reduce the primary action surface weight, mobile button height, optional detail padding and action rail decoration.
- Move Plan's duplicated option result copy into the active preview, render learned/changed/risk/next-step evidence as row-like sections, and make the active preview a compact action/result layout.

## After Evidence

Final command:

```bash
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-2026-05-27-top-app-command-surfaces-r2 npm run qa:ux-evidence
npm run qa:ux-summary -- /tmp/pulse-2026-05-27-top-app-command-surfaces-r2
```

Summary:

- desktop Chromium: 9 screenshots, 0 horizontal overflow
- mobile Chromium: 17 screenshots, 0 horizontal overflow
- commit under evidence before commit: `55dc23e`

Manual review:

- Desktop Plan now keeps option choices compact and places the explicit `Entscheidung merken` action in the active preview column.
- Desktop Data keeps the next action first while reducing the card border/shadow weight.
- Mobile Home keeps the CTA, reason and leading factor in the first view without an extra label row.
- Mobile Plan still has a substantial weekly control area; the next route-level UI slice should target the week strip itself if it remains the dominant friction after this package.

## Verification

```bash
git diff --check
npm run build -w frontend
npm run verify:trainingsanpassung:pr
npm run test:e2e:smoke
```

Result:

- `git diff --check`: passed
- `npm run build -w frontend`: passed
- `npm run verify:trainingsanpassung:pr`: passed
- `npm run test:e2e:smoke`: 108 passed, 14 skipped
