import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  parseSessionPlanDraft,
  SessionPlanDraftError,
} from "../application/sessionPlanDraft.js";
import {
  loadSessionPlanFile,
  saveSessionPlanFile,
  SessionPlanFileError,
} from "../storage/sessionPlanFileStore.js";
import {
  serializeSessionPlan,
  SessionPlanRecordError,
} from "../storage/sessionPlanRecord.js";
import { parseCliArguments, CliUsageError } from "./arguments.js";
import { formatSessionPlan } from "./formatPlan.js";
import { CLI_HELP } from "./help.js";

export interface CliEnvironment {
  readonly now: () => Date;
  readonly writeOutput: (text: string) => void;
  readonly writeError: (text: string) => void;
}

class DraftFileReadError extends Error {
  readonly filePath: string;

  constructor(filePath: string, cause: unknown) {
    super(`could not read training plan draft from ${filePath}`, { cause });
    this.name = "DraftFileReadError";
    this.filePath = filePath;
  }
}

async function readDraft(filePath: string): Promise<string> {
  const resolvedPath = resolve(filePath);

  try {
    return await readFile(resolvedPath, "utf8");
  } catch (error) {
    throw new DraftFileReadError(resolvedPath, error);
  }
}

function describeError(error: unknown): string {
  if (error instanceof SessionPlanDraftError) {
    return `draft ${error.code.toLowerCase()} at ${error.path}: ${error.message}`;
  }

  if (error instanceof SessionPlanFileError) {
    return `plan file ${error.code.toLowerCase()}: ${error.message}`;
  }

  if (error instanceof SessionPlanRecordError) {
    return `plan record ${error.code.toLowerCase()} at ${error.path}: ${error.message}`;
  }

  if (error instanceof DraftFileReadError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "an unexpected error occurred";
}

export async function runCli(
  argumentsList: readonly string[],
  environment: CliEnvironment,
): Promise<number> {
  let command;

  try {
    command = parseCliArguments(argumentsList);
  } catch (error) {
    if (error instanceof CliUsageError) {
      environment.writeError(`Error: ${error.message}\n\n${CLI_HELP}\n`);
      return 2;
    }

    throw error;
  }

  if (command.kind === "help") {
    environment.writeOutput(`${CLI_HELP}\n`);
    return 0;
  }

  try {
    if (command.kind === "plan-create") {
      const source = await readDraft(command.from);
      const plan = parseSessionPlanDraft(source);
      const savedAt = command.savedAt ?? environment.now().toISOString();
      const stored = await saveSessionPlanFile(command.to, plan, savedAt);

      environment.writeOutput(
        [
          `Saved "${stored.plan.title}" to ${resolve(command.to)}`,
          `Scheduled: ${stored.plan.scheduledFor}`,
          `Duration: ${stored.plan.totalMinutes} min`,
        ].join("\n") + "\n",
      );
      return 0;
    }

    const stored = await loadSessionPlanFile(command.filePath);
    const output = command.json
      ? serializeSessionPlan(stored.plan, stored.savedAt)
      : formatSessionPlan(stored);
    environment.writeOutput(`${output}\n`);
    return 0;
  } catch (error) {
    environment.writeError(`Error: ${describeError(error)}\n`);
    return 1;
  }
}
