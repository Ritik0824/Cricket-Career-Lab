import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

export type PrivateFileErrorCode =
  | "INVALID_PATH"
  | "NOT_FOUND"
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "DELETE_FAILED";

export class PrivateFileError extends Error {
  readonly code: PrivateFileErrorCode;
  readonly filePath: string;

  constructor(
    code: PrivateFileErrorCode,
    filePath: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "PrivateFileError";
    this.code = code;
    this.filePath = filePath;
  }
}

export function resolvePrivateFilePath(filePath: string): string {
  if (filePath.trim().length === 0) {
    throw new PrivateFileError(
      "INVALID_PATH",
      filePath,
      "private file path cannot be empty",
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
    // Preserve the original write failure. Every write uses a unique temp name.
  }
}

export async function writePrivateTextFile(
  filePath: string,
  contents: string,
): Promise<string> {
  const targetPath = resolvePrivateFilePath(filePath);
  const parentPath = dirname(targetPath);
  const temporaryPath = resolve(
    parentPath,
    `.${basename(targetPath)}.${randomUUID()}.tmp`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    await mkdir(parentPath, { recursive: true, mode: 0o700 });
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(contents, { encoding: "utf8" });
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, targetPath);
    return targetPath;
  } catch (error) {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        // The first write failure remains the useful cause for callers.
      }
    }

    await removeTemporaryFile(temporaryPath);
    throw new PrivateFileError(
      "WRITE_FAILED",
      targetPath,
      `could not write private file at ${targetPath}`,
      error,
    );
  }
}

export async function readPrivateTextFile(filePath: string): Promise<string> {
  const targetPath = resolvePrivateFilePath(filePath);

  try {
    return await readFile(targetPath, { encoding: "utf8" });
  } catch (error) {
    if (readNodeErrorCode(error) === "ENOENT") {
      throw new PrivateFileError(
        "NOT_FOUND",
        targetPath,
        `private file does not exist at ${targetPath}`,
        error,
      );
    }

    throw new PrivateFileError(
      "READ_FAILED",
      targetPath,
      `could not read private file at ${targetPath}`,
      error,
    );
  }
}

export async function deletePrivateFile(filePath: string): Promise<boolean> {
  const targetPath = resolvePrivateFilePath(filePath);

  try {
    await rm(targetPath);
    return true;
  } catch (error) {
    if (readNodeErrorCode(error) === "ENOENT") {
      return false;
    }

    throw new PrivateFileError(
      "DELETE_FAILED",
      targetPath,
      `could not delete private file at ${targetPath}`,
      error,
    );
  }
}
