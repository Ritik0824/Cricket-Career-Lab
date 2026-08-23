export const CLI_HELP = `Cricket Career Lab

Create and review private cricket training plans.

Usage:
  cricket-career-lab plan create --from <draft.json> --to <plan.json> [--saved-at <UTC timestamp>]
  cricket-career-lab plan show <plan.json> [--json]
  cricket-career-lab --help

Commands:
  plan create   Validate a draft and save a versioned private plan record.
  plan show     Show a saved plan as a readable summary or canonical JSON.

Options:
  --from        Path to an unversioned training-plan draft.
  --to          Destination for the validated versioned record.
  --saved-at    Canonical UTC timestamp; defaults to the current time.
  --json        Emit canonical record JSON instead of a text summary.
  -h, --help    Show this help.`;
