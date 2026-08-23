# Training Plan Storage Format

Training plans use a small, versioned JSON record so local adapters and portable
backups share one contract. Version 1 contains:

- the fixed record kind `cricket-career-lab/session-plan`;
- the integer schema version `1`;
- a canonical UTC `savedAt` timestamp supplied by the application clock; and
- the normalized title, scheduled date, and drill inputs.

Derived totals are deliberately excluded. The parser sends stored drill inputs
through the domain constructor and recalculates duration, workload, and focus
summaries. A record therefore cannot inject stale or manipulated derived values.

## Boundary behavior

`serializeSessionPlan` revalidates a plan and emits deterministic, indented JSON.
`parseSessionPlanRecord` accepts either JSON text or an already-parsed value. It
returns an immutable plan or a `SessionPlanRecordError` containing a stable code
and field path.

Error codes distinguish malformed JSON, invalid record shapes, unsupported schema
versions, and records that violate current domain invariants. Unknown schema
versions fail closed until an explicit migration is added.

This module defines the data contract only. The implemented filesystem adapter
consumes it through a separate atomic I/O boundary; future browser and backup
adapters can do the same without weakening record validation.
