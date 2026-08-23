import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  parseDevelopmentGoalDraft,
  DevelopmentGoalDraftError,
} from "../application/developmentGoalDraft.js";
import {
  parseSessionPlanDraft,
  SessionPlanDraftError,
} from "../application/sessionPlanDraft.js";
import {
  parseTrainingCompletionDraft,
  TrainingCompletionDraftError,
} from "../application/trainingCompletionDraft.js";
import {
  evaluateDevelopmentGoal,
  evaluateDevelopmentGoals,
  DevelopmentGoalValidationError,
} from "../domain/developmentGoal.js";
import {
  completeTrainingSession,
  TrainingJournalValidationError,
} from "../domain/trainingJournal.js";
import {
  filterTrainingJournal,
  TrainingJournalQueryError,
} from "../domain/trainingJournalQuery.js";
import {
  buildWeeklyWorkloadReview,
  WeeklyWorkloadValidationError,
} from "../domain/weeklyWorkload.js";
import {
  DevelopmentGoalFileRepository,
  DevelopmentGoalRepositoryError,
} from "../storage/developmentGoalRepository.js";
import {
  DevelopmentGoalRecordError,
} from "../storage/developmentGoalRecord.js";
import {
  loadSessionPlanFile,
  saveSessionPlanFile,
  SessionPlanFileError,
} from "../storage/sessionPlanFileStore.js";
import {
  serializeSessionPlan,
  SessionPlanRecordError,
} from "../storage/sessionPlanRecord.js";
import {
  TrainingJournalFileRepository,
  TrainingJournalRepositoryError,
} from "../storage/trainingJournalRepository.js";
import {
  serializeTrainingJournalEntry,
  TrainingJournalRecordError,
} from "../storage/trainingJournalRecord.js";
import { parseCliArguments, CliUsageError } from "./arguments.js";
import {
  formatGoalProgress,
  formatGoalProgressList,
  toGoalProgressView,
} from "./formatGoal.js";
import { formatJournalEntry, formatJournalList } from "./formatJournal.js";
import { formatSessionPlan } from "./formatPlan.js";
import { formatWeeklyWorkloadReview } from "./formatWorkload.js";
import { CLI_HELP } from "./help.js";

export interface CliEnvironment {
  readonly now: () => Date;
  readonly writeOutput: (text: string) => void;
  readonly writeError: (text: string) => void;
}

class DraftFileReadError extends Error {
  readonly filePath: string;

  constructor(filePath: string, label: string, cause: unknown) {
    super(`could not read ${label} from ${filePath}`, { cause });
    this.name = "DraftFileReadError";
    this.filePath = filePath;
  }
}

async function readDraft(filePath: string, label: string): Promise<string> {
  const resolvedPath = resolve(filePath);

  try {
    return await readFile(resolvedPath, "utf8");
  } catch (error) {
    throw new DraftFileReadError(resolvedPath, label, error);
  }
}

