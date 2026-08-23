import assert from "node:assert/strict";
import test from "node:test";

import {
  createDevelopmentGoal,
  type DevelopmentGoal,
} from "../domain/developmentGoal.js";
import {
  parseDevelopmentGoalRecord,
  serializeDevelopmentGoal,
  DEVELOPMENT_GOAL_RECORD_KIND,
  DevelopmentGoalRecordError,
} from "./developmentGoalRecord.js";

function createGoal(): DevelopmentGoal {
  return createDevelopmentGoal({
    goalId: "bowling-volume",
    title: "Build bowling volume",
    metric: "focus-minutes",
    target: 240,
    startDate: "2026-09-01",
    dueDate: "2026-09-30",
    focus: "bowling",
  });
}

function serializedRecord(): Record<string, unknown> {
  return JSON.parse(serializeDevelopmentGoal(createGoal())) as Record<
    string,
    unknown
  >;
}

test("serializes a stable versioned goal definition without progress", () => {
  const serialized = serializeDevelopmentGoal(createGoal());
  const record = JSON.parse(serialized) as Record<string, unknown>;

  assert.equal(record.kind, DEVELOPMENT_GOAL_RECORD_KIND);
  assert.equal(record.version, 1);
  assert.equal(record.goalId, "bowling-volume");
  assert.equal(record.focus, "bowling");
  assert.equal(record.currentValue, undefined);
  assert.equal(record.progressPercentage, undefined);
  assert.equal(serialized, serializeDevelopmentGoal(createGoal()));
});

test("parses JSON and restores an immutable normalized goal", () => {
  const goal = parseDevelopmentGoalRecord(
    serializeDevelopmentGoal(createGoal()),
  );

  assert.deepEqual(goal, createGoal());
  assert.ok(Object.isFrozen(goal));
});

test("accepts an already-parsed record", () => {
  const goal = parseDevelopmentGoalRecord(serializedRecord());
  assert.equal(goal.title, "Build bowling volume");
});

test("reports malformed JSON and record identity", () => {
  assert.throws(
    () => parseDevelopmentGoalRecord("{broken"),
    (error: unknown) =>
      error instanceof DevelopmentGoalRecordError &&
      error.code === "INVALID_JSON" &&
      error.path === "$",
  );

  const record = serializedRecord();
  record.kind = "cricket-career-lab/training-journal-entry";
  assert.throws(
    () => parseDevelopmentGoalRecord(record),
    (error: unknown) =>
      error instanceof DevelopmentGoalRecordError &&
      error.code === "INVALID_SHAPE" &&
      error.path === "kind",
  );
});

test("distinguishes invalid version shapes from future versions", () => {
  const record = serializedRecord();
  record.version = "1";
  assert.throws(
    () => parseDevelopmentGoalRecord(record),
    (error: unknown) =>
      error instanceof DevelopmentGoalRecordError &&
      error.code === "INVALID_SHAPE" &&
      error.path === "version",
  );

  record.version = 2;
  assert.throws(
    () => parseDevelopmentGoalRecord(record),
    (error: unknown) =>
      error instanceof DevelopmentGoalRecordError &&
      error.code === "UNSUPPORTED_VERSION",
  );
});

test("wraps invalid stored goal definitions", () => {
  const record = serializedRecord();
  record.target = 0;

  assert.throws(
    () => parseDevelopmentGoalRecord(record),
    (error: unknown) =>
      error instanceof DevelopmentGoalRecordError &&
      error.code === "INVALID_GOAL" &&
      error.path === "target",
  );
});

test("rejects malformed field shapes before goal validation", () => {
  const record = serializedRecord();
  record.dueDate = 20260930;

  assert.throws(
    () => parseDevelopmentGoalRecord(record),
    (error: unknown) =>
      error instanceof DevelopmentGoalRecordError &&
      error.code === "INVALID_SHAPE" &&
      error.path === "dueDate",
  );
});

test("omits focus for global metrics", () => {
  const goal = createDevelopmentGoal({
    goalId: "session-count",
    title: "Complete ten sessions",
    metric: "completed-sessions",
    target: 10,
    startDate: "2026-09-01",
    dueDate: "2026-09-30",
  });
  const record = JSON.parse(serializeDevelopmentGoal(goal)) as Record<
    string,
    unknown
  >;

  assert.equal(record.focus, undefined);
  assert.equal(parseDevelopmentGoalRecord(record).focus, null);
});

test("serializer rejects a goal-shaped object with invalid values", () => {
  const invalid = { ...createGoal(), target: -5 } as DevelopmentGoal;

  assert.throws(
    () => serializeDevelopmentGoal(invalid),
    (error: unknown) =>
      error instanceof DevelopmentGoalRecordError &&
      error.code === "INVALID_GOAL" &&
      error.path === "target",
  );
});
