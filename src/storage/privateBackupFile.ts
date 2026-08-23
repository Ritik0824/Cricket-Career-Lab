import {
  readPrivateTextFile,
  writePrivateTextFile,
  PrivateFileError,
} from "./privateFile.js";
import {
  parsePrivateBackupRecord,
  serializePrivateBackup,
  PrivateBackupRecordError,
  type PrivateBackup,
} from "./privateBackupRecord.js";

export type PrivateBackupFileErrorCode =
  | "INVALID_PATH"
  | "NOT_FOUND"
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "INVALID_RECORD";

export class PrivateBackupFileError extends Error {
  readonly code: PrivateBackupFileErrorCode;
  readonly filePath: string;

  constructor(
    code: PrivateBackupFileErrorCode,
    filePath: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "PrivateBackupFileError";
    this.code = code;
    this.filePath = filePath;
  }
}

function translatePrivateFileError(
  error: PrivateFileError,
): PrivateBackupFileError {
  const code =
    error.code === "INVALID_PATH" ||
    error.code === "NOT_FOUND" ||
    error.code === "READ_FAILED" ||
    error.code === "WRITE_FAILED"
      ? error.code
      : "READ_FAILED";

  return new PrivateBackupFileError(
    code,
    error.filePath,
    error.message,
    error,
  );
}

export async function savePrivateBackupFile(
  filePath: string,
  backup: PrivateBackup,
): Promise<string> {
  let serialized: string;

  try {
    serialized = serializePrivateBackup(backup);
  } catch (error) {
    if (error instanceof PrivateBackupRecordError) {
      throw new PrivateBackupFileError(
        "INVALID_RECORD",
        filePath,
        "private backup cannot be serialized",
        error,
      );
    }

    throw error;
  }

  try {
    return await writePrivateTextFile(filePath, serialized);
  } catch (error) {
    if (error instanceof PrivateFileError) {
      throw translatePrivateFileError(error);
    }

    throw error;
  }
}

export async function loadPrivateBackupFile(
  filePath: string,
): Promise<PrivateBackup> {
  let serialized: string;

  try {
    serialized = await readPrivateTextFile(filePath);
  } catch (error) {
    if (error instanceof PrivateFileError) {
      throw translatePrivateFileError(error);
    }

    throw error;
  }

  try {
    return parsePrivateBackupRecord(serialized);
  } catch (error) {
    if (error instanceof PrivateBackupRecordError) {
      throw new PrivateBackupFileError(
        "INVALID_RECORD",
        filePath,
        "private backup file is not a supported valid record",
        error,
      );
    }

    throw error;
  }
}
