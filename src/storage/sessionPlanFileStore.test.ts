import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { createSessionPlan } from "../domain/sessionPlan.js";
import {
  loadSessionPlanFile,
  saveSessionPlanFile,
  SessionPlanFileError,
} from "./sessionPlanFileStore.js";
import { SessionPlanRecordError } from "./sessionPlanRecord.js";

const FIRST_SAVE = "2026-08-23T15:00:00.000Z";
const SECOND_SAVE = "2026-08-24T09:15:00.000Z";

function createPlan(title = "Opening spell control") {
  return createSessionPlan({
    title,
    scheduledFor: "2026-08-27",
    drills: [
      {
        id: "crease-alignment",
        name: "Crease alignment",
        focus: "bowling",
        minutes: 20,
        intensity: "moderate",
      },
      {
        id: "follow-through",
        name: "Follow-through balance",
        focus: "fitness",
        minutes: 10,
        intensity: "low",
      },
    ],
  });
}

async function withTemporaryDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "cricket-career-lab-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("saves privately and restores a plan from nested directories", async () => {
  await withTemporaryDirectory(async (directory) => {
    const filePath = join(directory, "private", "plans", "opening.json");
    const saved = await saveSessionPlanFile(filePath, createPlan(), FIRST_SAVE);
    const restored = await loadSessionPlanFile(filePath);
    const fileMode = (await stat(filePath)).mode & 0o777;
    const directoryMode = (await stat(dirname(filePath))).mode & 0o777;

    assert.equal(saved.savedAt, FIRST_SAVE);
    assert.equal(restored.savedAt, FIRST_SAVE);
    assert.equal(restored.plan.title, "Opening spell control");
    assert.equal(restored.plan.totalMinutes, 30);
    assert.equal(fileMode & 0o077, 0);
    assert.equal(directoryMode & 0o077, 0);

    const serialized = await readFile(filePath, "utf8");
    assert.match(serialized, /cricket-career-lab\/session-plan/);
  });
});

test("atomically replaces an existing plan without temp-file debris", async () => {
  await withTemporaryDirectory(async (directory) => {
    const filePath = join(directory, "current-plan.json");
    await saveSessionPlanFile(filePath, createPlan(), FIRST_SAVE);
    await saveSessionPlanFile(
      filePath,
      createPlan("Powerplay fielding session"),
      SECOND_SAVE,
    );

    const restored = await loadSessionPlanFile(filePath);
    const entries = await readdir(directory);

    assert.equal(restored.savedAt, SECOND_SAVE);
    assert.equal(restored.plan.title, "Powerplay fielding session");
    assert.deepEqual(entries, ["current-plan.json"]);
  });
});

test("reports missing plans separately from other read failures", async () => {
  await withTemporaryDirectory(async (directory) => {
    const missingPath = join(directory, "missing.json");

    await assert.rejects(
      loadSessionPlanFile(missingPath),
      (error: unknown) =>
        error instanceof SessionPlanFileError &&
        error.code === "NOT_FOUND" &&
        error.filePath === missingPath,
    );

    const directoryPath = join(directory, "not-a-file");
    await mkdir(directoryPath);
    await assert.rejects(
      loadSessionPlanFile(directoryPath),
      (error: unknown) =>
        error instanceof SessionPlanFileError && error.code === "READ_FAILED",
    );
  });
});

test("wraps corrupt content while retaining the record error as its cause", async () => {
  await withTemporaryDirectory(async (directory) => {
    const filePath = join(directory, "corrupt.json");
    await writeFile(filePath, "{broken-json", "utf8");

    await assert.rejects(
      loadSessionPlanFile(filePath),
      (error: unknown) =>
        error instanceof SessionPlanFileError &&
        error.code === "INVALID_RECORD" &&
        error.cause instanceof SessionPlanRecordError &&
        error.cause.code === "INVALID_JSON",
    );
  });
});

test("removes temporary data when an atomic rename cannot complete", async () => {
  await withTemporaryDirectory(async (directory) => {
    const targetDirectory = join(directory, "plan.json");
    await mkdir(targetDirectory);

    await assert.rejects(
      saveSessionPlanFile(targetDirectory, createPlan(), FIRST_SAVE),
      (error: unknown) =>
        error instanceof SessionPlanFileError && error.code === "WRITE_FAILED",
    );

    assert.deepEqual(await readdir(directory), ["plan.json"]);
  });
});

test("rejects blank paths before attempting filesystem access", async () => {
  await assert.rejects(
    loadSessionPlanFile("  "),
    (error: unknown) =>
      error instanceof SessionPlanFileError && error.code === "INVALID_PATH",
  );
  await assert.rejects(
    saveSessionPlanFile("", createPlan(), FIRST_SAVE),
    (error: unknown) =>
      error instanceof SessionPlanFileError && error.code === "INVALID_PATH",
  );
});

test("does not create a target when record serialization fails", async () => {
  await withTemporaryDirectory(async (directory) => {
    const filePath = join(directory, "invalid.json");

    await assert.rejects(
      saveSessionPlanFile(filePath, createPlan(), "not-a-timestamp"),
      (error: unknown) => error instanceof SessionPlanRecordError,
    );

    assert.deepEqual(await readdir(directory), []);
  });
});
