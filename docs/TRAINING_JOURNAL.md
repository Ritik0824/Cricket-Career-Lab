# Training Journal Domain

A training-journal entry is an immutable account of what happened against one
validated session plan. It snapshots each drill's name, focus, planned intensity,
and duration so results remain explainable and queryable without a mutable plan
file.

## Completion input

Callers provide a stable entry identifier, canonical UTC completion timestamp,
the validated plan, and results for drills that were attempted. Each performed
drill records integer completed minutes and perceived effort from 1 to 10. A
drill result may include a private note of up to 500 normalized characters; the
entry may include a private session note of up to 1,000 characters.

Omitted drills become skipped results. A zero-minute result cannot carry effort,
and a performed drill must carry effort. Unknown and duplicate drill identifiers
fail validation rather than being silently discarded.

## Derived review

The domain derives:

- completed, partial, or skipped status for every planned drill;
- completed, partial, or missed status for the session;
- planned, completed, variance, and adherence time;
- planned and completed minutes grouped by training focus;
- effort load as completed minutes multiplied by perceived effort; and
- a minute-weighted average effort rounded to one decimal place.

Completed minutes may exceed planned minutes so a genuine extended drill remains
visible. Individual drills are bounded at 120 minutes and an entry at 240 minutes
to reject corrupt values.

This slice defines completion behavior only. The versioned journal record and
private file repository now consume it through separate storage boundaries.
The CLI completion workflow also consumes the same domain contract. Collection
filters remain separate application work.
