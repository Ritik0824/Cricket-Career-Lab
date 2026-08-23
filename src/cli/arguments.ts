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
    }
  | {
      readonly kind: "journal-complete";
      readonly plan: string;
      readonly from: string;
      readonly journal: string;
      readonly completedAt?: string;
    }
  | {
      readonly kind: "journal-list";
      readonly journal: string;
      readonly json: boolean;
      readonly from?: string;
      readonly to?: string;
      readonly focus?: string;
      readonly intensity?: string;
      readonly status?: string;
      readonly text?: string;
      readonly limit?: number;
    }
  | {
      readonly kind: "journal-show";
      readonly entryId: string;
      readonly journal: string;
      readonly json: boolean;
    }
  | {
      readonly kind: "journal-delete";
      readonly entryId: string;
      readonly journal: string;
    }
  | {
      readonly kind: "goal-create";
      readonly from: string;
      readonly goals: string;
    }
  | {
      readonly kind: "goal-list";
      readonly goals: string;
      readonly journal: string;
      readonly asOf?: string;
      readonly json: boolean;
    }
  | {
      readonly kind: "goal-show";
      readonly goalId: string;
      readonly goals: string;
      readonly journal: string;
      readonly asOf?: string;
      readonly json: boolean;
    }
  | {
      readonly kind: "goal-delete";
      readonly goalId: string;
      readonly goals: string;
    }
  | {
      readonly kind: "workload-week";
      readonly journal: string;
      readonly ending?: string;
      readonly json: boolean;
    }
  | {
      readonly kind: "workload-month";
      readonly journal: string;
      readonly month?: string;
      readonly json: boolean;
    }
  | {
      readonly kind: "backup-create";
      readonly to: string;
      readonly goals: string;
      readonly journal: string;
      readonly exportedAt?: string;
    }
  | {
      readonly kind: "backup-inspect";
      readonly filePath: string;
      readonly json: boolean;
    }
  | {
      readonly kind: "backup-restore";
      readonly filePath: string;
      readonly goals: string;
      readonly journal: string;
      readonly conflicts: "fail" | "skip" | "replace";
    };

export const DEFAULT_JOURNAL_DIRECTORY = ".career/journal";
export const DEFAULT_GOAL_DIRECTORY = ".career/goals";

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

interface JournalCompleteOptions {
  plan?: string;
  from?: string;
  journal?: string;
  completedAt?: string;
}

interface JournalListOptions {
  from?: string;
  to?: string;
  focus?: string;
  intensity?: string;
  status?: string;
  text?: string;
  limit?: number;
}

function requireOptionValue(
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

  if (filePath === undefined || filePath.trim().length === 0) {
    throw new CliUsageError("plan show requires <plan.json>");
  }

  return { kind: "plan-show", filePath, json };
}

function setJournalCompleteOption(
  options: JournalCompleteOptions,
  key: keyof JournalCompleteOptions,
  value: string,
  option: string,
): void {
  if (options[key] !== undefined) {
    throw new CliUsageError(`${option} may only be provided once`);
  }

  options[key] = value;
}

function parseJournalComplete(argumentsList: readonly string[]): CliCommand {
  const options: JournalCompleteOptions = {};

  for (let index = 0; index < argumentsList.length; index += 2) {
    const option = argumentsList[index];

    if (option === undefined || !option.startsWith("--")) {
      throw new CliUsageError(
        `unexpected journal complete argument ${option ?? "<missing>"}`,
      );
    }

    const value = requireOptionValue(argumentsList, index, option);

    if (option === "--plan") {
      setJournalCompleteOption(options, "plan", value, option);
    } else if (option === "--from") {
      setJournalCompleteOption(options, "from", value, option);
    } else if (option === "--journal") {
      setJournalCompleteOption(options, "journal", value, option);
    } else if (option === "--completed-at") {
      setJournalCompleteOption(options, "completedAt", value, option);
    } else {
      throw new CliUsageError(`unknown journal complete option ${option}`);
    }
  }

  if (options.plan === undefined) {
    throw new CliUsageError(
      "journal complete requires --plan <plan.json>",
    );
  }

  if (options.from === undefined) {
    throw new CliUsageError(
      "journal complete requires --from <completion.json>",
    );
  }

  const base = {
    kind: "journal-complete" as const,
    plan: options.plan,
    from: options.from,
    journal: options.journal ?? DEFAULT_JOURNAL_DIRECTORY,
  };

  return options.completedAt === undefined
    ? base
    : { ...base, completedAt: options.completedAt };
}

