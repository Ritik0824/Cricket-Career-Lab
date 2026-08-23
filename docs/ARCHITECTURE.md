# Architecture

## Product boundary

Cricket Career Lab manages a player's own training information. The application
does not require a catalogue of professional players, a guessing-game engine, or
third-party identity services.

## Design principles

1. Domain rules remain independent of frameworks and persistence.
2. Private user records stay local by default.
3. Every stored format has explicit validation and versioning.
4. Time-dependent calculations accept an explicit clock.
5. Public interfaces depend on immutable domain results rather than mutable state.
6. Core builds and tests work without service credentials.

## Intended module boundaries

- `src/domain`: training, goal, workload, and review rules.
- `src/application`: use cases coordinating domain rules and ports.
- `src/storage`: versioned local persistence and portable exports.
- `src/http`: an optional local API boundary.
- `apps/web`: a future TypeScript user interface.

Only a module that is needed for genuine product work should be introduced. The
directory plan is guidance, not a request to generate empty scaffolding.

## Current slice

The first slice is the training-session plan aggregate. It validates a proposed
session and returns a normalized, immutable plan with total minutes, workload,
and minutes grouped by training focus. Persistence and UI layers can consume this
contract without duplicating its rules.
