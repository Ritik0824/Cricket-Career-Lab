import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createDevelopmentGoal } from "../domain/developmentGoal.js";
import { createSessionPlan } from "../domain/sessionPlan.js";
import { completeTrainingSession } from "../domain/trainingJournal.js";
import { DevelopmentGoalFileRepository } from "../storage/developmentGoalRepository.js";
import { loadPrivateBackupFile, savePrivateBackupFile } from "../storage/privateBackupFile.js";
import { createPrivateBackup } from "../storage/privateBackupRecord.js";
import { TrainingJournalFileRepository } from "../storage/trainingJournalRepository.js";
import {
  exportPrivateBackup,
  restorePrivateBackup,
  PrivateBackupServiceError,
} from "./privateBackupService.js";

function sampleGoal(target: number) {
  return createDevelopmentGoal({
    goalId: "backup-goal",
    title: "Backup training volume",
    metric: "training-minutes",
    target,
    startDate: "2026-09-01",
    dueDate: "2026-09-30",
  });
}

function sampleEntry(completedMinutes: number) {
  const plan = createSessionPlan({
    title: "Backup batting session",
    scheduledFor: "2026-09-10",
    drills: [
      {
        id: "backup-batting",
        name: "Backup batting",
        focus: "batting",
        minutes: 20,
        intensity: "moderate",
      },
    ],
  });

  return completeTrainingSession({
    entryId: "backup-entry",
    plan,
    completedAt: "2026-09-10T08:00:00.000Z",
    drills: [
      {
        drillId: "backup-batting",
        completedMinutes,
        perceivedEffort: 7,
        note: "Private restored cue.",
      },
    ],
    sessionNote: "Private restored note.",
  });
}

async function withDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "career-backup-service-"));

  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function writeSampleBackup(filePath: string): Promise<void> {
  await savePrivateBackupFile(
    filePath,
    createPrivateBackup(
      [sampleGoal(100)],
      [sampleEntry(18)],
      "2026-10-01T08:00:00.000Z",
    ),
  );
}

test("exports repositories and restores them into empty destinations", async () => {
  await withDirectory(async (directory) => {
    const sourceGoals = join(directory, "source-goals");
    const sourceJournal = join(directory, "source-journal");
    const targetGoals = join(directory, "target-goals");
    const targetJournal = join(directory, "target-journal");
    const filePath = join(directory, "backups", "career.json");
    await new DevelopmentGoalFileRepository(sourceGoals).save(sampleGoal(100));
    await new TrainingJournalFileRepository(sourceJournal).save(sampleEntry(18));

    const exported = await exportPrivateBackup({
      goalsDirectory: sourceGoals,
      journalDirectory: sourceJournal,
      filePath,
      exportedAt: "2026-10-01T08:00:00.000Z",
    });
    const stored = await loadPrivateBackupFile(filePath);
    assert.equal(exported.goals.length, 1);
    assert.equal(stored.journalEntries[0]?.sessionNote, "Private restored note.");

    const result = await restorePrivateBackup({
      goalsDirectory: targetGoals,
      journalDirectory: targetJournal,
      filePath,
      conflicts: "fail",
    });
    assert.deepEqual(result.goals, { created: 1, replaced: 0, skipped: 0 });
    assert.deepEqual(result.journalEntries, {
      created: 1,
      replaced: 0,
      skipped: 0,
    });
    assert.equal(
      (await new DevelopmentGoalFileRepository(targetGoals).load("backup-goal"))
        .target,
      100,
    );
    assert.equal(
      (await new TrainingJournalFileRepository(targetJournal).load("backup-entry"))
        .completedMinutes,
      18,
    );
  });
});

test("fail, skip, and replace modes handle existing identifiers explicitly", async () => {
  await withDirectory(async (directory) => {
    const goalsDirectory = join(directory, "goals");
    const journalDirectory = join(directory, "journal");
    const filePath = join(directory, "backup.json");
    const goals = new DevelopmentGoalFileRepository(goalsDirectory);
    const journal = new TrainingJournalFileRepository(journalDirectory);
    await writeSampleBackup(filePath);
    await goals.save(sampleGoal(50));
    await journal.save(sampleEntry(10));

    await assert.rejects(
      () =>
        restorePrivateBackup({
          goalsDirectory,
          journalDirectory,
          filePath,
          conflicts: "fail",
        }),
      (error: unknown) =>
        error instanceof PrivateBackupServiceError &&
        error.code === "CONFLICT" &&
        error.conflicts.length === 2,
    );
    assert.equal((await goals.load("backup-goal")).target, 50);
    assert.equal((await journal.load("backup-entry")).completedMinutes, 10);

    const skipped = await restorePrivateBackup({
      goalsDirectory,
      journalDirectory,
      filePath,
      conflicts: "SKIP",
    });
    assert.equal(skipped.goals.skipped, 1);
    assert.equal(skipped.journalEntries.skipped, 1);
    assert.equal((await goals.load("backup-goal")).target, 50);

    const replaced = await restorePrivateBackup({
      goalsDirectory,
      journalDirectory,
      filePath,
      conflicts: "replace",
    });
    assert.equal(replaced.goals.replaced, 1);
    assert.equal(replaced.journalEntries.replaced, 1);
    assert.equal((await goals.load("backup-goal")).target, 100);
    assert.equal((await journal.load("backup-entry")).completedMinutes, 18);
  });
});

test("rolls back completed writes when a later restore write fails", async () => {
  await withDirectory(async (directory) => {
    const goalsDirectory = join(directory, "goals");
    const journalDirectory = join(directory, "journal");
    const filePath = join(directory, "backup.json");
    await writeSampleBackup(filePath);
    await mkdir(join(journalDirectory, "backup-entry.json"), {
      recursive: true,
    });

    await assert.rejects(
      () =>
        restorePrivateBackup({
          goalsDirectory,
          journalDirectory,
          filePath,
          conflicts: "replace",
        }),
      (error: unknown) =>
        error instanceof PrivateBackupServiceError &&
        error.code === "RESTORE_FAILED",
    );
    assert.deepEqual(
      await new DevelopmentGoalFileRepository(goalsDirectory).list(),
      [],
    );
  });
});

test("rejects unsupported conflict modes before reading a backup", async () => {
  await assert.rejects(
    () =>
      restorePrivateBackup({
        goalsDirectory: "unused-goals",
        journalDirectory: "unused-journal",
        filePath: "missing.json",
        conflicts: "merge",
      }),
    (error: unknown) =>
      error instanceof PrivateBackupServiceError &&
      error.code === "INVALID_CONFLICT_MODE",
  );
});
