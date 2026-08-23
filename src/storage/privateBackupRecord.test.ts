import assert from "node:assert/strict";
import test from "node:test";

import { createDevelopmentGoal } from "../domain/developmentGoal.js";
import { createSessionPlan } from "../domain/sessionPlan.js";
import { completeTrainingSession } from "../domain/trainingJournal.js";
import {
  createPrivateBackup,
  parsePrivateBackupRecord,
  serializePrivateBackup,
  PrivateBackupRecordError,
} from "./privateBackupRecord.js";

function goal(goalId: string) {
  return createDevelopmentGoal({
    goalId,
    title: `Goal ${goalId}`,
    metric: "training-minutes",
    target: 100,
    startDate: "2026-09-01",
    dueDate: "2026-09-30",
  });
}

function journalEntry(entryId: string, completedAt: string) {
  const plan = createSessionPlan({
    title: `Backup session ${entryId}`,
    scheduledFor: completedAt.slice(0, 10),
    drills: [
      {
        id: "backup-drill",
        name: "Backup drill",
        focus: "batting",
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
        drillId: "backup-drill",
        completedMinutes: 18,
        perceivedEffort: 7,
        note: "Private backup drill note.",
      },
    ],
    sessionNote: "Private backup session note.",
  });
}

function validBackup() {
  return createPrivateBackup(
    [goal("second-goal"), goal("first-goal")],
    [
      journalEntry("older-entry", "2026-09-01T08:00:00.000Z"),
      journalEntry("newer-entry", "2026-09-02T08:00:00.000Z"),
    ],
    "2026-10-01T08:00:00.000Z",
  );
}

test("creates a deterministic immutable backup with private journal detail", () => {
  const backup = validBackup();
  const serialized = serializePrivateBackup(backup);
  const restored = parsePrivateBackupRecord(serialized);

  assert.deepEqual(
    restored.goals.map((item) => item.goalId),
    ["first-goal", "second-goal"],
  );
  assert.deepEqual(
    restored.journalEntries.map((item) => item.entryId),
    ["newer-entry", "older-entry"],
  );
  assert.equal(
    restored.journalEntries[0]?.sessionNote,
    "Private backup session note.",
  );
  assert.match(serialized, /cricket-career-lab\/private-backup/);
  assert.match(serialized, /Private backup drill note/);
  assert.ok(Object.isFrozen(restored));
  assert.ok(Object.isFrozen(restored.goals));
  assert.ok(Object.isFrozen(restored.journalEntries));
});

test("rejects malformed JSON, identities, versions, and timestamps", () => {
  assert.throws(
    () => parsePrivateBackupRecord("{broken"),
    (error: unknown) =>
      error instanceof PrivateBackupRecordError &&
      error.code === "INVALID_JSON",
  );

  const source = JSON.parse(serializePrivateBackup(validBackup())) as Record<
    string,
    unknown
  >;
  assert.throws(
    () => parsePrivateBackupRecord({ ...source, kind: "other" }),
    (error: unknown) =>
      error instanceof PrivateBackupRecordError && error.path === "kind",
  );
  assert.throws(
    () => parsePrivateBackupRecord({ ...source, version: 2 }),
    (error: unknown) =>
      error instanceof PrivateBackupRecordError &&
      error.code === "UNSUPPORTED_VERSION",
  );
  assert.throws(
    () => parsePrivateBackupRecord({ ...source, exportedAt: "tomorrow" }),
    (error: unknown) =>
      error instanceof PrivateBackupRecordError &&
      error.code === "INVALID_TIMESTAMP",
  );
});

test("wraps invalid nested records with their collection path", () => {
  const source = JSON.parse(serializePrivateBackup(validBackup())) as {
    goals: Array<Record<string, unknown>>;
    journalEntries: Array<Record<string, unknown>>;
  };
  source.goals[0] = { ...source.goals[0], target: 0 };

  assert.throws(
    () => parsePrivateBackupRecord(source),
    (error: unknown) =>
      error instanceof PrivateBackupRecordError &&
      error.code === "INVALID_GOAL" &&
      error.path === "goals.0.target",
  );

  const journalSource = JSON.parse(
    serializePrivateBackup(validBackup()),
  ) as {
    journalEntries: Array<Record<string, unknown>>;
  };
  journalSource.journalEntries[0] = {
    ...journalSource.journalEntries[0],
    completedAt: "invalid",
  };
  assert.throws(
    () => parsePrivateBackupRecord(journalSource),
    (error: unknown) =>
      error instanceof PrivateBackupRecordError &&
      error.code === "INVALID_JOURNAL_ENTRY" &&
      error.path === "journalEntries.0.completedAt",
  );
});

test("rejects duplicate goal and journal identifiers", () => {
  const duplicateGoal = JSON.parse(
    serializePrivateBackup(validBackup()),
  ) as {
    goals: unknown[];
  };
  duplicateGoal.goals.push(duplicateGoal.goals[0]);
  assert.throws(
    () => parsePrivateBackupRecord(duplicateGoal),
    (error: unknown) =>
      error instanceof PrivateBackupRecordError &&
      error.code === "DUPLICATE_GOAL",
  );

  const duplicateEntry = JSON.parse(
    serializePrivateBackup(validBackup()),
  ) as {
    journalEntries: unknown[];
  };
  duplicateEntry.journalEntries.push(duplicateEntry.journalEntries[0]);
  assert.throws(
    () => parsePrivateBackupRecord(duplicateEntry),
    (error: unknown) =>
      error instanceof PrivateBackupRecordError &&
      error.code === "DUPLICATE_JOURNAL_ENTRY",
  );
});

test("serializer revalidates backup-shaped objects", () => {
  const backup = validBackup();

  assert.throws(
    () =>
      serializePrivateBackup({
        ...backup,
        exportedAt: "2026-10-01T08:00:00Z",
      }),
    (error: unknown) => error instanceof PrivateBackupRecordError,
  );

  assert.throws(
    () =>
      createPrivateBackup(
        [{ ...goal("valid-goal"), target: 0 }],
        [],
        "2026-10-01T08:00:00.000Z",
      ),
    (error: unknown) =>
      error instanceof PrivateBackupRecordError &&
      error.code === "INVALID_GOAL" &&
      error.path === "goals.0.target",
  );
});
