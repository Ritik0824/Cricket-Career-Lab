import assert from "node:assert/strict";
import test from "node:test";

import { buildMonthlyPracticeReview } from "../domain/monthlyReview.js";
import { createSessionPlan } from "../domain/sessionPlan.js";
import { completeTrainingSession } from "../domain/trainingJournal.js";
import { formatMonthlyPracticeReview } from "./formatMonthlyReview.js";

test("formats monthly patterns and evidence without copying notes", () => {
  const plan = createSessionPlan({
    title: "Monthly bowling review",
    scheduledFor: "2026-09-10",
    drills: [
      {
        id: "seam-block",
        name: "Seam block",
        focus: "bowling",
        minutes: 20,
        intensity: "moderate",
      },
    ],
  });
  const entry = completeTrainingSession({
    entryId: "monthly-seam-entry",
    plan,
    completedAt: "2026-09-10T09:00:00.000Z",
    drills: [
      {
        drillId: "seam-block",
        completedMinutes: 18,
        perceivedEffort: 7,
        note: "Private seam cue.",
      },
    ],
    sessionNote: "Private month note.",
  });
  const output = formatMonthlyPracticeReview(
    buildMonthlyPracticeReview([entry], "2026-09"),
  );

  assert.match(output, /Monthly practice review — 2026-09/);
  assert.match(output, /Current month: 2026-09-01 to 2026-09-30/);
  assert.match(output, /Bowling 18 min \(100%\)/);
  assert.match(output, /18 vs 0 min \| \+18 \| no prior baseline \| started/);
  assert.match(output, /Busiest training day: 2026-09-10/);
  assert.match(output, /Current evidence: monthly-seam-entry/);
  assert.match(output, /does not assess readiness, health, or injury risk/);
  assert.doesNotMatch(output, /Private/);
});

test("formats empty-month highlights explicitly", () => {
  const output = formatMonthlyPracticeReview(
    buildMonthlyPracticeReview([], "2026-09"),
  );

  assert.match(output, /Longest active-day streak: none/);
  assert.match(output, /Busiest training day: none/);
  assert.match(output, /Current evidence: none/);
  assert.match(output, /2026-09-29 to 2026-09-30/);
});
