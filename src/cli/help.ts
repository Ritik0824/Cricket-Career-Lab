export const CLI_HELP = `Cricket Career Lab

Create plans and keep a private local cricket training journal.

Usage:
  cricket-career-lab plan create --from <draft.json> --to <plan.json> [--saved-at <UTC timestamp>]
  cricket-career-lab plan show <plan.json> [--json]
  cricket-career-lab journal complete --plan <plan.json> --from <completion.json> [--journal <directory>] [--completed-at <UTC timestamp>]
  cricket-career-lab journal list [--journal <directory>] [--json]
  cricket-career-lab journal show <entry-id> [--journal <directory>] [--json]
  cricket-career-lab journal delete <entry-id> [--journal <directory>]
  cricket-career-lab --help

Commands:
  plan create   Validate a draft and save a versioned private plan record.
  plan show     Show a saved plan as a readable summary or canonical JSON.
  journal complete  Validate results against a plan and save a journal entry.
  journal list      List completed sessions newest first.
  journal show      Show one completed session.
  journal delete    Delete one completed session.

Options:
  --from        Path to an unversioned training-plan draft.
  --to          Destination for the validated versioned record.
  --saved-at    Canonical UTC timestamp; defaults to the current time.
  --plan        Path to a validated versioned plan record.
  --journal     Journal directory; defaults to .career/journal.
  --completed-at  Canonical UTC timestamp; defaults to the current time.
  --json        Emit canonical record JSON instead of a text summary.
  -h, --help    Show this help.`;
