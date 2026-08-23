export const CLI_HELP = `Cricket Career Lab

Create plans, keep a private training journal, and track evidence-backed goals.

Usage:
  cricket-career-lab plan create --from <draft.json> --to <plan.json> [--saved-at <UTC timestamp>]
  cricket-career-lab plan show <plan.json> [--json]
  cricket-career-lab journal complete --plan <plan.json> --from <completion.json> [--journal <directory>] [--completed-at <UTC timestamp>]
  cricket-career-lab journal list [--journal <directory>] [--from <date>] [--to <date>] [--focus <focus>] [--intensity <level>] [--status <status>] [--text <query>] [--limit <count>] [--json]
  cricket-career-lab journal show <entry-id> [--journal <directory>] [--json]
  cricket-career-lab journal delete <entry-id> [--journal <directory>]
  cricket-career-lab goal create --from <goal.json> [--goals <directory>]
  cricket-career-lab goal list [--goals <directory>] [--journal <directory>] [--as-of <date>] [--json]
  cricket-career-lab goal show <goal-id> [--goals <directory>] [--journal <directory>] [--as-of <date>] [--json]
  cricket-career-lab goal delete <goal-id> [--goals <directory>]
  cricket-career-lab workload week [--journal <directory>] [--ending <date>] [--json]
  cricket-career-lab workload month [--journal <directory>] [--month <YYYY-MM>] [--json]
  cricket-career-lab backup create --to <backup.json> [--goals <directory>] [--journal <directory>] [--exported-at <UTC timestamp>]
  cricket-career-lab backup inspect <backup.json> [--json]
  cricket-career-lab backup restore <backup.json> [--goals <directory>] [--journal <directory>] [--conflicts <mode>]
  cricket-career-lab --help

Commands:
  plan create   Validate a draft and save a versioned private plan record.
  plan show     Show a saved plan as a readable summary or canonical JSON.
  journal complete  Validate results against a plan and save a journal entry.
  journal list      List completed sessions newest first.
  journal show      Show one completed session.
  journal delete    Delete one completed session.
  goal create       Validate and save a private development-goal definition.
  goal list         List goals with progress derived from journal evidence.
  goal show         Show one goal with exact contributing journal entries.
  goal delete       Delete one goal definition without deleting journal data.
  workload week     Compare an explicit seven-day window with the prior week.
  workload month    Review one calendar month against the prior month.
  backup create     Export goals and journal records to one private file.
  backup inspect    Validate and summarize a backup without showing notes.
  backup restore    Restore records with explicit conflict handling.

Options:
  --from        Path to an unversioned training-plan draft.
  --to          Destination for the validated versioned record.
  --saved-at    Canonical UTC timestamp; defaults to the current time.
  --plan        Path to a validated versioned plan record.
  --journal     Journal directory; defaults to .career/journal.
  --goals       Goal directory; defaults to .career/goals.
  --completed-at  Canonical UTC timestamp; defaults to the current time.
  --as-of       Goal evaluation date in YYYY-MM-DD; defaults to today.
  --ending      Weekly review end date in YYYY-MM-DD; defaults to today.
  --month       Review month in YYYY-MM; defaults to the current month.
  --exported-at  Canonical UTC export time; defaults to the current time.
  --conflicts   Restore mode: fail (default), skip, or replace.
  --from, --to  Inclusive completion-date bounds in YYYY-MM-DD format.
  --focus       Performed drill focus: batting, bowling, fielding, fitness, recovery.
  --intensity   Performed drill intensity: low, moderate, high.
  --status      Session outcome: completed, partial, missed.
  --text        Search entry, plan, drill, and private note text.
  --limit       Return 1 to 100 newest matching entries.
  --json        Emit canonical record JSON instead of a text summary.
  -h, --help    Show this help.`;
