import assert from "node:assert/strict";
import test from "node:test";

import {
  createSessionPlan,
  SessionPlanValidationError,
  type SessionPlanInput,
} from "./sessionPlan.js";

function validInput(): SessionPlanInput {
  return {
    title: "  Saturday skill session  ",
    scheduledFor: "2026-08-29",
    drills: [
      {
        id: "FRONT-FOOT-DRIVE",
        name: "Front-foot drive",
        focus: "batting",
        minutes: 30,
        intensity: "moderate",
      },
      {
        id: "boundary-catching",
        name: "Boundary catching",
        focus: "fielding",
        minutes: 20,
        intensity: "high",
      },
      {
        id: "cool-down",
        name: "Guided cool down",
        focus: "recovery",
        minutes: 10,
        intensity: "low",
      },
    ],
  };
}

test("creates a normalized plan with focus and workload summaries", () => {
  const plan = createSessionPlan(validInput());

  assert.equal(plan.title, "Saturday skill session");
  assert.equal(plan.drills[0]?.id, "front-foot-drive");
  assert.equal(plan.totalMinutes, 60);
  assert.equal(plan.workloadPoints, 130);
  assert.deepEqual(plan.focusMinutes, {
    batting: 30,
    bowling: 0,
    fielding: 20,
    fitness: 0,
    recovery: 10,
  });
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.drills));
});

test("rejects duplicate drill identifiers after normalization", () => {
  const input = validInput();
  input.drills = [input.drills[0]!, { ...input.drills[0]!, id: "front-foot-drive" }];

  assert.throws(
    () => createSessionPlan(input),
    (error: unknown) =>
      error instanceof SessionPlanValidationError &&
      error.field === "drills.1.id" &&
      /already used/.test(error.message),
  );
});

test("rejects impossible calendar dates", () => {
  const input = validInput();
  input.scheduledFor = "2026-02-30";

  assert.throws(
    () => createSessionPlan(input),
    (error: unknown) =>
      error instanceof SessionPlanValidationError &&
      error.field === "scheduledFor",
  );
});

test("rejects sessions whose combined duration exceeds three hours", () => {
  const input = validInput();
  input.drills = [
    { ...input.drills[0]!, id: "block-one", minutes: 70 },
    { ...input.drills[0]!, id: "block-two", minutes: 70 },
    { ...input.drills[0]!, id: "block-three", minutes: 70 },
  ];

  assert.throws(
    () => createSessionPlan(input),
    (error: unknown) =>
      error instanceof SessionPlanValidationError &&
      error.field === "drills" &&
      /180 minutes/.test(error.message),
  );
});

test("rejects empty drill lists and out-of-range drill durations", () => {
  const empty = validInput();
  empty.drills = [];
  assert.throws(() => createSessionPlan(empty), /at least one drill/);

  const tooShort = validInput();
  tooShort.drills = [{ ...tooShort.drills[0]!, minutes: 4 }];
  assert.throws(() => createSessionPlan(tooShort), /integer from 5 to 90/);
});
