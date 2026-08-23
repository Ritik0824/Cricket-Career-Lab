# Journal Storage

Completed training sessions are stored as one versioned JSON record per entry in
a private local directory. File names are the normalized journal entry identifier
plus `.json`; identifiers cannot contain path separators or traversal segments.

## Record contract

Version 1 stores only the inputs needed to reproduce an entry:

- fixed kind `cricket-career-lab/training-journal-entry` and version `1`;
- entry identifier and canonical completion timestamp;
- the plan title, scheduled date, and complete drill snapshot;
- completed minutes, perceived effort, and optional note per drill; and
- the optional private session note.

Status, adherence, variance, focus totals, average effort, and effort load are not
stored. The parser reconstructs the plan and completion through both domain
constructors, so injected or stale derived fields cannot alter a restored entry.

## Directory repository

`TrainingJournalFileRepository` saves with the shared owner-only atomic file
writer. It can load by identifier, list entries newest first, replace a corrected
entry, and delete an entry idempotently. A missing journal directory represents an
empty journal.

Listing reads every top-level `.json` file. It ignores unrelated file extensions,
temporary files, and nested directories, but it never silently skips corrupt JSON
or a mismatch between an entry identifier and its file name. Those conditions are
reported with stable repository error codes so the user can repair the exact file.

The repository remains entirely local. It does not publish, synchronize, index,
or transmit journal content.
