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

Usage mistakes exit with status `2`. Draft, record, and filesystem failures exit
with status `1`; successful commands and help exit with status `0`. Error details
are written to standard error so JSON output remains safe to pipe.
