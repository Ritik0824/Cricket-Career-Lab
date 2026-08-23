import type { DevelopmentGoal } from "../domain/developmentGoal.js";
import type { TrainingJournalEntry } from "../domain/trainingJournal.js";
import {
  DevelopmentGoalFileRepository,
} from "../storage/developmentGoalRepository.js";
import {
  loadPrivateBackupFile,
  savePrivateBackupFile,
} from "../storage/privateBackupFile.js";
import {
  createPrivateBackup,
  type PrivateBackup,
} from "../storage/privateBackupRecord.js";
import {
  TrainingJournalFileRepository,
} from "../storage/trainingJournalRepository.js";

export const BACKUP_CONFLICT_MODES = ["fail", "skip", "replace"] as const;
export type BackupConflictMode = (typeof BACKUP_CONFLICT_MODES)[number];

export interface ExportPrivateBackupInput {
  readonly goalsDirectory: string;
  readonly journalDirectory: string;
  readonly filePath: string;
  readonly exportedAt: string;
}

export interface RestorePrivateBackupInput {
  readonly goalsDirectory: string;
  readonly journalDirectory: string;
  readonly filePath: string;
  readonly conflicts: string;
}

export interface RestoreCollectionResult {
  readonly created: number;
  readonly replaced: number;
  readonly skipped: number;
}

export interface RestorePrivateBackupResult {
  readonly exportedAt: string;
  readonly goals: RestoreCollectionResult;
  readonly journalEntries: RestoreCollectionResult;
}

export type PrivateBackupServiceErrorCode =
  | "INVALID_CONFLICT_MODE"
  | "CONFLICT"
  | "RESTORE_FAILED"
  | "ROLLBACK_FAILED";

export class PrivateBackupServiceError extends Error {
  readonly code: PrivateBackupServiceErrorCode;
  readonly conflicts: readonly string[];

  constructor(
    code: PrivateBackupServiceErrorCode,
    message: string,
    conflicts: readonly string[] = [],
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "PrivateBackupServiceError";
    this.code = code;
    this.conflicts = Object.freeze([...conflicts]);
  }
}

type RestoreMutation =
  | {
      readonly kind: "goal";
      readonly id: string;
      readonly original: DevelopmentGoal | null;
    }
  | {
      readonly kind: "journal";
      readonly id: string;
      readonly original: TrainingJournalEntry | null;
    };

function normalizeConflictMode(value: string): BackupConflictMode {
  const normalized = value.trim().toLowerCase();

  if (!BACKUP_CONFLICT_MODES.includes(normalized as BackupConflictMode)) {
    throw new PrivateBackupServiceError(
      "INVALID_CONFLICT_MODE",
      `conflicts must be one of ${BACKUP_CONFLICT_MODES.join(", ")}`,
    );
  }

  return normalized as BackupConflictMode;
}

export async function exportPrivateBackup(
  input: ExportPrivateBackupInput,
): Promise<PrivateBackup> {
  const goalRepository = new DevelopmentGoalFileRepository(
    input.goalsDirectory,
  );
  const journalRepository = new TrainingJournalFileRepository(
    input.journalDirectory,
  );
  const [goals, journalEntries] = await Promise.all([
    goalRepository.list(),
    journalRepository.list(),
  ]);
  const backup = createPrivateBackup(
    goals,
    journalEntries,
    input.exportedAt,
  );

  await savePrivateBackupFile(input.filePath, backup);
  return backup;
}

function conflictNames(
  backup: PrivateBackup,
  goalsById: ReadonlyMap<string, DevelopmentGoal>,
  entriesById: ReadonlyMap<string, TrainingJournalEntry>,
): readonly string[] {
  return Object.freeze([
    ...backup.goals
      .filter((goal) => goalsById.has(goal.goalId))
      .map((goal) => `goal:${goal.goalId}`),
    ...backup.journalEntries
      .filter((entry) => entriesById.has(entry.entryId))
      .map((entry) => `journal:${entry.entryId}`),
  ]);
}

