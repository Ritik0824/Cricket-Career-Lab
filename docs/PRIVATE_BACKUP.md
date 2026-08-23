# Private Backup and Restore

Private backup combines local goal definitions and training-journal entries into
one portable, versioned JSON file. It is designed for offline transfer and
recovery; no command uploads, publishes, or synchronizes the file.

## Format and privacy

Version 1 uses the fixed kind `cricket-career-lab/private-backup`, a canonical UTC
export timestamp, an array of complete versioned goal records, and an array of
complete versioned journal records. Goals are ordered by identifier and journal
entries by newest completion time for deterministic output.

The journal records include drill notes and session notes so a restore is
lossless. Backup files are therefore sensitive. The filesystem adapter creates
parent directories with owner-only permissions, writes an owner-only temporary
file, flushes it, and atomically replaces the selected destination. Encryption at
rest remains the responsibility of the operating system or storage device.

Every nested record is parsed through its existing schema and domain contracts.
Malformed JSON, unsupported versions, invalid timestamps, nested validation
failures, and duplicate goal or entry identifiers fail closed with stable paths.
Derived goal progress and workload summaries are excluded because they are
recalculated from restored journal evidence.

## Create and inspect

Create a backup of the default `.career/goals` and `.career/journal` repositories:

```bash
npm run cli -- backup create --to .career/backups/career.json
```

Use `--goals` or `--journal` for different source directories. The current UTC
time is used unless a canonical `--exported-at` timestamp is supplied.

Validate and summarize a backup:

```bash
npm run cli -- backup inspect .career/backups/career.json
npm run cli -- backup inspect .career/backups/career.json --json
```

Both inspection views contain format metadata, counts, identifiers, and journal
completion timestamps only. They deliberately omit notes even though the backup
file contains them.

## Restore conflicts

Restore into the default repositories:

```bash
npm run cli -- backup restore .career/backups/career.json
```

The default `--conflicts fail` mode preflights all identifiers and writes nothing
if any goal or journal entry already exists. Two explicit alternatives are
available:

- `--conflicts skip` keeps existing records and creates only missing records;
- `--conflicts replace` atomically replaces matching records and creates missing
  records.

All source and destination records are validated before writes begin. If a later
write fails, the service reverses completed writes: newly created records are
deleted and replaced records are restored from their preflight snapshots. A
rollback failure is reported distinctly instead of claiming a clean recovery.

Restore never deletes records that are absent from the backup. This makes the
operation an explicit merge under the selected conflict policy, not a directory
mirror or destructive reset.
