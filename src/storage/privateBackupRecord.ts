import type { DevelopmentGoal } from "../domain/developmentGoal.js";
import type { TrainingJournalEntry } from "../domain/trainingJournal.js";
import {
  parseDevelopmentGoalRecord,
  serializeDevelopmentGoal,
  DevelopmentGoalRecordError,
} from "./developmentGoalRecord.js";
import {
  parseTrainingJournalRecord,
  serializeTrainingJournalEntry,
  TrainingJournalRecordError,
} from "./trainingJournalRecord.js";

export const PRIVATE_BACKUP_RECORD_KIND =
  "cricket-career-lab/private-backup";
export const PRIVATE_BACKUP_RECORD_VERSION = 1;

export type PrivateBackupRecordErrorCode =
  | "INVALID_JSON"
  | "INVALID_SHAPE"
  | "UNSUPPORTED_VERSION"
  | "INVALID_TIMESTAMP"
  | "INVALID_GOAL"
  | "INVALID_JOURNAL_ENTRY"
  | "DUPLICATE_GOAL"
  | "DUPLICATE_JOURNAL_ENTRY";

export interface PrivateBackup {
  readonly exportedAt: string;
  readonly goals: readonly DevelopmentGoal[];
  readonly journalEntries: readonly TrainingJournalEntry[];
}

export class PrivateBackupRecordError extends Error {
  readonly code: PrivateBackupRecordErrorCode;
  readonly path: string;

  constructor(
    code: PrivateBackupRecordErrorCode,
    path: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "PrivateBackupRecordError";
    this.code = code;
    this.path = path;
  }
}

type UnknownObject = Record<string, unknown>;

function invalidShape(path: string, expectation: string): never {
  throw new PrivateBackupRecordError(
    "INVALID_SHAPE",
    path,
    `${path} must be ${expectation}`,
  );
}

function readObject(value: unknown, path: string): UnknownObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalidShape(path, "an object");
  }

  return value as UnknownObject;
}

function readSource(source: string | unknown): unknown {
  if (typeof source !== "string") {
    return source;
  }

  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new PrivateBackupRecordError(
      "INVALID_JSON",
      "$",
      "private backup must contain valid JSON",
    );
  }
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== "string") {
    return invalidShape("exportedAt", "a string");
  }

  const parsed = new Date(value);

  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new PrivateBackupRecordError(
      "INVALID_TIMESTAMP",
      "exportedAt",
      "exportedAt must be a canonical UTC timestamp",
    );
  }

  return value;
}

function parseGoals(values: unknown): readonly DevelopmentGoal[] {
  if (!Array.isArray(values)) {
    return invalidShape("goals", "an array");
  }

  const seenIds = new Set<string>();
  const goals = values.map((value, index) => {
    let goal: DevelopmentGoal;

    try {
      goal = parseDevelopmentGoalRecord(value);
    } catch (error) {
      if (error instanceof DevelopmentGoalRecordError) {
        throw new PrivateBackupRecordError(
          "INVALID_GOAL",
          `goals.${index}.${error.path}`,
          error.message,
          error,
        );
      }

      throw error;
    }

    if (seenIds.has(goal.goalId)) {
      throw new PrivateBackupRecordError(
        "DUPLICATE_GOAL",
        `goals.${index}.goalId`,
        `goal ${goal.goalId} is listed more than once`,
      );
    }

    seenIds.add(goal.goalId);
    return goal;
  });

  goals.sort((left, right) => left.goalId.localeCompare(right.goalId));
  return Object.freeze(goals);
}

