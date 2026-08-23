# Loopback Local Interface

The local API exposes privacy-safe review projections to a browser or another
trusted process on the same computer. It is read-only, requires no database or
network service, and binds to `127.0.0.1` by default. The server rejects
non-loopback hosts such as `0.0.0.0`; supported hosts are `127.0.0.1`, `::1`, and
`localhost`.

## Start the server

```bash
npm run serve
```

The default origin is `http://127.0.0.1:4317`. Select an available port and local
repositories explicitly when needed:

```bash
npm run serve -- \
  --port 4318 \
  --goals .career/goals \
  --journal .career/journal
```

Port `0` asks the operating system to select an ephemeral port, which is useful
for isolated automation. `SIGINT` and `SIGTERM` close the listener cleanly.

Open the printed origin in a browser to use the dependency-free dashboard. It
provides keyboard-accessible date controls, evidence-backed goal progress,
weekly and monthly workload patterns, and a responsive journal table. The page
uses semantic headings, a skip link, labelled form controls, an announced loading
status, visible keyboard focus, reduced-motion support, and light or dark color
preferences. It contains no remote fonts, scripts, styles, images, or analytics.

## Routes

All API routes accept `GET` only and return JSON:

- `/api/health` returns API version and local-read-only status;
- `/api/journal` returns note-free journal summaries and accepts the same `from`,
  `to`, `focus`, `intensity`, `status`, `text`, and `limit` filters as the CLI;
- `/api/goals?asOf=YYYY-MM-DD` returns live evidence-backed goal progress;
- `/api/workload/week?ending=YYYY-MM-DD` returns the weekly review; and
- `/api/workload/month?month=YYYY-MM` returns the monthly review.

Date parameters default to the current UTC date or month. Unknown and duplicate
parameters fail with `400 INVALID_QUERY`; unsupported methods return `405` with
`Allow: GET`; unknown routes return `404`. Storage failures return a generic
`500 INTERNAL_ERROR` without filesystem paths or record identifiers.

## Privacy boundary

Journal responses exclude drills, drill notes, and session notes. Goal evidence
contains entry identifiers, timestamps, and numeric contributions only. Workload
routes use the existing note-free domain projections. Responses use `no-store`,
MIME-sniffing protection, a no-referrer policy, frame denial, and a restrictive
content-security policy.

This loopback boundary reduces accidental exposure; it is not an authentication
system. Only run it on a computer and user account you trust.