function parseJournalList(argumentsList: readonly string[]): CliCommand {
  let journal = DEFAULT_JOURNAL_DIRECTORY;
  let journalProvided = false;
  let json = false;
  const options: JournalListOptions = {};

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--json") {
      if (json) {
        throw new CliUsageError("--json may only be provided once");
      }

      json = true;
    } else if (argument === "--journal") {
      if (journalProvided) {
        throw new CliUsageError("--journal may only be provided once");
      }

      journal = requireOptionValue(argumentsList, index, argument);
      journalProvided = true;
      index += 1;
    } else if (
      argument === "--from" ||
      argument === "--to" ||
      argument === "--focus" ||
      argument === "--intensity" ||
      argument === "--status" ||
      argument === "--text"
    ) {
      const key = argument.slice(2) as Exclude<keyof JournalListOptions, "limit">;

      if (options[key] !== undefined) {
        throw new CliUsageError(`${argument} may only be provided once`);
      }

      options[key] = requireOptionValue(argumentsList, index, argument);
      index += 1;
    } else if (argument === "--limit") {
      if (options.limit !== undefined) {
        throw new CliUsageError("--limit may only be provided once");
      }

      const value = requireOptionValue(argumentsList, index, argument);
      const limit = Number(value);

      if (!Number.isInteger(limit)) {
        throw new CliUsageError("--limit requires an integer");
      }

      options.limit = limit;
      index += 1;
    } else {
      throw new CliUsageError(
        `unknown journal list option ${argument ?? "<missing>"}`,
      );
    }
  }

  return { kind: "journal-list", journal, json, ...options };
}

function parseJournalEntryCommand(
  action: "show" | "delete",
  argumentsList: readonly string[],
): CliCommand {
  let entryId: string | undefined;
  let journal = DEFAULT_JOURNAL_DIRECTORY;
  let journalProvided = false;
  let json = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--journal") {
      if (journalProvided) {
        throw new CliUsageError("--journal may only be provided once");
      }

      journal = requireOptionValue(argumentsList, index, argument);
      journalProvided = true;
      index += 1;
    } else if (argument === "--json" && action === "show") {
      if (json) {
        throw new CliUsageError("--json may only be provided once");
      }

      json = true;
    } else if (argument === undefined || argument.startsWith("--")) {
      throw new CliUsageError(
        `unknown journal ${action} option ${argument ?? "<missing>"}`,
      );
    } else if (entryId === undefined) {
      entryId = argument;
    } else {
      throw new CliUsageError(
        `unexpected journal ${action} argument ${argument}`,
      );
    }
  }

  if (entryId === undefined || entryId.trim().length === 0) {
    throw new CliUsageError(`journal ${action} requires <entry-id>`);
  }

  return action === "show"
    ? { kind: "journal-show", entryId, journal, json }
    : { kind: "journal-delete", entryId, journal };
}

function parseJournalCommand(
  action: string | undefined,
  remaining: readonly string[],
): CliCommand {
  if (action === "complete") {
    return parseJournalComplete(remaining);
  }

  if (action === "list") {
    return parseJournalList(remaining);
  }

  if (action === "show" || action === "delete") {
    return parseJournalEntryCommand(action, remaining);
  }

  throw new CliUsageError(
    `unknown journal command ${action ?? "<missing>"}`,
  );
}

function parseGoalCreate(argumentsList: readonly string[]): CliCommand {
  let from: string | undefined;
  let goals = DEFAULT_GOAL_DIRECTORY;
  let goalsProvided = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--from") {
      if (from !== undefined) {
        throw new CliUsageError("--from may only be provided once");
      }

      from = requireOptionValue(argumentsList, index, argument);
      index += 1;
    } else if (argument === "--goals") {
      if (goalsProvided) {
        throw new CliUsageError("--goals may only be provided once");
      }

      goals = requireOptionValue(argumentsList, index, argument);
      goalsProvided = true;
      index += 1;
    } else {
      throw new CliUsageError(
        `unknown goal create option ${argument ?? "<missing>"}`,
      );
    }
  }

  if (from === undefined) {
    throw new CliUsageError("goal create requires --from <goal.json>");
  }

  return { kind: "goal-create", from, goals };
}

interface GoalEvaluationOptions {
  goals: string;
  journal: string;
  asOf?: string;
  json: boolean;
}