function describeError(error: unknown): string {
  if (error instanceof DevelopmentGoalDraftError) {
    return `goal draft ${error.code.toLowerCase()} at ${error.path}: ${error.message}`;
  }

  if (error instanceof SessionPlanDraftError) {
    return `draft ${error.code.toLowerCase()} at ${error.path}: ${error.message}`;
  }

  if (error instanceof TrainingCompletionDraftError) {
    return `completion draft ${error.code.toLowerCase()} at ${error.path}: ${error.message}`;
  }

  if (error instanceof TrainingJournalValidationError) {
    return `journal entry invalid at ${error.field}: ${error.message}`;
  }

  if (error instanceof TrainingJournalQueryError) {
    return `journal query invalid at ${error.field}: ${error.message}`;
  }

  if (error instanceof WeeklyWorkloadValidationError) {
    return `workload review invalid at ${error.field}: ${error.message}`;
  }

  if (error instanceof DevelopmentGoalValidationError) {
    return `goal invalid at ${error.field}: ${error.message}`;
  }

  if (error instanceof DevelopmentGoalRepositoryError) {
    return `goal ${error.code.toLowerCase()}: ${error.message}`;
  }

  if (error instanceof DevelopmentGoalRecordError) {
    return `goal record ${error.code.toLowerCase()} at ${error.path}: ${error.message}`;
  }

  if (error instanceof TrainingJournalRepositoryError) {
    return `journal ${error.code.toLowerCase()}: ${error.message}`;
  }

  if (error instanceof TrainingJournalRecordError) {
    return `journal record ${error.code.toLowerCase()} at ${error.path}: ${error.message}`;
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
      const source = await readDraft(command.from, "training plan draft");
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

    if (command.kind === "plan-show") {
      const stored = await loadSessionPlanFile(command.filePath);
      const output = command.json
        ? serializeSessionPlan(stored.plan, stored.savedAt)
        : formatSessionPlan(stored);
      environment.writeOutput(`${output}\n`);
      return 0;
    }

    if (command.kind === "journal-complete") {
      const storedPlan = await loadSessionPlanFile(command.plan);
      const source = await readDraft(command.from, "training completion draft");
      const draft = parseTrainingCompletionDraft(source);
      const completedAt = command.completedAt ?? environment.now().toISOString();
      const entry = completeTrainingSession({
        entryId: draft.entryId,
        plan: storedPlan.plan,
        completedAt,
        drills: draft.drills,
        ...(draft.sessionNote === undefined
          ? {}
          : { sessionNote: draft.sessionNote }),
      });
      const repository = new TrainingJournalFileRepository(command.journal);
      const saved = await repository.save(entry);

      environment.writeOutput(
        [
          `Recorded "${saved.planTitle}" as ${saved.entryId}`,
          `Status: ${saved.status}`,
          `Time: ${saved.completedMinutes}/${saved.plannedMinutes} min`,
          `Journal: ${repository.directoryPath}`,
        ].join("\n") + "\n",
      );
      return 0;
    }

    if (command.kind === "goal-create") {
      const source = await readDraft(command.from, "development goal draft");
      const goal = parseDevelopmentGoalDraft(source);
      const repository = new DevelopmentGoalFileRepository(command.goals);
      const saved = await repository.save(goal);

      environment.writeOutput(
        [
          `Saved goal "${saved.title}" as ${saved.goalId}`,
          `Metric: ${saved.metric}`,
          `Target: ${saved.target}`,
          `Window: ${saved.startDate} to ${saved.dueDate}`,
          `Goals: ${repository.directoryPath}`,
        ].join("\n") + "\n",
      );
      return 0;
    }

    if (command.kind === "goal-list") {
      const goalRepository = new DevelopmentGoalFileRepository(command.goals);
      const journalRepository = new TrainingJournalFileRepository(
        command.journal,
      );
      const [goals, entries] = await Promise.all([
        goalRepository.list(),
        journalRepository.list(),
      ]);
      const asOf = command.asOf ?? environment.now().toISOString().slice(0, 10);
      const progress = evaluateDevelopmentGoals(goals, entries, asOf);
      const output = command.json
        ? JSON.stringify(progress.map(toGoalProgressView), null, 2)
        : formatGoalProgressList(progress);

      environment.writeOutput(`${output}\n`);
      return 0;
    }

    if (command.kind === "goal-show") {
      const goalRepository = new DevelopmentGoalFileRepository(command.goals);
      const journalRepository = new TrainingJournalFileRepository(
        command.journal,
      );
      const [goal, entries] = await Promise.all([
        goalRepository.load(command.goalId),
        journalRepository.list(),
      ]);
      const asOf = command.asOf ?? environment.now().toISOString().slice(0, 10);
      const progress = evaluateDevelopmentGoal(goal, entries, asOf);
      const output = command.json
        ? JSON.stringify(toGoalProgressView(progress), null, 2)
        : formatGoalProgress(progress);

      environment.writeOutput(`${output}\n`);
      return 0;
    }

    if (command.kind === "goal-delete") {
      const repository = new DevelopmentGoalFileRepository(command.goals);
      const deleted = await repository.delete(command.goalId);

      environment.writeOutput(
        deleted
          ? `Deleted development goal ${command.goalId}.\n`
          : `No development goal ${command.goalId} was found.\n`,
      );
      return 0;
    }

    const repository = new TrainingJournalFileRepository(command.journal);

    if (command.kind === "workload-week") {
      const entries = await repository.list();
      const ending =
        command.ending ?? environment.now().toISOString().slice(0, 10);
      const review = buildWeeklyWorkloadReview(entries, ending);
      const output = command.json
        ? JSON.stringify(review, null, 2)
        : formatWeeklyWorkloadReview(review);

      environment.writeOutput(`${output}\n`);
      return 0;
    }

    if (command.kind === "journal-list") {
      const entries = filterTrainingJournal(await repository.list(), {
        ...(command.from === undefined ? {} : { from: command.from }),
        ...(command.to === undefined ? {} : { to: command.to }),
        ...(command.focus === undefined ? {} : { focus: command.focus }),
        ...(command.intensity === undefined
          ? {}
          : { intensity: command.intensity }),
        ...(command.status === undefined ? {} : { status: command.status }),
        ...(command.text === undefined ? {} : { text: command.text }),
        ...(command.limit === undefined ? {} : { limit: command.limit }),
      });
      const output = command.json
        ? JSON.stringify(
            entries.map((entry) =>
              JSON.parse(serializeTrainingJournalEntry(entry)) as unknown,
            ),
            null,
            2,
          )
        : formatJournalList(entries);
      environment.writeOutput(`${output}\n`);
      return 0;
    }

    if (command.kind === "journal-show") {
      const entry = await repository.load(command.entryId);
      const output = command.json
        ? serializeTrainingJournalEntry(entry)
        : formatJournalEntry(entry);
      environment.writeOutput(`${output}\n`);
      return 0;
    }

    const deleted = await repository.delete(command.entryId);
    environment.writeOutput(
      deleted
        ? `Deleted journal entry ${command.entryId}.\n`
        : `No journal entry ${command.entryId} was found.\n`,
    );
    return 0;
  } catch (error) {
    environment.writeError(`Error: ${describeError(error)}\n`);
    return 1;
  }
}
