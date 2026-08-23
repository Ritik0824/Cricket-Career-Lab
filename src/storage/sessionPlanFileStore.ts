import type { SessionPlan } from "../domain/sessionPlan.js";
import {
  readPrivateTextFile,
  resolvePrivateFilePath,
  writePrivateTextFile,
  PrivateFileError,
} from "./privateFile.js";
import {
  parseSessionPlanRecord,
  serializeSessionPlan,
  SessionPlanRecordError,
  type StoredSessionPlan,
} from "./sessionPlanRecord.js";

export type SessionPlanFileErrorCode =
  | "INVALID_PATH"
  | "NOT_FOUND"
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "INVALID_RECORD";

export class SessionPlanFileError extends Error {
  readonly code: SessionPlanFileErrorCode;
  readonly filePath: string;

  constructor(
    code: SessionPlanFileErrorCode,
    filePath: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "SessionPlanFileError";
    this.code = code;
    this.filePath = filePath;
  }
}

function translatePrivateFileError(error: PrivateFileError): SessionPlanFileError {
  const code =
    error.code === "INVALID_PATH" ||
    error.code === "NOT_FOUND" ||
    error.code === "READ_FAILED" ||
    error.code === "WRITE_FAILED"
      ? error.code
      : "WRITE_FAILED";

  return new SessionPlanFileError(
    code,
    error.filePath,
    error.message,
    error,
  );
}

export async function saveSessionPlanFile(
  filePath: string,
  plan: SessionPlan,
  savedAt: string,
): Promise<StoredSessionPlan> {
  let targetPath: string;

  try {
    targetPath = resolvePrivateFilePath(filePath);
  } catch (error) {
    if (error instanceof PrivateFileError) {
      throw translatePrivateFileError(error);
    }

    throw error;
  }

  const serialized = serializeSessionPlan(plan, savedAt);

  try {
    await writePrivateTextFile(targetPath, serialized);
  } catch (error) {
    if (error instanceof PrivateFileError) {
      throw translatePrivateFileError(error);
    }

    throw error;
  }

  return parseSessionPlanRecord(serialized);
}

export async function loadSessionPlanFile(
  filePath: string,
): Promise<StoredSessionPlan> {
  let targetPath: string;
  let serialized: string;

  try {
    targetPath = resolvePrivateFilePath(filePath);
    serialized = await readPrivateTextFile(targetPath);
  } catch (error) {
    if (error instanceof PrivateFileError) {
      throw translatePrivateFileError(error);
    }

    throw error;
  }

  try {
    return parseSessionPlanRecord(serialized);
  } catch (error) {
    if (error instanceof SessionPlanRecordError) {
      throw new SessionPlanFileError(
        "INVALID_RECORD",
        targetPath,
        `session plan file at ${targetPath} is not valid`,
        error,
      );
    }

    throw error;
  }
}
