import assert from "node:assert/strict";
import test from "node:test";

import { createSessionPlan } from "../domain/sessionPlan.js";
import {
  completeTrainingSession,
  type TrainingJournalEntry,
} from "../domain/trainingJournal.js";
import {
  parseTrainingJournalRecord,
  serializeTrainingJournalEntry,
  TRAINING_JOURNAL_RECORD_KIND,
  TrainingJournalRecordError,
} from "./trainingJournalRecord.js";

function createEntry(entryId = "journal-entry-one"): TrainingJournalEntry {
  const plan = createSessionPlan({
    title: "Close-catching practice",
    scheduledFor: "2026-09-04",
    drills: [
      {
        id: "reaction-catches",
        name: "Reaction catches",
        focus: "fielding",
        minutes: 20,
        intensity: "high",
      },
      {
        id: "cool-down-walk",
        name: "Cool-down walk",
        focus: "recovery",
        minutes: 10,
        intensity: "low",
      },
    ],
  });

  return completeTrainingSession({
    entryId,
    plan,
    completedAt: "2026-09-04T10:45:00.000Z",
    drills: [
      {
        drillId: "reaction-catches",
        completedMinutes: 18,
        perceivedEffort: 8,
        note: "Hands stayed relaxed.",
      },
    ],
    sessionNote: "Repeat with a closer starting position.",
  });
}

function serializedRecord(): Record<string, unknown> {
  return JSON.parse(serializeTrainingJournalEntry(createEntry())) as Record<
    string,
    unknown
  >;
}

test("serializes stable inputs without trusting derived review values", () => {
  const serialized = serializeTrainingJournalEntry(createEntry());
  const record = JSON.parse(serialized) as Record<string, unknown>;
  const plan = record.plan as Record<string, unknown>;
  const drills = record.drills as Array<Record<string, unknown>>;

  assert.equal(record.kind, TRAINING_JOURNAL_RECORD_KIND);
  assert.equal(record.version, 1);
  assert.equal(record.entryId, "journal-entry-one");
  assert.equal(record.completedMinutes, undefined);
  assert.equal(record.adherencePercentage, undefined);
  assert.equal(plan.totalMinutes, undefined);
  assert.equal(drills[0]?.status, undefined);
  assert.equal(drills[1]?.perceivedEffort, undefined);
  assert.equal(serialized, serializeTrainingJournalEntry(createEntry()));
});

test("restores an immutable journal entry and recalculates summaries", () => {
  const entry = parseTrainingJournalRecord(
    serializeTrainingJournalEntry(createEntry()),
  );

  assert.equal(entry.status, "partial");
  assert.equal(entry.plannedMinutes, 30);
  assert.equal(entry.completedMinutes, 18);
  assert.equal(entry.adherencePercentage, 60);
  assert.equal(entry.effortLoad, 144);
  assert.equal(entry.averageEffort, 8);
  assert.equal(entry.drills[0]?.plannedIntensity, "high");
  assert.equal(entry.drills[1]?.status, "skipped");
  assert.equal(entry.sessionNote, "Repeat with a closer starting position.");
  assert.ok(Object.isFrozen(entry));
});

test("accepts an already-parsed journal record", () => {
  const entry = parseTrainingJournalRecord(serializedRecord());

  assert.equal(entry.entryId, "journal-entry-one");
  assert.equal(entry.drills.length, 2);
});

test("reports malformed JSON and wrong record identity", () => {
  assert.throws(
    () => parseTrainingJournalRecord("{broken"),
    (error: unknown) =>
      error instanceof TrainingJournalRecordError &&
      error.code === "INVALID_JSON" &&
      error.path === "$",
  );

  const record = serializedRecord();
  record.kind = "cricket-career-lab/session-plan";
  assert.throws(
    () => parseTrainingJournalRecord(record),
    (error: unknown) =>
      error instanceof TrainingJournalRecordError &&
      error.code === "INVALID_SHAPE" &&
      error.path === "kind",
  );
});

test("distinguishes invalid version shapes from future versions", () => {
  const record = serializedRecord();
  record.version = "1";
  assert.throws(
    () => parseTrainingJournalRecord(record),
    (error: unknown) =>
      error instanceof TrainingJournalRecordError &&
      error.code === "INVALID_SHAPE" &&
      error.path === "version",
  );

  record.version = 2;
  assert.throws(
    () => parseTrainingJournalRecord(record),
    (error: unknown) =>
      error instanceof TrainingJournalRecordError &&
      error.code === "UNSUPPORTED_VERSION",
  );
});

test("rejects malformed plan snapshots before journal calculations", () => {
  const record = serializedRecord();
  const plan = record.plan as Record<string, unknown>;
  const drills = plan.drills as Array<Record<string, unknown>>;
  drills[0]!.intensity = "maximum";

  assert.throws(
    () => parseTrainingJournalRecord(record),
    (error: unknown) =>
      error instanceof TrainingJournalRecordError &&
      error.code === "INVALID_SHAPE" &&
      error.path === "plan.drills.0.intensity",
  );
});

test("wraps journal invariant violations from stored results", () => {
  const record = serializedRecord();
  const drills = record.drills as Array<Record<string, unknown>>;
  drills.push({ ...drills[0] });

  assert.throws(
    () => parseTrainingJournalRecord(record),
    (error: unknown) =>
      error instanceof TrainingJournalRecordError &&
      error.code === "INVALID_ENTRY" &&
      error.path === "drills.2.drillId",
  );
});

test("ignores injected derived fields and recomputes their values", () => {
  const record = serializedRecord();
  record.completedMinutes = 999;
  record.status = "completed";
  record.effortLoad = -1;

  const entry = parseTrainingJournalRecord(record);
  assert.equal(entry.completedMinutes, 18);
  assert.equal(entry.status, "partial");
  assert.equal(entry.effortLoad, 144);
});

test("serializer rejects a journal-shaped object with invalid identity", () => {
  const invalid = {
    ...createEntry(),
    entryId: "Unsafe entry id",
  } as TrainingJournalEntry;

  assert.throws(
    () => serializeTrainingJournalEntry(invalid),
    (error: unknown) =>
      error instanceof TrainingJournalRecordError &&
      error.code === "INVALID_ENTRY" &&
      error.path === "entryId",
  );
});
