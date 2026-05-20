# Plan Week First Desktop

## Goal

Make `/plan` read as a weekly planner on desktop. Home owns the day-level decision; Plan should show the week before detailed next-training reasoning.

## Evidence

- Live after PR #364: `/tmp/pulse-live-plan-progression-after.png`
- The top action is calmer, but the real-data desktop first viewport still shows next training, progression, plan action and adaptation before the week strip.

## Design Decision

1. On the Plan training tab, render the week strip before the next-training/action stack.
2. Keep the next-training decision and plan-change inbox immediately below; do not remove actions.
3. Do not add or rename tabs in this slice.
4. Keep Home unchanged.

## TDD Plan

1. Add a desktop smoke test proving the week strip renders above the next-training decision when a next workout exists.
2. Move the existing `WeekStrip` call above the action stack in `TrainingTab`.
3. Verify focused Plan smoke, build, and desktop route evidence.
