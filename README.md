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
npm run cli -- goal create \
  --from examples/development-goal.draft.json
npm run cli -- goal list --as-of 2026-09-30
npm run cli -- workload week --ending 2026-09-30
npm run cli -- workload month --month 2026-09
npm run cli -- backup create --to .career/backups/career.json
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

Journal lists support inclusive completion dates, performed focus and intensity,
status, private text, and bounded newest-first results. See
[docs/JOURNAL_QUERIES.md](docs/JOURNAL_QUERIES.md).

Personal development goals derive sessions, minutes, focus work, effort load, or
consistency progress from exact journal evidence inside an inclusive target
window. See [docs/DEVELOPMENT_GOALS.md](docs/DEVELOPMENT_GOALS.md).

Goal definitions persist separately from progress in an owner-only versioned
repository. The CLI creates definitions and joins them with current journal
evidence for list and detail views. See
[docs/GOAL_STORAGE.md](docs/GOAL_STORAGE.md).

Weekly workload review compares two explicit seven-day windows across session,
time, effort, focus, and intensity measures without making health or injury-risk
claims. See [docs/WEEKLY_WORKLOAD.md](docs/WEEKLY_WORKLOAD.md).

Calendar-month review adds seven-day segments, consecutive active-day streaks,
busiest-day evidence, and previous-month comparison. See
[docs/MONTHLY_REVIEW.md](docs/MONTHLY_REVIEW.md).

Versioned private backups preserve goal definitions and complete journal records
in one owner-only file, with validation, privacy-safe inspection, explicit
conflict policies, and rollback-aware restore. See
[docs/PRIVATE_BACKUP.md](docs/PRIVATE_BACKUP.md).

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
