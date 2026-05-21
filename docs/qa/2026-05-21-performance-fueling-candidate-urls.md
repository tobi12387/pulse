# 2026-05-21 - Performance Fueling Candidate URLs

## Trigger

The combined Performance gate packet is the primary manual handoff for the
current blockers. It already showed the first Fueling `Target URL`, but the
second existing Activity Fueling candidate only appeared as a path inside the
candidate list, even though both logs need real GI comfort before Fueling
learning can advance.

## Change

- `scripts/performance-gates-audit.mjs` now renders each Fueling completion
  candidate with its full `Target URL`.
- The change uses the existing structured `completionCandidates[].targetUrl`
  metadata and does not change the audit JSON contract.
- `scripts/performance-gates-audit.test.mjs` covers default and configured
  `PULSE_URL` candidate URLs.

## Verification

```bash
node --test scripts/performance-gates-audit.test.mjs
npm run audit:performance-gates -- --today 2026-05-21 --packet
git diff --check
```

Expected packet result: both existing Fueling completion candidates include
their full Activity Fueling `Target URL` beside the path and missing GI comfort
reason.
