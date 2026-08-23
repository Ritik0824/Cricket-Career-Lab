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

import { createSessionPlan } from "../domain/sessionPlan.js";
import {
  completeTrainingSession,
  type TrainingJournalEntry,
} from "../domain/trainingJournal.js";
import {
  TrainingJournalFileRepository,
  TrainingJournalRepositoryError,
} from "./trainingJournalRepository.js";
import { serializeTrainingJournalEntry } from "./trainingJournalRecord.js";

function createEntry(
  entryId: string,
  completedAt: string,
  sessionNote = "Good control through the session.",
): TrainingJournalEntry {
  const plan = createSessionPlan({
    title: "Seam presentation",
    scheduledFor: "2026-09-06",
    drills: [
      {
        id: "wrist-position",
        name: "Wrist position",
        focus: "bowling",
        minutes: 20,
        intensity: "moderate",
      },
    ],
  });

  return completeTrainingSession({
    entryId,
    plan,
    completedAt,
    drills: [
      {
        drillId: "wrist-position",
        completedMinutes: 18,
        perceivedEffort: 6,
      },
    ],
    sessionNote,
  });
}

async function withTemporaryDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "cricket-journal-repo-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("saves, loads, and lists entries newest first", async () => {
  await withTemporaryDirectory(async (directory) => {
    const journalPath = join(directory, "private", "journal");
    const repository = new TrainingJournalFileRepository(journalPath);
    const older = createEntry(
      "seam-entry-one",
      "2026-09-06T09:00:00.000Z",
    );
    const newer = createEntry(
      "seam-entry-two",
      "2026-09-07T09:00:00.000Z",
    );

    await repository.save(older);
    await repository.save(newer);

    const loaded = await repository.load("SEAM-ENTRY-ONE");
    const listed = await repository.list();
    const fileMode =
      (await stat(join(journalPath, "seam-entry-one.json"))).mode & 0o777;
    const directoryMode = (await stat(journalPath)).mode & 0o777;

    assert.equal(loaded.entryId, "seam-entry-one");
    assert.deepEqual(
      listed.map((entry) => entry.entryId),
      ["seam-entry-two", "seam-entry-one"],
    );
    assert.ok(Object.isFrozen(listed));
    assert.equal(fileMode & 0o077, 0);
    assert.equal(directoryMode & 0o077, 0);
  });
});

test("atomically replaces an entry with the same identifier", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new TrainingJournalFileRepository(directory);
    await repository.save(
      createEntry("same-entry", "2026-09-06T09:00:00.000Z", "First note."),
    );
    await repository.save(
      createEntry(
        "same-entry",
        "2026-09-06T10:00:00.000Z",
        "Corrected note.",
      ),
    );

    const loaded = await repository.load("same-entry");
    assert.equal(loaded.completedAt, "2026-09-06T10:00:00.000Z");
    assert.equal(loaded.sessionNote, "Corrected note.");
    assert.deepEqual(await readdir(directory), ["same-entry.json"]);
  });
});

test("deletes existing entries and treats missing deletion as idempotent", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new TrainingJournalFileRepository(directory);
    await repository.save(
      createEntry("delete-entry", "2026-09-06T09:00:00.000Z"),
    );

    assert.equal(await repository.delete("delete-entry"), true);
    assert.equal(await repository.delete("delete-entry"), false);
    assert.deepEqual(await repository.list(), []);
  });
});

test("reports a delete failure when an entry path is not a file", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new TrainingJournalFileRepository(directory);
    await mkdir(join(directory, "directory-entry.json"));

    await assert.rejects(
      repository.delete("directory-entry"),
      (error: unknown) =>
        error instanceof TrainingJournalRepositoryError &&
        error.code === "DELETE_FAILED",
    );
  });
});

test("reports missing and corrupt journal entries distinctly", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new TrainingJournalFileRepository(directory);

    await assert.rejects(
      repository.load("missing-entry"),
      (error: unknown) =>
        error instanceof TrainingJournalRepositoryError &&
        error.code === "NOT_FOUND",
    );

    await writeFile(join(directory, "corrupt-entry.json"), "{broken", "utf8");
    await assert.rejects(
      repository.list(),
      (error: unknown) =>
        error instanceof TrainingJournalRepositoryError &&
        error.code === "INVALID_RECORD" &&
        error.filePath.endsWith("corrupt-entry.json"),
    );
  });
});

test("rejects records whose identity does not match their file name", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new TrainingJournalFileRepository(directory);
    const entry = createEntry(
      "canonical-entry",
      "2026-09-06T09:00:00.000Z",
    );
    await writeFile(
      join(directory, "wrong-name.json"),
      serializeTrainingJournalEntry(entry),
      "utf8",
    );

    await assert.rejects(
      repository.list(),
      (error: unknown) =>
        error instanceof TrainingJournalRepositoryError &&
        error.code === "ENTRY_ID_MISMATCH",
    );
  });
});

test("ignores non-record files and nested directories when listing", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new TrainingJournalFileRepository(directory);
    await repository.save(
      createEntry("visible-entry", "2026-09-06T09:00:00.000Z"),
    );
    await writeFile(join(directory, "README.txt"), "private journal", "utf8");
    await writeFile(join(directory, ".visible-entry.temp"), "partial", "utf8");
    await mkdir(join(directory, "archive.json"));

    const entries = await repository.list();
    assert.deepEqual(entries.map((entry) => entry.entryId), ["visible-entry"]);
  });
});

test("rejects blank directories and unsafe entry identifiers", async () => {
  assert.throws(
    () => new TrainingJournalFileRepository("  "),
    (error: unknown) =>
      error instanceof TrainingJournalRepositoryError &&
      error.code === "INVALID_DIRECTORY",
  );

  await withTemporaryDirectory(async (directory) => {
    const repository = new TrainingJournalFileRepository(directory);
    await assert.rejects(
      repository.load("../outside"),
      (error: unknown) =>
        error instanceof TrainingJournalRepositoryError &&
        error.code === "INVALID_ENTRY_ID",
    );
  });
});

test("an absent journal directory lists as an empty collection", async () => {
  await withTemporaryDirectory(async (directory) => {
    const repository = new TrainingJournalFileRepository(
      join(directory, "not-created"),
    );

    assert.deepEqual(await repository.list(), []);
  });
});
