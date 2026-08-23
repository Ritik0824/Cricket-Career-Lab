# Private File Storage

The filesystem adapter persists one versioned training-plan record per JSON file.
It is intended for the command-line application and private local backups.

## Save behavior

`saveSessionPlanFile` validates and serializes the plan before touching disk. It
creates missing parent directories with owner-only permissions, writes to a
uniquely named owner-only temporary file, flushes the file, and atomically renames
it over the target. Failed writes attempt to remove their temporary file while
preserving the original error for the caller.

## Load behavior

`loadSessionPlanFile` reads UTF-8 JSON and delegates all content validation to the
versioned record parser. The adapter distinguishes these operational outcomes:

- `INVALID_PATH`: the caller supplied an empty path;
- `NOT_FOUND`: no entry exists at the requested path;
- `READ_FAILED`: the path exists but cannot be read as a file;
- `WRITE_FAILED`: the atomic save could not complete; and
- `INVALID_RECORD`: the file was readable but failed schema or domain validation.

For an invalid record, the underlying `SessionPlanRecordError` remains available
as the error cause. Interfaces can present a concise message while diagnostics
retain the exact stable code and field path.

The adapter does not sync files to a remote service, discover files globally, or
write outside the path selected by its caller. Encryption at rest remains the
responsibility of the operating system or a future explicitly designed vault.
