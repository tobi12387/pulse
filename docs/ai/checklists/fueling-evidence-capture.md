# Fueling Evidence Capture

Use this when `npm run audit:fueling-gate` or `npm run audit:performance-next` says the first Performance-OS unblock is Fueling learning.

The checklist is for evidence capture only. Do not infer GI comfort from notes, route type, carbs per hour, RPE or how the workout looks afterward.

## Boundaries

- Nutrition trend summaries stay gated until three comparable complete `during` logs exist.
- A comparable complete log needs activity/duration context, carbs and structured GI comfort.
- Accepted GI comfort values are `ok`, `mild_issue` and `issue`.
- Do not edit database rows directly for normal evidence capture.
- Do not invent GI comfort; Tobi must choose the value from actual experience.
- Sodium, heat and sweat-rate remain measured-only evidence gaps until they are explicitly recorded.

## Refresh The Target

Run the current handoff first:

```bash
npm run audit:performance-next -- --today <YYYY-MM-DD>
```

Use the printed `Target URL` or `Target path` and `Options`. If the target
changes, follow the command output instead of this document.

For clipboard/script use across every target attached to the current first
unblock, print one target URL per line. This is the fastest path when the
audit lists multiple existing completion candidates:

```bash
npm run audit:performance-next -- --today <YYYY-MM-DD> --target-urls
```

For only the single first target URL:

```bash
npm run audit:performance-next -- --today <YYYY-MM-DD> --target-url
```

If Fueling is part of a broader manual gate run, generate one ordered handoff first:

```bash
npm run audit:performance-gates -- --today <YYYY-MM-DD> --packet
```

For a shorter checkbox-style manual session handoff across Fueling, iPhone/PWA
and server gates, run:

```bash
npm run audit:performance-checklist -- --today <YYYY-MM-DD>
```

When these handoff commands run from a Codex feature branch, the audit
automatically uses local-planning mode for packet/checklist/next-target output
and defers the server mirror check to avoid a feature-branch false blocker.
Rerun the normal audit from clean `main` before deploy-sensitive decisions or
current iPhone field evidence.

For a focused table, run:

```bash
npm run audit:fueling-gate -- --today <YYYY-MM-DD>
```

For a live manual capture packet with all current candidates and rerun steps, run:

```bash
npm run audit:fueling-gate -- --today <YYYY-MM-DD> --packet
```

For the shortest first-target prompt to use in a manual capture/chat handoff, run:

```bash
npm run audit:fueling-gate -- --today <YYYY-MM-DD> --next-prompt
```

For clipboard/script use across all existing completion candidates, print one
candidate URL per line:

```bash
npm run audit:fueling-gate -- --today <YYYY-MM-DD> --candidate-urls
```

For the paste-ready checklist for the future complete long-session log that
remains after existing candidates, print the existing candidate URLs plus that
capture scaffold:

```bash
npm run audit:fueling-gate -- --today <YYYY-MM-DD> --new-log-checklist
```

## Capture Existing Log Evidence

Open the `Target URL` from the audit output when available; otherwise open the
`Target path` inside Pulse.

On the Activity Fueling section:

- confirm the activity, date, duration and carbs match the audit target;
- choose exactly one structured GI comfort value:
  - `ok` = Magen ok;
  - `mild_issue` = Magen leicht unruhig;
  - `issue` = Magenprobleme;
- save through the Activity Fueling UI;
- rerun `npm run audit:fueling-gate -- --today <YYYY-MM-DD>`.

If the audit still lists another existing completion candidate, repeat this checklist for that target.

## Capture The Next Long Session

After existing candidates are complete, the gate still needs any new complete long-session log reported by the audit.

For the next long endurance activity, record:

- activity/duration context from the activity itself;
- carbs during the activity;
- structured GI comfort;
- optional bottles, powder, sodium, temperature or sweat-rate only when measured.

Then rerun:

```bash
npm run audit:performance-gates -- --today <YYYY-MM-DD>
```

## Evidence Record

When the gate changes, record the result in a small QA note under `docs/qa/` with:

- the audit command and date;
- the comparable complete count;
- any remaining completion candidates;
- whether nutrition trend summaries are still gated or ready.
