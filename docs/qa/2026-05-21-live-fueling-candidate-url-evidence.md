# 2026-05-21 - Live Fueling Candidate URL Evidence

## Trigger

The current Performance-OS first unblock is still Fueling learning: two existing
Activity Fueling logs need a real GI-comfort choice before they can count toward
the three-log nutrition trend floor. After the combined Performance packet began
showing full URLs for both candidates, the next evidence question was whether
those exact live URLs land on the intended GI action without requiring manual
route repair.

## Scope

- Commit under test: `c2d8c26`
- Base URL: `https://192.168.178.46:5175`
- Candidate 1:
  `https://192.168.178.46:5175/plan/activity/3a77af7f-3ece-40ea-8879-c6d878519c61#activity-fueling-log`
- Candidate 2:
  `https://192.168.178.46:5175/plan/activity/4f4b873d-bb64-4410-8e63-a382e9729863#activity-fueling-log`

## Check

Read-only live Playwright smoke against both URLs in desktop Chromium and mobile
Chromium:

- Navigate to the URL.
- Wait for `#activity-fueling-log`.
- Wait for `data-testid="activity-gi-comfort-action"`.
- Confirm `activity-gi-comfort-action` is the focused element.
- Confirm the GI choices `Magen ok`, `Magen leicht unruhig` and
  `Magenprobleme` are present.
- Confirm the action is in the viewport.
- Confirm no horizontal overflow.
- Do not click any GI choice and do not write Fueling data.

## Result

All four route checks passed:

```text
desktop-chromium: 2026-05-09 Datteln Graveln OK | focused=activity-gi-comfort-action | buttons=Magen ok, Magen leicht unruhig, Magenprobleme
desktop-chromium: 2026-05-04 Datteln Z2 OK | focused=activity-gi-comfort-action | buttons=Magen ok, Magen leicht unruhig, Magenprobleme
mobile-chromium: 2026-05-09 Datteln Graveln OK | focused=activity-gi-comfort-action | buttons=Magen ok, Magen leicht unruhig, Magenprobleme
mobile-chromium: 2026-05-04 Datteln Z2 OK | focused=activity-gi-comfort-action | buttons=Magen ok, Magen leicht unruhig, Magenprobleme
```

Conclusion: the current first blocker is not a route or focus bug. It remains
the real manual GI-comfort evidence choice for both existing logs, followed by
one additional complete long-session log.
