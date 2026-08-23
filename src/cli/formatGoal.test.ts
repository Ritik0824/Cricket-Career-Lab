import assert from "node:assert/strict";
import test from "node:test";

import {
  createDevelopmentGoal,
  evaluateDevelopmentGoal,
} from "../domain/developmentGoal.js";
import { createSessionPlan } from "../domain/sessionPlan.js";
import { completeTrainingSession } from "../domain/trainingJournal.js";
import {
  formatGoalProgress,
  formatGoalProgressList,
  toGoalProgressView,
} from "./formatGoal.js";

function sampleProgress() {
  const plan = createSessionPlan({
    title: "Bowling rhythm",
    scheduledFor: "2026-09-04",
    drills: [
      {
        id: "run-up",
        name: "Run-up rhythm",
        focus: "bowling",
        minutes: 30,
        intensity: "moderate",
      },
    ],
  });
  const entry = completeTrainingSession({
    entryId: "rhythm-entry",
    plan,
    completedAt: "2026-09-04T08:00:00.000Z",
    drills: [
      {
        drillId: "run-up",
        completedMinutes: 24,
        perceivedEffort: 7,
        note: "Private release cue.",
      },
    ],
    sessionNote: "Private journal note.",
  });
  const goal = createDevelopmentGoal({
    goalId: "bowling-volume",
    title: "Build bowling volume",
    metric: "focus-minutes",
    target: 120,
    startDate: "2026-09-01",
    dueDate: "2026-09-30",
    focus: "bowling",
  });

  return evaluateDevelopmentGoal(goal, [entry], "2026-09-10");
}

test("formats a readable goal with evidence but no journal notes", () => {
  const output = formatGoalProgress(sampleProgress());

  assert.match(output, /Status: In-progress/);
  assert.match(output, /Metric: Focus minutes \(Bowling\)/);
  assert.match(output, /Progress: 24\/120 min \(20%\)/);
  assert.match(output, /rhythm-entry \| \+24/);
  assert.doesNotMatch(output, /Private/);
});

test("formats goal lists and the empty state", () => {
  const progress = sampleProgress();

  assert.match(
    formatGoalProgressList([progress]),
    /bowling-volume \| in-progress \| 24\/120 min/,
  );
  assert.equal(
    formatGoalProgressList([]),
    "No development goals have been created.",
  );
});

test("builds a versioned JSON view without copying private notes", () => {
  const view = toGoalProgressView(sampleProgress());
  const serialized = JSON.stringify(view);
  const goal = view.goal as Record<string, unknown>;
  const progress = view.progress as Record<string, unknown>;

  assert.equal(goal.kind, "cricket-career-lab/development-goal");
  assert.equal(goal.version, 1);
  assert.equal(progress.currentValue, 24);
  assert.doesNotMatch(serialized, /Private/);
});
