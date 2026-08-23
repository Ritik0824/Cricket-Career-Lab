# Command-Line Training Plans

The command-line interface creates and reviews private training-plan files. It
runs locally and does not use accounts, databases, analytics, or network calls.

## Create a plan

Start from an unversioned JSON draft. The repository includes
`examples/session-plan.draft.json` as a working shape:

```bash
npm run cli -- plan create \
  --from examples/session-plan.draft.json \
  --to .career/plans/new-ball.json
```

The command validates every field through the domain model and writes a versioned
record atomically. It supplies the current UTC time as `savedAt`. Tests and
reproducible scripts can override that clock with a canonical timestamp:

```bash
npm run cli -- plan create \
  --from examples/session-plan.draft.json \
  --to .career/plans/new-ball.json \
  --saved-at 2026-08-23T18:00:00.000Z
```

The `.career` directory is ignored by Git so personal plans are not accidentally
committed.

## Review a plan

Render a concise summary:

```bash
npm run cli -- plan show .career/plans/new-ball.json
```

Emit the canonical versioned record for another local tool:

```bash
npm run cli -- plan show .career/plans/new-ball.json --json
```

Help and usage errors are available without filesystem access:

```bash
npm run cli -- --help
```

## Complete a session

Use a completion draft to record actual minutes, perceived effort, and optional
private notes against a saved plan:

```bash
npm run cli -- journal complete \
  --plan .career/plans/new-ball.json \
  --from examples/session-completion.draft.json
```

Entries default to `.career/journal`. Use `--journal <directory>` to select a
different private local repository. The application supplies the current UTC
completion time; deterministic scripts can pass `--completed-at` explicitly.

An omitted planned drill is recorded as skipped. Performed drills require effort
from 1 to 10, while a zero-minute drill must omit effort. The domain validates the
completion before the journal directory or entry file is created.

## Review the journal

List entries newest first without displaying private notes:

```bash
npm run cli -- journal list
```

Filter by inclusive completion dates, performed focus or intensity, session
status, private text, and result limit:

```bash
npm run cli -- journal list \
  --from 2026-09-01 \
  --to 2026-09-30 \
  --focus bowling \
  --status partial \
  --text "seam control" \
  --limit 10
```

See [JOURNAL_QUERIES.md](JOURNAL_QUERIES.md) for matching semantics and validation.

Show a complete entry, including its private notes:

```bash
npm run cli -- journal show new-ball-accuracy-2026-09-05
```

Both commands accept `--journal <directory>` and `--json`. JSON list output
contains full canonical records, including notes, and should only be piped to a
trusted local process.

Delete an entry:

```bash
npm run cli -- journal delete new-ball-accuracy-2026-09-05
```

Deleting a missing identifier is an idempotent success and reports that no entry
was found.

## Manage development goals

Create a goal definition from the included draft shape:

```bash
npm run cli -- goal create \
  --from examples/development-goal.draft.json
```

Definitions default to `.career/goals`. Use `--goals <directory>` to select a
different private repository. The command validates metric, target, focus, and
date-window rules before it creates or replaces the definition.

Review every goal using live journal evidence:

```bash
npm run cli -- goal list --as-of 2026-09-30
npm run cli -- goal show new-ball-bowling-volume --as-of 2026-09-30
```

Both review commands accept `--goals`, `--journal`, and `--json`. Without
`--as-of`, they evaluate on the current UTC calendar date. Text and JSON views
include only entry identifiers, timestamps, and numeric contributions as
evidence; journal notes are not copied into goal output.

Delete a definition without changing any journal entries:

```bash
npm run cli -- goal delete new-ball-bowling-volume
```

Deleting a missing goal is also an idempotent success. Derived progress is never
stored, so every later review reflects corrected or removed journal entries.

## Review weekly workload

Compare a seven-day window with the immediately preceding seven days:

```bash
npm run cli -- workload week --ending 2026-09-14
```

The ending date is inclusive. The command accepts `--journal <directory>` and
`--json`; without `--ending`, it uses the current UTC calendar date. Both outputs
derive minutes, effort load, focus, planned intensity, session count, active days,
and exact entry identifiers from validated journal records. Neither output
contains journal notes or interprets the comparison as a health or injury-risk
assessment. See [WEEKLY_WORKLOAD.md](WEEKLY_WORKLOAD.md).

Review a complete calendar month against its predecessor:

```bash
npm run cli -- workload month --month 2026-09
```

This command also accepts `--journal` and `--json`; the current UTC month is the
default. It adds seven-day segments, the longest active-date streak, and
busiest-day evidence. Journal notes remain excluded. See
[MONTHLY_REVIEW.md](MONTHLY_REVIEW.md).

## Back up and restore private data

Export goals and full journal records to an owner-only versioned file:

```bash
npm run cli -- backup create --to .career/backups/career.json
```

Use `backup inspect <backup.json> [--json]` to validate and summarize the file.
Both inspection formats omit private notes. Restore defaults to a fail-on-conflict
preflight:

```bash
npm run cli -- backup restore .career/backups/career.json
```

Pass `--conflicts skip` to preserve matching destinations or `--conflicts replace`
to replace them. Create accepts `--goals`, `--journal`, and `--exported-at`;
restore accepts `--goals` and `--journal`. See
[PRIVATE_BACKUP.md](PRIVATE_BACKUP.md) for sensitive-file handling and rollback
semantics.

Usage mistakes exit with status `2`. Draft, record, and filesystem failures exit
with status `1`; successful commands and help exit with status `0`. Error details
are written to standard error so JSON output remains safe to pipe.
