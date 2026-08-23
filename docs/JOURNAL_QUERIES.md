# Journal Queries

Journal queries operate on immutable completed-session entries after the private
repository has validated every record. Results are always sorted by canonical
completion timestamp newest first, then by entry identifier for stable ties.

## Filters

- `from` and `to` are inclusive UTC completion-date bounds in `YYYY-MM-DD` form.
- `focus` matches a drill with completed minutes in batting, bowling, fielding,
  fitness, or recovery.
- `intensity` matches the snapshotted planned intensity of a performed drill.
- `status` accepts completed, partial, or missed.
- `text` searches identifiers, titles, outcomes, drill details, and private notes
  case-insensitively.
- `limit` returns between 1 and 100 newest matches after every other filter.

Focus and intensity deliberately do not match an omitted or skipped drill merely
because it appeared in the plan. This keeps journal queries about work that
actually occurred. A missed entry remains discoverable by status, date, text, and
identifier.

Malformed and impossible dates, reversed ranges, unsupported facets, empty text,
and out-of-range limits fail with a stable field-specific query error. The input
collection is never mutated.

## CLI examples

```bash
npm run cli -- journal list --from 2026-09-01 --to 2026-09-30
npm run cli -- journal list --focus bowling --intensity high
npm run cli -- journal list --status partial --text "seam control" --limit 10
```

Every filter can be combined with `--journal <directory>` and `--json`. JSON
matches remain full private records and may contain notes.
