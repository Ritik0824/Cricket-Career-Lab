import assert from "node:assert/strict";
import test from "node:test";

import {
  parseSessionPlanDraft,
  SessionPlanDraftError,
} from "./sessionPlanDraft.js";

function validDraft(): Record<string, unknown> {
  return {
    title: "  Middle-overs rotation  ",
    scheduledFor: "2026-08-30",
    drills: [
      {
        id: "strike-rotation",
        name: "Strike rotation grid",
        focus: "batting",
        minutes: 25,
        intensity: "moderate",
      },
      {
        id: "inner-ring-pickup",
        name: "Inner-ring pickup and release",
        focus: "fielding",
        minutes: 15,
        intensity: "high",
      },
    ],
  };
}

test("parses JSON drafts through the training-plan domain", () => {
  const plan = parseSessionPlanDraft(JSON.stringify(validDraft()));

  assert.equal(plan.title, "Middle-overs rotation");
  assert.equal(plan.totalMinutes, 40);
  assert.equal(plan.workloadPoints, 95);
  assert.deepEqual(plan.focusMinutes, {
    batting: 25,
    bowling: 0,
    fielding: 15,
    fitness: 0,
    recovery: 0,
  });
});

test("accepts an already-parsed draft object", () => {
  const plan = parseSessionPlanDraft(validDraft());

  assert.equal(plan.drills.length, 2);
  assert.ok(Object.isFrozen(plan));
});

test("returns a stable error for malformed JSON", () => {
  assert.throws(
    () => parseSessionPlanDraft("{unfinished"),
    (error: unknown) =>
      error instanceof SessionPlanDraftError &&
      error.code === "INVALID_JSON" &&
      error.path === "$",
  );
});

test("identifies invalid drill fields before domain calculations", () => {
  const draft = validDraft();
  const drills = draft.drills as Array<Record<string, unknown>>;
  drills[0]!.focus = "captaincy";

  assert.throws(
    () => parseSessionPlanDraft(draft),
    (error: unknown) =>
      error instanceof SessionPlanDraftError &&
      error.code === "INVALID_SHAPE" &&
      error.path === "drills.0.focus",
  );
});

test("wraps violated plan invariants with their public field path", () => {
  const draft = validDraft();
  const drills = draft.drills as Array<Record<string, unknown>>;
  drills[1]!.id = drills[0]!.id;

  assert.throws(
    () => parseSessionPlanDraft(draft),
    (error: unknown) =>
      error instanceof SessionPlanDraftError &&
      error.code === "INVALID_PLAN" &&
      error.path === "drills.1.id",
  );
});

test("rejects missing drill collections and non-string titles", () => {
  const withoutDrills = validDraft();
  delete withoutDrills.drills;
  assert.throws(
    () => parseSessionPlanDraft(withoutDrills),
    (error: unknown) =>
      error instanceof SessionPlanDraftError && error.path === "drills",
  );

  const wrongTitle = validDraft();
  wrongTitle.title = 42;
  assert.throws(
    () => parseSessionPlanDraft(wrongTitle),
    (error: unknown) =>
      error instanceof SessionPlanDraftError && error.path === "title",
  );
});
