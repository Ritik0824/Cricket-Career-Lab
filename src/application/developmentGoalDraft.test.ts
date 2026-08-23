import assert from "node:assert/strict";
import test from "node:test";

import {
  parseDevelopmentGoalDraft,
  DevelopmentGoalDraftError,
} from "./developmentGoalDraft.js";

function validDraft(): Record<string, unknown> {
  return {
    goalId: "bowling-volume",
    title: "Build bowling volume",
    metric: "focus-minutes",
    target: 180,
    startDate: "2026-09-01",
    dueDate: "2026-09-30",
    focus: "bowling",
  };
}

test("parses and normalizes a goal draft through the domain", () => {
  const goal = parseDevelopmentGoalDraft(JSON.stringify(validDraft()));

  assert.equal(goal.goalId, "bowling-volume");
  assert.equal(goal.metric, "focus-minutes");
  assert.equal(goal.focus, "bowling");
  assert.equal(goal.target, 180);
  assert.ok(Object.isFrozen(goal));
});

test("accepts an already-parsed global metric draft", () => {
  const draft = validDraft();
  draft.metric = "completed-sessions";
  draft.target = 8;
  delete draft.focus;

  const goal = parseDevelopmentGoalDraft(draft);
  assert.equal(goal.metric, "completed-sessions");
  assert.equal(goal.focus, null);
});

test("reports malformed JSON and missing fields", () => {
  assert.throws(
    () => parseDevelopmentGoalDraft("{broken"),
    (error: unknown) =>
      error instanceof DevelopmentGoalDraftError &&
      error.code === "INVALID_JSON" &&
      error.path === "$",
  );

  const draft = validDraft();
  delete draft.target;
  assert.throws(
    () => parseDevelopmentGoalDraft(draft),
    (error: unknown) =>
      error instanceof DevelopmentGoalDraftError &&
      error.code === "INVALID_SHAPE" &&
      error.path === "target",
  );
});

test("wraps invalid goal semantics with their field path", () => {
  const draft = validDraft();
  draft.dueDate = "2026-08-31";

  assert.throws(
    () => parseDevelopmentGoalDraft(draft),
    (error: unknown) =>
      error instanceof DevelopmentGoalDraftError &&
      error.code === "INVALID_GOAL" &&
      error.path === "startDate",
  );
});

test("rejects optional focus values with the wrong shape", () => {
  const draft = validDraft();
  draft.focus = 42;

  assert.throws(
    () => parseDevelopmentGoalDraft(draft),
    (error: unknown) =>
      error instanceof DevelopmentGoalDraftError && error.path === "focus",
  );
});
