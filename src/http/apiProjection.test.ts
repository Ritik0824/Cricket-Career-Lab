import assert from "node:assert/strict";
import test from "node:test";

import {
  createDevelopmentGoal,
  evaluateDevelopmentGoal,
} from "../domain/developmentGoal.js";
import { createSessionPlan } from "../domain/sessionPlan.js";
import { completeTrainingSession } from "../domain/trainingJournal.js";
import {
  toDevelopmentGoalApiView,
  toJournalEntryApiView,
} from "./apiProjection.js";

function privateEntry() {
  const plan = createSessionPlan({
    title: "API bowling session",
    scheduledFor: "2026-09-10",
    drills: [
      {
        id: "api-seam",
        name: "API seam drill",
        focus: "bowling",
        minutes: 20,
        intensity: "moderate",
      },
    ],
  });

  return completeTrainingSession({
    entryId: "api-seam-entry",
    plan,
    completedAt: "2026-09-10T08:00:00.000Z",
    drills: [
      {
        drillId: "api-seam",
        completedMinutes: 18,
        perceivedEffort: 7,
        note: "Private API drill note.",
      },
    ],
    sessionNote: "Private API session note.",
  });
}

test("projects journal summaries without drill or note detail", () => {
  const view = toJournalEntryApiView(privateEntry());
  const serialized = JSON.stringify(view);

  assert.equal(view.entryId, "api-seam-entry");
  assert.equal(view.completedMinutes, 18);
  assert.equal(view.completedFocusMinutes.bowling, 18);
  assert.doesNotMatch(serialized, /Private API/);
  assert.doesNotMatch(serialized, /drills/);
  assert.ok(Object.isFrozen(view));
});

test("projects evidence-backed goal progress without journal notes", () => {
  const entry = privateEntry();
  const goal = createDevelopmentGoal({
    goalId: "api-bowling-volume",
    title: "API bowling volume",
    metric: "focus-minutes",
    target: 60,
    startDate: "2026-09-01",
    dueDate: "2026-09-30",
    focus: "bowling",
  });
  const view = toDevelopmentGoalApiView(
    evaluateDevelopmentGoal(goal, [entry], "2026-09-10"),
  );

  assert.equal(view.currentValue, 18);
  assert.equal(view.evidence[0]?.entryId, "api-seam-entry");
  assert.doesNotMatch(JSON.stringify(view), /Private API/);
  assert.ok(Object.isFrozen(view));
});
