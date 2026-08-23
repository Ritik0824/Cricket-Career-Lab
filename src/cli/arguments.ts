export type CliCommand =
  | { readonly kind: "help" }
  | {
      readonly kind: "plan-create";
      readonly from: string;
      readonly to: string;
      readonly savedAt?: string;
    }
  | {
      readonly kind: "plan-show";
      readonly filePath: string;
      readonly json: boolean;
    };

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

interface CreateOptions {
  from?: string;
  to?: string;
  savedAt?: string;
}

function requireOptionValue(
  argumentsList: readonly string[],
  index: number,
  option: string,
): string {
  const value = argumentsList[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new CliUsageError(`${option} requires a value`);
  }

  return value;
}

function setCreateOption(
  options: CreateOptions,
  key: keyof CreateOptions,
  value: string,
  option: string,
): void {
  if (options[key] !== undefined) {
    throw new CliUsageError(`${option} may only be provided once`);
  }

  options[key] = value;
}

function parseCreate(argumentsList: readonly string[]): CliCommand {
  const options: CreateOptions = {};

  for (let index = 0; index < argumentsList.length; index += 2) {
    const option = argumentsList[index];

    if (option === undefined || !option.startsWith("--")) {
      throw new CliUsageError(
        `unexpected create argument ${option ?? "<missing>"}`,
      );
    }

    const value = requireOptionValue(argumentsList, index, option);

    if (option === "--from") {
      setCreateOption(options, "from", value, option);
    } else if (option === "--to") {
      setCreateOption(options, "to", value, option);
    } else if (option === "--saved-at") {
      setCreateOption(options, "savedAt", value, option);
    } else {
      throw new CliUsageError(`unknown create option ${option}`);
    }
  }

  if (options.from === undefined) {
    throw new CliUsageError("plan create requires --from <draft.json>");
  }

  if (options.to === undefined) {
    throw new CliUsageError("plan create requires --to <plan.json>");
  }

  return options.savedAt === undefined
    ? {
        kind: "plan-create",
        from: options.from,
        to: options.to,
      }
    : {
        kind: "plan-create",
        from: options.from,
        to: options.to,
        savedAt: options.savedAt,
      };
}

function parseShow(argumentsList: readonly string[]): CliCommand {
  let filePath: string | undefined;
  let json = false;

  for (const argument of argumentsList) {
    if (argument === "--json") {
      if (json) {
        throw new CliUsageError("--json may only be provided once");
      }

      json = true;
    } else if (argument.startsWith("--")) {
      throw new CliUsageError(`unknown show option ${argument}`);
    } else if (filePath === undefined) {
      filePath = argument;
    } else {
      throw new CliUsageError(`unexpected show argument ${argument}`);
    }
  }

  if (filePath === undefined) {
    throw new CliUsageError("plan show requires <plan.json>");
  }

  return { kind: "plan-show", filePath, json };
}

export function parseCliArguments(argumentsList: readonly string[]): CliCommand {
  if (
    argumentsList.length === 0 ||
    argumentsList.includes("--help") ||
    argumentsList.includes("-h")
  ) {
    return { kind: "help" };
  }

  const [scope, action, ...remaining] = argumentsList;

  if (scope !== "plan") {
    throw new CliUsageError(`unknown command ${scope ?? "<missing>"}`);
  }

  if (action === "create") {
    return parseCreate(remaining);
  }

  if (action === "show") {
    return parseShow(remaining);
  }

  throw new CliUsageError(
    `unknown plan command ${action ?? "<missing>"}`,
  );
}
