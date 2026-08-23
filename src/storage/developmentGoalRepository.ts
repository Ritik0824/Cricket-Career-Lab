import { readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import {
  normalizeDevelopmentGoalId,
  DevelopmentGoalValidationError,
  type DevelopmentGoal,
} from "../domain/developmentGoal.js";
import {
  deletePrivateFile,
  readPrivateTextFile,
  writePrivateTextFile,
  PrivateFileError,
} from "./privateFile.js";
import {
  parseDevelopmentGoalRecord,
  serializeDevelopmentGoal,
  DevelopmentGoalRecordError,
} from "./developmentGoalRecord.js";

export type DevelopmentGoalRepositoryErrorCode =
  | "INVALID_DIRECTORY"
  | "INVALID_GOAL_ID"
  | "NOT_FOUND"
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "DELETE_FAILED"
  | "INVALID_RECORD"
  | "GOAL_ID_MISMATCH";

export class DevelopmentGoalRepositoryError extends Error {
  readonly code: DevelopmentGoalRepositoryErrorCode;
  readonly filePath: string;

  constructor(
    code: DevelopmentGoalRepositoryErrorCode,
    filePath: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "DevelopmentGoalRepositoryError";
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
): DevelopmentGoalRepositoryError {
  const code =
    error.code === "NOT_FOUND" ||
    error.code === "READ_FAILED" ||
    error.code === "WRITE_FAILED" ||
    error.code === "DELETE_FAILED"
      ? error.code
      : "READ_FAILED";

  return new DevelopmentGoalRepositoryError(
    code,
    error.filePath,
    error.message,
    error,
  );
}

export class DevelopmentGoalFileRepository {
  readonly directoryPath: string;

  constructor(directoryPath: string) {
    if (directoryPath.trim().length === 0) {
      throw new DevelopmentGoalRepositoryError(
        "INVALID_DIRECTORY",
        directoryPath,
        "development goal directory cannot be empty",
      );
    }

    this.directoryPath = resolve(directoryPath);
  }

  private goalPath(goalId: string): string {
    let normalizedId: string;

    try {
      normalizedId = normalizeDevelopmentGoalId(goalId);
    } catch (error) {
      if (error instanceof DevelopmentGoalValidationError) {
        throw new DevelopmentGoalRepositoryError(
          "INVALID_GOAL_ID",
          this.directoryPath,
          error.message,
          error,
        );
      }

      throw error;
    }

    return join(this.directoryPath, `${normalizedId}.json`);
  }

  private async loadPath(filePath: string): Promise<DevelopmentGoal> {
    let serialized: string;

    try {
      serialized = await readPrivateTextFile(filePath);
    } catch (error) {
      if (error instanceof PrivateFileError) {
        throw translatePrivateFileError(error);
      }

      throw error;
    }

    let goal: DevelopmentGoal;

    try {
      goal = parseDevelopmentGoalRecord(serialized);
    } catch (error) {
      if (error instanceof DevelopmentGoalRecordError) {
        throw new DevelopmentGoalRepositoryError(
          "INVALID_RECORD",
          filePath,
          `goal file at ${filePath} is not a valid definition`,
          error,
        );
      }

      throw error;
    }

    if (basename(filePath) !== `${goal.goalId}.json`) {
      throw new DevelopmentGoalRepositoryError(
        "GOAL_ID_MISMATCH",
        filePath,
        `development goal ${goal.goalId} does not match file name ${basename(filePath)}`,
      );
    }

    return goal;
  }

  async save(goal: DevelopmentGoal): Promise<DevelopmentGoal> {
    const filePath = this.goalPath(goal.goalId);
    let serialized: string;

    try {
      serialized = serializeDevelopmentGoal(goal);
    } catch (error) {
      if (error instanceof DevelopmentGoalRecordError) {
        throw new DevelopmentGoalRepositoryError(
          "INVALID_RECORD",
          filePath,
          `development goal ${goal.goalId} cannot be serialized`,
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

    return parseDevelopmentGoalRecord(serialized);
  }

  async load(goalId: string): Promise<DevelopmentGoal> {
    return this.loadPath(this.goalPath(goalId));
  }

  async list(): Promise<readonly DevelopmentGoal[]> {
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

      throw new DevelopmentGoalRepositoryError(
        "READ_FAILED",
        this.directoryPath,
        `could not list development goals at ${this.directoryPath}`,
        error,
      );
    }

    const goals = await Promise.all(
      fileNames.map((fileName) =>
        this.loadPath(join(this.directoryPath, fileName)),
      ),
    );

    goals.sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) ||
        left.goalId.localeCompare(right.goalId),
    );
    return Object.freeze(goals);
  }

  async delete(goalId: string): Promise<boolean> {
    const filePath = this.goalPath(goalId);

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
