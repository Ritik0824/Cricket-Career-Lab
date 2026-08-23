import assert from "node:assert/strict";
import test from "node:test";

import { createSessionPlan } from "../domain/sessionPlan.js";
import {
  parseSessionPlanRecord,
  serializeSessionPlan,
  SESSION_PLAN_RECORD_KIND,
  SessionPlanRecordError,
} from "./sessionPlanRecord.js";

const SAVED_AT = "2026-08-23T14:30:00.000Z";

function createPlan() {
  return createSessionPlan({
    title: "New-ball control",
    scheduledFor: "2026-08-26",
    drills: [
      {
        id: "target-channel",
        name: "Fourth-stump target channel",
        focus: "bowling",
        minutes: 24,
        intensity: "high",
      },
      {
        id: "landing-mechanics",
        name: "Landing mechanics review",
        focus: "fitness",
        minutes: 12,
        intensity: "low",
      },
    ],
  });
}

function serializedRecord(): Record<string, unknown> {
  return JSON.parse(serializeSessionPlan(createPlan(), SAVED_AT)) as Record<
    string,
    unknown
  >;
}

test("serializes a stable versioned record without derived totals", () => {
  const serialized = serializeSessionPlan(createPlan(), SAVED_AT);
  const record = JSON.parse(serialized) as Record<string, unknown>;
  const plan = record.plan as Record<string, unknown>;

  assert.equal(record.kind, SESSION_PLAN_RECORD_KIND);
  assert.equal(record.version, 1);
  assert.equal(record.savedAt, SAVED_AT);
  assert.equal(plan.totalMinutes, undefined);
  assert.equal(plan.workloadPoints, undefined);
  assert.equal(serialized, serializeSessionPlan(createPlan(), SAVED_AT));
});

test("parses JSON and rebuilds trustworthy derived values", () => {
  const restored = parseSessionPlanRecord(
    serializeSessionPlan(createPlan(), SAVED_AT),
  );

  assert.equal(restored.savedAt, SAVED_AT);
  assert.equal(restored.plan.totalMinutes, 36);
  assert.equal(restored.plan.workloadPoints, 84);
  assert.deepEqual(restored.plan.focusMinutes, {
    batting: 0,
    bowling: 24,
    fielding: 0,
    fitness: 12,
    recovery: 0,
  });
  assert.ok(Object.isFrozen(restored));
});

test("accepts an already-parsed record at the storage boundary", () => {
  const restored = parseSessionPlanRecord(serializedRecord());

  assert.equal(restored.plan.title, "New-ball control");
  assert.equal(restored.plan.drills.length, 2);
});

test("reports malformed JSON without leaking parser details", () => {
  assert.throws(
    () => parseSessionPlanRecord("{not-json"),
    (error: unknown) =>
      error instanceof SessionPlanRecordError &&
      error.code === "INVALID_JSON" &&
      error.path === "$",
  );
});

test("distinguishes unsupported versions from invalid record shapes", () => {
  const record = serializedRecord();
  record.version = 2;

  assert.throws(
    () => parseSessionPlanRecord(record),
    (error: unknown) =>
      error instanceof SessionPlanRecordError &&
      error.code === "UNSUPPORTED_VERSION" &&
      error.path === "version",
  );

  record.version = "1";
  assert.throws(
    () => parseSessionPlanRecord(record),
    (error: unknown) =>
      error instanceof SessionPlanRecordError &&
      error.code === "INVALID_SHAPE" &&
      error.path === "version",
  );
});

test("rejects non-canonical timestamps", () => {
  const record = serializedRecord();
  record.savedAt = "2026-08-23T14:30:00Z";

  assert.throws(
    () => parseSessionPlanRecord(record),
    (error: unknown) =>
      error instanceof SessionPlanRecordError && error.path === "savedAt",
  );
});

test("rejects unknown drill values before they reach domain calculations", () => {
  const record = serializedRecord();
  const plan = record.plan as Record<string, unknown>;
  const drills = plan.drills as Array<Record<string, unknown>>;
  drills[0]!.intensity = "extreme";

  assert.throws(
    () => parseSessionPlanRecord(record),
    (error: unknown) =>
      error instanceof SessionPlanRecordError &&
      error.code === "INVALID_SHAPE" &&
      error.path === "plan.drills.0.intensity",
  );
});

test("wraps violated session invariants as invalid stored plans", () => {
  const record = serializedRecord();
  const plan = record.plan as Record<string, unknown>;
  const drills = plan.drills as Array<Record<string, unknown>>;
  drills[1]!.id = drills[0]!.id;

  assert.throws(
    () => parseSessionPlanRecord(record),
    (error: unknown) =>
      error instanceof SessionPlanRecordError &&
      error.code === "INVALID_PLAN" &&
      error.path === "plan.drills.1.id",
  );
});
