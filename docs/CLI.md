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

Usage mistakes exit with status `2`. Draft, record, and filesystem failures exit
with status `1`; successful commands and help exit with status `0`. Error details
are written to standard error so JSON output remains safe to pipe.
