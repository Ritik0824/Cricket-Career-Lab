import assert from "node:assert/strict";
import test from "node:test";

import { createSessionPlan } from "./sessionPlan.js";
import {
  completeTrainingSession,
  TrainingJournalValidationError,
  type CompleteTrainingSessionInput,
} from "./trainingJournal.js";

function createPlan() {
  return createSessionPlan({
    title: "Spin batting session",
    scheduledFor: "2026-09-03",
    drills: [
      {
        id: "sweep-options",
        name: "Sweep options",
        focus: "batting",
        minutes: 25,
        intensity: "moderate",
      },
      {
        id: "footwork-cues",
        name: "Footwork cues",
        focus: "batting",
        minutes: 20,
        intensity: "high",
      },
      {
        id: "mobility-reset",
        name: "Mobility reset",
        focus: "recovery",
        minutes: 10,
        intensity: "low",
      },
    ],
  });
}

function validInput(): CompleteTrainingSessionInput {
  return {
    entryId: "spin-session-2026-09-03",
    plan: createPlan(),
    completedAt: "2026-09-03T11:30:00.000Z",
    drills: [
      {
        drillId: "sweep-options",
        completedMinutes: 25,
        perceivedEffort: 7,
        note: "  Strong contact after opening the front shoulder.  ",
      },
      {
        drillId: "footwork-cues",
        completedMinutes: 20,
        perceivedEffort: 8,
      },
      {
        drillId: "mobility-reset",
        completedMinutes: 10,
        perceivedEffort: 3,
      },
    ],
    sessionNote: "  Pick up length earlier next session.  ",
  };
}

test("records a completed session with planned-versus-actual summaries", () => {
  const entry = completeTrainingSession(validInput());

  assert.equal(entry.status, "completed");
  assert.equal(entry.plannedMinutes, 55);
  assert.equal(entry.completedMinutes, 55);
  assert.equal(entry.varianceMinutes, 0);
  assert.equal(entry.adherencePercentage, 100);
  assert.equal(entry.effortLoad, 365);
  assert.equal(entry.averageEffort, 6.6);
  assert.deepEqual(entry.completedFocusMinutes, {
    batting: 45,
    bowling: 0,
    fielding: 0,
    fitness: 0,
    recovery: 10,
  });
  assert.equal(
    entry.drills[0]?.note,
    "Strong contact after opening the front shoulder.",
  );
  assert.equal(entry.drills[0]?.plannedIntensity, "moderate");
  assert.equal(entry.sessionNote, "Pick up length earlier next session.");
  assert.ok(Object.isFrozen(entry));
  assert.ok(Object.isFrozen(entry.drills));
});

test("classifies partial, extended, and omitted drills", () => {
  const input = validInput();
  input.drills = [
    {
      drillId: "SWEEP-OPTIONS",
      completedMinutes: 15,
      perceivedEffort: 6,
    },
    {
      drillId: "footwork-cues",
      completedMinutes: 25,
      perceivedEffort: 9,
    },
  ];

  const entry = completeTrainingSession(input);

  assert.equal(entry.status, "partial");
  assert.equal(entry.completedMinutes, 40);
  assert.equal(entry.varianceMinutes, -15);
  assert.equal(entry.adherencePercentage, 73);
  assert.equal(entry.averageEffort, 7.9);
  assert.deepEqual(
    entry.drills.map((drill) => drill.status),
    ["partial", "completed", "skipped"],
  );
  assert.equal(entry.drills[1]?.varianceMinutes, 5);
  assert.equal(entry.drills[2]?.perceivedEffort, null);
});

test("records an explicitly missed session without effort", () => {
  const input = validInput();
  input.drills = [];
  input.sessionNote = "Rain made the nets unavailable.";

  const entry = completeTrainingSession(input);

  assert.equal(entry.status, "missed");
  assert.equal(entry.completedMinutes, 0);
  assert.equal(entry.adherencePercentage, 0);
  assert.equal(entry.averageEffort, null);
  assert.ok(entry.drills.every((drill) => drill.status === "skipped"));
});

