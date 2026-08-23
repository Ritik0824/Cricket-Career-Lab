export type LocalServerCommand =
  | { readonly kind: "help" }
  | {
      readonly kind: "start";
      readonly host: string;
      readonly port: number;
      readonly goalsDirectory: string;
      readonly journalDirectory: string;
    };

export const LOCAL_SERVER_DEFAULT_HOST = "127.0.0.1";
export const LOCAL_SERVER_DEFAULT_PORT = 4317;
export const LOCAL_SERVER_DEFAULT_GOALS = ".career/goals";
export const LOCAL_SERVER_DEFAULT_JOURNAL = ".career/journal";

export class LocalServerUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalServerUsageError";
  }
}

function requireValue(
  argumentsList: readonly string[],
  index: number,
  option: string,
): string {
  const value = argumentsList[index + 1];

  if (
    value === undefined ||
    value.startsWith("--") ||
    value.trim().length === 0
  ) {
    throw new LocalServerUsageError(`${option} requires a value`);
  }

  return value;
}

export function parseLocalServerArguments(
  argumentsList: readonly string[],
): LocalServerCommand {
  if (argumentsList.includes("--help") || argumentsList.includes("-h")) {
    return { kind: "help" };
  }

  let host = LOCAL_SERVER_DEFAULT_HOST;
  let port = LOCAL_SERVER_DEFAULT_PORT;
  let goalsDirectory = LOCAL_SERVER_DEFAULT_GOALS;
  let journalDirectory = LOCAL_SERVER_DEFAULT_JOURNAL;
  const provided = new Set<string>();

  for (let index = 0; index < argumentsList.length; index += 1) {
    const option = argumentsList[index];

    if (
      option !== "--host" &&
      option !== "--port" &&
      option !== "--goals" &&
      option !== "--journal"
    ) {
      throw new LocalServerUsageError(
        `unknown local server option ${option ?? "<missing>"}`,
      );
    }

    if (provided.has(option)) {
      throw new LocalServerUsageError(`${option} may only be provided once`);
    }

    provided.add(option);
    const value = requireValue(argumentsList, index, option);
    index += 1;

    if (option === "--host") {
      host = value;
    } else if (option === "--port") {
      const parsed = Number(value);

      if (!Number.isInteger(parsed)) {
        throw new LocalServerUsageError("--port requires an integer");
      }

      port = parsed;
    } else if (option === "--goals") {
      goalsDirectory = value;
    } else {
      journalDirectory = value;
    }
  }

  return {
    kind: "start",
    host,
    port,
    goalsDirectory,
    journalDirectory,
  };
}

export const LOCAL_SERVER_HELP = `Cricket Career Lab local server

Serve privacy-safe review data over a loopback-only HTTP API.

Usage:
  npm run serve -- [--host <loopback>] [--port <port>] [--goals <directory>] [--journal <directory>]
  npm run serve -- --help

Options:
  --host     Loopback host: 127.0.0.1 (default), ::1, or localhost.
  --port     TCP port from 0 to 65535; defaults to 4317.
  --goals    Goal directory; defaults to .career/goals.
  --journal  Journal directory; defaults to .career/journal.
  -h, --help Show this help.`;
