import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import type { SessionPlan } from "../domain/sessionPlan.js";
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

function normalizeFilePath(filePath: string): string {
  if (filePath.trim().length === 0) {
    throw new SessionPlanFileError(
      "INVALID_PATH",
      filePath,
      "session plan file path cannot be empty",
    );
  }

  return resolve(filePath);
}

function readNodeErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}

async function removeTemporaryFile(filePath: string): Promise<void> {
  try {
    await rm(filePath, { force: true });
  } catch {
    // Preserve the original write failure. A later save uses a unique temp name.
  }
}

export async function saveSessionPlanFile(
  filePath: string,
  plan: SessionPlan,
  savedAt: string,
): Promise<StoredSessionPlan> {
  const targetPath = normalizeFilePath(filePath);
  const serialized = serializeSessionPlan(plan, savedAt);
  const parentPath = dirname(targetPath);
  const temporaryPath = resolve(
    parentPath,
    `.${basename(targetPath)}.${randomUUID()}.tmp`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    await mkdir(parentPath, { recursive: true, mode: 0o700 });
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(serialized, { encoding: "utf8" });
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, targetPath);
  } catch (error) {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        // The write error remains the useful failure for callers.
      }
    }

    await removeTemporaryFile(temporaryPath);
    throw new SessionPlanFileError(
      "WRITE_FAILED",
      targetPath,
      `could not save session plan to ${targetPath}`,
      error,
    );
  }

  return parseSessionPlanRecord(serialized);
}

export async function loadSessionPlanFile(
  filePath: string,
): Promise<StoredSessionPlan> {
  const targetPath = normalizeFilePath(filePath);
  let serialized: string;

  try {
    serialized = await readFile(targetPath, { encoding: "utf8" });
  } catch (error) {
    if (readNodeErrorCode(error) === "ENOENT") {
      throw new SessionPlanFileError(
        "NOT_FOUND",
        targetPath,
        `session plan file does not exist at ${targetPath}`,
        error,
      );
    }

    throw new SessionPlanFileError(
      "READ_FAILED",
      targetPath,
      `could not read session plan from ${targetPath}`,
      error,
    );
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