function parseJournalEntries(
  values: unknown,
): readonly TrainingJournalEntry[] {
  if (!Array.isArray(values)) {
    return invalidShape("journalEntries", "an array");
  }

  const seenIds = new Set<string>();
  const entries = values.map((value, index) => {
    let entry: TrainingJournalEntry;

    try {
      entry = parseTrainingJournalRecord(value);
    } catch (error) {
      if (error instanceof TrainingJournalRecordError) {
        throw new PrivateBackupRecordError(
          "INVALID_JOURNAL_ENTRY",
          `journalEntries.${index}.${error.path}`,
          error.message,
          error,
        );
      }

      throw error;
    }

    if (seenIds.has(entry.entryId)) {
      throw new PrivateBackupRecordError(
        "DUPLICATE_JOURNAL_ENTRY",
        `journalEntries.${index}.entryId`,
        `journal entry ${entry.entryId} is listed more than once`,
      );
    }

    seenIds.add(entry.entryId);
    return entry;
  });

  entries.sort(
    (left, right) =>
      right.completedAt.localeCompare(left.completedAt) ||
      left.entryId.localeCompare(right.entryId),
  );
  return Object.freeze(entries);
}

function parseBackupRecord(record: UnknownObject): PrivateBackup {
  if (record.kind !== PRIVATE_BACKUP_RECORD_KIND) {
    throw new PrivateBackupRecordError(
      "INVALID_SHAPE",
      "kind",
      `kind must equal ${PRIVATE_BACKUP_RECORD_KIND}`,
    );
  }

  if (
    typeof record.version !== "number" ||
    !Number.isInteger(record.version)
  ) {
    return invalidShape("version", "an integer");
  }

  if (record.version !== PRIVATE_BACKUP_RECORD_VERSION) {
    throw new PrivateBackupRecordError(
      "UNSUPPORTED_VERSION",
      "version",
      `private backup version ${String(record.version)} is not supported`,
    );
  }

  return Object.freeze({
    exportedAt: normalizeTimestamp(record.exportedAt),
    goals: parseGoals(record.goals),
    journalEntries: parseJournalEntries(record.journalEntries),
  });
}

function serializeGoalObject(goal: DevelopmentGoal, index: number): unknown {
  try {
    return JSON.parse(serializeDevelopmentGoal(goal)) as unknown;
  } catch (error) {
    if (error instanceof DevelopmentGoalRecordError) {
      throw new PrivateBackupRecordError(
        "INVALID_GOAL",
        `goals.${index}.${error.path}`,
        error.message,
        error,
      );
    }

    throw error;
  }
}

function serializeJournalEntryObject(
  entry: TrainingJournalEntry,
  index: number,
): unknown {
  try {
    return JSON.parse(serializeTrainingJournalEntry(entry)) as unknown;
  } catch (error) {
    if (error instanceof TrainingJournalRecordError) {
      throw new PrivateBackupRecordError(
        "INVALID_JOURNAL_ENTRY",
        `journalEntries.${index}.${error.path}`,
        error.message,
        error,
      );
    }

    throw error;
  }
}

export function createPrivateBackup(
  goals: readonly DevelopmentGoal[],
  journalEntries: readonly TrainingJournalEntry[],
  exportedAt: string,
): PrivateBackup {
  return parseBackupRecord({
    kind: PRIVATE_BACKUP_RECORD_KIND,
    version: PRIVATE_BACKUP_RECORD_VERSION,
    exportedAt,
    goals: goals.map(serializeGoalObject),
    journalEntries: journalEntries.map(serializeJournalEntryObject),
  });
}

export function serializePrivateBackup(backup: PrivateBackup): string {
  const normalized = createPrivateBackup(
    backup.goals,
    backup.journalEntries,
    backup.exportedAt,
  );

  return JSON.stringify(
    {
      kind: PRIVATE_BACKUP_RECORD_KIND,
      version: PRIVATE_BACKUP_RECORD_VERSION,
      exportedAt: normalized.exportedAt,
      goals: normalized.goals.map(serializeGoalObject),
      journalEntries: normalized.journalEntries.map(
        serializeJournalEntryObject,
      ),
    },
    null,
    2,
  );
}

export function parsePrivateBackupRecord(
  source: string | unknown,
): PrivateBackup {
  return parseBackupRecord(readObject(readSource(source), "$record"));
}
