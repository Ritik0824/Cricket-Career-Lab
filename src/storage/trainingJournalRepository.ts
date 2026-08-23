import { readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import {
  normalizeTrainingJournalEntryId,
  TrainingJournalValidationError,
  type TrainingJournalEntry,
} from "../domain/trainingJournal.js";
import {
  deletePrivateFile,
  readPrivateTextFile,
  writePrivateTextFile,
  PrivateFileError,
} from "./privateFile.js";
import {
  parseTrainingJournalRecord,
  serializeTrainingJournalEntry,
  TrainingJournalRecordError,
} from "./trainingJournalRecord.js";

export type TrainingJournalRepositoryErrorCode =
  | "INVALID_DIRECTORY"
  | "INVALID_ENTRY_ID"
  | "NOT_FOUND"
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "DELETE_FAILED"
  | "INVALID_RECORD"
  | "ENTRY_ID_MISMATCH";

export class TrainingJournalRepositoryError extends Error {
  readonly code: TrainingJournalRepositoryErrorCode;
  readonly filePath: string;

  constructor(
    code: TrainingJournalRepositoryErrorCode,
    filePath: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "TrainingJournalRepositoryError";
    this.code = code;
    this.filePath = filePath;
  }
}

function readNodeErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}

function translatePrivateFileError(
  error: PrivateFileError,
): TrainingJournalRepositoryError {
  const code =
    error.code === "NOT_FOUND" ||
    error.code === "READ_FAILED" ||
    error.code === "WRITE_FAILED" ||
    error.code === "DELETE_FAILED"
      ? error.code
      : "READ_FAILED";

  return new TrainingJournalRepositoryError(
    code,
    error.filePath,
    error.message,
    error,
  );
}

export class TrainingJournalFileRepository {
  readonly directoryPath: string;

  constructor(directoryPath: string) {
    if (directoryPath.trim().length === 0) {
      throw new TrainingJournalRepositoryError(
        "INVALID_DIRECTORY",
        directoryPath,
        "training journal directory cannot be empty",
      );
    }

    this.directoryPath = resolve(directoryPath);
  }

  private entryPath(entryId: string): string {
    let normalizedId: string;

    try {
      normalizedId = normalizeTrainingJournalEntryId(entryId);
    } catch (error) {
      if (error instanceof TrainingJournalValidationError) {
        throw new TrainingJournalRepositoryError(
          "INVALID_ENTRY_ID",
          this.directoryPath,
          error.message,
          error,
        );
      }

      throw error;
    }

    return join(this.directoryPath, `${normalizedId}.json`);
  }

  private async loadPath(filePath: string): Promise<TrainingJournalEntry> {
    let serialized: string;

    try {
      serialized = await readPrivateTextFile(filePath);
    } catch (error) {
      if (error instanceof PrivateFileError) {
        throw translatePrivateFileError(error);
      }

      throw error;
    }

    let entry: TrainingJournalEntry;

    try {
      entry = parseTrainingJournalRecord(serialized);
    } catch (error) {
      if (error instanceof TrainingJournalRecordError) {
        throw new TrainingJournalRepositoryError(
          "INVALID_RECORD",
          filePath,
          `journal file at ${filePath} is not a valid entry`,
          error,
        );
      }

      throw error;
    }

    if (basename(filePath) !== `${entry.entryId}.json`) {
      throw new TrainingJournalRepositoryError(
        "ENTRY_ID_MISMATCH",
        filePath,
        `journal entry ${entry.entryId} does not match file name ${basename(filePath)}`,
      );
    }

    return entry;
  }

  async save(entry: TrainingJournalEntry): Promise<TrainingJournalEntry> {
    const filePath = this.entryPath(entry.entryId);
    let serialized: string;

    try {
      serialized = serializeTrainingJournalEntry(entry);
    } catch (error) {
      if (error instanceof TrainingJournalRecordError) {
        throw new TrainingJournalRepositoryError(
          "INVALID_RECORD",
          filePath,
          `journal entry ${entry.entryId} cannot be serialized`,
          error,
        );
      }

      throw error;
    }

    try {
      await writePrivateTextFile(filePath, serialized);
    } catch (error) {
      if (error instanceof PrivateFileError) {
        throw translatePrivateFileError(error);
      }

      throw error;
    }

    return parseTrainingJournalRecord(serialized);
  }

  async load(entryId: string): Promise<TrainingJournalEntry> {
    return this.loadPath(this.entryPath(entryId));
  }

  async list(): Promise<readonly TrainingJournalEntry[]> {
    let fileNames: string[];

    try {
      const entries = await readdir(this.directoryPath, { withFileTypes: true });
      fileNames = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => entry.name)
        .sort();
    } catch (error) {
      if (readNodeErrorCode(error) === "ENOENT") {
        return Object.freeze([]);
      }

      throw new TrainingJournalRepositoryError(
        "READ_FAILED",
        this.directoryPath,
        `could not list training journal at ${this.directoryPath}`,
        error,
      );
    }

    const entries = await Promise.all(
      fileNames.map((fileName) =>
        this.loadPath(join(this.directoryPath, fileName)),
      ),
    );

    entries.sort(
      (left, right) =>
        right.completedAt.localeCompare(left.completedAt) ||
        left.entryId.localeCompare(right.entryId),
    );
    return Object.freeze(entries);
  }

  async delete(entryId: string): Promise<boolean> {
    const filePath = this.entryPath(entryId);

    try {
      return await deletePrivateFile(filePath);
    } catch (error) {
      if (error instanceof PrivateFileError) {
        throw translatePrivateFileError(error);
      }

      throw error;
    }
  }
}
