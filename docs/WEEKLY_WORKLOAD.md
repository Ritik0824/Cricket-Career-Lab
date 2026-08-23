# Weekly Workload Review

Weekly workload review gives a player a descriptive view of recorded training.
It compares one explicit seven-day UTC calendar window with the immediately
preceding seven days. The selected ending date is inclusive, so a review ending
`2026-09-14` covers `2026-09-08` through `2026-09-14` and compares it with
`2026-09-01` through `2026-09-07`.

## Current and previous summaries

Each window derives:

- recorded, performed, and missed session counts;
- distinct calendar days containing performed training;
- completed minutes and effort load;
- minute-weighted average perceived effort;
- completed minutes grouped and ranked by training focus;
- completed minutes grouped and ranked by planned drill intensity; and
- the exact journal entry identifiers included in the window.

Missed sessions remain visible in the recorded count and evidence identifiers,
but add no active day, minute, effort-load, focus, or intensity contribution.
Rankings omit zero-minute categories and use the domain's stable category order
to resolve equal-minute ties.

Duplicate entry identifiers cannot inflate either week. If a caller supplies
multiple reconstructed versions, only the one with the latest canonical
completion timestamp is considered before the two windows are assigned.

## Comparison semantics

Completed minutes, effort load, performed sessions, and active days report the
current value, previous value, signed delta, percentage change, and a descriptive
trend. A zero previous value has no percentage baseline and is labelled
`started`; two zero values are `no-activity`. Other outcomes are `increased`,
`decreased`, or `unchanged`.

These labels describe journal arithmetic only. They do not infer training
readiness, health, fatigue, recovery needs, or injury risk. The text output states
that boundary explicitly rather than presenting a diagnostic recommendation.

## CLI

Review the week ending on a chosen date:

```bash
npm run cli -- workload week --ending 2026-09-14
```

Use `--journal <directory>` for a non-default journal and `--json` for a
structured local view. Without `--ending`, the application clock supplies the
current UTC calendar date. Neither output includes drill notes or session notes;
only the contributing entry identifiers are projected as evidence.
