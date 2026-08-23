import assert from "node:assert/strict";
import test from "node:test";

import { createSessionPlan } from "../domain/sessionPlan.js";
import { completeTrainingSession } from "../domain/trainingJournal.js";
import { buildWeeklyWorkloadReview } from "../domain/weeklyWorkload.js";
import { formatWeeklyWorkloadReview } from "./formatWorkload.js";

test("formats workload comparison, evidence, and scope without private notes", () => {
  const plan = createSessionPlan({
    title: "Fielding workload",
    scheduledFor: "2026-09-10",
    drills: [
      {
        id: "ground-fielding",
        name: "Ground fielding",
        focus: "fielding",
        minutes: 20,
        intensity: "moderate",
      },
    ],
  });
  const entry = completeTrainingSession({
    entryId: "fielding-entry",
    plan,
    completedAt: "2026-09-10T09:00:00.000Z",
    drills: [
      {
        drillId: "ground-fielding",
        completedMinutes: 18,
        perceivedEffort: 7,
        note: "Private footwork note.",
      },
    ],
    sessionNote: "Private session note.",
  });
  const output = formatWeeklyWorkloadReview(
    buildWeeklyWorkloadReview([entry], "2026-09-14"),
  );

  assert.match(output, /Current week: 2026-09-08 to 2026-09-14/);
  assert.match(output, /Completed time: 18 min/);
  assert.match(output, /Fielding 18 min \(100%\)/);
  assert.match(output, /18 vs 0 min \| \+18 \| no prior baseline \| started/);
  assert.match(output, /Current entries: fielding-entry/);
  assert.match(output, /does not assess readiness, health, or injury risk/);
  assert.doesNotMatch(output, /Private/);
});

test("formats an empty review without misleading numeric effort", () => {
  const output = formatWeeklyWorkloadReview(
    buildWeeklyWorkloadReview([], "2026-09-14"),
  );

  assert.match(output, /Sessions: 0 performed, 0 missed \(0 recorded\)/);
  assert.match(output, /Average effort: n\/a/);
  assert.match(output, /Focus: none/);
  assert.match(output, /Current entries: none/);
});
