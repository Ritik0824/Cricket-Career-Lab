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

The journal domain snapshots the visible plan contract into an immutable
completion entry. It derives adherence and effort review from explicit drill
results while keeping private notes inside the entry boundary. Storage and query
adapters will consume this contract without recalculating its invariants.

Journal persistence stores one versioned entry per private file. The repository
uses the same atomic file primitive as plan storage, treats corrupt records as
visible failures, and derives list order from canonical completion timestamps.

The CLI completion boundary joins a validated saved plan with an untrusted
completion draft, then persists the resulting domain entry. Journal list output
keeps notes out of the default summary, while explicit show and JSON contracts
make private detail available for local review and trusted tooling.

Journal queries are pure domain operations over reconstructed entries. They
normalize and validate every facet, never mutate repository results, and sort
independently so callers receive deterministic newest-first output.

The development-goal domain evaluates immutable goal definitions against journal
entries. Counters are derived rather than stored, duplicate entry identifiers are
deduplicated, and every positive contribution retains an evidence reference.

Goal persistence stores definitions only, one atomic private file per goal. Live
progress always joins the repository definitions with reconstructed journal
entries, preventing stored counters from drifting away from their evidence.

The goal CLI performs that join at review time. Creation accepts an unversioned
draft, storage writes the canonical versioned definition, and list or show output
derives status from an explicit clock. Evidence views deliberately project only
entry identity, time, and contribution so goal review does not duplicate journal
notes into another privacy boundary.

Weekly workload review is another pure projection over reconstructed journal
entries. It assigns deduplicated entries to two fixed UTC date windows, returns
immutable summaries and arithmetic comparisons, and keeps medical interpretation
outside the product boundary. The CLI owns clock selection and rendering, while
the domain remains deterministic and independent of storage.

Weekly and monthly reviews share training-period aggregation and arithmetic
comparison modules. Calendar selection remains in the product-specific review,
while session, activity-day, focus, intensity, effort, and evidence semantics
stay identical across windows. Monthly highlights are derived from the same
deduplicated entries before the CLI renders text or privacy-safe JSON.
