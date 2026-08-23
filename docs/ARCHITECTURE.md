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
and minutes grouped by training focus.

The storage-format slice serializes only canonical domain inputs plus explicit
record metadata. It restores every record through the aggregate so persistence
cannot override calculated values. Filesystem and browser adapters will depend on
this contract without duplicating validation rules.

The first filesystem adapter implements that contract with owner-only temporary
files and atomic replacement. Its errors translate operating-system and record
failures into stable application-facing categories without hiding their causes.

The command-line boundary parses untrusted draft JSON into the domain, then uses
the same file adapter as every future local interface. Argument parsing, output
formatting, and command orchestration are separate modules so exit statuses and
text contracts can be tested without replacing storage or domain behavior.
