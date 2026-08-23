# Goal Storage

Private goal definitions use one versioned JSON file per normalized goal
identifier. The default future CLI location is `.career/goals`, already protected
by the repository ignore policy.

## Record contract

Version 1 stores the fixed kind `cricket-career-lab/development-goal`, schema
version, identifier, title, metric, target, inclusive start date, due date, and an
optional focus for focus-minute goals.

The record never stores progress, status, evidence, percentage, or days remaining.
Those values are derived from current validated journal entries whenever the goal
is reviewed. Parsing routes every stored definition through the goal constructor,
and unsupported versions fail closed until an explicit migration exists.

## Directory repository

`DevelopmentGoalFileRepository` saves through the shared owner-only atomic file
writer. It loads by path-safe identifier, lists goals by due date, replaces a
corrected definition, and deletes idempotently. A missing directory is an empty
goal collection.

Every top-level `.json` file must parse successfully and its identifier must match
its filename. Corrupt files and identity mismatches remain visible failures rather
than silently disappearing from a progress review. Non-JSON files, temporary
files, and nested directories are ignored.

No goal definition or derived progress leaves the local filesystem.