test("rejects unknown and duplicate drill results", () => {
  const unknown = validInput();
  unknown.drills = [
    { drillId: "new-drill", completedMinutes: 10, perceivedEffort: 5 },
  ];
  assert.throws(
    () => completeTrainingSession(unknown),
    (error: unknown) =>
      error instanceof TrainingJournalValidationError &&
      error.field === "drills.0.drillId" &&
      /not part/.test(error.message),
  );

  const duplicate = validInput();
  duplicate.drills = [
    duplicate.drills[0]!,
    { ...duplicate.drills[0]!, drillId: "SWEEP-OPTIONS" },
  ];
  assert.throws(
    () => completeTrainingSession(duplicate),
    (error: unknown) =>
      error instanceof TrainingJournalValidationError &&
      error.field === "drills.1.drillId" &&
      /more than once/.test(error.message),
  );
});

test("requires bounded effort for performed drills and none for skipped drills", () => {
  const missingEffort = validInput();
  missingEffort.drills = [
    { drillId: "sweep-options", completedMinutes: 10 },
  ];
  assert.throws(
    () => completeTrainingSession(missingEffort),
    /integer from 1 to 10/,
  );

  const skippedWithEffort = validInput();
  skippedWithEffort.drills = [
    {
      drillId: "sweep-options",
      completedMinutes: 0,
      perceivedEffort: 1,
    },
  ];
  assert.throws(
    () => completeTrainingSession(skippedWithEffort),
    /must be omitted/,
  );

  const excessiveEffort = validInput();
  excessiveEffort.drills = [
    {
      drillId: "sweep-options",
      completedMinutes: 10,
      perceivedEffort: 11,
    },
  ];
  assert.throws(
    () => completeTrainingSession(excessiveEffort),
    /integer from 1 to 10/,
  );
});

test("reports validation paths against the caller's result order", () => {
  const input = validInput();
  input.drills = [
    {
      drillId: "mobility-reset",
      completedMinutes: 10,
      perceivedEffort: 12,
    },
    {
      drillId: "sweep-options",
      completedMinutes: 20,
      perceivedEffort: 6,
    },
  ];

  assert.throws(
    () => completeTrainingSession(input),
    (error: unknown) =>
      error instanceof TrainingJournalValidationError &&
      error.field === "drills.0.perceivedEffort",
  );
});

test("rejects invalid duration totals and note lengths", () => {
  const invalidMinutes = validInput();
  invalidMinutes.drills = [
    {
      drillId: "sweep-options",
      completedMinutes: 121,
      perceivedEffort: 5,
    },
  ];
  assert.throws(
    () => completeTrainingSession(invalidMinutes),
    /integer from 0 to 120/,
  );

  const excessiveTotal = validInput();
  excessiveTotal.drills = excessiveTotal.plan.drills.map((drill) => ({
    drillId: drill.id,
    completedMinutes: 90,
    perceivedEffort: 5,
  }));
  assert.throws(
    () => completeTrainingSession(excessiveTotal),
    /cannot exceed 240 minutes/,
  );

  const longNote = validInput();
  longNote.drills = [
    {
      drillId: "sweep-options",
      completedMinutes: 10,
      perceivedEffort: 5,
      note: "n".repeat(501),
    },
  ];
  assert.throws(
    () => completeTrainingSession(longNote),
    /at most 500 characters/,
  );

  const longSessionNote = validInput();
  longSessionNote.sessionNote = "n".repeat(1_001);
  assert.throws(
    () => completeTrainingSession(longSessionNote),
    /at most 1000 characters/,
  );
});

test("rejects invalid entry identifiers and completion timestamps", () => {
  const badId = validInput();
  badId.entryId = "Not a safe id";
  assert.throws(
    () => completeTrainingSession(badId),
    (error: unknown) =>
      error instanceof TrainingJournalValidationError &&
      error.field === "entryId",
  );

  const badTimestamp = validInput();
  badTimestamp.completedAt = "2026-09-03T11:30:00Z";
  assert.throws(
    () => completeTrainingSession(badTimestamp),
    (error: unknown) =>
      error instanceof TrainingJournalValidationError &&
      error.field === "completedAt",
  );
});
