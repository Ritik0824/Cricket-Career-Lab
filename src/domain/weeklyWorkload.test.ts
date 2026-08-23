import assert from "node:assert/strict";
import test from "node:test";

import { createSessionPlan } from "./sessionPlan.js";
import {
  completeTrainingSession,
  type TrainingJournalEntry,
} from "./trainingJournal.js";
import {
  buildWeeklyWorkloadReview,
  WeeklyWorkloadValidationError,
} from "./weeklyWorkload.js";

interface EntryOptions {
  readonly id: string;
  readonly completedAt: string;
  readonly bowlingMinutes?: number;
  readonly fitnessMinutes?: number;
}

function createEntry(options: EntryOptions): TrainingJournalEntry {
  const plan = createSessionPlan({
    title: `Workload session ${options.id}`,
    scheduledFor: options.completedAt.slice(0, 10),
    drills: [
      {
        id: "bowling-block",
        name: "Bowling block",
        focus: "bowling",
        minutes: 20,
        intensity: "moderate",
      },
      {
        id: "fitness-block",
        name: "Fitness block",
        focus: "fitness",
        minutes: 20,
        intensity: "high",
      },
    ],
  });
  const drills = [
    ...(options.bowlingMinutes === undefined
      ? []
      : [
          {
            drillId: "bowling-block",
            completedMinutes: options.bowlingMinutes,
            perceivedEffort: 7,
          },
        ]),
    ...(options.fitnessMinutes === undefined
      ? []
      : [
          {
            drillId: "fitness-block",
            completedMinutes: options.fitnessMinutes,
            perceivedEffort: 8,
          },
        ]),
  ];

  return completeTrainingSession({
    entryId: options.id,
    plan,
    completedAt: options.completedAt,
    drills,
  });
}

test("summarizes explicit current and previous seven-day windows", () => {
  const entries = [
    createEntry({
      id: "previous-bowling",
      completedAt: "2026-09-01T08:00:00.000Z",
      bowlingMinutes: 20,
    }),
    createEntry({
      id: "previous-fitness",
      completedAt: "2026-09-07T08:00:00.000Z",
      fitnessMinutes: 10,
    }),
    createEntry({
      id: "current-bowling",
      completedAt: "2026-09-08T08:00:00.000Z",
      bowlingMinutes: 30,
    }),
    createEntry({
      id: "current-mixed",
      completedAt: "2026-09-10T08:00:00.000Z",
      bowlingMinutes: 10,
      fitnessMinutes: 20,
    }),
    createEntry({
      id: "current-missed",
      completedAt: "2026-09-14T08:00:00.000Z",
    }),
    createEntry({
      id: "outside-before",
      completedAt: "2026-08-31T08:00:00.000Z",
      bowlingMinutes: 20,
    }),
    createEntry({
      id: "outside-after",
      completedAt: "2026-09-15T08:00:00.000Z",
      bowlingMinutes: 20,
    }),
  ];

  const review = buildWeeklyWorkloadReview(entries, "2026-09-14");

  assert.equal(review.current.startDate, "2026-09-08");
  assert.equal(review.current.endDate, "2026-09-14");
  assert.equal(review.previous.startDate, "2026-09-01");
  assert.equal(review.previous.endDate, "2026-09-07");
  assert.equal(review.current.entryCount, 3);
  assert.equal(review.current.performedSessionCount, 2);
  assert.equal(review.current.missedSessionCount, 1);
  assert.equal(review.current.activeDays, 2);
  assert.equal(review.current.completedMinutes, 60);
  assert.equal(review.current.effortLoad, 440);
  assert.equal(review.current.averageEffort, 7.3);
  assert.deepEqual(review.current.focusMinutes, {
    batting: 0,
    bowling: 40,
    fielding: 0,
    fitness: 20,
    recovery: 0,
  });
  assert.deepEqual(review.current.intensityMinutes, {
    low: 0,
    moderate: 40,
    high: 20,
  });
  assert.deepEqual(review.current.focusRanking, [
    { category: "bowling", minutes: 40, sharePercentage: 67 },
    { category: "fitness", minutes: 20, sharePercentage: 33 },
  ]);
  assert.deepEqual(review.current.entryIds, [
    "current-missed",
    "current-mixed",
    "current-bowling",
  ]);

  assert.equal(review.previous.completedMinutes, 30);
  assert.equal(review.previous.effortLoad, 220);
  assert.deepEqual(review.comparison.completedMinutes, {
    current: 60,
    previous: 30,
    delta: 30,
    percentageChange: 100,
    trend: "increased",
  });
  assert.deepEqual(review.comparison.effortLoad, {
    current: 440,
    previous: 220,
    delta: 220,
    percentageChange: 100,
    trend: "increased",
  });
  assert.equal(review.comparison.performedSessions.trend, "unchanged");
  assert.equal(review.comparison.activeDays.trend, "unchanged");
  assert.ok(Object.isFrozen(review));
  assert.ok(Object.isFrozen(review.current));
  assert.ok(Object.isFrozen(review.current.focusRanking));
});

test("distinguishes started, decreased, and no-activity comparisons", () => {
  const started = buildWeeklyWorkloadReview(
    [
      createEntry({
        id: "first-current-session",
        completedAt: "2026-09-10T08:00:00.000Z",
        bowlingMinutes: 15,
      }),
    ],
    "2026-09-14",
  );
  assert.equal(started.comparison.completedMinutes.trend, "started");
  assert.equal(started.comparison.completedMinutes.percentageChange, null);

  const decreased = buildWeeklyWorkloadReview(
    [
      createEntry({
        id: "previous-only-session",
        completedAt: "2026-09-04T08:00:00.000Z",
        bowlingMinutes: 20,
      }),
    ],
    "2026-09-14",
  );
  assert.equal(decreased.comparison.completedMinutes.trend, "decreased");
  assert.equal(decreased.comparison.completedMinutes.percentageChange, -100);

  const empty = buildWeeklyWorkloadReview([], "2026-09-14");
  assert.equal(empty.comparison.completedMinutes.trend, "no-activity");
  assert.equal(empty.current.averageEffort, null);
  assert.deepEqual(empty.current.focusRanking, []);
});

test("deduplicates entry identifiers before assigning a week", () => {
  const older = createEntry({
    id: "corrected-session",
    completedAt: "2026-09-04T08:00:00.000Z",
    bowlingMinutes: 20,
  });
  const newer = createEntry({
    id: "corrected-session",
    completedAt: "2026-09-10T08:00:00.000Z",
    bowlingMinutes: 12,
  });
  const input = [older, newer];

  const review = buildWeeklyWorkloadReview(input, "2026-09-14");

  assert.equal(review.current.completedMinutes, 12);
  assert.equal(review.previous.completedMinutes, 0);
  assert.deepEqual(review.current.entryIds, ["corrected-session"]);
  assert.deepEqual(input, [older, newer]);
});

test("rejects malformed and impossible week-ending dates", () => {
  assert.throws(
    () => buildWeeklyWorkloadReview([], "14-09-2026"),
    (error: unknown) =>
      error instanceof WeeklyWorkloadValidationError &&
      error.field === "weekEnding" &&
      /ISO calendar/.test(error.message),
  );
  assert.throws(
    () => buildWeeklyWorkloadReview([], "2026-09-31"),
    (error: unknown) =>
      error instanceof WeeklyWorkloadValidationError &&
      /real calendar/.test(error.message),
  );
});
