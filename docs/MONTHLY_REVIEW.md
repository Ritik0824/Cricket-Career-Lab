# Monthly Practice Review

Monthly practice review summarizes one UTC calendar month and compares it with
the complete previous calendar month. The review accepts an explicit `YYYY-MM`
value, so results do not depend on locale, partial rolling windows, or hidden
clock behavior. Leap years and year boundaries are handled as real calendar
boundaries.

## Period summaries

Current and previous months share the same validated period-summary contract as
weekly workload review. Each reports recorded, performed, and missed sessions;
active days; completed minutes; effort load; minute-weighted average effort;
focus and planned-intensity distributions; and exact evidence identifiers.

Duplicate journal identifiers are resolved before either month is assigned. The
latest canonical completion timestamp wins, so a corrected entry cannot appear
in both months or inflate totals.

## Monthly patterns

The current month also includes:

- consecutive segments covering days 1–7, 8–14, 15–21, 22–28, and any remaining
  days 29–31;
- the longest sequence of consecutive UTC dates with performed training; and
- the busiest training date by completed minutes, then effort load, then latest
  date, with its exact entry identifiers.

Segments report performed sessions, active days, minutes, and effort load. A
missed record remains visible in monthly evidence and counts, but contributes no
training activity. Tied longest streaks keep the earliest sequence because it was
established first in chronological order.

These patterns are descriptive. They do not score health, readiness, fatigue,
recovery, or injury risk, and they do not prescribe future training.

## CLI

Review a chosen month:

```bash
npm run cli -- workload month --month 2026-09
```

The command accepts `--journal <directory>` and `--json`. Without `--month`, the
injected application clock supplies the current UTC month. Text and JSON outputs
contain derived measures and entry identifiers, but never drill or session notes.
