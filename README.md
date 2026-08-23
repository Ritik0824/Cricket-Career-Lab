# Cricket Career Lab

Cricket Career Lab is a private, offline-first workspace for planning cricket
training, recording development goals, and reviewing progress over time.

This is a greenfield project. It was initialized as a private-first codebase and
does not import source files or Git history from the earlier Guess-The-Cricketer
repositories.

## First capability

The initial product slice creates, saves, and reviews validated training-session
plans. A versioned JSON record gives local adapters a safe persistence boundary.
Together these modules protect the invariants that later interfaces will depend
on:

- one to eight drills per session;
- unique, stable drill identifiers;
- bounded drill and session durations;
- supported training focuses and intensity levels;
- deterministic focus and workload summaries;
- canonical save timestamps and explicit schema versions; and
- restoration through domain validation instead of trusting stored totals.

The first local adapter saves each plan through an owner-only temporary file and
atomically replaces its destination. Corrupt, missing, unreadable, and unwritable
paths remain distinct outcomes for command-line interfaces.

## Command-line quick start

Create a private plan from the included example and review it locally:

```bash
npm run cli -- plan create \
  --from examples/session-plan.draft.json \
  --to .career/plans/new-ball.json
npm run cli -- plan show .career/plans/new-ball.json
npm run cli -- journal complete \
  --plan .career/plans/new-ball.json \
  --from examples/session-completion.draft.json
npm run cli -- journal list
```

See [docs/CLI.md](docs/CLI.md) for completion records, private journal review,
JSON output, deterministic timestamps, and exit statuses.

The training-journal domain can also turn a plan into an immutable completed,
partial, or missed entry with drill-level effort, private notes, and
planned-versus-actual summaries. See
[docs/TRAINING_JOURNAL.md](docs/TRAINING_JOURNAL.md).

Completed entries can be stored in an owner-only local journal directory using a
versioned format that recalculates all review values when loaded. See
[docs/JOURNAL_STORAGE.md](docs/JOURNAL_STORAGE.md).

## Local verification

Use Node.js 20 and install the exact locked dependencies:

```bash
nvm use
npm ci
npm run check
```

The current test suite and build do not need credentials, databases, or network
services after dependencies have been installed.

## Product direction

The planned product is intentionally different from a player-guessing game. Its
core surfaces will cover training plans, practice logs, personal goals, workload
review, and private exports. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/ROADMAP.md](docs/ROADMAP.md).

## Development policy

Development is committed and pushed as work happens. Contributions must be
independently authored for this repository; do not copy source, tests, assets,
datasets, or history from a public project. See [CONTRIBUTING.md](CONTRIBUTING.md).
