import assert from "node:assert/strict";
import test from "node:test";

import { createSessionPlan } from "./sessionPlan.js";
import { completeTrainingSession } from "./trainingJournal.js";
import {
  deduplicateTrainingEntries,
  summarizeTrainingPeriod,
  TrainingPeriodValidationError,
} from "./trainingPeriod.js";

function completedEntry(id: string, completedAt: string, minutes: number) {
  const plan = createSessionPlan({
    title: `Period ${id}`,
    scheduledFor: completedAt.slice(0, 10),
    drills: [
      {
        id: "fielding-block",
        name: "Fielding block",
        focus: "fielding",
        minutes: 20,
        intensity: "high",
      },
    ],
  });

  return completeTrainingSession({
    entryId: id,
    plan,
    completedAt,
    drills: [
      {
        drillId: "fielding-block",
        completedMinutes: minutes,
        perceivedEffort: 8,
      },
    ],
  });
}

test("summarizes an inclusive period and keeps stable evidence order", () => {
  const first = completedEntry(
    "period-first",
    "2026-09-01T08:00:00.000Z",
    12,
  );
  const last = completedEntry(
    "period-last",
    "2026-09-30T08:00:00.000Z",
    18,
  );
  const outside = completedEntry(
    "period-outside",
    "2026-10-01T08:00:00.000Z",
    20,
  );

  const summary = summarizeTrainingPeriod(
    [first, outside, last],
    "2026-09-01",
    "2026-09-30",
  );

  assert.equal(summary.completedMinutes, 30);
  assert.equal(summary.effortLoad, 240);
  assert.equal(summary.averageEffort, 8);
  assert.deepEqual(summary.entryIds, ["period-last", "period-first"]);
  assert.deepEqual(summary.focusRanking, [
    { category: "fielding", minutes: 30, sharePercentage: 100 },
  ]);
  assert.ok(Object.isFrozen(summary));
});

test("deduplication keeps the newest timestamp and freezes its result", () => {
  const older = completedEntry(
    "corrected-period",
    "2026-09-01T08:00:00.000Z",
    20,
  );
  const newer = completedEntry(
    "corrected-period",
    "2026-09-02T08:00:00.000Z",
    10,
  );
  const result = deduplicateTrainingEntries([older, newer]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.completedAt, "2026-09-02T08:00:00.000Z");
  assert.ok(Object.isFrozen(result));
});

test("validates both period bounds and their order", () => {
  assert.throws(
    () => summarizeTrainingPeriod([], "2026-02-30", "2026-03-01"),
    (error: unknown) =>
      error instanceof TrainingPeriodValidationError &&
      error.field === "startDate",
  );
  assert.throws(
    () => summarizeTrainingPeriod([], "2026-09-02", "2026-09-01"),
    (error: unknown) =>
      error instanceof TrainingPeriodValidationError &&
      /cannot be later/.test(error.message),
  );
});