async function rollbackMutations(
  mutations: readonly RestoreMutation[],
  goalRepository: DevelopmentGoalFileRepository,
  journalRepository: TrainingJournalFileRepository,
): Promise<void> {
  const failures: unknown[] = [];

  for (const mutation of [...mutations].reverse()) {
    try {
      if (mutation.kind === "goal") {
        if (mutation.original === null) {
          await goalRepository.delete(mutation.id);
        } else {
          await goalRepository.save(mutation.original);
        }
      } else if (mutation.original === null) {
        await journalRepository.delete(mutation.id);
      } else {
        await journalRepository.save(mutation.original);
      }
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, "one or more restore changes could not be rolled back");
  }
}

function collectionResult(
  total: number,
  conflictCount: number,
  mode: BackupConflictMode,
): RestoreCollectionResult {
  return Object.freeze({
    created: total - conflictCount,
    replaced: mode === "replace" ? conflictCount : 0,
    skipped: mode === "skip" ? conflictCount : 0,
  });
}

export async function restorePrivateBackup(
  input: RestorePrivateBackupInput,
): Promise<RestorePrivateBackupResult> {
  const mode = normalizeConflictMode(input.conflicts);
  const backup = await loadPrivateBackupFile(input.filePath);
  const goalRepository = new DevelopmentGoalFileRepository(
    input.goalsDirectory,
  );
  const journalRepository = new TrainingJournalFileRepository(
    input.journalDirectory,
  );
  const [existingGoals, existingEntries] = await Promise.all([
    goalRepository.list(),
    journalRepository.list(),
  ]);
  const goalsById = new Map(existingGoals.map((goal) => [goal.goalId, goal]));
  const entriesById = new Map(
    existingEntries.map((entry) => [entry.entryId, entry]),
  );
  const conflicts = conflictNames(backup, goalsById, entriesById);

  if (mode === "fail" && conflicts.length > 0) {
    throw new PrivateBackupServiceError(
      "CONFLICT",
      `restore found ${conflicts.length} existing record conflict${conflicts.length === 1 ? "" : "s"}: ${conflicts.join(", ")}`,
      conflicts,
    );
  }

  const mutations: RestoreMutation[] = [];

  try {
    for (const goal of backup.goals) {
      const original = goalsById.get(goal.goalId) ?? null;

      if (original !== null && mode === "skip") {
        continue;
      }

      await goalRepository.save(goal);
      mutations.push({ kind: "goal", id: goal.goalId, original });
    }

    for (const entry of backup.journalEntries) {
      const original = entriesById.get(entry.entryId) ?? null;

      if (original !== null && mode === "skip") {
        continue;
      }

      await journalRepository.save(entry);
      mutations.push({ kind: "journal", id: entry.entryId, original });
    }
  } catch (error) {
    try {
      await rollbackMutations(mutations, goalRepository, journalRepository);
    } catch (rollbackError) {
      throw new PrivateBackupServiceError(
        "ROLLBACK_FAILED",
        "restore failed and one or more completed writes could not be rolled back",
        [],
        new AggregateError([error, rollbackError]),
      );
    }

    throw new PrivateBackupServiceError(
      "RESTORE_FAILED",
      "restore failed; completed writes were rolled back",
      [],
      error,
    );
  }

  const goalConflictCount = backup.goals.filter((goal) =>
    goalsById.has(goal.goalId),
  ).length;
  const entryConflictCount = backup.journalEntries.filter((entry) =>
    entriesById.has(entry.entryId),
  ).length;

  return Object.freeze({
    exportedAt: backup.exportedAt,
    goals: collectionResult(backup.goals.length, goalConflictCount, mode),
    journalEntries: collectionResult(
      backup.journalEntries.length,
      entryConflictCount,
      mode,
    ),
  });
}
