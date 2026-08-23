import assert from "node:assert/strict";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createPrivateBackup } from "./privateBackupRecord.js";
import {
  loadPrivateBackupFile,
  savePrivateBackupFile,
  PrivateBackupFileError,
} from "./privateBackupFile.js";

async function withDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "career-backup-file-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("writes and reads an owner-only atomic backup file", async () => {
  await withDirectory(async (directory) => {
    const filePath = join(directory, "nested", "career.backup.json");
    const backup = createPrivateBackup(
      [],
      [],
      "2026-10-01T08:00:00.000Z",
    );

    const savedPath = await savePrivateBackupFile(filePath, backup);
    const restored = await loadPrivateBackupFile(filePath);
    const fileMode = (await stat(filePath)).mode & 0o777;
    const directoryMode = (await stat(join(directory, "nested"))).mode & 0o777;

    assert.equal(savedPath, filePath);
    assert.equal(restored.exportedAt, backup.exportedAt);
    assert.equal(fileMode, 0o600);
    assert.equal(directoryMode, 0o700);
  });
});

test("distinguishes missing and corrupt backup files", async () => {
  await withDirectory(async (directory) => {
    const filePath = join(directory, "backup.json");

    await assert.rejects(
      () => loadPrivateBackupFile(filePath),
      (error: unknown) =>
        error instanceof PrivateBackupFileError && error.code === "NOT_FOUND",
    );

    await writeFile(filePath, "{broken", "utf8");
    await assert.rejects(
      () => loadPrivateBackupFile(filePath),
      (error: unknown) =>
        error instanceof PrivateBackupFileError &&
        error.code === "INVALID_RECORD" &&
        error.cause instanceof Error,
    );
  });
});

test("rejects blank paths and invalid backup-shaped values", async () => {
  const backup = createPrivateBackup([], [], "2026-10-01T08:00:00.000Z");

  await assert.rejects(
    () => savePrivateBackupFile("", backup),
    (error: unknown) =>
      error instanceof PrivateBackupFileError && error.code === "INVALID_PATH",
  );
  await assert.rejects(
    () =>
      savePrivateBackupFile("unused.json", {
        ...backup,
        exportedAt: "invalid",
      }),
    (error: unknown) =>
      error instanceof PrivateBackupFileError &&
      error.code === "INVALID_RECORD",
  );
});
