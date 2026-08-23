import assert from "node:assert/strict";
import test from "node:test";

import {
  parseTrainingCompletionDraft,
  TrainingCompletionDraftError,
} from "./trainingCompletionDraft.js";

function validDraft(): Record<string, unknown> {
  return {
    entryId: "new-ball-entry",
    drills: [
      {
        drillId: "fourth-stump-channel",
        completedMinutes: 22,
        perceivedEffort: 8,
        note: "Release stayed consistent.",
      },
    ],
    sessionNote: "Repeat from the opposite end.",
  };
}

test("parses completion JSON with optional private notes", () => {
  const draft = parseTrainingCompletionDraft(JSON.stringify(validDraft()));

  assert.equal(draft.entryId, "new-ball-entry");
  assert.equal(draft.drills[0]?.completedMinutes, 22);
  assert.equal(draft.drills[0]?.perceivedEffort, 8);
  assert.equal(draft.sessionNote, "Repeat from the opposite end.");
  assert.ok(Object.isFrozen(draft));
  assert.ok(Object.isFrozen(draft.drills));
});

test("accepts a missed-session draft with no drill results", () => {
  const draft = parseTrainingCompletionDraft({
    entryId: "rain-day-entry",
    drills: [],
    sessionNote: "Outdoor nets were unavailable.",
  });

  assert.deepEqual(draft.drills, []);
  assert.equal(draft.sessionNote, "Outdoor nets were unavailable.");
});

test("reports malformed JSON and missing drill arrays", () => {
  assert.throws(
    () => parseTrainingCompletionDraft("{broken"),
    (error: unknown) =>
      error instanceof TrainingCompletionDraftError &&
      error.code === "INVALID_JSON" &&
      error.path === "$",
  );

  const withoutDrills = validDraft();
  delete withoutDrills.drills;
  assert.throws(
    () => parseTrainingCompletionDraft(withoutDrills),
    (error: unknown) =>
      error instanceof TrainingCompletionDraftError &&
      error.path === "drills",
  );
});

test("identifies malformed drill fields precisely", () => {
  const draft = validDraft();
  const drills = draft.drills as Array<Record<string, unknown>>;
  drills[0]!.completedMinutes = "twenty";

  assert.throws(
    () => parseTrainingCompletionDraft(draft),
    (error: unknown) =>
      error instanceof TrainingCompletionDraftError &&
      error.code === "INVALID_SHAPE" &&
      error.path === "drills.0.completedMinutes",
  );
});

test("leaves domain ranges to the completed-session contract", () => {
  const draft = validDraft();
  const drills = draft.drills as Array<Record<string, unknown>>;
  drills[0]!.perceivedEffort = 11;

  const parsed = parseTrainingCompletionDraft(draft);
  assert.equal(parsed.drills[0]?.perceivedEffort, 11);
});
