# Personal Development Goals

Development goals turn private journal evidence into measurable progress. A goal
has a stable identifier, readable title, metric, positive integer target, and an
inclusive start and due date. Goal counters are never edited directly.

## Metrics

- `completed-sessions`: sessions with at least one completed minute;
- `training-minutes`: all completed minutes;
- `focus-minutes`: completed minutes for one required training focus;
- `effort-load`: completed minutes multiplied by perceived effort; and
- `consistency-days`: distinct UTC calendar dates with completed training.

Only focus-minute goals accept a focus. Consistency targets cannot exceed the
number of calendar days in their goal window, preventing an impossible goal at
creation time.

## Evidence and windows

Progress accepts an explicit evaluation date. It considers entries from the goal
start through the earlier of that date or the due date, inclusive. Duplicate
journal identifiers cannot inflate progress. Missed sessions contribute nothing.

Every positive contribution retains the journal entry identifier, completion
timestamp, and value. Consistency uses one newest entry as evidence for each
distinct active day. Evidence is newest first, making progress explainable without
copying private notes into the goal.

## Status

- `not-started`: evaluation precedes the start date;
- `in-progress`: the window is active and the target remains unmet;
- `achieved`: evidence reaches or exceeds the target, including by the due date;
- `expired`: evaluation is after the due date and the target remained unmet.

Progress percentage is capped at 100 while the real current value is retained.
Days remaining are never negative. Evaluating several goals orders them by due
date and identifier for deterministic review.

The versioned private goal repository now stores definitions without progress.
The CLI creates and deletes those definitions, and joins list or detail views to
live journal evidence through this domain contract. Its JSON progress view keeps
the versioned definition separate from derived status and evidence, and never
copies journal notes.
