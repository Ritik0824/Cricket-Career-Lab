# Cricket Career Lab

Cricket Career Lab is a private, offline-first workspace for planning cricket
training, recording development goals, and reviewing progress over time.

This is a greenfield project. It was initialized as a private-first codebase and
does not import source files or Git history from the earlier Guess-The-Cricketer
repositories.

## First capability

The initial domain module creates validated training-session plans. It protects
the invariants that later interfaces and storage adapters will depend on:

- one to eight drills per session;
- unique, stable drill identifiers;
- bounded drill and session durations;
- supported training focuses and intensity levels; and
- deterministic focus and workload summaries.

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