function parseGoalEvaluationOptions(
  action: "list" | "show",
  argumentsList: readonly string[],
): GoalEvaluationOptions & { readonly goalId?: string } {
  let goalId: string | undefined;
  let goals = DEFAULT_GOAL_DIRECTORY;
  let journal = DEFAULT_JOURNAL_DIRECTORY;
  let asOf: string | undefined;
  let goalsProvided = false;
  let journalProvided = false;
  let json = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--json") {
      if (json) {
        throw new CliUsageError("--json may only be provided once");
      }

      json = true;
    } else if (argument === "--goals") {
      if (goalsProvided) {
        throw new CliUsageError("--goals may only be provided once");
      }

      goals = requireOptionValue(argumentsList, index, argument);
      goalsProvided = true;
      index += 1;
    } else if (argument === "--journal") {
      if (journalProvided) {
        throw new CliUsageError("--journal may only be provided once");
      }

      journal = requireOptionValue(argumentsList, index, argument);
      journalProvided = true;
      index += 1;
    } else if (argument === "--as-of") {
      if (asOf !== undefined) {
        throw new CliUsageError("--as-of may only be provided once");
      }

      asOf = requireOptionValue(argumentsList, index, argument);
      index += 1;
    } else if (
      action === "show" &&
      argument !== undefined &&
      !argument.startsWith("--") &&
      goalId === undefined
    ) {
      goalId = argument;
    } else {
      throw new CliUsageError(
        `unknown goal ${action} option ${argument ?? "<missing>"}`,
      );
    }
  }

  if (action === "show" && goalId === undefined) {
    throw new CliUsageError("goal show requires <goal-id>");
  }

  return {
    goals,
    journal,
    ...(asOf === undefined ? {} : { asOf }),
    json,
    ...(goalId === undefined ? {} : { goalId }),
  };
}

function parseGoalDelete(argumentsList: readonly string[]): CliCommand {
  let goalId: string | undefined;
  let goals = DEFAULT_GOAL_DIRECTORY;
  let goalsProvided = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--goals") {
      if (goalsProvided) {
        throw new CliUsageError("--goals may only be provided once");
      }

      goals = requireOptionValue(argumentsList, index, argument);
      goalsProvided = true;
      index += 1;
    } else if (
      argument !== undefined &&
      !argument.startsWith("--") &&
      goalId === undefined
    ) {
      goalId = argument;
    } else {
      throw new CliUsageError(
        `unknown goal delete option ${argument ?? "<missing>"}`,
      );
    }
  }

  if (goalId === undefined) {
    throw new CliUsageError("goal delete requires <goal-id>");
  }

  return { kind: "goal-delete", goalId, goals };
}

function parseGoalCommand(
  action: string | undefined,
  remaining: readonly string[],
): CliCommand {
  if (action === "create") {
    return parseGoalCreate(remaining);
  }

  if (action === "list") {
    return { kind: "goal-list", ...parseGoalEvaluationOptions(action, remaining) };
  }

  if (action === "show") {
    const options = parseGoalEvaluationOptions(action, remaining);

    return {
      kind: "goal-show",
      goalId: options.goalId as string,
      goals: options.goals,
      journal: options.journal,
      ...(options.asOf === undefined ? {} : { asOf: options.asOf }),
      json: options.json,
    };
  }

  if (action === "delete") {
    return parseGoalDelete(remaining);
  }

  throw new CliUsageError(`unknown goal command ${action ?? "<missing>"}`);
}

function parseWorkloadWeek(argumentsList: readonly string[]): CliCommand {
  let journal = DEFAULT_JOURNAL_DIRECTORY;
  let ending: string | undefined;
  let journalProvided = false;
  let json = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--json") {
      if (json) {
        throw new CliUsageError("--json may only be provided once");
      }

      json = true;
    } else if (argument === "--journal") {
      if (journalProvided) {
        throw new CliUsageError("--journal may only be provided once");
      }

      journal = requireOptionValue(argumentsList, index, argument);
      journalProvided = true;
      index += 1;
    } else if (argument === "--ending") {
      if (ending !== undefined) {
        throw new CliUsageError("--ending may only be provided once");
      }

      ending = requireOptionValue(argumentsList, index, argument);
      index += 1;
    } else {
      throw new CliUsageError(
        `unknown workload week option ${argument ?? "<missing>"}`,
      );
    }
  }

  return {
    kind: "workload-week",
    journal,
    ...(ending === undefined ? {} : { ending }),
    json,
  };
}

function parseWorkloadMonth(argumentsList: readonly string[]): CliCommand {
  let journal = DEFAULT_JOURNAL_DIRECTORY;
  let month: string | undefined;
  let journalProvided = false;
  let json = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--json") {
      if (json) {
        throw new CliUsageError("--json may only be provided once");
      }

      json = true;
    } else if (argument === "--journal") {
      if (journalProvided) {
        throw new CliUsageError("--journal may only be provided once");
      }

      journal = requireOptionValue(argumentsList, index, argument);
      journalProvided = true;
      index += 1;
    } else if (argument === "--month") {
      if (month !== undefined) {
        throw new CliUsageError("--month may only be provided once");
      }

      month = requireOptionValue(argumentsList, index, argument);
      index += 1;
    } else {
      throw new CliUsageError(
        `unknown workload month option ${argument ?? "<missing>"}`,
      );
    }
  }

  return {
    kind: "workload-month",
    journal,
    ...(month === undefined ? {} : { month }),
    json,
  };
}

