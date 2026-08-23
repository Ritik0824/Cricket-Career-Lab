import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createDevelopmentGoal,
  type DevelopmentGoal,
} from "../domain/developmentGoal.js";
import {
  DevelopmentGoalFileRepository,
  DevelopmentGoalRepositoryError,
} from "./developmentGoalRepository.js";
import { serializeDevelopmentGoal } from "./developmentGoalRecord.js";

function createGoal(
  goalId: string,
  dueDate: string,
  target = 120,
): DevelopmentGoal {
  return createDevelopmentGoal({
    goalId,
    title: `Goal for ${goalId}`,
    metric: "training-minutes",
    target,
    startDate: "2026-09-01",
    dueDate,
  });
}

async function withTemporaryDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "cricket-goal-repo-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("saves, loads, and lists goals by due date", async () => {
  await withTemporaryDirectory(async (directory) => {
    const goalPath = join(directory, "private", "goals");
    const repository = new DevelopmentGoalFileRepository(goalPath);
    await repository.save(createGoal("later-goal", "2026-10-31"));
    await repository.save(createGoal("earlier-goal", "2026-09-30"));

    const loaded = await repository.load("EARLIER-GOAL");
    const listed = await repository.list();
    const fileMode =
      (await stat(join(goalPath, "earlier-goal.json"))).mode & 0o777;
    const directoryMode = (await stat(goalPath)).mode & 0o777;

    assert.equal(loaded.goalId, "earlier-goal");
    assert.deepEqual(
      listed.map((goal) => goal.goalId),
      ["earlier-goal", "later-goal"],
    );
    assert.ok(Object.isFrozen(listed));
    assert.equal(fileMode & 0o077, 0);
    assert.equal(directoryMode & 0o077, 0);
  });
});

test("atomically replaces a corrected goal definition", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new DevelopmentGoalFileRepository(directory);
    await repository.save(createGoal("volume-goal", "2026-09-30", 100));
    await repository.save(createGoal("volume-goal", "2026-09-30", 150));

    assert.equal((await repository.load("volume-goal")).target, 150);
    assert.deepEqual(await readdir(directory), ["volume-goal.json"]);
  });
});

test("deletes goals idempotently and reports non-file deletion", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new DevelopmentGoalFileRepository(directory);
    await repository.save(createGoal("delete-goal", "2026-09-30"));
    assert.equal(await repository.delete("delete-goal"), true);
    assert.equal(await repository.delete("delete-goal"), false);

    await mkdir(join(directory, "directory-goal.json"));
    await assert.rejects(
      repository.delete("directory-goal"),
      (error: unknown) =>
        error instanceof DevelopmentGoalRepositoryError &&
        error.code === "DELETE_FAILED",
    );
  });
});

test("reports missing and corrupt goal files distinctly", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new DevelopmentGoalFileRepository(directory);
    await assert.rejects(
      repository.load("missing-goal"),
      (error: unknown) =>
        error instanceof DevelopmentGoalRepositoryError &&
        error.code === "NOT_FOUND",
    );

    await writeFile(join(directory, "corrupt-goal.json"), "{broken", "utf8");
    await assert.rejects(
      repository.list(),
      (error: unknown) =>
        error instanceof DevelopmentGoalRepositoryError &&
        error.code === "INVALID_RECORD",
    );
  });
});

test("rejects goal identity and filename mismatches", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new DevelopmentGoalFileRepository(directory);
    await writeFile(
      join(directory, "wrong-name.json"),
      serializeDevelopmentGoal(createGoal("canonical-goal", "2026-09-30")),
      "utf8",
    );

    await assert.rejects(
      repository.list(),
      (error: unknown) =>
        error instanceof DevelopmentGoalRepositoryError &&
        error.code === "GOAL_ID_MISMATCH",
    );
  });
});

test("ignores unrelated files, temporary files, and nested directories", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new DevelopmentGoalFileRepository(directory);
    await repository.save(createGoal("visible-goal", "2026-09-30"));
    await writeFile(join(directory, "README.txt"), "private goals", "utf8");
    await writeFile(join(directory, ".visible-goal.temp"), "partial", "utf8");
    await mkdir(join(directory, "archive.json"));

    assert.deepEqual(
      (await repository.list()).map((goal) => goal.goalId),
      ["visible-goal"],
    );
  });
});

test("rejects blank directories and unsafe identifiers", async () => {
  assert.throws(
    () => new DevelopmentGoalFileRepository("  "),
    (error: unknown) =>
      error instanceof DevelopmentGoalRepositoryError &&
      error.code === "INVALID_DIRECTORY",
  );

  await withTemporaryDirectory(async (directory) => {
    const repository = new DevelopmentGoalFileRepository(directory);
    await assert.rejects(
      repository.load("../outside"),
      (error: unknown) =>
        error instanceof DevelopmentGoalRepositoryError &&
        error.code === "INVALID_GOAL_ID",
    );
  });
});

test("an absent goal directory lists as an empty collection", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new DevelopmentGoalFileRepository(
      join(directory, "not-created"),
    );
    assert.deepEqual(await repository.list(), []);
  });
});