function parseWorkloadCommand(
  action: string | undefined,
  remaining: readonly string[],
): CliCommand {
  if (action === "week") {
    return parseWorkloadWeek(remaining);
  }

  if (action === "month") {
    return parseWorkloadMonth(remaining);
  }

  throw new CliUsageError(
    `unknown workload command ${action ?? "<missing>"}`,
  );
}

function parseBackupCreate(argumentsList: readonly string[]): CliCommand {
  let to: string | undefined;
  let goals = DEFAULT_GOAL_DIRECTORY;
  let journal = DEFAULT_JOURNAL_DIRECTORY;
  let exportedAt: string | undefined;
  const provided = new Set<string>();

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (
      argument !== "--to" &&
      argument !== "--goals" &&
      argument !== "--journal" &&
      argument !== "--exported-at"
    ) {
      throw new CliUsageError(
        `unknown backup create option ${argument ?? "<missing>"}`,
      );
    }

    if (provided.has(argument)) {
      throw new CliUsageError(`${argument} may only be provided once`);
    }

    provided.add(argument);
    const value = requireOptionValue(argumentsList, index, argument);
    index += 1;

    if (argument === "--to") {
      to = value;
    } else if (argument === "--goals") {
      goals = value;
    } else if (argument === "--journal") {
      journal = value;
    } else {
      exportedAt = value;
    }
  }

  if (to === undefined) {
    throw new CliUsageError("backup create requires --to <backup.json>");
  }

  return {
    kind: "backup-create",
    to,
    goals,
    journal,
    ...(exportedAt === undefined ? {} : { exportedAt }),
  };
}

function parseBackupInspect(argumentsList: readonly string[]): CliCommand {
  let filePath: string | undefined;
  let json = false;

  for (const argument of argumentsList) {
    if (argument === "--json") {
      if (json) {
        throw new CliUsageError("--json may only be provided once");
      }

      json = true;
    } else if (argument.startsWith("--")) {
      throw new CliUsageError(`unknown backup inspect option ${argument}`);
    } else if (filePath === undefined) {
      filePath = argument;
    } else {
      throw new CliUsageError(`unexpected backup inspect argument ${argument}`);
    }
  }

  if (filePath === undefined) {
    throw new CliUsageError("backup inspect requires <backup.json>");
  }

  return { kind: "backup-inspect", filePath, json };
}

function parseBackupRestore(argumentsList: readonly string[]): CliCommand {
  let filePath: string | undefined;
  let goals = DEFAULT_GOAL_DIRECTORY;
  let journal = DEFAULT_JOURNAL_DIRECTORY;
  let conflicts: "fail" | "skip" | "replace" = "fail";
  const provided = new Set<string>();

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (
      argument === "--goals" ||
      argument === "--journal" ||
      argument === "--conflicts"
    ) {
      if (provided.has(argument)) {
        throw new CliUsageError(`${argument} may only be provided once`);
      }

      provided.add(argument);
      const value = requireOptionValue(argumentsList, index, argument);
      index += 1;

      if (argument === "--goals") {
        goals = value;
      } else if (argument === "--journal") {
        journal = value;
      } else {
        const normalized = value.toLowerCase();

        if (
          normalized !== "fail" &&
          normalized !== "skip" &&
          normalized !== "replace"
        ) {
          throw new CliUsageError(
            "--conflicts must be one of fail, skip, replace",
          );
        }

        conflicts = normalized;
      }
    } else if (argument === undefined || argument.startsWith("--")) {
      throw new CliUsageError(
        `unknown backup restore option ${argument ?? "<missing>"}`,
      );
    } else if (filePath === undefined) {
      filePath = argument;
    } else {
      throw new CliUsageError(`unexpected backup restore argument ${argument}`);
    }
  }

  if (filePath === undefined) {
    throw new CliUsageError("backup restore requires <backup.json>");
  }

  return {
    kind: "backup-restore",
    filePath,
    goals,
    journal,
    conflicts,
  };
}

function parseBackupCommand(
  action: string | undefined,
  remaining: readonly string[],
): CliCommand {
  if (action === "create") {
    return parseBackupCreate(remaining);
  }

  if (action === "inspect") {
    return parseBackupInspect(remaining);
  }

  if (action === "restore") {
    return parseBackupRestore(remaining);
  }

  throw new CliUsageError(`unknown backup command ${action ?? "<missing>"}`);
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

  if (scope === "plan") {
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

  if (scope === "journal") {
    return parseJournalCommand(action, remaining);
  }

  if (scope === "goal") {
    return parseGoalCommand(action, remaining);
  }

  if (scope === "workload") {
    return parseWorkloadCommand(action, remaining);
  }

  if (scope === "backup") {
    return parseBackupCommand(action, remaining);
  }

  throw new CliUsageError(`unknown command ${scope ?? "<missing>"}`);
}
